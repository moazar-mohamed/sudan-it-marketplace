import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { useCatalog } from '../data/DataProvider';
import { loginPath, safeNext } from '../data/nextPath';

/**
 * The pages that need an account (checkout, orders, chats...). A visitor who
 * opens one signs in first and then comes back to it, with its query, so a
 * checkout keeps its product and quantity.
 */
export function RequireAccount() {
  const { profile } = useCatalog();
  const { pathname, search } = useLocation();
  if (!profile) return <Navigate to={loginPath(pathname + search)} replace />;
  return <Outlet />;
}

/** The sign-in pages, for visitors only: once signed in, back to `?next=`. */
export function SignedOutOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  if (user) return <Navigate to={safeNext(params.get('next'))} replace />;
  return <>{children}</>;
}

/** For a button that needs an account: a visitor is sent to sign in and back here. */
export function useAskToSignIn(): () => void {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  return useCallback(() => navigate(loginPath(pathname + search)), [navigate, pathname, search]);
}
