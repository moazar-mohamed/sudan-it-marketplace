import { useNavigate } from 'react-router-dom';
import { EmptyState, Skeleton } from '../components/Bits';
import { PushSwitch } from '../components/PushSettings';
import { useCatalog } from '../data/DataProvider';
import {
  deleteNotification,
  markNotificationRead,
  notificationBody,
  notificationTarget,
  notificationTitle,
} from '../data/notifications';
import type { AppNotification } from '../data/types';
import { t } from '../i18n';

function when(value: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${two(value.getMonth() + 1)}-${two(value.getDate())} ${two(value.getHours())}:${two(value.getMinutes())}`;
}

export function NotificationsPage() {
  const nav = useNavigate();
  const { notifications, profile } = useCatalog();

  function open(n: AppNotification) {
    if (!n.isRead) void markNotificationRead(n.id).catch(() => undefined);
    const target = notificationTarget(n);
    if (target) nav(target);
  }

  function remove(n: AppNotification) {
    if (window.confirm(t('حذف هذا الإشعار؟ سيُحذف نهائياً.'))) void deleteNotification(n.id).catch(() => undefined);
  }

  return (
    <main className="stack narrow">
      <h1 className="page-title">{t('الإشعارات')}</h1>
      {/* Only while this browser can take pushes and does not yet. */}
      <PushSwitch profile={profile} compact />
      {notifications === null ? (
        <Skeleton height={240} />
      ) : notifications.length === 0 ? (
        <EmptyState title={t('لا توجد إشعارات بعد.')} />
      ) : (
        <section className="rows">
          {notifications.map((n) => (
            <div key={n.id} className={`note-row${n.isRead ? '' : ' unread'}`}>
              <button className="note-open" onClick={() => open(n)}>
                <strong>{notificationTitle(n)}</strong>
                <span>{notificationBody(n)}</span>
                <time className="pmeta" dir="ltr">{when(n.createdAt)}</time>
              </button>
              <button className="link-btn" aria-label={t('حذف الإشعار')} onClick={() => remove(n)}>✕</button>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
