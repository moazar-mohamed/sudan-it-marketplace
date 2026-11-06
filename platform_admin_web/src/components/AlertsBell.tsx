import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { attentionCounts } from '../data/attention';
import { attentionItems } from '../data/attentionItems';
import { useNewReports } from '../data/hooks';
import { markPlatformNoticeRead, markPlatformNoticesRead, platformNoticeTarget, usePlatformNotices } from '../data/platformNotices';
import { useDashboard } from '../data/useDashboard';
import { useI18n } from '../i18n/I18nProvider';
import { Icon } from './Icon';

const SEEN_KEY = 'platform_admin_alerts_seen';
/** Figures older than this are read again when the bell is opened (the free plan's read budget is small). */
const OPEN_STALE_MS = 60_000;

function readSeen(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}


/**
 * The bell in the top bar: how many records need attention (the dashboard's
 * own rules), and a list of them that links to the rows. Under it, what is
 * only waiting for someone else (a company to answer, a payment to confirm).
 */
export function AlertsBell() {
  const { t, number, dateTime } = useI18n();
  const { snapshot, refreshIfStale } = useDashboard();
  const [open, setOpen] = useState(false);
  // What the person has already looked at: the badge is for what is new since then.
  const [seen, setSeen] = useState(readSeen);
  const box = useRef<HTMLDivElement>(null);

  // Closes with Escape or a press outside.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onPress = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPress);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPress);
    };
  }, [open]);

  const newReports = useNewReports();
  const reportCount = newReports.status === 'ready' ? newReports.data.length : 0;
  const found = snapshot ? attentionCounts(snapshot) : null;
  const items = attentionItems(found, t).filter((i) => i.count);
  // What people told the admins (a new report, a low rating), newest first; the unread ones are listed.
  const notices = (usePlatformNotices() ?? []).filter((n) => !n.isRead);
  // New reports are already counted on their own; a low rating adds to the number.
  const lowRatings = notices.filter((n) => n.type === 'low_review').length;

  const current: Record<string, number> = {
    reports: reportCount,
    lowRatings,
    ...Object.fromEntries(items.map((i) => [i.key, i.count ?? 0])),
  };
  const unseen = Object.entries(current).reduce((sum, [key, count]) => sum + Math.max(0, count - (seen[key] ?? 0)), 0);
  const badgeCount = unseen;
  const markSeen = () => {
    setSeen(current);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(current));
    } catch {
      // The choice just won't persist.
    }
  };
  const toggleOpen = () => {
    if (!open) {
      markSeen();
      refreshIfStale?.(OPEN_STALE_MS);
    }
    setOpen((v) => !v);
  };

  const pending = snapshot?.pendingRequests;
  const open_ = snapshot?.openOrders;
  const waiting = [
    {
      key: 'requests',
      count: pending?.ok ? pending.value.length : null,
      label: t('alerts.pendingRequests'),
      to: '/service-requests',
    },
    {
      key: 'payments',
      count: open_?.ok ? open_.value.filter((o) => o.orderStatus === 'processing' && o.paymentStatus === 'pending_verification').length : null,
      label: t('alerts.unverifiedAny'),
      to: '/orders?status=processing',
    },
  ].filter((w) => w.count);

  return (
    <div className="bell" ref={box}>
      <button
        className="icon-btn bell__button"
        onClick={toggleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={badgeCount ? t('alerts.open', { count: number(badgeCount) }) : t('alerts.title')}
        title={t('alerts.title')}
      >
        <Icon name="bell" size={18} />
        {badgeCount ? <span className="bell__badge">{badgeCount > 99 ? '99+' : number(badgeCount)}</span> : null}
      </button>
      {open && (
        <div className="bell__panel" role="dialog" aria-label={t('alerts.title')}>
          {notices.length > 0 && (
            <>
              <div className="bell__head">
                <h2 className="bell__title">{t('alerts.notices')}</h2>
                <button type="button" className="link-btn" onClick={() => void markPlatformNoticesRead(notices.map((n) => n.id)).catch(() => undefined)}>
                  {t('alerts.markAllRead')}
                </button>
              </div>
              <ul className="bell__list">
                {notices.slice(0, 5).map((n) => (
                  <li key={n.id}>
                    <Link
                      to={platformNoticeTarget(n)}
                      className="bell__row"
                      onClick={() => {
                        void markPlatformNoticeRead(n.id).catch(() => undefined);
                        setOpen(false);
                      }}
                    >
                      <span className={`attention__dot attention__dot--${n.type === 'new_report' ? 'high' : 'medium'}`} aria-hidden="true" />
                      <span className="bell__label">
                        {t(n.type === 'new_report' ? 'alerts.notice.new_report' : 'alerts.notice.low_review', { name: n.name || '—' })}
                        {n.createdAt && <small className="muted"> · {dateTime(n.createdAt)}</small>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h2 className="bell__title">{t('attention.title')}</h2>
          {reportCount > 0 && (
            <ul className="bell__list">
              <li>
                <Link to="/reports" className="bell__row" onClick={() => setOpen(false)}>
                  <span className="attention__dot attention__dot--high" aria-hidden="true" />
                  <span className="attention__count">{number(reportCount)}</span>
                  <span className="bell__label">{t('alerts.newReportsRow')}</span>
                </Link>
              </li>
            </ul>
          )}
          {items.length === 0 && reportCount === 0 ? (
            <p className="muted bell__empty">{t('alerts.none')}</p>
          ) : items.length === 0 ? null : (
            <ul className="bell__list">
              {items.map((item) => (
                <li key={item.key}>
                  <Link to={item.to} className="bell__row" onClick={() => setOpen(false)}>
                    <span className={`attention__dot attention__dot--${item.severity}`} aria-hidden="true" />
                    <span className="attention__count">{number(item.count ?? 0)}</span>
                    <span className="bell__label">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {waiting.length > 0 && (
            <>
              <h2 className="bell__title">{t('alerts.waiting')}</h2>
              <ul className="bell__list">
                {waiting.map((w) => (
                  <li key={w.key}>
                    <Link to={w.to} className="bell__row" onClick={() => setOpen(false)}>
                      <span className="attention__count attention__count--zero">{number(w.count ?? 0)}</span>
                      <span className="bell__label">{w.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="bell__foot">
            <span className="muted">{snapshot ? t('alerts.updated', { time: dateTime(new Date(snapshot.at)) }) : t('common.loading')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
