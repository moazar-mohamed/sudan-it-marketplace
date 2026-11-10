// Where a visitor goes back to after signing in: the page that asked for the
// account (checkout, a chat, favourites), carried in `?next=`.

const SIGN_IN_PAGES = ['/login', '/register', '/forgot-password'];

/** A path on this site only (never another site, never a sign-in page); '/' otherwise. */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  const path = raw.split(/[?#]/)[0];
  if (SIGN_IN_PAGES.includes(path)) return '/';
  return raw;
}

/** [page] ('/login', '/register'...) that comes back to [next] afterwards. */
export function withNext(page: string, next: string | null | undefined): string {
  const back = safeNext(next);
  return back === '/' ? page : `${page}?next=${encodeURIComponent(back)}`;
}

/** The sign-in page that comes back to [next] afterwards. */
export const loginPath = (next: string | null | undefined): string => withNext('/login', next);
