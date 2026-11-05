import type { DocumentData, Timestamp } from 'firebase/firestore';
import type {
  CancelReason,
  CatalogService,
  Category,
  Chat,
  ChatMessage,
  Company,
  CompanyService,
  DeliveryMethod,
  OfferBadge,
  Order,
  OrderStatus,
  PaymentAccount,
  PaymentStatus,
  PickupPoint,
  Product,
  Review,
  Technician,
} from './types';

export function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (v && typeof v === 'object' && typeof (v as Timestamp).toDate === 'function') return (v as Timestamp).toDate();
  return null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

const badge = (v: unknown): OfferBadge | null => (v === 'discount' || v === 'special' || v === 'limited' ? v : null);

export function mapProduct(id: string, d: DocumentData): Product {
  const raw: Record<string, string> = {};
  if (d.specifications && typeof d.specifications === 'object') {
    for (const [k, v] of Object.entries(d.specifications as Record<string, unknown>)) raw[k] = String(v);
  }
  // Firestore keeps map keys alphabetically; the company's own order is kept beside it.
  const order = strList(d.specificationsOrder);
  const specs: Record<string, string> = {};
  for (const k of order) if (k in raw) specs[k] = raw[k];
  for (const k of Object.keys(raw)) if (!(k in specs)) specs[k] = raw[k];
  const imageUrl = str(d.imageUrl);
  const imageUrls = strList(d.imageUrls).filter(Boolean).slice(0, 5);
  return {
    id,
    companyId: str(d.companyId),
    companyName: str(d.companyName),
    name: str(d.name),
    brand: str(d.brand).trim(),
    imageUrl,
    imageUrls: imageUrls.length > 0 ? imageUrls : imageUrl ? [imageUrl] : [],
    status: d.status === 'draft' || d.status === 'archived' ? d.status : 'published',
    sku: str(d.sku),
    lowStockThreshold: typeof d.lowStockThreshold === 'number' && Number.isInteger(d.lowStockThreshold) ? d.lowStockThreshold : null,
    specificationsOrder: order,
    categoryId: typeof d.categoryId === 'string' && d.categoryId ? d.categoryId : null,
    price: numOrNull(d.price),
    currency: str(d.currency) || 'SDG',
    stockCount: typeof d.stockCount === 'number' ? Math.trunc(d.stockCount) : 0,
    inStock: d.inStock !== false,
    description: str(d.description),
    specifications: specs,
    isDeliveryAvailable: d.isDeliveryAvailable !== false,
    isInstallationAvailable: d.isInstallationAvailable === true,
    installationPrice: numOrNull(d.installationPrice),
    offerPrice: numOrNull(d.offerPrice),
    offerEndsAt: toDate(d.offerEndsAt),
    offerBadge: badge(d.offerBadge),
    createdAt: toDate(d.createdAt),
    hidden: d.hidden === true,
    hiddenReason: str(d.hiddenReason),
    priceUsd: positiveOrNull(d.priceUsd),
    offerPriceUsd: positiveOrNull(d.offerPriceUsd),
    installationPriceUsd: positiveOrNull(d.installationPriceUsd),
    usdRateApplied: positiveOrNull(d.usdRateApplied),
  };
}

const positiveOrNull = (v: unknown): number | null => {
  const value = numOrNull(v);
  return value !== null && value > 0 ? value : null;
};

const orderStatus = (v: unknown): OrderStatus =>
  v === 'out_for_delivery' || v === 'completed' || v === 'cancelled' ? v : 'processing';
const paymentStatus = (v: unknown): PaymentStatus => (v === 'confirmed' ? 'confirmed' : 'pending_verification');
const deliveryMethod = (v: unknown): DeliveryMethod => (v === 'pickup' ? 'pickup' : 'delivery');
const cancelReason = (v: unknown): CancelReason | null =>
  v === 'company' || v === 'expired' || v === 'out_of_stock' || v === 'admin' ? v : null;
const n = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function mapOrder(id: string, d: DocumentData): Order {
  return {
    id,
    customerId: str(d.customerId),
    companyId: str(d.companyId),
    companyName: str(d.companyName),
    productId: str(d.productId),
    productName: str(d.productName),
    quantity: Math.trunc(n(d.quantity, 1)),
    unitPrice: n(d.unitPrice, 0),
    productSubtotal: n(d.productSubtotal, 0),
    installationSelected: d.installationSelected === true,
    installationFee: n(d.installationFee, 0),
    deliveryFee: n(d.deliveryFee, 0),
    totalAmount: n(d.totalAmount, 0),
    deliveryAddress: str(d.deliveryAddress),
    contactPhone: str(d.contactPhone),
    deliveryMethod: deliveryMethod(d.deliveryMethod),
    deliveryCityId: typeof d.deliveryCityId === 'string' && d.deliveryCityId ? d.deliveryCityId : null,
    customerName: str(d.customerName),
    paymentStatus: paymentStatus(d.paymentStatus),
    orderStatus: orderStatus(d.orderStatus),
    receiptFileName: str(d.receiptFileName),
    deliveryLatitude: numOrNull(d.deliveryLatitude),
    deliveryLongitude: numOrNull(d.deliveryLongitude),
    technicianId: str(d.technicianId),
    technicianName: str(d.technicianName),
    // An order stored without the flag took its stock when it was placed.
    stockReserved: d.stockReserved !== false,
    stockReleased: d.stockReleased === true,
    cancelReason: cancelReason(d.cancelReason),
    cancelledAt: toDate(d.cancelledAt),
    cancelNote: str(d.cancelNote),
    refundedAt: toDate(d.refundedAt),
    // A just-written order has no server time yet.
    createdAt: toDate(d.createdAt) ?? new Date(),
    updatedAt: toDate(d.updatedAt),
  };
}

