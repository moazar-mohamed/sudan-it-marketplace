// The words of each push, in the recipient's language. They mirror the
// notif* strings in lib/l10n/app_en.arb / app_ar.arb, so a push reads exactly
// like the same notification inside the app.

const ORDER_TEXTS = {
  new_order: {
    en: ['New order received', (p) => `A new order for "${p}" was placed and is awaiting payment verification.`],
    ar: ['تم استلام طلب جديد', (p) => `تم إنشاء طلب جديد لـ "${p}" وهو بانتظار التحقق من الدفع.`],
  },
  payment_confirmed: {
    en: ['Payment confirmed', (p) => `Your payment for "${p}" has been confirmed.`],
    ar: ['تم تأكيد الدفع', (p) => `تم تأكيد دفعتك لـ "${p}".`],
  },
  out_for_delivery: {
    en: ['Order out for delivery', (p) => `Your order "${p}" is out for delivery.`],
    ar: ['طلبك في الطريق إليك', (p) => `طلبك "${p}" في الطريق إليك.`],
  },
  order_completed: {
    en: ['Order completed', () => 'Your order has been completed.'],
    ar: ['اكتمل الطلب', () => 'تم إكمال طلبك'],
  },
  technician_assigned: {
    en: ['New installation job assigned', (p) => `You have been assigned to install "${p}".`],
    ar: ['تم تعيين مهمة تركيب جديدة', (p) => `تم تعيينك لتركيب "${p}".`],
  },
  new_review: {
    en: ['New rating', (p) => `A customer rated "${p}".`],
    ar: ['تقييم جديد', (p) => `قيّم عميل «${p}».`],
  },
  review_reply: {
    en: ['The company replied', (p) => `The company replied to your rating of "${p}".`],
    ar: ['ردّت الشركة على تقييمك', (p) => `ردّت الشركة على تقييمك لـ«${p}».`],
  },
  // Service requests: the quoted name is the service, not a product.
  new_service_request: {
    en: ['New service request', (p) => `A customer requested "${p}".`],
    ar: ['طلب خدمة جديد', (p) => `طلب عميل الخدمة «${p}».`],
  },
  service_request_accepted: {
    en: ['Request accepted', (p) => `Your request for "${p}" was accepted.`],
    ar: ['تم قبول طلبك', (p) => `تم قبول طلبك للخدمة «${p}».`],
  },
  service_request_rejected: {
    en: ['Request declined', (p) => `Your request for "${p}" was declined.`],
    ar: ['تم رفض طلبك', (p) => `تم رفض طلبك للخدمة «${p}».`],
  },
  service_request_in_progress: {
    en: ['Work has started', (p) => `Work has started on your request for "${p}".`],
    ar: ['بدأ تنفيذ طلبك', (p) => `بدأ تنفيذ طلبك للخدمة «${p}».`],
  },
  service_request_completed: {
    en: ['Request completed', (p) => `Your request for "${p}" has been completed.`],
    ar: ['اكتمل طلبك', (p) => `تم إكمال طلبك للخدمة «${p}».`],
  },
  service_request_cancelled: {
    en: ['Request cancelled', (p) => `A customer cancelled the request for "${p}".`],
    ar: ['تم إلغاء الطلب', (p) => `ألغى عميل طلبه للخدمة «${p}».`],
  },
  // Reports: the quoted name is the subject of the report. Written by Platform
  // Admin when it moves a report along (firestore.rules checks it is true).
  report_in_progress: {
    en: ['Your report is being handled', (p) => `We started working on "${p}".`],
    ar: ['بلاغك قيد المعالجة', (p) => `بدأنا العمل على «${p}».`],
  },
  report_closed: {
    en: ['Your report was closed', (p) => `Your report "${p}" was closed. Open My reports to read our reply.`],
    ar: ['تم إغلاق بلاغك', (p) => `تم إغلاق بلاغك «${p}». افتح «بلاغاتي» لقراءة ردّنا.`],
  },
};

const CHAT_TEXTS = {
  en: { customer: 'Customer', question: (s) => `Question: ${s}` },
  ar: { customer: 'عميل', question: (s) => `استفسار: ${s}` },
};

/** 'ar' or 'en'; anything else falls back to English, like the app. */
export function languageOf(user) {
  return user?.language === 'ar' ? 'ar' : 'en';
}

/** A product name is at most this long (firestore.rules). */
const MAX_PRODUCT_NAME = 200;

/**
 * Title and body of an order or service request notification, built only
 * from its type and its `productName` (the product of the order, or the name
 * of the service, which the security rules check). Nothing a sender wrote is
 * ever used: any stored `title` or `body` is ignored, and an unknown type, or
 * a type that needs a name and has none, gives null so nothing is pushed.

 */
export function orderNotificationText(notification, language) {
  const type = typeof notification?.type === 'string' ? notification.type : '';
  const texts = Object.hasOwn(ORDER_TEXTS, type) ? ORDER_TEXTS[type][language] : null;
  if (!texts) return null;
  const product =
    typeof notification.productName === 'string'
      ? notification.productName.trim().slice(0, MAX_PRODUCT_NAME)
      : '';
  if (!product && type !== 'order_completed') return null;
  return { title: texts[0], body: texts[1](product) };
}

const MAX_BODY = 180;

/**
 * A chat message as seen by the other side: "<who> · <what about>" and the
 * message itself (shortened).
 */
export function chatMessageText(chat, message, language) {
  const words = CHAT_TEXTS[language];
  const fromCustomer = message.senderRole === 'customer';
  const sender = fromCustomer
    ? (chat.customerName || '').trim() || words.customer
    : (chat.companyName || '').trim();
  const about = chat.productName || chat.serviceName || '';
  const isInquiry = !chat.orderId && !chat.serviceRequestId;
  const subject = about ? (isInquiry ? words.question(about) : about) : '';
  const text = (message.text ?? '').trim();
  return {
    title: subject ? `${sender} · ${subject}` : sender,
    body: text.length > MAX_BODY ? `${text.slice(0, MAX_BODY - 1)}…` : text,
  };
}
