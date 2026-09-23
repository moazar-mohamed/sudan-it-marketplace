import type { DocumentData } from 'firebase/firestore';
import { toGeoPoint } from './location';
import type {
  CatalogService,
  Category,
  Company,
  CompanyStatus,
  Customer,
  DeliveryMethod,
  Order,
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
  return v === 'completed' ? 'completed' : 'processing';
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
    address: str(d.address),
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    phone: str(d.phone),
    email: str(d.email),
    pickupAddress: str(d.pickupAddress),
    status: parseCompanyStatus(d.status),
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
    createdAt: toDate(d.createdAt),
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
    description: str(d.description),
    iconName: str(d.iconName),
    isActive: d.isActive === true,
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

// No reviews collection exists in the current backend, so this reads the
// fields a review would most plausibly carry and tolerates any that are absent.
export function mapReview(id: string, d: DocumentData): Review {
  return {
    id,
    customerName: str(d.customerName) || str(d.customerId),
    companyName: str(d.companyName) || str(d.companyId),
    rating: num(d.rating),
    comment: str(d.comment),
    orderId: str(d.orderId),
    createdAt: toDate(d.createdAt),
  };
}
