import { useEffect, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { pushTechChatMessage } from './pushRelay';
import { useRetryKey } from './retry';
import type { Order } from './types';
import { t } from '../i18n';

/*
 * The conversation between an order's customer and the technician the company
 * sent for it: `customerTechChats/{orderId}`, with its `messages`. The Firestore
 * rules (deployed 14 Nov 2026) let the two of them write from the assignment
 * until the order is completed or cancelled; the company's admins read it.
 * No phone number is ever part of it. The technician side is in technician_web.
 */

export const TECH_CHAT_MAX = 2000;
const TECH_CHAT_PAGE = 200;

export type TechChatRole = 'customer' | 'technician';

export interface TechChat {
  id: string;
  lastMessageAt: Date | null;
  lastMessageSenderRole: TechChatRole | null;
  customerLastReadAt: Date | null;
}

export interface TechChatMessage {
  id: string;
  senderRole: TechChatRole;
  senderName: string;
  text: string;
  createdAt: Date;
  pending: boolean;
}

const toDate = (v: unknown): Date | null =>
  v && typeof (v as { toDate?: unknown }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : null;

const role = (v: unknown): TechChatRole | null => (v === 'customer' || v === 'technician' ? v : null);

export function mapTechChat(id: string, d: DocumentData): TechChat {
  return {
    id,
    lastMessageAt: toDate(d.lastMessageAt),
    lastMessageSenderRole: role(d.lastMessageSenderRole),
    customerLastReadAt: toDate(d.customerLastReadAt),
  };
}

/** A message from the technician the customer has not seen yet. */
export function techChatUnread(chat: TechChat | null): boolean {
  if (!chat || !chat.lastMessageAt || chat.lastMessageSenderRole !== 'technician') return false;
  return !chat.customerLastReadAt || chat.customerLastReadAt < chat.lastMessageAt;
}

/** The two can write while a technician is assigned and the order is still open (as the rules say). */
export const techChatOpen = (order: Pick<Order, 'technicianId' | 'orderStatus'>): boolean =>
  order.technicianId !== null && order.orderStatus !== 'completed' && order.orderStatus !== 'cancelled';

/** The conversation document, live; null until the first message creates it. */
export function useTechChat(orderId: string): { chat: TechChat | null; loaded: boolean } {
  const [state, setState] = useState<{ id: string; chat: TechChat | null; loaded: boolean }>({ id: orderId, chat: null, loaded: false });
  useEffect(() => {
    if (!orderId) return;
    return onSnapshot(
      doc(db, 'customerTechChats', orderId),
      (snap) => setState({ id: orderId, chat: snap.exists() ? mapTechChat(snap.id, snap.data()) : null, loaded: true }),
      // Before the first message there is nothing to read, and the rules refuse it like a stranger's.
      () => setState({ id: orderId, chat: null, loaded: true }),
    );
  }, [orderId]);
  return state.id === orderId ? state : { chat: null, loaded: false };
}

/** The messages, oldest first, live (a job's conversation is short, so one page is enough). */
export function useTechChatMessages(orderId: string): { messages: TechChatMessage[]; loaded: boolean; failed: boolean } {
  const [state, setState] = useState<{ messages: TechChatMessage[]; loaded: boolean; failed: boolean }>({ messages: [], loaded: false, failed: false });
  const retry = useRetryKey();
  useEffect(() => {
    setState({ messages: [], loaded: false, failed: false });
    return onSnapshot(
      query(collection(db, 'customerTechChats', orderId, 'messages'), orderBy('createdAt'), limit(TECH_CHAT_PAGE)),
      { includeMetadataChanges: true },
      (snap) =>
        setState({
          messages: snap.docs.flatMap((d) => {
            const data = d.data();
            const senderRole = role(data.senderRole);
            if (!senderRole) return [];
            return [{
              id: d.id,
              senderRole,
              senderName: typeof data.senderName === 'string' ? data.senderName : '',
              text: typeof data.text === 'string' ? data.text : '',
              // A message still being sent has no server time yet.
              createdAt: toDate(data.createdAt) ?? new Date(),
              pending: d.metadata.hasPendingWrites,
            }];
          }),
          loaded: true,
          failed: false,
        }),
      // No conversation yet reads as "permission denied": that is an empty one, not a failure.
      (error) => setState({ messages: [], loaded: true, failed: !(error instanceof FirebaseError && error.code === 'permission-denied') }),
    );
  }, [orderId, retry]);
  return state;
}

/**
 * Sends [text] as the customer. The message and the conversation's "last message"
 * are written together, as the rules require; the first message also creates the
 * conversation with the order's details.
 */
export async function sendTechChatMessage(order: Order, customerId: string, text: string, exists: boolean): Promise<void> {
  const chatRef = doc(db, 'customerTechChats', order.id);
  const messageRef = doc(collection(chatRef, 'messages'));
  const last = {
    lastMessageId: messageRef.id,
    lastMessageText: text,
    lastMessageAt: serverTimestamp(),
    lastMessageSenderRole: 'customer',
    updatedAt: serverTimestamp(),
    customerLastReadAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(messageRef, {
    id: messageRef.id,
    senderId: customerId,
    senderRole: 'customer',
    senderName: order.customerName.trim().slice(0, 200),
    text,
    createdAt: serverTimestamp(),
  });
  if (exists) batch.update(chatRef, last);
  else {
    batch.set(chatRef, {
      id: order.id,
      orderId: order.id,
      companyId: order.companyId,
      customerId,
      productName: order.productName,
      createdAt: serverTimestamp(),
      ...last,
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    throw new Error(
      error instanceof FirebaseError && error.code === 'permission-denied'
        ? t('لم يعد بالإمكان الكتابة في هذه المحادثة.')
        : t('تعذر إرسال الرسالة. يرجى المحاولة مرة أخرى.'),
    );
  }
  // The technician gets it on their phone or browser (best effort).
  void pushTechChatMessage(order.id, messageRef.id);
}

/** Best effort: a failure only leaves the "new message" dot until it is opened again. */
export const markTechChatRead = (orderId: string): Promise<void> =>
  updateDoc(doc(db, 'customerTechChats', orderId), { customerLastReadAt: serverTimestamp() }).catch(() => undefined);
