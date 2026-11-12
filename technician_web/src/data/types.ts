export type OrderStatus = 'processing' | 'out_for_delivery' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending_verification' | 'confirmed';
export type DeliveryMethod = 'delivery' | 'pickup';

/** An installation job: an order assigned to this technician (only orderStatus is ever written here). */
export interface Job {
  id: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  deliveryMethod: DeliveryMethod;
  deliveryAddress: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  productName: string;
  quantity: number;
  installationFee: number;
  customerId: string;
  customerName: string;
  contactPhone: string;
  companyId: string;
  companyName: string;
  technicianId: string;
  technicianName: string;
  createdAt: Date;
  updatedAt: Date | null;
  cancelNote: string;
  cancelledAt: Date | null;
  /** This device changed it and the server has not confirmed yet (offline). */
  pendingSync: boolean;
}

/** The technician's own record (technicians/{id}). */
export interface TechnicianRecord {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  companyId: string;
  isActive: boolean;
  /** A record without the field counts as available. */
  isAvailable: boolean;
}

export interface Company {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
}

export type TechNoticeType = 'technician_assigned' | 'job_ready' | 'job_cancelled' | string;

export interface Notice {
  id: string;
  type: TechNoticeType;
  orderId: string;
  productName: string;
  isRead: boolean;
  createdAt: Date;
}

export type ChatRole = 'technician' | 'company';

export interface JobChat {
  id: string;
  lastMessageText: string | null;
  lastMessageAt: Date | null;
  lastMessageSenderRole: ChatRole | null;
  technicianLastReadAt: Date | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: ChatRole;
  senderName: string;
  text: string;
  createdAt: Date;
  pending: boolean;
}

export interface Note {
  id: string;
  kind: 'note' | 'completion';
  text: string;
  authorId: string;
  createdAt: Date;
  pending: boolean;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** The longest technician note (and completion remark) the rules accept. */
export const NOTE_MAX = 500;
/** The longest job chat message the rules accept. */
export const MESSAGE_MAX = 2000;
