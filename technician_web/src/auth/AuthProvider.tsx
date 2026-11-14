import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { turnPushOff } from '../data/webPush';
import { t } from '../i18n';

export interface Profile {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  companyId: string;
  mustChangePassword: boolean;
  pushPrefs: Record<string, boolean>;
}

export type AccessNotice = 'not_found' | 'not_technician' | 'inactive' | 'error';

type State =
  | { status: 'loading' }
  | { status: 'signedOut'; notice: AccessNotice | null }
  | { status: 'authorized'; profile: Profile };

interface AuthValue {
  state: State;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Choose a new password; on the first sign-in it also clears the profile's mustChangePassword flag. */
  changePassword: (current: string | null, next: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Keeps the profile in step after a write made elsewhere (push choices). */
  patchProfile: (changes: Partial<Profile>) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Only a signed-in, active technician with a company gets in. This is a UX
 * gate: the Firestore rules are the real enforcement.
 */
export function evaluateAccess(
  uid: string,
  data: Record<string, unknown> | undefined,
): { ok: true; profile: Profile } | { ok: false; reason: AccessNotice } {
  if (!data) return { ok: false, reason: 'not_found' };
  if (data.role !== 'technician' || typeof data.companyId !== 'string' || data.companyId === '') {
    return { ok: false, reason: 'not_technician' };
  }
  if (data.isActive === false || data.deactivated === true) return { ok: false, reason: 'inactive' };
  const prefs = data.pushPrefs && typeof data.pushPrefs === 'object' ? (data.pushPrefs as Record<string, unknown>) : {};
  return {
    ok: true,
    profile: {
      uid,
      fullName: typeof data.fullName === 'string' ? data.fullName : '',
      email: typeof data.email === 'string' ? data.email : '',
      phone: typeof data.phone === 'string' ? data.phone : '',
      companyId: data.companyId,
      mustChangePassword: data.mustChangePassword === true,
      pushPrefs: Object.fromEntries(Object.entries(prefs).filter(([, v]) => typeof v === 'boolean')) as Record<string, boolean>,
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const noticeRef = useRef<AccessNotice | null>(null);
  const runRef = useRef(0);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      const run = ++runRef.current;
      if (!user) {
        setState({ status: 'signedOut', notice: noticeRef.current });
        return;
      }
      setState({ status: 'loading' });
      void (async () => {
        let notice: AccessNotice;
        try {
          // Offline, the copy kept on the device answers, so a technician already signed in still gets in.
          const snap = await getDoc(doc(db, 'users', user.uid));
          const decision = evaluateAccess(user.uid, snap.exists() ? snap.data() : undefined);
          if (run !== runRef.current) return;
          if (decision.ok) {
            noticeRef.current = null;
            setState({ status: 'authorized', profile: decision.profile });
            return;
          }
          notice = decision.reason;
        } catch {
          if (run !== runRef.current) return;
          notice = 'error';
        }
        noticeRef.current = notice;
        await firebaseSignOut(auth);
      })();
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    noticeRef.current = null;
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signOut = useCallback(async () => {
    noticeRef.current = null;
    // This browser stops getting the technician's pushes (best effort).
    const uid = auth.currentUser?.uid ?? null;
    await turnPushOff(uid).catch(() => undefined);
    await firebaseSignOut(auth);
  }, []);

  const changePassword = useCallback(async (current: string | null, next: string) => {
    const user = auth.currentUser;
    if (!user?.email) throw Object.assign(new Error('no user'), { code: 'auth/no-current-user' });
    // Right after the first sign-in no re-check is needed; from the profile the current password is checked first.
    if (current !== null) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
    await updatePassword(user, next);
    let mustChange = false;
    setState((now) => {
      if (now.status !== 'authorized') return now;
      mustChange = now.profile.mustChangePassword;
      return { status: 'authorized', profile: { ...now.profile, mustChangePassword: false } };
    });
    if (mustChange) {
      await updateDoc(doc(db, 'users', user.uid), { mustChangePassword: false, updatedAt: serverTimestamp() }).catch(() => undefined);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    // The e-mail's link brings the technician back to this portal.
    const url = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
    await sendPasswordResetEmail(auth, email.trim(), url ? { url } : undefined);
  }, []);

  const patchProfile = useCallback((changes: Partial<Profile>) => {
    setState((now) => (now.status === 'authorized' ? { status: 'authorized', profile: { ...now.profile, ...changes } } : now));
  }, []);

  const value = useMemo(
    () => ({ state, signIn, signOut, changePassword, resetPassword, patchProfile }),
    [state, signIn, signOut, changePassword, resetPassword, patchProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function useProfile(): Profile {
  const { state } = useAuth();
  if (state.status !== 'authorized') throw new Error('useProfile needs a signed-in technician');
  return state.profile;
}

export const noticeText = (notice: AccessNotice): string =>
  ({
    not_found: t('هذا الحساب غير مسجَّل في المنصة.'),
    not_technician: t('هذه الصفحة للفنيين فقط. إن كنت عميلًا فتسوّق في sictm.net، وإن كنت مدير شركة فادخل من company.sictm.net.'),
    inactive: t('حسابك موقوف. تواصل مع شركتك.'),
    error: t('تعذّر التحقق من الحساب. تأكد من الاتصال وحاول مرة أخرى.'),
  })[notice];

/** Firebase Authentication's own minimum, the same as the app (PasswordChangeStrings.minLength). */
export const MIN_PASSWORD_LENGTH = 6;

export function authErrorText(error: unknown): string {
  switch ((error as { code?: string } | null)?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return t('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    case 'auth/too-many-requests':
      return t('محاولات كثيرة. انتظر قليلًا ثم حاول من جديد.');
    case 'auth/network-request-failed':
      return t('لا يوجد اتصال بالإنترنت.');
    case 'auth/weak-password':
      return t('كلمة المرور ضعيفة: اختر 6 أحرف على الأقل.');
    case 'auth/requires-recent-login':
      return t('سجّل الدخول من جديد ثم أعد المحاولة.');
    default:
      return t('تعذّرت العملية، حاول مرة أخرى.');
  }
}
