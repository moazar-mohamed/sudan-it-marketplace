import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, Skeleton } from '../components/Bits';
import { Icon, PATHS } from '../components/Icon';
import { PushSwitch } from '../components/PushSettings';
import { PageTitle } from '../components/PageTitle';
import { useAccount, useCatalog } from '../data/DataProvider';
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  notificationBody,
  notificationKind,
  notificationTarget,
  notificationTitle,
  splitByDay,
} from '../data/notifications';
import type { AppNotification } from '../data/types';
import { t } from '../i18n';

function when(value: Date, today: boolean): string {
  const two = (n: number) => String(n).padStart(2, '0');
  const time = `${two(value.getHours())}:${two(value.getMinutes())}`;
  return today ? time : `${value.getFullYear()}-${two(value.getMonth() + 1)}-${two(value.getDate())} ${time}`;
}

export function NotificationsPage() {
  const nav = useNavigate();
  const { notifications, moreNotifications, showMoreNotifications } = useCatalog();
  const profile = useAccount();
  const [busy, setBusy] = useState(false);

  function open(n: AppNotification) {
    if (!n.isRead) void markNotificationRead(n.id).catch(() => undefined);
    const target = notificationTarget(n);
    if (target) nav(target);
  }

  function remove(n: AppNotification) {
    if (window.confirm(t('حذف هذا الإشعار؟ سيُحذف نهائياً.'))) void deleteNotification(n.id).catch(() => undefined);
  }

  const unread = notifications?.filter((n) => !n.isRead) ?? [];

  async function readAll() {
    setBusy(true);
    try {
      await markAllNotificationsRead(unread.map((n) => n.id));
    } catch {
      // The rows stay unread; nothing else to undo.
    } finally {
      setBusy(false);
    }
  }

  const row = (n: AppNotification, today: boolean) => {
    const kind = notificationKind(n);
    return (
      <div key={n.id} className={`note-row${n.isRead ? '' : ' unread'}`}>
        <span className={`note-ico ${kind.tone}`} aria-hidden="true">
          <Icon d={PATHS[kind.icon]} size={18} />
        </span>
        <button className="note-open" onClick={() => open(n)}>
          <strong>{notificationTitle(n)}</strong>
          <span>{notificationBody(n)}</span>
          <time className="pmeta" dir="ltr">{when(n.createdAt, today)}</time>
        </button>
        {!n.isRead && <span className="note-new">{t('جديد')}</span>}
        <button className="link-btn" aria-label={t('حذف الإشعار')} onClick={() => remove(n)}>✕</button>
      </div>
    );
  };

  const groups = notifications ? splitByDay(notifications) : null;

  return (
    <main className="stack narrow">
      <PageTitle title={t('الإشعارات')} />
      <div className="note-head">
        <h1 className="page-title">{t('الإشعارات')}</h1>
        {unread.length > 0 && (
          <button className="btn ghost sm" disabled={busy} onClick={() => void readAll()}>
            {t('تعليم الكل كمقروء ({0})', unread.length)}
          </button>
        )}
      </div>
      {/* Only while this browser can take pushes and does not yet. */}
      <PushSwitch profile={profile} compact />
      {notifications === null || groups === null ? (
        <Skeleton height={240} />
      ) : notifications.length === 0 ? (
        <EmptyState title={t('لا توجد إشعارات بعد.')} />
      ) : (
        <>
          {groups.today.length > 0 && (
            <>
              <h2 className="note-sec">{t('اليوم')}</h2>
              <section className="rows">{groups.today.map((n) => row(n, true))}</section>
            </>
          )}
          {groups.earlier.length > 0 && (
            <>
              <h2 className="note-sec">{t('سابقًا')}</h2>
              <section className="rows">{groups.earlier.map((n) => row(n, false))}</section>
            </>
          )}
          {moreNotifications && (
            <button className="btn ghost note-more" onClick={showMoreNotifications}>
              {t('عرض إشعارات أقدم')}
            </button>
          )}
        </>
      )}
    </main>
  );
}
