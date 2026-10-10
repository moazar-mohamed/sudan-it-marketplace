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
  // What Platform Admin did to an order or a product (written by it in the same
  // batch, and firestore.rules checks it is true): the quoted name is the
  // order's product, or the product itself.
  order_cancelled_by_admin: {
    en: ['Your order was cancelled', (p) => `The platform cancelled your order "${p}".`],
    ar: ['تم إلغاء طلبك', (p) => `ألغت المنصة طلبك «${p}».`],
  },
  order_cancelled_by_admin_company: {
    en: ['An order was cancelled', (p) => `The platform cancelled the order for "${p}".`],
    ar: ['تم إلغاء طلب', (p) => `ألغت المنصة الطلب الخاص بـ«${p}».`],
  },
  product_hidden: {
    en: ['A product was hidden', (p) => `"${p}" was hidden from customers. Open it to see why.`],
    ar: ['تم إخفاء منتج', (p) => `أُخفي «${p}» عن العملاء. افتحه لمعرفة السبب.`],
  },
  product_shown: {
    en: ['A product is visible again', (p) => `"${p}" is visible to customers again.`],
    ar: ['المنتج ظاهر من جديد', (p) => `أصبح «${p}» ظاهراً للعملاء من جديد.`],
  },
  // A customer's account turned into a company's: the quoted name is the company.
  account_converted_to_company: {
    en: ['Your account is now a company account', (p) => `"${p}" is ready. Sign in again to manage your company.`],
    ar: ['أصبح حسابك حساب شركة', (p) => `شركة «${p}» جاهزة. سجّل الدخول من جديد لإدارتها.`],
  },
};

// The kinds of phone notification a person can switch off (users/{uid}.pushPrefs,
// the same keys as the apps' Settings). A type that is not listed is always sent.
const CATEGORY_OF_TYPE = {
  new_order: 'orders',
  payment_confirmed: 'orders',
  out_for_delivery: 'orders',
  order_completed: 'orders',
  technician_assigned: 'orders',
  new_review: 'orders',
  review_reply: 'orders',
  order_cancelled_by_admin: 'orders',
  order_cancelled_by_admin_company: 'orders',
  new_service_request: 'serviceRequests',
  service_request_accepted: 'serviceRequests',
  service_request_rejected: 'serviceRequests',
  service_request_in_progress: 'serviceRequests',
  service_request_completed: 'serviceRequests',
  service_request_cancelled: 'serviceRequests',
  report_in_progress: 'reports',
  report_closed: 'reports',
  product_hidden: 'platform',
  product_shown: 'platform',
  account_converted_to_company: 'platform',
};

/** The switchable kind a notification type belongs to, or null. */
export function pushCategoryOf(type) {
  return typeof type === 'string' && Object.hasOwn(CATEGORY_OF_TYPE, type) ? CATEGORY_OF_TYPE[type] : null;
}

/** False only when [user] switched this kind of push off (everything is on until then). */
export function wantsPush(user, category) {
  if (!category) return true;
  const prefs = user?.pushPrefs;
  return !(prefs && typeof prefs === 'object' && prefs[category] === false);
}

const CHAT_TEXTS = {
  en: { customer: 'Customer', question: (s) => `Question: ${s}` },
  ar: { customer: 'عميل', question: (s) => `استفسار: ${s}` },
};

// The cities the app ships with, for a city whose name is not in
// platform_settings/cities (yet): the same names as the apps.
const BUILT_IN_CITIES = {
  khartoum: { ar: 'الخرطوم', en: 'Khartoum' },
  omdurman: { ar: 'أم درمان', en: 'Omdurman' },
  bahri: { ar: 'الخرطوم بحري', en: 'Khartoum Bahri' },
  port_sudan: { ar: 'بورتسودان', en: 'Port Sudan' },
  wad_madani: { ar: 'ود مدني', en: 'Wad Madani' },
  kassala: { ar: 'كسلا', en: 'Kassala' },
  gedaref: { ar: 'القضارف', en: 'Gedaref' },
  atbara: { ar: 'عطبرة', en: 'Atbara' },
  shendi: { ar: 'شندي', en: 'Shendi' },
  ed_damer: { ar: 'الدامر', en: 'Ed Damer' },
  berber: { ar: 'بربر', en: 'Berber' },
  dongola: { ar: 'دنقلا', en: 'Dongola' },
  wadi_halfa: { ar: 'وادي حلفا', en: 'Wadi Halfa' },
  el_obeid: { ar: 'الأبيض', en: 'El Obeid' },
  kosti: { ar: 'كوستي', en: 'Kosti' },
  rabak: { ar: 'ربك', en: 'Rabak' },
  ed_dueim: { ar: 'الدويم', en: 'Ed Dueim' },
  sennar: { ar: 'سنار', en: 'Sennar' },
  singa: { ar: 'سنجة', en: 'Singa' },
  ed_damazin: { ar: 'الدمازين', en: 'Ed Damazin' },
  nyala: { ar: 'نيالا', en: 'Nyala' },
  el_fasher: { ar: 'الفاشر', en: 'El Fasher' },
  el_geneina: { ar: 'الجنينة', en: 'El Geneina' },
  zalingei: { ar: 'زالنجي', en: 'Zalingei' },
  ed_daein: { ar: 'الضعين', en: 'Ed Daein' },
  kadugli: { ar: 'كادقلي', en: 'Kadugli' },
  al_fula: { ar: 'الفولة', en: 'Al Fula' },
  tokar: { ar: 'طوكر', en: 'Tokar' },
};

/** The topic the apps of the customers of [cityId] subscribe to, per language. */
export function cityTopic(cityId, language) {
  return `city_${cityId}_${language === 'ar' ? 'ar' : 'en'}`;
}

/** Name of a city in [language]: from the saved list, else the built-in one, else its id. */
export function cityName(cityId, language, savedItems = []) {
  const saved = Array.isArray(savedItems) ? savedItems.find((item) => item?.id === cityId) : null;
  const name = saved?.[language === 'ar' ? 'nameAr' : 'nameEn'];
  if (typeof name === 'string' && name.trim()) return name.trim();
  return BUILT_IN_CITIES[cityId]?.[language === 'ar' ? 'ar' : 'en'] ?? cityId;
}

const MAX_COMPANY_NAME = 120;

/**
 * "A company now serves your city", in [language], from the company's name
 * and the city's name only. Null when there is no company name to say.
 */
export function cityAnnouncementText(companyName, cityNameText, language) {
  const company = typeof companyName === 'string' ? companyName.trim().slice(0, MAX_COMPANY_NAME) : '';
  if (!company) return null;
  return language === 'ar'
    ? { title: 'شركة جديدة في مدينتك', body: `أصبحت «${company}» تخدم ${cityNameText}.` }
    : { title: 'A new company in your city', body: `"${company}" now serves ${cityNameText}.` };
}

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
