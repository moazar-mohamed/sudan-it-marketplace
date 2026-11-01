import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { AppNotification } from './types';

// Port of notification_format.dart: the words come only from the type and the
// product name, so nothing a sender wrote is ever shown.

type Text = { title: string; body: (name: string) => string; nameless?: string };

const TEXTS: Record<string, Text> = {
  payment_confirmed: { title: 'تم تأكيد الدفع', body: (n) => `تم تأكيد دفعتك لـ "${n}".` },
  out_for_delivery: { title: 'طلبك في الطريق إليك', body: (n) => `طلبك "${n}" في الطريق إليك.` },
  order_completed: { title: 'اكتمل الطلب', body: () => 'تم إكمال طلبك', nameless: 'تم إكمال طلبك' },
  review_reply: { title: 'ردّت الشركة على تقييمك', body: (n) => `ردّت الشركة على تقييمك لـ«${n}».` },
  service_request_accepted: { title: 'تم قبول طلبك', body: (n) => `تم قبول طلبك للخدمة «${n}».` },
  service_request_rejected: { title: 'تم رفض طلبك', body: (n) => `تم رفض طلبك للخدمة «${n}».` },
  service_request_in_progress: { title: 'بدأ تنفيذ طلبك', body: (n) => `بدأ تنفيذ طلبك للخدمة «${n}».` },
  service_request_completed: { title: 'اكتمل طلبك', body: (n) => `تم إكمال طلبك للخدمة «${n}».` },
  report_in_progress: { title: 'بلاغك قيد المعالجة', body: (n) => `بدأنا العمل على «${n}».` },
  report_closed: { title: 'تم إغلاق بلاغك', body: (n) => `تم إغلاق بلاغك «${n}». افتح «بلاغاتي» لقراءة ردّنا.` },
  order_cancelled_by_admin: { title: 'تم إلغاء طلبك', body: (n) => `ألغت المنصة طلبك «${n}».` },
};

const GENERIC_TITLE = 'إشعار';
const GENERIC_BODY = 'يوجد تحديث على أحد طلباتك.';

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
