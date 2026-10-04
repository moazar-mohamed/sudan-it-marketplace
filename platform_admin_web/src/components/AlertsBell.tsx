import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { attentionCounts } from '../data/attention';
import { attentionItems, attentionTotal } from '../data/attentionItems';
import { useNewReports } from '../data/hooks';
import { useDashboard } from '../data/useDashboard';
import { useI18n } from '../i18n/I18nProvider';
import { Icon } from './Icon';

/**
 * The bell in the top bar: how many records need attention (the dashboard's
 * own rules), and a list of them that links to the rows. Under it, what is
 * only waiting for someone else (a company to answer, a payment to confirm).
 */
export function AlertsBell() {
  const { t, number, dateTime } = useI18n();
  const { snapshot, refreshing, refresh } = useDashboard();
  const [open, setOpen] = useState(false);
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
  const total = reportCount > 0 ? (attentionTotal(found) ?? 0) + reportCount : attentionTotal(found);
  const items = attentionItems(found, t).filter((i) => i.count);

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
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={total ? t('alerts.open', { count: number(total) }) : t('alerts.title')}
        title={t('alerts.title')}
      >
        <Icon name="bell" size={18} />
        {total ? <span className="bell__badge">{total > 99 ? '99+' : number(total)}</span> : null}
      </button>
      {open && (
        <div className="bell__panel" role="dialog" aria-label={t('alerts.title')}>
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
            <button className="btn btn--sm" onClick={() => void refresh()} disabled={refreshing}>
              {t('dashboard.refresh')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
