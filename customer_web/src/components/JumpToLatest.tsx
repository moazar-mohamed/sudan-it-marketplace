import { useEffect, useRef, useState, type RefObject } from 'react';
import { t } from '../i18n';

/** How far from the newest message counts as "reading older ones": about one screen of the box. */
const awayFrom = (el: HTMLElement) => el.scrollHeight - el.scrollTop - el.clientHeight > el.clientHeight * 0.8;

/**
 * How many of [items] came after [previousLast] and were written by the other
 * person: the new messages someone reading older ones has not seen yet.
 */
export function freshFromOthers(items: { id: string; mine: boolean }[], previousLast: string): number {
  if (!previousLast) return 0;
  const at = items.map((m) => m.id).lastIndexOf(previousLast);
  if (at < 0) return 0;
  return items.slice(at + 1).filter((m) => !m.mine).length;
}

/**
 * The chat's "jump to the latest" button: shown once the reader has scrolled up
 * about a screen, with the number of messages that arrived meanwhile. Call
 * `onScroll` from the message box's own scroll handler.
 */
export function useJumpToLatest(box: RefObject<HTMLElement | null>, items: { id: string; mine: boolean }[]) {
  const [away, setAway] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const last = useRef('');

  useEffect(() => {
    const newest = items[items.length - 1]?.id ?? '';
    const el = box.current;
    if (newest !== last.current && el && awayFrom(el)) {
      const fresh = freshFromOthers(items, last.current);
      if (fresh > 0) setUnseen((n) => n + fresh);
    }
    last.current = newest;
  }, [items, box]);

  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    setAway(awayFrom(el));
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) setUnseen(0);
  };

  const jump = () => {
    const el = box.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
    setUnseen(0);
  };

  return { show: away, unseen, onScroll, jump };
}

/** Sits at the bottom of the scrolling message box (sticky, taking no room). */
export function JumpToLatest({ show, unseen, onJump }: { show: boolean; unseen: number; onJump: () => void }) {
  const label = unseen > 0 ? t('{0} رسائل جديدة — الانتقال إلى آخر الرسائل', unseen) : t('الانتقال إلى آخر الرسائل');
  return (
    <div className="jump-latest-anchor">
      <button
        type="button"
        className={`jump-latest${show ? ' on' : ''}`}
        onClick={onJump}
        aria-label={label}
        title={label}
        tabIndex={show ? 0 : -1}
        aria-hidden={!show}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M12 5v14 M6 13l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unseen > 0 && <span className="jump-count">{unseen > 99 ? '99+' : unseen}</span>}
      </button>
    </div>
  );
}
