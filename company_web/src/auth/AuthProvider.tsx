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
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export interface Profile {
  uid: string;
  fullName: string;
  email: string;
  companyId: string;
  mustChangePassword: boolean;
}

export type AccessNotice = 'not_found' | 'not_company' | 'inactive' | 'error';

type State =
  | { status: 'loading' }
  | { status: 'signedOut'; notice: AccessNotice | null }
  | { status: 'authorized'; profile: Profile };

interface AuthValue {
  state: State;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Choose a new password the first time in; clears the profile's mustChangePassword flag. */
  completePasswordChange: (current: string, next: string) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Only a signed-in, active company admin with a company gets in. This is a UX
 * gate: the Firestore rules are the real enforcement.
 */
export function evaluateAccess(
  uid: string,
  data: Record<string, unknown> | undefined,
): { ok: true; profile: Profile } | { ok: false; reason: AccessNotice } {
  if (!data) return { ok: false, reason: 'not_found' };
  if (data.role !== 'company_admin' || typeof data.companyId !== 'string' || data.companyId === '') {
    return { ok: false, reason: 'not_company' };
  }
  if (data.isActive !== true) return { ok: false, reason: 'inactive' };
  return {
    ok: true,
    profile: {
      uid,
      fullName: typeof data.fullName === 'string' ? data.fullName : '',
      email: typeof data.email === 'string' ? data.email : '',
      companyId: data.companyId,
      mustChangePassword: data.mustChangePassword === true,
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
    await firebaseSignOut(auth);
  }, []);

  const completePasswordChange = useCallback(async (current: string, next: string) => {
    const user = auth.currentUser;
    if (!user?.email) throw Object.assign(new Error('no user'), { code: 'auth/no-current-user' });
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
    await updatePassword(user, next);
    await updateDoc(doc(db, 'users', user.uid), { mustChangePassword: false, updatedAt: serverTimestamp() });
    setState((now) =>
      now.status === 'authorized' ? { status: 'authorized', profile: { ...now.profile, mustChangePassword: false } } : now,
    );
  }, []);

  const value = useMemo(() => ({ state, signIn, signOut, completePasswordChange }), [state, signIn, signOut, completePasswordChange]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export const noticeText: Record<AccessNotice, string> = {
  not_found: 'هذا الحساب غير مسجَّل في المنصة.',
  not_company: 'هذه اللوحة لمديري الشركات فقط. إن كنت مشرف المنصة فاستخدم لوحة المشرف.',
  inactive: 'حسابك موقوف. تواصل مع إدارة المنصة.',
  error: 'تعذّر التحقق من الحساب. تأكد من الاتصال وحاول مرة أخرى.',
};

/** Firebase Authentication's own minimum. */
export const MIN_PASSWORD_LENGTH = 6;

export function authErrorText(error: unknown): string {
  switch ((error as { code?: string } | null)?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    case 'auth/too-many-requests':
      return 'محاولات كثيرة. انتظر قليلًا ثم حاول من جديد.';
    case 'auth/network-request-failed':
      return 'لا يوجد اتصال بالإنترنت.';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة: اختر 6 أحرف على الأقل.';
    case 'auth/requires-recent-login':
      return 'سجّل الدخول من جديد ثم أعد المحاولة.';
    default:
      return 'تعذّرت العملية، حاول مرة أخرى.';
  }
}
