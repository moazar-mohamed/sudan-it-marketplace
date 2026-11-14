// Shapes mirror the Firestore documents the Flutter app already reads.

export type OfferBadge = 'discount' | 'special' | 'limited';

/** Anything a company sells at a price: a product or a company's service. */
export interface Priced {
  /** null = no price set; never treated as 0. */
  price: number | null;
  offerPrice: number | null;
  offerEndsAt: Date | null;
  offerBadge: OfferBadge | null;
}

export interface Category {
  id: string;
  name: string;
  nameAr: string;
  nameEn: string;
  description: string;
  parentId: string | null;
  sortOrder: number | null;
  iconName: string;
  color: string;
  isActive: boolean;
  deletionPending: boolean;
}

export interface Company {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  logoUrl: string;
  description: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  status: string;
  /** City ids it serves; empty = it has not said, shown in every city. */
  serviceCityIds: string[];
  pickupAddress: string;
  pickupPoints: PickupPoint[];
}

export interface PickupPoint {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

export interface PaymentAccount {
  bankName: string;
  accountName: string;
  accountNumber: string;
  phoneNumber: string;
}

export type OrderStatus = 'processing' | 'out_for_delivery' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending_verification' | 'confirmed';
export type DeliveryMethod = 'delivery' | 'pickup';

export interface Order {
  id: string;
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
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  deliveryCityId: string | null;
  contactPhone: string;
  deliveryMethod: DeliveryMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  receiptFileName: string;
  cancelReason: string | null;
  /** What the company wrote when it cancelled (optional). */
  cancelNote: string | null;
  cancelledAt: Date | null;
  /** When the company recorded giving the money back (a paid order it cancelled). */
  refundedAt: Date | null;
  createdAt: Date;
}

/** What checkout hands to the payment step; nothing is stored until the receipt is sent. */
export interface OrderDraft {
  id: string;
  customerId: string;
  customerName: string;
  companyId: string;
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
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  deliveryCityId: string | null;
  contactPhone: string;
  deliveryMethod: DeliveryMethod;
}

/** A receipt ready to be stored: a JPEG within the limits the rules accept. */
export interface ReceiptImage {
  fileName: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface Product extends Priced {
  id: string;
  companyId: string;
  companyName: string;
  categoryId: string | null;
  name: string;
  imageUrl: string;
  currency: string;
  description: string;
  brand: string;
  inStock: boolean;
  stockCount: number;
  specifications: Record<string, string>;
  isDeliveryAvailable: boolean;
  isInstallationAvailable: boolean;
  installationPrice: number | null;
  hidden: boolean;
  /** The company's own visibility; a document without it is published. */
  status: 'published' | 'draft' | 'archived';
  /** Up to five pictures the company set (imageUrl is the first). */
  imageUrls: string[];
  createdAt: Date | null;
}

export interface CatalogService {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  isActive: boolean;
}

/** One company's offer of a catalogue service. */
export interface CompanyService extends Priced {
  id: string;
  companyId: string;
  serviceId: string;
  isActive: boolean;
  note: string;
}

/** A catalogue service with the active offers of the companies customers can see. */
export interface ServiceListing {
  service: CatalogService;
  /** Cheapest first; an offer without a price goes last. */
  offers: CompanyService[];
  companies: Map<string, Company>;
}

export interface RatingStats {
  sum: number;
  count: number;
}

export interface Review {
  id: string;
  authorName: string;
  companyId: string;
  companyName: string;
  targetType: string;
  targetId: string;
  /** The rated product's or service's name (a low rating tells the Platform Admins with it). */
  targetName?: string;
  stars: number;
  tags: string[];
  comment: string;
  hidden: boolean;
  reply: string;
  createdAt: Date;
}

export interface City {
  id: string;
  nameAr: string;
  nameEn: string;
  active: boolean;
}

export type ChatRole = 'customer' | 'company';

/** A customer's conversation with a company about one order, request or item. */
export interface Conversation {
  id: string;
  serviceRequestId: string | null;
  orderId: string | null;
  productId: string | null;
  companyServiceId: string | null;
  customerName: string;
  companyId: string;
  companyName: string;
  serviceName: string;
  productName: string;
  createdAt: Date;
  lastMessageText: string;
  lastMessageAt: Date | null;
  lastMessageSenderRole: ChatRole | null;
  customerLastReadAt: Date | null;
  companyLastReadAt: Date | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: ChatRole;
  text: string;
  createdAt: Date;
  /** Written here and not yet confirmed by the server. */
  pending: boolean;
}

export type ServiceRequestStatus = 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'completed' | 'cancelled';

export interface ServiceRequest {
  id: string;
  companyId: string;
  companyName: string;
  companyServiceId: string;
  serviceName: string;
  /** The company's price when it was sent; null when it had set none. */
  price: number | null;
  details: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  cityId: string | null;
  contactPhone: string;
  status: ServiceRequestStatus;
  createdAt: Date;
}

export interface ServiceRequestDraft {
  id: string;
  customerId: string;
  customerName: string;
  companyId: string;
  companyName: string;
  companyServiceId: string;
  serviceId: string;
  serviceName: string;
  price: number | null;
  details: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  cityId: string;
  contactPhone: string;
}

export type FavoriteKind = 'product' | 'service';

/** A saved item; its name is kept so it can be read after the item stops being offered. */
export interface Favorite {
  kind: FavoriteKind;
  targetId: string;
  name: string;
  createdAt: Date;
}

export interface UserProfile {
  id: string;
  role: string;
  fullName: string;
  email: string;
  phone: string;
  photoUrl: string;
  isActive: boolean;
  /** null until they choose one. */
  cityId: string | null;
  /** null when they never chose one. */
  language: 'ar' | 'en' | null;
  /** The terms version they accepted; null when they never did. */
  termsVersion: number | null;
  /** The kinds of push they switched off ({ orders: false, ... }); the app and this site share them. */
  pushPrefs?: Record<string, boolean>;
}

export interface AppNotification {
  id: string;
  type: string;
  productName: string;
  orderId: string;
  serviceRequestId: string;
  reportId: string;
  isRead: boolean;
  createdAt: Date;
}

export interface Report {
  id: string;
  reason: string;
  subject: string;
  details: string;
  orderRef: string;
  status: string;
  /** What Platform Admin wrote back; empty until they do. */
  resolution: string;
  createdAt: Date;
}
