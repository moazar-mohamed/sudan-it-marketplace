import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCatalog } from '../data/DataProvider';
import { markNotificationRead, notificationBody, notificationKind, notificationTarget, notificationTitle } from '../data/notifications';
import type { AppNotification } from '../data/types';
import { t } from '../i18n';
import { Icon, PATHS } from './Icon';

/** How long a toast stays when nobody touches it. */
const SHOWN_MS = 7000;

/**
 * The ids in [now] that were not in [seen] and arrived within the last two
 * minutes, newest first: what deserves a toast. The first list a page reads
 * only fills [seen] (the caller passes null then), so old news never pops up.
 */
export function freshArrivals(seen: ReadonlySet<string> | null, now: readonly AppNotification[], at: number = Date.now()): AppNotification[] {
  if (!seen) return [];
  return now.filter((n) => !seen.has(n.id) && !n.isRead && at - n.createdAt.getTime() < 120_000);
}

/** A small card at the bottom of the page when a notification arrives while the site is open. */
export function NoticeToast() {
  const { notifications } = useCatalog();
  const seen = useRef<Set<string> | null>(null);
  const [shown, setShown] = useState<AppNotification | null>(null);
  const { pathname } = useLocation();
  const nav = useNavigate();

  useEffect(() => {
    if (!notifications) return;
    const fresh = freshArrivals(seen.current, notifications);
    seen.current = new Set(notifications.map((n) => n.id));
    // On the notifications page the new row is already in front of the reader.
    if (fresh.length > 0 && pathname !== '/notifications') setShown(fresh[0]);
  }, [notifications, pathname]);

  useEffect(() => {
    if (!shown) return;
    const timer = window.setTimeout(() => setShown(null), SHOWN_MS);
    return () => window.clearTimeout(timer);
  }, [shown]);

  if (!shown) return null;
  const kind = notificationKind(shown);
  const target = notificationTarget(shown) ?? '/notifications';

  return (
    <div className="note-toast" role="status" aria-live="polite">
      <span className={`note-ico ${kind.tone}`} aria-hidden="true">
        <Icon d={PATHS[kind.icon]} size={18} />
      </span>
      <button
        className="note-open"
        onClick={() => {
          void markNotificationRead(shown.id).catch(() => undefined);
          setShown(null);
          nav(target);
        }}
      >
        <strong>{notificationTitle(shown)}</strong>
        <span>{notificationBody(shown)}</span>
      </button>
      <button className="link-btn" aria-label={t('إغلاق')} onClick={() => setShown(null)}>✕</button>
    </div>
  );
}
