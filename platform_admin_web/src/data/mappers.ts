import type { DocumentData } from 'firebase/firestore';
import { normalizeCityIds } from './cities';
import { toGeoPoint } from './location';
import type {
  AuditEntry,
  CatalogService,
  Category,
  CompanyServiceLink,
  Company,
  CompanyStatus,
  Customer,
  PlatformAdmin,
  Report,
  ReportStatus,
  DeliveryMethod,
  Order,
  OrderCancelReason,
  OrderStatus,
  PaymentStatus,
  Product,
  Review,
  ServiceRequest,
  ServiceRequestStatus,
} from './types';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0);

export function toDate(v: unknown): Date | null {
  if (v && typeof v === 'object' && 'toDate' in v) {
    const fn = (v as { toDate: () => Date }).toDate;
    if (typeof fn === 'function') return fn.call(v);
  }
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function parseCompanyStatus(v: unknown): CompanyStatus {
  return v === 'pending' || v === 'rejected' || v === 'inactive' ? v : 'active';
}

export function parseOrderStatus(v: unknown): OrderStatus {
  if (v === 'out_for_delivery' || v === 'outForDelivery') return 'out_for_delivery';
  if (v === 'cancelled') return 'cancelled';
  return v === 'completed' ? 'completed' : 'processing';
}

export function parseOrderCancelReason(v: unknown): OrderCancelReason | null {
  return v === 'company' || v === 'expired' || v === 'out_of_stock' || v === 'admin' ? v : null;
}

export function parsePaymentStatus(v: unknown): PaymentStatus {
  return v === 'confirmed' ? 'confirmed' : 'pending_verification';
}

export function parseDeliveryMethod(v: unknown): DeliveryMethod {
  return v === 'pickup' ? 'pickup' : 'delivery';
}

export function mapCompany(id: string, d: DocumentData): Company {
  const point = toGeoPoint(d.latitude, d.longitude);
  return {
    id,
    name: str(d.name),
    rating: num(d.rating),
    reviewCount: num(d.reviewCount),
    logoUrl: str(d.logoUrl),
    description: str(d.description),
    city: str(d.city),
    serviceCityIds: normalizeCityIds(d.serviceCityIds),
    address: str(d.address),
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    phone: str(d.phone),
    email: str(d.email),
    pickupAddress: str(d.pickupAddress),
    status: parseCompanyStatus(d.status),
    trashedAt: toDate(d.trashedAt),
    statusBeforeTrash: d.statusBeforeTrash == null ? null : parseCompanyStatus(d.statusBeforeTrash),
    createdAt: toDate(d.createdAt),
  };
}

export function mapCustomer(id: string, d: DocumentData): Customer {
  return {
    id,
    fullName: str(d.fullName) || str(d.name),
    email: str(d.email),
    phone: str(d.phone) || str(d.phoneNumber),
    isActive: typeof d.isActive === 'boolean' ? d.isActive : true,
    cityId: normalizeCityIds([d.cityId])[0] ?? '',
    createdAt: toDate(d.createdAt),
  };
}

export function mapPlatformAdmin(id: string, d: DocumentData): PlatformAdmin {
  return {
    id,
    fullName: str(d.fullName) || str(d.name),
    email: str(d.email),
    // A missing flag is NOT active: the rules treat such an admin as having no access.
    isActive: d.isActive === true,
    createdAt: toDate(d.createdAt),
  };
}

const REPORT_STATUS_SET: readonly string[] = ['new', 'in_progress', 'closed'];

export function mapReport(id: string, d: DocumentData): Report {
  return {
    id,
    reporterId: str(d.reporterId),
    reporterRole: str(d.reporterRole),
    reporterName: str(d.reporterName),
    reporterEmail: str(d.reporterEmail),
    companyId: str(d.companyId),
    reason: str(d.reason) || 'other',
    subject: str(d.subject),
    details: str(d.details),
    orderRef: str(d.orderRef),
    status: REPORT_STATUS_SET.includes(d.status) ? (d.status as ReportStatus) : 'new',
    resolution: str(d.resolution),
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

export function mapProduct(id: string, d: DocumentData): Product {
  const specs: Record<string, string> = {};
  if (d.specifications && typeof d.specifications === 'object') {
    for (const [k, v] of Object.entries(d.specifications as Record<string, unknown>)) {
      specs[k] = String(v);
    }
  }
  return {
    id,
    companyId: str(d.companyId),
    companyName: str(d.companyName),
    categoryId: typeof d.categoryId === 'string' && d.categoryId ? d.categoryId : null,
    name: str(d.name),
    imageUrl: str(d.imageUrl),
    price: typeof d.price === 'number' && isFinite(d.price) ? d.price : null,
    currency: str(d.currency) || 'SDG',
    stockCount: num(d.stockCount),
    inStock: typeof d.inStock === 'boolean' ? d.inStock : true,
    description: str(d.description),
    specifications: specs,
    isDeliveryAvailable:
      typeof d.isDeliveryAvailable === 'boolean' ? d.isDeliveryAvailable : true,
    isInstallationAvailable: d.isInstallationAvailable === true,
    installationPrice:
      typeof d.installationPrice === 'number' ? d.installationPrice : null,
    offerPrice: typeof d.offerPrice === 'number' && isFinite(d.offerPrice) ? d.offerPrice : null,
    offerEndsAt: toDate(d.offerEndsAt),
    offerBadge: typeof d.offerBadge === 'string' && d.offerBadge ? d.offerBadge : null,
    hidden: d.hidden === true,
    hiddenReason: str(d.hiddenReason),
    createdAt: toDate(d.createdAt),
  };
}

export function mapOrder(id: string, d: DocumentData): Order {
  const delivery = toGeoPoint(d.deliveryLatitude, d.deliveryLongitude);
  return {
    id,
    customerId: str(d.customerId),
    customerName: str(d.customerName),
    companyId: str(d.companyId),
    companyName: str(d.companyName),
    productId: str(d.productId),
    productName: str(d.productName),
    quantity: num(d.quantity) || 1,
    unitPrice: num(d.unitPrice),
    productSubtotal: num(d.productSubtotal),
    installationSelected: d.installationSelected === true,
    installationFee: num(d.installationFee),
    deliveryFee: num(d.deliveryFee),
    totalAmount: num(d.totalAmount),
    deliveryAddress: str(d.deliveryAddress),
    deliveryLatitude: delivery?.latitude ?? null,
    deliveryLongitude: delivery?.longitude ?? null,
    contactPhone: str(d.contactPhone),
    deliveryMethod: parseDeliveryMethod(d.deliveryMethod),
    paymentStatus: parsePaymentStatus(d.paymentStatus),
    orderStatus: parseOrderStatus(d.orderStatus),
    receiptFileName: str(d.receiptFileName),
    technicianId: str(d.technicianId),
    technicianName: str(d.technicianName),
    cancelReason: parseOrderCancelReason(d.cancelReason),
    cancelledAt: toDate(d.cancelledAt),
    stockReleased: d.stockReleased === true,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

export function parseServiceRequestStatus(v: unknown): ServiceRequestStatus {
  return v === 'accepted' ||
    v === 'rejected' ||
    v === 'in_progress' ||
    v === 'completed' ||
    v === 'cancelled'
    ? v
    : 'pending';
}

export function mapServiceRequest(id: string, d: DocumentData): ServiceRequest {
  const point = toGeoPoint(d.latitude, d.longitude);
  return {
    id,
    customerId: str(d.customerId),
    customerName: str(d.customerName),
    companyId: str(d.companyId),
    companyName: str(d.companyName),
    serviceId: str(d.serviceId),
    serviceName: str(d.serviceName),
    price: typeof d.price === 'number' && isFinite(d.price) && d.price > 0 ? d.price : null,
    details: str(d.details),
    address: str(d.address),
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    contactPhone: str(d.contactPhone),
    status: parseServiceRequestStatus(d.status),
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

export function mapCategory(id: string, d: DocumentData): Category {
  return {
    id,
    name: str(d.name),
    nameAr: str(d.nameAr),
    nameEn: str(d.nameEn),
    parentId: typeof d.parentId === 'string' && d.parentId ? d.parentId : null,
    ancestorIds: Array.isArray(d.ancestorIds)
      ? d.ancestorIds.filter((x: unknown): x is string => typeof x === 'string')
      : [],
    deletionPending: d.deletionPending === true,
    sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : null,
    description: str(d.description),
    iconName: str(d.iconName),
    color: str(d.color),
    isActive: d.isActive === true,
    trashedAt: toDate(d.trashedAt),
    trashRootId: str(d.trashRootId),
    activeBeforeTrash: d.activeBeforeTrash === true,
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
    createdAt: toDate(d.createdAt),
  };
}

export function mapCompanyService(id: string, d: DocumentData): CompanyServiceLink {
  const positive = (v: unknown) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null);
  return {
    id,
    companyId: str(d.companyId),
    serviceId: str(d.serviceId),
    isActive: d.isActive === true,
    price: positive(d.price),
    offerPrice: positive(d.offerPrice),
    offerEndsAt: toDate(d.offerEndsAt),
    offerBadge: typeof d.offerBadge === 'string' && d.offerBadge ? d.offerBadge : null,
    createdAt: toDate(d.createdAt),
  };
}

// A customer's rating of a completed order or service request (the app writes
// it; see the reviews rules).
export function mapReview(id: string, d: DocumentData): Review {
  const sourceType = str(d.sourceType) || 'order';
  return {
    id,
    sourceType,
    customerName: str(d.authorName) || str(d.customerId),
    companyId: str(d.companyId),
    companyName: str(d.companyName) || str(d.companyId),
    targetType: str(d.targetType) || (sourceType === 'order' ? 'product' : 'service'),
    targetId: str(d.targetId),
    targetName: str(d.targetName),
    rating: num(d.stars),
    comment: str(d.comment),
    orderId: sourceType === 'order' ? id : '',
    hidden: d.hidden === true,
    reply: str(d.reply),
    createdAt: toDate(d.createdAt),
  };
}

export function mapAuditEntry(id: string, d: DocumentData): AuditEntry {
  return {
    id,
    actorId: str(d.actorId),
    actorName: str(d.actorName),
    action: str(d.action),
    targetType: str(d.targetType),
    targetId: str(d.targetId),
    targetName: str(d.targetName),
    detail: str(d.detail),
    createdAt: toDate(d.createdAt),
  };
}