function mapPaymentAccount(raw: unknown): PaymentAccount | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const account = {
    bankName: str(r.bankName).trim(),
    accountName: str(r.accountName).trim(),
    accountNumber: str(r.accountNumber).trim(),
    phoneNumber: str(r.phoneNumber).trim(),
  };
  return account.bankName && account.accountNumber ? account : null;
}

function mapPickupPoint(raw: unknown): PickupPoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const point = {
    name: str(r.name).trim(),
    address: str(r.address).trim(),
    latitude: numOrNull(r.latitude),
    longitude: numOrNull(r.longitude),
  };
  return point.name || point.address ? point : null;
}

export function mapCompany(id: string, d: DocumentData): Company {
  const status = d.status === 'pending' || d.status === 'rejected' || d.status === 'inactive' ? d.status : 'active';
  return {
    id,
    name: str(d.name),
    logoUrl: str(d.logoUrl),
    description: str(d.description),
    city: str(d.city),
    address: str(d.address),
    latitude: numOrNull(d.latitude),
    longitude: numOrNull(d.longitude),
    phone: str(d.phone),
    email: str(d.email),
    pickupAddress: str(d.pickupAddress),
    pickupPoints: Array.isArray(d.pickupPoints)
      ? d.pickupPoints.slice(0, 5).map(mapPickupPoint).filter((p): p is PickupPoint => p !== null)
      : [],
    status,
    paymentAccounts: Array.isArray(d.paymentAccounts)
      ? d.paymentAccounts.map(mapPaymentAccount).filter((a): a is PaymentAccount => a !== null)
      : [],
    serviceCityIds: strList(d.serviceCityIds),
    rating: n(d.rating, 0),
    reviewCount: Math.trunc(n(d.reviewCount, 0)),
    usdRate: positiveOrNull(d.usdRate),
    usdRateUpdatedAt: toDate(d.usdRateUpdatedAt),
  };
}

export function mapCategory(id: string, d: DocumentData): Category {
  return {
    id,
    name: str(d.name),
    nameAr: str(d.nameAr),
    nameEn: str(d.nameEn),
    parentId: typeof d.parentId === 'string' && d.parentId ? d.parentId : null,
    sortOrder: numOrNull(d.sortOrder),
    isActive: d.isActive === true,
    deletionPending: d.deletionPending === true,
    trashed: toDate(d.trashedAt) !== null,
  };
}

export function mapCatalogService(id: string, d: DocumentData): CatalogService {
  return {
    id,
    name: str(d.name),
    description: str(d.description),
    categoryId: typeof d.categoryId === 'string' && d.categoryId ? d.categoryId : null,
    ownerCompanyId: str(d.ownerCompanyId),
    isActive: d.isActive === true,
  };
}

export function mapCompanyService(id: string, d: DocumentData): CompanyService {
  const price = numOrNull(d.price);
  const offer = numOrNull(d.offerPrice);
  return {
    id,
    companyId: str(d.companyId),
    serviceId: str(d.serviceId),
    isActive: d.isActive === true,
    price: price !== null && price > 0 ? price : null,
    note: str(d.note),
    offerPrice: offer !== null && offer > 0 ? offer : null,
    offerEndsAt: toDate(d.offerEndsAt),
    offerBadge: badge(d.offerBadge),
  };
}

export function mapTechnician(id: string, d: DocumentData): Technician {
  return {
    id,
    companyId: str(d.companyId),
    fullName: str(d.fullName),
    phone: str(d.phone),
    email: str(d.email),
    uid: str(d.uid),
    isActive: d.isActive !== false,
    isAvailable: d.isAvailable !== false,
  };
}

export function mapReview(id: string, d: DocumentData): Review {
  return {
    id,
    customerId: str(d.customerId),
    source: d.source === 'service_request' ? 'service_request' : 'order',
    authorName: str(d.authorName),
    targetName: str(d.targetName),
    stars: Math.trunc(n(d.stars, 0)),
    tags: strList(d.tags),
    comment: str(d.comment),
    hidden: d.hidden === true,
    reply: str(d.reply),
    replyAt: toDate(d.replyAt),
    createdAt: toDate(d.createdAt),
  };
}

export function mapChat(id: string, d: DocumentData): Chat {
  return {
    id,
    orderId: str(d.orderId),
    serviceRequestId: str(d.serviceRequestId),
    serviceName: str(d.serviceName),
    productId: str(d.productId),
    customerId: str(d.customerId),
    companyId: str(d.companyId),
    customerName: str(d.customerName),
    productName: str(d.productName),
    lastMessageText: str(d.lastMessageText),
    lastMessageAt: toDate(d.lastMessageAt),
    lastMessageSenderRole: str(d.lastMessageSenderRole),
    companyLastReadAt: toDate(d.companyLastReadAt),
  };
}

export function mapMessage(id: string, d: DocumentData): ChatMessage {
  return {
    id,
    senderId: str(d.senderId),
    senderRole: d.senderRole === 'company' ? 'company' : 'customer',
    senderName: str(d.senderName),
    text: str(d.text),
    createdAt: toDate(d.createdAt),
  };
}
