import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from './firebase';

interface AuthValue {
  user: User | null;
  /** False until Firebase has reported the first auth state. */
  ready: boolean;
  /** Re-reads [user] after it changed in place (a reload shows a verified e-mail). */
  refresh: () => void;
}

const AuthContext = createContext<AuthValue>({ user: null, ready: false, refresh: () => undefined });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ user: User | null; ready: boolean; tick: number }>({
    user: null,
    ready: false,
    tick: 0,
  });
  useEffect(
    () => onAuthStateChanged(auth, (user) => setState((s) => ({ user, ready: true, tick: s.tick + 1 }))),
    [],
  );
  const refresh = useCallback(() => setState((s) => ({ ...s, tick: s.tick + 1 })), []);
  const value = useMemo(() => ({ user: state.user, ready: state.ready, refresh }), [state, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
