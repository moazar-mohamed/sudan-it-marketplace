// Shapes mirror the documents the Flutter app already reads and writes.

// Companies are either active or inactive; there is no application/approval
// workflow, so no count or filter is offered for any other status. (The type
// still accepts the older values so a legacy document can be read and shown.)
export type CompanyStatus = 'pending' | 'active' | 'rejected' | 'inactive';
export const COMPANY_FILTER_STATUSES = ['active', 'inactive'] as const;
export type CompanyFilterStatus = (typeof COMPANY_FILTER_STATUSES)[number];

export type OrderStatus = 'processing' | 'out_for_delivery' | 'completed';
export const ORDER_STATUSES: OrderStatus[] = [
  'processing',
  'out_for_delivery',
  'completed',
];

export type PaymentStatus = 'pending_verification' | 'confirmed';
export type DeliveryMethod = 'delivery' | 'pickup';

export interface Company {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  logoUrl: string;
  description: string;
  city: string;
  address: string;
  /** Optional exact map point; null for text-only (legacy) companies. */
  latitude: number | null;
  longitude: number | null;
  phone: string;
  email: string;
  pickupAddress: string;
  /** Companies without a stored status are treated as active. */
  status: CompanyStatus;
  createdAt: Date | null;
}

export interface Customer {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  isActive: boolean;
  createdAt: Date | null;
}

export interface Product {
  id: string;
  companyId: string;
  companyName: string;
  /** The category the company picked, or null (older products have none). */
  categoryId: string | null;
  name: string;
  imageUrl: string;
  /** null = the company left the price out ("price on request"), never 0. */
  price: number | null;
  currency: string;
  stockCount: number;
  inStock: boolean;
  description: string;
  specifications: Record<string, string>;
  isDeliveryAvailable: boolean;
  isInstallationAvailable: boolean;
  installationPrice: number | null;
  createdAt: Date | null;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  companyId: string;
  companyName: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  productSubtotal: number;
  installationSelected: boolean;
  installationFee: number;
  deliveryFee: number;
  totalAmount: number;
  deliveryAddress: string;
  /** Exact delivery point chosen at checkout; null for text-only/pickup/legacy orders. */
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  contactPhone: string;
  deliveryMethod: DeliveryMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  receiptFileName: string;
  technicianId: string;
  technicianName: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface Category {
  id: string;
  /** The single name kept for every language (and all that older categories have). */
  name: string;
  nameAr: string;
  nameEn: string;
  /** The category this one sits under; null for a top-level category. */
  parentId: string | null;
  /** Ids of every ancestor, top-level first; empty for a top-level category. */
  ancestorIds: string[];
  /** True while a deletion of this category (and its tree) is under way. */
  deletionPending: boolean;
  /** Position in the customer's list; null sorts after the ones that have one. */
  sortOrder: number | null;
  description: string;
  iconName: string;
  isActive: boolean;
  createdAt: Date | null;
}

/** A catalogue service (services/{id}); companies offer it via company_services. */
export interface CatalogService {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: Date | null;
}

/** Status of a service request (service_requests/{id}); see the Flutter app. */
export type ServiceRequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
export const SERVICE_REQUEST_STATUSES: ServiceRequestStatus[] = [
  'pending',
  'accepted',
  'in_progress',
  'completed',
  'rejected',
  'cancelled',
];

/**
 * A customer's request for a company's service. Platform Admin reads these
 * only; their conversations (chats) are private and never loaded here.
 */
export interface ServiceRequest {
  id: string;
  customerId: string;
  customerName: string;
  companyId: string;
  companyName: string;
  serviceId: string;
  serviceName: string;
  /** null when the company set no price (never 0). */
  price: number | null;
  details: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  contactPhone: string;
  status: ServiceRequestStatus;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface Review {
  id: string;
  customerName: string;
  companyName: string;
  rating: number;
  comment: string;
  orderId: string;
  createdAt: Date | null;
}
