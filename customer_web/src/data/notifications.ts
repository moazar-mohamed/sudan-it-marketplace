import { deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { AppNotification } from './types';
import { t } from '../i18n';

// Port of notification_format.dart: the words come only from the type and the
// product name, so nothing a sender wrote is ever shown.

type Text = { title: string; body: (name: string) => string; nameless?: string };

const TEXTS: Record<string, Text> = {
  payment_confirmed: { title: t('تم تأكيد الدفع'), body: (n) => t('تم تأكيد دفعتك لـ "{0}".', n) },
  out_for_delivery: { title: t('طلبك في الطريق إليك'), body: (n) => t('طلبك "{0}" في الطريق إليك.', n) },
  order_completed: { title: t('اكتمل الطلب'), body: () => t('تم إكمال طلبك'), nameless: t('تم إكمال طلبك') },
  review_reply: { title: t('ردّت الشركة على تقييمك'), body: (n) => t('ردّت الشركة على تقييمك لـ«{0}».', n) },
  service_request_accepted: { title: t('تم قبول طلبك'), body: (n) => t('تم قبول طلبك للخدمة «{0}».', n) },
  service_request_rejected: { title: t('تم رفض طلبك'), body: (n) => t('تم رفض طلبك للخدمة «{0}».', n) },
  service_request_in_progress: { title: t('بدأ تنفيذ طلبك'), body: (n) => t('بدأ تنفيذ طلبك للخدمة «{0}».', n) },
  service_request_completed: { title: t('اكتمل طلبك'), body: (n) => t('تم إكمال طلبك للخدمة «{0}».', n) },
  report_in_progress: { title: t('بلاغك قيد المعالجة'), body: (n) => t('بدأنا العمل على «{0}».', n) },
  report_closed: { title: t('تم إغلاق بلاغك'), body: (n) => t('تم إغلاق بلاغك «{0}». افتح «بلاغاتي» لقراءة ردّنا.', n) },
  order_cancelled_by_admin: { title: t('تم إلغاء طلبك'), body: (n) => t('ألغت المنصة طلبك «{0}».', n) },
  order_cancelled_by_company: { title: t('تم إلغاء طلبك'), body: (n) => t('ألغت الشركة طلبك «{0}». افتحه لمعرفة السبب.', n) },
  order_technician_assigned: {
    title: t('أرسلت الشركة فنيًا لطلبك'),
    body: (n) => t('أُسند فني لطلبك «{0}». يمكنك مراسلته من صفحة الطلب.', n),
  },
};

/** The picture and colour a notification's row shows: what kind of news it is. */
export type NotificationKind = { icon: 'box' | 'wrench' | 'flag' | 'chat' | 'user' | 'bell'; tone: 'ok' | 'bad' | 'info' };

export function notificationKind(n: AppNotification): NotificationKind {
  if (n.type.includes('cancelled') || n.type.endsWith('_rejected')) return { icon: n.serviceRequestId ? 'wrench' : 'box', tone: 'bad' };
  if (n.type.startsWith('report_')) return { icon: 'flag', tone: 'info' };
  if (n.type === 'review_reply') return { icon: 'chat', tone: 'info' };
  if (n.type === 'order_technician_assigned') return { icon: 'user', tone: 'info' };
  const done = n.type.endsWith('_completed') || n.type === 'payment_confirmed' || n.type.endsWith('_accepted');
  if (n.serviceRequestId) return { icon: 'wrench', tone: done ? 'ok' : 'info' };
  if (n.orderId) return { icon: 'box', tone: done ? 'ok' : 'info' };
  return { icon: 'bell', tone: 'info' };
}

/** Splits newest-first notifications into today's and the earlier ones. */
export function splitByDay<T extends { createdAt: Date }>(items: readonly T[], now: Date = new Date()): { today: T[]; earlier: T[] } {
  const sameDay = (d: Date) =>
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return { today: items.filter((i) => sameDay(i.createdAt)), earlier: items.filter((i) => !sameDay(i.createdAt)) };
}

const GENERIC_TITLE = t('إشعار');
const GENERIC_BODY = t('يوجد تحديث على أحد طلباتك.');

export const notificationTitle = (n: AppNotification): string => TEXTS[n.type]?.title ?? GENERIC_TITLE;

export function notificationBody(n: AppNotification): string {
  const text = TEXTS[n.type];
  const name = n.productName.trim();
  if (!text) return GENERIC_BODY;
  return name ? text.body(name) : text.nameless ?? GENERIC_BODY;
}

/** Where a notification leads; null for one that opens nothing. */
export function notificationTarget(n: AppNotification): string | null {
  if (n.reportId) return '/reports';
  if (n.serviceRequestId) return `/requests/${n.serviceRequestId}`;
  if (n.orderId) return `/orders/${n.orderId}`;
  return null;
}

export const markNotificationRead = (id: string): Promise<void> =>
  updateDoc(doc(db, 'notifications', id), { isRead: true });

/** Marks every given notification read in one write (at most 500 at a time). */
export async function markAllNotificationsRead(ids: readonly string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 500) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + 500)) batch.update(doc(db, 'notifications', id), { isRead: true });
    await batch.commit();
  }
}

export const deleteNotification =(id: string): Promise<void> => deleteDoc(doc(db, 'notifications', id));
