import { useEffect, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { collection, doc, limitToLast, onSnapshot, orderBy, query, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { t } from '../i18n';
import { pushTechChatMessage } from './pushRelay';
import { useRetryKey } from './retry';
import type { Order } from './types';

/*
 * The conversation between the customer and the technician the company sent
 * for their order (`customerTechChats/{orderId}`, the same as the app). It is
 * open from the assignment until the order is completed or cancelled, then
 * read only. The company reads it too; no phone number is in it.
 */

export const TECH_MESSAGE_MAX = 2000;
/** The latest messages; a job's conversation is short. */
const SHOWN = 200;

export interface TechChat {
  id: string;
  lastMessageAt: Date | null;
  lastMessageSenderRole: 'customer' | 'technician' | null;
  customerLastReadAt: Date | null;
}

export interface TechMessage {
  id: string;
  senderRole: 'customer' | 'technician';
  senderName: string;
  text: string;
  createdAt: Date;
  pending: boolean;
}

const dateOf = (v: unknown): Date | null =>
  v && typeof (v as { toDate?: unknown }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : null;

const roleOf = (v: unknown): 'customer' | 'technician' | null => (v === 'customer' || v === 'technician' ? v : null);

export function mapTechChat(id: string, d: DocumentData): TechChat {
  return {
    id,
    lastMessageAt: dateOf(d.lastMessageAt),
    lastMessageSenderRole: roleOf(d.lastMessageSenderRole),
    customerLastReadAt: dateOf(d.customerLastReadAt),
  };
}

/** The technician wrote last and the customer has not opened it since. */
export function techChatUnread(c: TechChat | null): boolean {
  if (!c || !c.lastMessageAt || c.lastMessageSenderRole !== 'technician') return false;
  return !c.customerLastReadAt || c.customerLastReadAt < c.lastMessageAt;
}

/** Whether the two sides may still write in it. */
export const techChatOpen = (order: Order): boolean =>
  order.technicianId !== null && order.orderStatus !== 'completed' && order.orderStatus !== 'cancelled';

/**
 * The conversation, live; null before its first message (the rules then
 * refuse the read, which here means "nothing yet").
 */
export function useTechChat(orderId: string): { chat: TechChat | null; loaded: boolean } {
  const [state, setState] = useState<{ id: string; chat: TechChat | null; loaded: boolean }>({ id: orderId, chat: null, loaded: false });
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'customerTechChats', orderId),
        (snap) => setState({ id: orderId, chat: snap.exists() ? mapTechChat(snap.id, snap.data()) : null, loaded: true }),
        () => setState({ id: orderId, chat: null, loaded: true }),
      ),
    [orderId],
  );
  return state.id === orderId ? state : { chat: null, loaded: false };
}

/** The latest messages, oldest first. A refused read (no conversation yet) is an empty one. */
export function useTechMessages(orderId: string): { messages: TechMessage[]; loaded: boolean; failed: boolean } {
  const [state, setState] = useState<{ messages: TechMessage[]; loaded: boolean; failed: boolean }>({ messages: [], loaded: false, failed: false });
  const retry = useRetryKey();
  useEffect(() => {
    setState({ messages: [], loaded: false, failed: false });
    return onSnapshot(
      query(collection(db, 'customerTechChats', orderId, 'messages'), orderBy('createdAt'), limitToLast(SHOWN)),
      { includeMetadataChanges: true },
      (snap) =>
        setState({
          messages: snap.docs.flatMap((d) => {
            const data = d.data();
            const senderRole = roleOf(data.senderRole);
            if (!senderRole) return [];
            return [{
              id: d.id,
              senderRole,
              senderName: typeof data.senderName === 'string' ? data.senderName : '',
              text: typeof data.text === 'string' ? data.text : '',
              createdAt: dateOf(data.createdAt) ?? new Date(),
              pending: d.metadata.hasPendingWrites,
            }];
          }),
          loaded: true,
          failed: false,
        }),
      (error) =>
        setState({ messages: [], loaded: true, failed: !(error instanceof FirebaseError && error.code === 'permission-denied') }),
    );
  }, [orderId, retry]);
  return state;
}

/** The message and the conversation go together: the rules require both. */
export async function sendTechMessage(order: Order, customerId: string, text: string, existing: boolean): Promise<void> {
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
  if (existing) {
    batch.update(chatRef, last);
  } else {
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

/** Best effort: a failure only leaves the unread mark until it is opened again. */
export const markTechChatRead = (orderId: string): Promise<void> =>
  updateDoc(doc(db, 'customerTechChats', orderId), { customerLastReadAt: serverTimestamp() }).catch(() => undefined);
