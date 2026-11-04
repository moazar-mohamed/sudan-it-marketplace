export type OrderStatus = 'processing' | 'out_for_delivery' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending_verification' | 'confirmed';
export type DeliveryMethod = 'delivery' | 'pickup';
export type CancelReason = 'company' | 'expired' | 'out_of_stock' | 'admin';
export type OfferBadge = 'discount' | 'special' | 'limited';

/** How long the company has to verify a new order's payment (the rules use the same 24 hours). */
export const PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface Product {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  brand: string;
  imageUrl: string;
  categoryId: string | null;
  /** null means "price on request", never 0. */
  price: number | null;
  currency: string;
  stockCount: number;
  inStock: boolean;
  description: string;
  specifications: Record<string, string>;
  isDeliveryAvailable: boolean;
  isInstallationAvailable: boolean;
  installationPrice: number | null;
  offerPrice: number | null;
  offerEndsAt: Date | null;
  offerBadge: OfferBadge | null;
  createdAt: Date | null;
  /** Set only by Platform Admin. */
  hidden: boolean;
  hiddenReason: string;
  /** The company's own visibility; a document without it is published. */
  status: ProductStatus;
  /** The company's own product code. */
  sku: string;
  /** Low-stock warning for this product; null uses the default. */
  lowStockThreshold: number | null;
  /** Up to five pictures; the first is also `imageUrl` (so older apps show it). */
  imageUrls: string[];
  /** The order the specifications are shown in (Firestore keeps map keys alphabetically). */
  specificationsOrder: string[];
}

export type ProductStatus = 'published' | 'draft' | 'archived';

export interface Order {
  id: string;
  customerId: string;
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
  contactPhone: string;
  deliveryMethod: DeliveryMethod;
  deliveryCityId: string | null;
  customerName: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  receiptFileName: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  technicianId: string;
  technicianName: string;
  /** The order's quantity has been taken from its product's stock. */
  stockReserved: boolean;
  stockReleased: boolean;
  cancelReason: CancelReason | null;
  cancelledAt: Date | null;
  /** A few words from the company on why it cancelled. */
  cancelNote: string;
  /** When the company recorded giving the money back (a paid order that was cancelled). */
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface PaymentAccount {
  bankName: string;
  accountName: string;
  accountNumber: string;
  phoneNumber: string;
}

export interface PickupPoint {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

export interface Company {
  id: string;
  name: string;
  logoUrl: string;
  description: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  email: string;
  pickupAddress: string;
  pickupPoints: PickupPoint[];
  status: 'pending' | 'active' | 'rejected' | 'inactive';
  paymentAccounts: PaymentAccount[];
  serviceCityIds: string[];
  rating: number;
  reviewCount: number;
}

export interface Category {
  id: string;
  name: string;
  nameAr: string;
  nameEn: string;
  parentId: string | null;
  sortOrder: number | null;
  isActive: boolean;
  deletionPending: boolean;
  trashed: boolean;
}

export interface CatalogService {
  id: string;
  name: string;
  description: string;
  categoryId: string | null;
  ownerCompanyId: string;
  isActive: boolean;
}

export interface CompanyService {
  id: string;
  companyId: string;
  serviceId: string;
  isActive: boolean;
  price: number | null;
  note: string;
  offerPrice: number | null;
  offerEndsAt: Date | null;
  offerBadge: OfferBadge | null;
}

export interface Technician {
  id: string;
  companyId: string;
  fullName: string;
  phone: string;
  email: string;
  uid: string;
  isActive: boolean;
  isAvailable: boolean;
}

export interface Review {
  id: string;
  customerId: string;
  /** A review of an order's product (its id is the order's id) or of a service request. */
  source: 'order' | 'service_request';
  authorName: string;
  targetName: string;
  stars: number;
  tags: string[];
  comment: string;
  hidden: boolean;
  reply: string;
  replyAt: Date | null;
  createdAt: Date | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: 'customer' | 'company';
  senderName: string;
  text: string;
  createdAt: Date | null;
}

export interface Chat {
  id: string;
  orderId: string;
  /** Set when the conversation is about a service request. */
  serviceRequestId: string;
  serviceName: string;
  productId: string;
  customerId: string;
  companyId: string;
  customerName: string;
  productName: string;
  lastMessageText: string;
  lastMessageAt: Date | null;
  lastMessageSenderRole: string;
  companyLastReadAt: Date | null;
}
