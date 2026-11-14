import type { DocumentData } from 'firebase/firestore';
import type {
  AppNotification,
  CatalogService,
  Category,
  ChatMessage,
  ChatRole,
  City,
  Company,
  CompanyService,
  Conversation,
  Favorite,
  OfferBadge,
  Order,
  OrderStatus,
  PaymentAccount,
  PickupPoint,
  Priced,
  Product,
  Report,
  Review,
  ServiceRequest,
  ServiceRequestStatus,
  UserProfile,
} from './types';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0);
const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && isFinite(v) ? v : null;

function toDate(v: unknown): Date | null {
  if (v && typeof v === 'object' && 'toDate' in v) {
    const fn = (v as { toDate: () => Date }).toDate;
    if (typeof fn === 'function') return fn.call(v);
  }
  return v instanceof Date ? v : null;
}

function offerBadge(v: unknown): OfferBadge | null {
  return v === 'discount' || v === 'special' || v === 'limited' ? v : null;
}

function pricing(d: DocumentData): Priced {
  return {
    price: numOrNull(d.price),
    offerPrice: numOrNull(d.offerPrice),
    offerEndsAt: toDate(d.offerEndsAt),
    offerBadge: offerBadge(d.offerBadge),
  };
}

export function mapCategory(id: string, d: DocumentData): Category {
  return {
    id,
    name: str(d.name),
    nameAr: str(d.nameAr),
    nameEn: str(d.nameEn),
    description: str(d.description),
    parentId: typeof d.parentId === 'string' && d.parentId ? d.parentId : null,
    sortOrder: typeof d.sortOrder === 'number' ? Math.trunc(d.sortOrder) : null,
    iconName: str(d.iconName),
    color: str(d.color),
    isActive: d.isActive === true,
    deletionPending: d.deletionPending === true,
  };
}

/** Anything but these three means active, as in the app (no stored status included). */
function companyStatus(v: unknown): string {
  return v === 'pending' || v === 'rejected' || v === 'inactive' ? v : 'active';
}

export function mapCompany(id: string, d: DocumentData): Company {
  return {
    id,
    name: str(d.name),
    rating: num(d.rating),
    reviewCount: num(d.reviewCount),
    logoUrl: str(d.logoUrl),
    description: str(d.description),
    city: str(d.city),
    address: str(d.address),
    ...geoPoint(d.latitude, d.longitude),
    phone: str(d.phone),
    status: companyStatus(d.status),
    serviceCityIds: Array.isArray(d.serviceCityIds)
      ? d.serviceCityIds.filter((x: unknown): x is string => typeof x === 'string' && x !== '')
      : [],
    pickupAddress: str(d.pickupAddress),
    pickupPoints: pickupPoints(d.pickupPoints),
  };
}

const MAX_PICKUP_POINTS = 5;

/** One bad entry never hides the rest. */
function pickupPoints(value: unknown): PickupPoint[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_PICKUP_POINTS).flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { name, address, latitude, longitude } = entry as Record<string, unknown>;
    const title = str(name).trim();
    if (title === '') return [];
    const point = geoPoint(latitude, longitude);
    return [{ name: title, address: str(address).trim(), ...point }];
  });
}

/** The accounts in `company_payment/{companyId}`: only signed-in customers may read them. */
export function paymentAccounts(value: unknown): PaymentAccount[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { bankName, accountName, accountNumber, phoneNumber } = entry as Record<string, unknown>;
    const account = {
      bankName: str(bankName).trim(),
      accountName: str(accountName).trim(),
      accountNumber: str(accountNumber).trim(),
      phoneNumber: str(phoneNumber).trim(),
    };
    return account.bankName && account.accountNumber ? [account] : [];
  });
}

/** Both values as a valid point, or neither: legacy documents have none. */
function geoPoint(lat: unknown, lng: unknown): { latitude: number | null; longitude: number | null } {
  const valid =
    typeof lat === 'number' && isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === 'number' && isFinite(lng) && lng >= -180 && lng <= 180;
  return valid ? { latitude: lat, longitude: lng } : { latitude: null, longitude: null };
}

function orderStatus(v: unknown): OrderStatus {
  if (v === 'out_for_delivery' || v === 'outForDelivery') return 'out_for_delivery';
  return v === 'completed' || v === 'cancelled' ? v : 'processing';
}

