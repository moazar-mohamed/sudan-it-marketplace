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
  name: string;
  imageUrl: string;
  price: number;
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
  name: string;
  description: string;
  iconName: string;
  isActive: boolean;
  createdAt: Date | null;
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
