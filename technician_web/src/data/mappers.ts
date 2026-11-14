import { Timestamp, type DocumentData } from 'firebase/firestore';
import type { ChatMessage, ChatRole, Company, Job, JobChat, Note, Notice, OrderStatus, TechnicianRecord } from './types';

export function asDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const status = (v: unknown): OrderStatus =>
  v === 'out_for_delivery' || v === 'completed' || v === 'cancelled' ? v : 'processing';

const role = (v: unknown): ChatRole | null => (v === 'technician' || v === 'company' ? v : null);

export function mapJob(id: string, d: DocumentData, pendingSync = false): Job {
  return {
    id,
    orderStatus: status(d.orderStatus),
    paymentStatus: d.paymentStatus === 'confirmed' ? 'confirmed' : 'pending_verification',
    deliveryMethod: d.deliveryMethod === 'pickup' ? 'pickup' : 'delivery',
    deliveryAddress: str(d.deliveryAddress),
    deliveryLatitude: numOrNull(d.deliveryLatitude),
    deliveryLongitude: numOrNull(d.deliveryLongitude),
    productName: str(d.productName),
    quantity: Math.max(1, num(d.quantity)),
    installationFee: num(d.installationFee),
    customerId: str(d.customerId),
    customerName: str(d.customerName),
    contactPhone: str(d.contactPhone),
    companyId: str(d.companyId),
    companyName: str(d.companyName),
    technicianId: str(d.technicianId),
    technicianName: str(d.technicianName),
    // A job this device just changed has no server time yet.
    createdAt: asDate(d.createdAt) ?? new Date(),
    updatedAt: asDate(d.updatedAt),
    cancelNote: str(d.cancelNote),
    cancelledAt: asDate(d.cancelledAt),
    pendingSync,
  };
}

export function mapTechnician(id: string, d: DocumentData): TechnicianRecord {
  return {
    id,
    fullName: str(d.fullName),
    phone: str(d.phone),
    email: str(d.email),
    companyId: str(d.companyId),
    isActive: d.isActive === true,
    isAvailable: d.isAvailable !== false,
  };
}

export function mapCompany(id: string, d: DocumentData): Company {
  return {
    id,
    name: str(d.name),
    address: str(d.address),
    city: str(d.city),
    latitude: numOrNull(d.latitude),
    longitude: numOrNull(d.longitude),
  };
}

export function mapNotice(id: string, d: DocumentData): Notice {
  return {
    id,
    type: str(d.type),
    orderId: str(d.orderId),
    productName: str(d.productName),
    isRead: d.isRead === true,
    createdAt: asDate(d.createdAt) ?? new Date(),
  };
}

export function mapChat(id: string, d: DocumentData): JobChat {
  return {
    id,
    lastMessageText: typeof d.lastMessageText === 'string' ? d.lastMessageText : null,
    lastMessageAt: asDate(d.lastMessageAt),
    lastMessageSenderRole: role(d.lastMessageSenderRole),
    technicianLastReadAt: asDate(d.technicianLastReadAt),
  };
}

export function mapMessage(id: string, d: DocumentData, pending: boolean): ChatMessage | null {
  const r = role(d.senderRole);
  if (!r) return null;
  return {
    id,
    senderId: str(d.senderId),
    senderRole: r,
    senderName: str(d.senderName),
    text: str(d.text),
    createdAt: asDate(d.createdAt) ?? new Date(),
    pending,
  };
}

export function mapNote(id: string, d: DocumentData, pending: boolean): Note {
  return {
    id,
    kind: d.kind === 'completion' ? 'completion' : 'note',
    text: str(d.text),
    authorId: str(d.authorId),
    createdAt: asDate(d.createdAt) ?? new Date(),
    pending,
  };
}