export function mapOrder(id: string, d: DocumentData): Order {
  const point = geoPoint(d.deliveryLatitude, d.deliveryLongitude);
  return {
    id,
    customerName: str(d.customerName),
    companyId: str(d.companyId),
    companyName: str(d.companyName),
    productId: str(d.productId),
    productName: str(d.productName),
    quantity: typeof d.quantity === 'number' ? Math.trunc(d.quantity) : 1,
    unitPrice: num(d.unitPrice),
    productSubtotal: num(d.productSubtotal),
    installationSelected: d.installationSelected === true,
    installationFee: num(d.installationFee),
    deliveryFee: num(d.deliveryFee),
    totalAmount: num(d.totalAmount),
    deliveryAddress: str(d.deliveryAddress),
    deliveryLatitude: point.latitude,
    deliveryLongitude: point.longitude,
    deliveryCityId: typeof d.deliveryCityId === 'string' ? d.deliveryCityId : null,
    contactPhone: str(d.contactPhone),
    deliveryMethod: d.deliveryMethod === 'pickup' ? 'pickup' : 'delivery',
    paymentStatus: d.paymentStatus === 'confirmed' ? 'confirmed' : 'pending_verification',
    orderStatus: orderStatus(d.orderStatus),
    receiptFileName: str(d.receiptFileName),
    cancelReason: typeof d.cancelReason === 'string' ? d.cancelReason : null,
    cancelNote: typeof d.cancelNote === 'string' && d.cancelNote.trim() !== '' ? d.cancelNote.trim() : null,
    cancelledAt: toDate(d.cancelledAt),
    refundedAt: toDate(d.refundedAt),
    // A new order reads back without its server time for a moment.
    createdAt: toDate(d.createdAt) ?? new Date(),
  };
}

/** Whether customers may see a product: Platform Admin has not hidden it and its company has not taken it off sale. */
export const isOnSale = (p: Pick<Product, 'hidden' | 'status'>): boolean => !p.hidden && p.status === 'published';

export function mapProduct(id: string, d: DocumentData): Product {
  const raw: Record<string, string> = {};
  if (d.specifications && typeof d.specifications === 'object') {
    for (const [k, v] of Object.entries(d.specifications as Record<string, unknown>)) {
      raw[k] = String(v);
    }
  }
  // Firestore keeps map keys alphabetically; the company's own order is kept beside them.
  const specifications: Record<string, string> = {};
  const order = Array.isArray(d.specificationsOrder) ? d.specificationsOrder.filter((k: unknown): k is string => typeof k === 'string') : [];
  for (const k of order) if (k in raw) specifications[k] = raw[k];
  for (const k of Object.keys(raw)) if (!(k in specifications)) specifications[k] = raw[k];
  const imageUrl = str(d.imageUrl);
  const imageUrls = Array.isArray(d.imageUrls) ? d.imageUrls.filter((u: unknown): u is string => typeof u === 'string' && u !== '').slice(0, 5) : [];
  return {
    ...pricing(d),
    id,
    companyId: str(d.companyId),
    companyName: str(d.companyName),
    categoryId: typeof d.categoryId === 'string' && d.categoryId ? d.categoryId : null,
    name: str(d.name),
    imageUrl,
    imageUrls: imageUrls.length > 0 ? imageUrls : imageUrl ? [imageUrl] : [],
    status: d.status === 'draft' || d.status === 'archived' ? d.status : 'published',
    currency: str(d.currency) || 'SDG',
    description: str(d.description),
    brand: str(d.brand).trim(),
    inStock: typeof d.inStock === 'boolean' ? d.inStock : true,
    stockCount: Math.trunc(num(d.stockCount)),
    specifications,
    isDeliveryAvailable: typeof d.isDeliveryAvailable === 'boolean' ? d.isDeliveryAvailable : true,
    isInstallationAvailable: d.isInstallationAvailable === true,
    installationPrice: numOrNull(d.installationPrice),
    hidden: d.hidden === true,
    createdAt: toDate(d.createdAt),
  };
}

export function mapService(id: string, d: DocumentData): CatalogService {
  return {
    id,
    categoryId: str(d.categoryId),
    name: str(d.name),
    description: str(d.description),
    isActive: d.isActive === true,
  };
}

export function mapCompanyService(id: string, d: DocumentData): CompanyService {
  return {
    ...pricing(d),
    id,
    companyId: str(d.companyId),
    serviceId: str(d.serviceId),
    isActive: d.isActive === true,
    note: str(d.note).trim(),
  };
}

export function mapReview(id: string, d: DocumentData): Review {
  return {
    id,
    authorName: str(d.authorName),
    companyId: str(d.companyId),
    companyName: str(d.companyName),
    targetType: str(d.targetType),
    targetId: str(d.targetId),
    targetName: str(d.targetName),
    hidden: d.hidden === true,
    stars: Math.min(5, Math.max(0, Math.trunc(num(d.stars)))),
    tags: Array.isArray(d.tags) ? d.tags.filter((x: unknown): x is string => typeof x === 'string') : [],
    comment: str(d.comment),
    reply: str(d.reply).trim(),
    // A review just written reads back without its server time for a moment.
    createdAt: toDate(d.createdAt) ?? new Date(),
  };
}

