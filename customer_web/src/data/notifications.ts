import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
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
};

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

export const deleteNotification = (id: string): Promise<void> => deleteDoc(doc(db, 'notifications', id));
