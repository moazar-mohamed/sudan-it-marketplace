import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { t } from '../i18n';

/** The long public pages that get the button (not the account pages, not the chats). */
const LONG_PAGES = [/^\/$/, /^\/browse/, /^\/category\//, /^\/search/, /^\/companies$/, /^\/company\//, /^\/product\//, /^\/terms/];

export const hasBackToTop = (pathname: string) => LONG_PAGES.some((page) => page.test(pathname));

/**
 * Whether the button shows, given the scroll position: never in the first
 * screen and a half; while reading on it stays out of the way (hidden on the
 * way down), and it comes back on the way up and near the end of the page.
 */
export function nextVisible(was: boolean, y: number, lastY: number, viewport: number, max: number): boolean {
  if (y < viewport * 1.5) return false;
  if (max > 0 && y >= max - viewport * 0.5) return true;
  if (y < lastY - 4) return true;
  if (y > lastY + 4) return false;
  return was;
}

/** The modern "back to top" button: a round button with a ring that fills as the page is read. */
export function BackToTop() {
  const { pathname } = useLocation();
  const enabled = hasBackToTop(pathname);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setVisible(false);
    if (!enabled) return;
    let lastY = window.scrollY;
    let shown = false;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      shown = nextVisible(shown, y, lastY, window.innerHeight, max);
      lastY = y;
      setVisible(shown);
      setProgress(max > 0 ? Math.min(1, Math.max(0, y / max)) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled, pathname]);

  if (!enabled) return null;
  const toTop = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };
  const radius = 22;
  const length = 2 * Math.PI * radius;
  return (
    <button
      type="button"
      className={`to-top${visible ? ' on' : ''}`}
      onClick={toTop}
      aria-label={t('العودة إلى أعلى الصفحة')}
      title={t('العودة إلى أعلى الصفحة')}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
    >
      <svg className="to-top-ring" viewBox="0 0 48 48" aria-hidden="true">
        <circle className="track" cx="24" cy="24" r={radius} />
        <circle className="fill" cx="24" cy="24" r={radius} strokeDasharray={length} strokeDashoffset={length * (1 - progress)} />
      </svg>
      <svg className="to-top-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M12 19V5 M6 11l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