export function mapProfile(id: string, d: DocumentData): UserProfile {
  return {
    language: d.language === 'ar' || d.language === 'en' ? d.language : null,
    id,
    role: str(d.role).trim().toLowerCase() || 'customer',
    fullName: str(d.fullName).trim() || str(d.name).trim(),
    email: str(d.email).trim(),
    phone: str(d.phone).trim(),
    photoUrl: str(d.photoUrl).trim(),
    isActive: typeof d.isActive === 'boolean' ? d.isActive : true,
    cityId: typeof d.cityId === 'string' && d.cityId.trim() ? d.cityId.trim() : null,
    termsVersion: typeof d.termsVersion === 'number' ? d.termsVersion : null,
    pushPrefs:
      d.pushPrefs && typeof d.pushPrefs === 'object'
        ? Object.fromEntries(Object.entries(d.pushPrefs as Record<string, unknown>).filter((e): e is [string, boolean] => typeof e[1] === 'boolean'))
        : {},
  };
}

export function mapNotification(id: string, d: DocumentData): AppNotification {
  return {
    id,
    type: str(d.type),
    productName: str(d.productName),
    orderId: str(d.orderId),
    serviceRequestId: str(d.serviceRequestId),
    reportId: str(d.reportId),
    isRead: d.isRead === true,
    createdAt: toDate(d.createdAt) ?? new Date(0),
  };
}

export function mapReport(id: string, d: DocumentData): Report {
  return {
    id,
    reason: str(d.reason),
    subject: str(d.subject),
    details: str(d.details),
    orderRef: str(d.orderRef),
    status: str(d.status) || 'new',
    resolution: str(d.resolution),
    createdAt: toDate(d.createdAt) ?? new Date(0),
  };
}

/** One entry of `platform_settings/cities.items`; null when it has no id or name. */
export function mapCity(raw: unknown): City | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { id, nameAr, nameEn, active } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || id === '') return null;
  const ar = str(nameAr).trim();
  const en = str(nameEn).trim();
  if (ar === '' && en === '') return null;
  return { id, nameAr: ar || en, nameEn: en || ar, active: active !== false };
}

const idOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const chatRole = (v: unknown): ChatRole | null => (v === 'customer' || v === 'company' ? v : null);

export function mapConversation(id: string, d: DocumentData): Conversation {
  return {
    id,
    serviceRequestId: idOrNull(d.serviceRequestId),
    orderId: idOrNull(d.orderId),
    productId: idOrNull(d.productId),
    companyServiceId: idOrNull(d.companyServiceId),
    customerName: str(d.customerName),
    companyId: str(d.companyId),
    companyName: str(d.companyName),
    serviceName: str(d.serviceName),
    productName: str(d.productName),
    createdAt: toDate(d.createdAt) ?? new Date(),
    lastMessageText: str(d.lastMessageText),
    lastMessageAt: toDate(d.lastMessageAt),
    lastMessageSenderRole: chatRole(d.lastMessageSenderRole),
    customerLastReadAt: toDate(d.customerLastReadAt),
    companyLastReadAt: toDate(d.companyLastReadAt),
  };
}

export function mapMessage(id: string, d: DocumentData, pending: boolean): ChatMessage {
  return {
    id,
    senderId: str(d.senderId),
    senderRole: chatRole(d.senderRole) ?? 'customer',
    text: str(d.text),
    // A message just written reads back without its server time for a moment.
    createdAt: toDate(d.createdAt) ?? new Date(),
    pending,
  };
}

const REQUEST_STATUSES: ServiceRequestStatus[] = ['pending', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled'];

export function mapServiceRequest(id: string, d: DocumentData): ServiceRequest {
  const price = numOrNull(d.price);
  return {
    id,
    companyId: str(d.companyId),
    companyName: str(d.companyName),
    companyServiceId: str(d.companyServiceId),
    serviceName: str(d.serviceName),
    price: price !== null && price > 0 ? price : null,
    details: str(d.details),
    address: str(d.address),
    latitude: numOrNull(d.latitude),
    longitude: numOrNull(d.longitude),
    cityId: idOrNull(d.cityId),
    contactPhone: str(d.contactPhone),
    status: REQUEST_STATUSES.find((s) => s === d.status) ?? 'pending',
    createdAt: toDate(d.createdAt) ?? new Date(),
  };
}

export function mapFavorite(_id: string, d: DocumentData): Favorite {
  return {
    kind: d.kind === 'service' ? 'service' : 'product',
    targetId: str(d.targetId),
    name: str(d.name),
    // An entry just written reads back without its server time for a moment.
    createdAt: toDate(d.createdAt) ?? new Date(),
  };
}
