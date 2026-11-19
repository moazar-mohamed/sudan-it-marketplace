import {
  collection,
  doc,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { pushJobChatMessage } from './pushRelay';
import type { Order } from './types';

/*
 * The conversation between the company and the technician it sent for an order
 * (`jobChats/{orderId}`), the same one the app's company screens and the
 * technician portal use. The customer never sees it. The rules let the
 * company's admins and the order's technician write; nobody lists it, it is
 * opened by the order's id.
 */

export interface JobLine {
  id: string;
  fromCompany: boolean;
  name: string;
  text: string;
  at: Date | null;
}

export interface JobChatHead {
  lastMessageText: string;
  lastMessageAt: Date | null;
  lastFromTechnician: boolean;
  companyLastReadAt: Date | null;
}

const MESSAGE_MAX = 2000;

const dateOf = (v: unknown): Date | null =>
  v && typeof (v as { toDate?: unknown }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : null;

const lineOf = (id: string, d: DocumentData): JobLine => ({
  id,
  fromCompany: d.senderRole === 'company',
  name: typeof d.senderName === 'string' ? d.senderName.trim() : '',
  text: typeof d.text === 'string' ? d.text : '',
  at: dateOf(d.createdAt),
});

/** The technician wrote last and the company has not opened the conversation since. */
export const jobChatUnread = (h: JobChatHead | null): boolean =>
  !!h &&
  h.lastFromTechnician &&
  !!h.lastMessageAt &&
  (!h.companyLastReadAt || h.companyLastReadAt.getTime() < h.lastMessageAt.getTime());

/** The conversation's head, live: undefined while it loads, null when nobody wrote yet. */
export function useJobChatHead(orderId: string): JobChatHead | null | undefined {
  const [head, setHead] = useState<JobChatHead | null | undefined>(undefined);
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'jobChats', orderId),
        (snap) => {
          const d = snap.data();
          setHead(
            d
              ? {
                  lastMessageText: typeof d.lastMessageText === 'string' ? d.lastMessageText : '',
                  lastMessageAt: dateOf(d.lastMessageAt),
                  lastFromTechnician: d.lastMessageSenderRole === 'technician',
                  companyLastReadAt: dateOf(d.companyLastReadAt),
                }
              : null,
          );
        },
        () => setHead(null),
      ),
    [orderId],
  );
  return head;
}

/** The newest 200 messages, live, only while [open] (each read spends the free quota). */
export function useJobChatLines(orderId: string, open: boolean): JobLine[] | null {
  const [lines, setLines] = useState<JobLine[] | null>(null);
  useEffect(() => {
    if (!open) return;
    setLines(null);
    return onSnapshot(
      query(collection(db, 'jobChats', orderId, 'messages'), orderBy('createdAt'), limitToLast(200)),
      (snap) => setLines(snap.docs.map((d) => lineOf(d.id, d.data()))),
      () => setLines([]),
    );
  }, [orderId, open]);
  return lines;
}

/** Moves the company's read marker to now. Never throws. */
export function markJobChatRead(orderId: string): void {
  updateDoc(doc(db, 'jobChats', orderId), { companyLastReadAt: serverTimestamp() }).catch(() => undefined);
}

/**
 * Writes the message and the conversation together (the rules require both);
 * [exists] says whether the conversation is there yet. Then asks the relay to
 * push it to the technician (best effort). Returns false when it was refused.
 */
export async function sendJobChatMessage(order: Order, text: string, senderName: string, exists: boolean): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MESSAGE_MAX || !order.technicianId) return false;
  const chatRef = doc(db, 'jobChats', order.id);
  const messageRef = doc(collection(chatRef, 'messages'));
  const last = {
    lastMessageId: messageRef.id,
    lastMessageText: trimmed,
    lastMessageAt: serverTimestamp(),
    lastMessageSenderRole: 'company',
    updatedAt: serverTimestamp(),
    companyLastReadAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(messageRef, {
    id: messageRef.id,
    senderId: auth.currentUser?.uid ?? '',
    senderRole: 'company',
    senderName: senderName.trim().slice(0, 200),
    text: trimmed,
    createdAt: serverTimestamp(),
  });
  if (exists) batch.update(chatRef, last);
  else
    batch.set(chatRef, {
      id: order.id,
      orderId: order.id,
      companyId: order.companyId,
      technicianId: order.technicianId,
      technicianName: (order.technicianName ?? '').slice(0, 120),
      productName: order.productName.slice(0, 200),
      createdAt: serverTimestamp(),
      ...last,
    });
  try {
    await batch.commit();
  } catch {
    return false;
  }
  void pushJobChatMessage(order.id, messageRef.id);
  return true;
}
