import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { hasUnsavedInput, newerBuild, reloadOnce } from '../data/autoUpdate';

const CHECK_MS = 5 * 60 * 1000;

/**
 * Picks up a new version without asking: on the next move to another page, or on
 * coming back to the tab with nothing typed, so nobody loses what they wrote.
 */
export function AutoUpdate() {
  const { pathname } = useLocation();
  const pending = useRef<string | null>(null);
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (pathname !== lastPath.current && pending.current) reloadOnce(pending.current);
    lastPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    async function check() {
      pending.current ??= await newerBuild();
      if (pending.current && document.visibilityState === 'visible' && !hasUnsavedInput()) reloadOnce(pending.current);
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    // A page file of the old version is gone: only a fresh page can open it.
    const onStale = (e: Event) => {
      if (reloadOnce('stale-file')) e.preventDefault();
    };
    void check();
    const timer = window.setInterval(check, CHECK_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('vite:preloadError', onStale);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('vite:preloadError', onStale);
    };
  }, []);

  return null;
}
