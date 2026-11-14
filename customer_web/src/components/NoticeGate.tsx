import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth';
import { formatDateTime } from '../data/format';
import {
  announcementIsFor,
  announcementKey,
  durationText,
  hasSchedule,
  loadDismissed,
  noticeText,
  saveDismissed,
  upcomingMaintenance,
  useNotices,
  useNow,
} from '../data/platformNotices';
import type { NoticeLink } from '../data/platformNotices';
import { Icon, PATHS } from './Icon';
import { t } from '../i18n';

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

const ExternalLink = ({ link }: { link: NoticeLink }) => (
  <a className="notice-link" href={link.url} target="_blank" rel="noreferrer noopener">{link.label}</a>
);

function Maintenance({ message, endsAt, now, link }: { message: string; endsAt: Date | null; now: Date; link: NoticeLink | null }) {
  const left = endsAt ? endsAt.getTime() - now.getTime() : 0;
  return (
    <div className="maintenance" role="alertdialog" aria-modal="true" aria-label={t('المنصة تحت الصيانة')}>
      <div className="login-card">
        <span className="maintenance-icon"><Icon d={PATHS.grid} size={34} /></span>
        <h1 className="auth-title">{t('المنصة تحت الصيانة')}</h1>
        <p className="prose">{message}</p>
        {endsAt && left > 0 ? (
          <>
            <strong>{t('العودة المتوقعة:')}{' '}<span dir="ltr">{formatDateTime(endsAt)}</span></strong>
            <p className="pmeta">{t('أي بعد نحو')}{' '}{durationText(left)}.</p>
          </>
        ) : (
          <p className="pmeta">{t('يرجى المحاولة مرة أخرى بعد قليل.')}</p>
        )}
        {link && <ExternalLink link={link} />}
      </div>
    </div>
  );
}

/**
 * The Platform Admin's notices around the whole site, before sign-in too. What is
 * underneath stays mounted, so a notice coming and going never loses what the
 * customer was doing.
 */
export function NoticeGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const notices = useNotices();
  const now = useNow(hasSchedule(notices));
  const online = useOnline();
  const [dismissed, setDismissed] = useState(loadDismissed);

  const maintenance = noticeText(notices.maintenance, now);
  const soon = upcomingMaintenance(notices.maintenance, now);
  const announcement = noticeText(notices.announcement, now);
  const key = announcementKey(notices);
  const showBanner = announcement !== null && announcementIsFor(notices, user !== null) && dismissed !== key;

  function dismiss() {
    saveDismissed(key);
    setDismissed(key);
  }

  return (
    <>
      <div inert={maintenance !== null}>
        {!online && <div className="notice-bar warning" role="status">{t('لا يوجد اتصال بالإنترنت. سيتحدّث الموقع عند عودته.')}</div>}
        {soon && (
          <div className="notice-bar warning" role="status">
            {t('صيانة مجدولة للمنصة بعد نحو')}{' '}{durationText(soon.getTime() - now.getTime())}{t('. أكمل ما تعمل عليه قبلها.')}
          </div>
        )}
        {showBanner && (
          <div className={`notice-bar ${notices.kind}`} role="status">
            <span className="grow">
              {announcement}
              {notices.announcement.link && <> <ExternalLink link={notices.announcement.link} /></>}
            </span>
            <button className="notice-close" aria-label={t('إغلاق')} onClick={dismiss}>✕</button>
          </div>
        )}
        {children}
      </div>
      {maintenance !== null && (
        <Maintenance message={maintenance} endsAt={notices.maintenance.endsAt} now={now} link={notices.maintenance.link} />
      )}
    </>
  );
}
