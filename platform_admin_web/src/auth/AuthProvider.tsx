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
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { resetStores } from '../data/store';
import { readStoredLocale, useI18n } from '../i18n/I18nProvider';
import { reconcileLanguage } from '../i18n/reconcile';
import { isLanguagePending, saveLanguage } from '../i18n/saveLanguage';
import { evaluateAccess, type AccessDenialReason, type AdminProfile } from './access';

export type AccessNotice = AccessDenialReason | 'error';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; notice: AccessNotice | null }
  | { status: 'authorized'; profile: AdminProfile };

interface AuthContextValue {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setLocale } = useI18n();
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  // Why the last sign-in was rejected; shown on the login page once the
  // forced sign-out completes.
  const noticeRef = useRef<AccessNotice | null>(null);
  const runRef = useRef(0);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      const run = ++runRef.current;
      if (!user) {
        resetStores();
        setState({ status: 'signedOut', notice: noticeRef.current });
        return;
      }
      setState({ status: 'loading' });
      void (async () => {
        let notice: AccessNotice;
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          const decision = evaluateAccess(
            user.uid,
            snap.exists() ? (snap.data() as Record<string, unknown>) : undefined,
          );
          if (run !== runRef.current) return;
          if (decision.ok) {
            noticeRef.current = null;
            setState({ status: 'authorized', profile: decision.profile });
            // The account's language wins; else this browser's choice is
            // saved to the account. Nothing was read before sign-in.
            const plan = reconcileLanguage(
              decision.profile.language,
              readStoredLocale(),
              isLanguagePending(),
            );
            if (plan.adopt) setLocale(plan.adopt);
            else if (plan.push) void saveLanguage(decision.profile.uid, plan.push);
            return;
          }
          notice = decision.reason;
        } catch {
          if (run !== runRef.current) return;
          notice = 'error';
        }
        // Not an admin (or could not be verified): refuse access and sign the
        // session out. The resulting signed-out callback shows the notice.
        noticeRef.current = notice;
        await firebaseSignOut(auth);
      })();
    });
  }, [setLocale]);

  const signIn = useCallback(async (email: string, password: string) => {
    noticeRef.current = null;
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signOut = useCallback(async () => {
    noticeRef.current = null;
    resetStores();
    await firebaseSignOut(auth);
  }, []);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
