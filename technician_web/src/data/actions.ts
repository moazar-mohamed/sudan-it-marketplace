import {
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { pushJobChatMessage, pushToPhone } from './pushRelay';
import { MESSAGE_MAX, NOTE_MAX, type Job, type OrderStatus } from './types';

/*
 * Every write the technician makes, as the app makes it (TechnicianActions,
 * JobChatStore, TechnicianNotesStore). They are plain writes, never
 * transactions, so with no network Firestore keeps them on the device and
 * sends them, in order, when the network is back.
 */

/** How long to wait for the server before treating a write as "kept on the device". */
const SERVER_WAIT_MS = 6000;

export type WriteResult = 'sent' | 'queued';

/**
 * Waits for the server, but not forever: offline (or on a very slow network)
 * the write is already in the device's copy and goes out by itself later.
 * A refusal by the server (rules) still throws.
 */
async function settle(write: Promise<unknown>): Promise<WriteResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    write.catch(() => undefined);
    return 'queued';
  }
  let timer = 0;
  const waited = new Promise<WriteResult>((resolve) => {
    timer = window.setTimeout(() => resolve('queued'), SERVER_WAIT_MS);
  });
  try {
    return await Promise.race([write.then(() => 'sent' as const), waited]);
  } finally {
    window.clearTimeout(timer);
  }
}

/** One notification, with the fixed id the rules expect (sending it twice is refused and ignored). Best effort. */
async function notify(
  recipientType: 'customer' | 'company_admin',
  recipientId: string,
  type: 'out_for_delivery' | 'order_completed' | 'job_completed',
  job: Job,
): Promise<void> {
  const id = `${job.id}_${type}`;
  const write = setDoc(doc(db, 'notifications', id), {
    id,
    recipientType,
    recipientId,
    orderId: job.id,
    type,
    productName: job.productName,
    isRead: false,
    createdAt: serverTimestamp(),
    senderId: auth.currentUser?.uid ?? '',
  });
  try {
    if ((await settle(write)) === 'sent') void pushToPhone(id);
  } catch {
    // Refused or failed: the status change it follows stands.
  }
}

/** Moves [job] one step on (out for delivery, or completed), then tells the customer (and, when finished, the company). */
export async function advanceJob(job: Job, next: OrderStatus): Promise<WriteResult> {
  const result = await settle(
    updateDoc(doc(db, 'orders', job.id), { orderStatus: next, updatedAt: serverTimestamp() }),
  );
  // As NotificationEvents.forOrderStatusChange: no notice for processing or cancelled.
  if (next === 'out_for_delivery') void notify('customer', job.customerId, 'out_for_delivery', job);
  if (next === 'completed') {
    void notify('customer', job.customerId, 'order_completed', job);
    void notify('company_admin', job.companyId, 'job_completed', job);
  }
  return result;
}

/** Completed first; the remark for the company after it. A failed remark never undoes the completion. */
export async function finishJob(job: Job, note: string, authorName: string): Promise<{ result: WriteResult; noteSaved: boolean }> {
  const result = await advanceJob(job, 'completed');
  if (!note.trim()) return { result, noteSaved: true };
  try {
    await addNote(job, note, authorName, 'completion');
    return { result, noteSaved: true };
  } catch {
    return { result, noteSaved: false };
  }
}

export async function addNote(job: Job, text: string, authorName: string, kind: 'note' | 'completion' = 'note'): Promise<WriteResult> {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > NOTE_MAX) throw Object.assign(new Error('invalid'), { code: 'invalid-argument' });
  const ref = doc(collection(db, 'orders', job.id, 'technicianNotes'));
  return settle(
    setDoc(ref, {
      id: ref.id,
      orderId: job.id,
      companyId: job.companyId,
      technicianId: job.technicianId,
      authorId: auth.currentUser?.uid ?? '',
      authorName: authorName.trim(),
      kind,
      text: trimmed,
      createdAt: serverTimestamp(),
    }),
  );
}

export function deleteNote(orderId: string, noteId: string): Promise<WriteResult> {
  return settle(deleteDoc(doc(db, 'orders', orderId, 'technicianNotes', noteId)));
}

/** The technician's own "taking new jobs" switch (technicians/{id}.isAvailable). */
export function setAvailability(technicianId: string, available: boolean): Promise<WriteResult> {
  return settle(updateDoc(doc(db, 'technicians', technicianId), { isAvailable: available, updatedAt: serverTimestamp() }));
}

/** Writes the message and the conversation together (the rules require both); [existing] says whether the conversation is there yet. */
export async function sendJobMessage(job: Job, text: string, senderName: string, existing: boolean): Promise<WriteResult> {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MESSAGE_MAX) throw Object.assign(new Error('invalid'), { code: 'invalid-argument' });
  const chatRef = doc(db, 'jobChats', job.id);
  const messageRef = doc(collection(chatRef, 'messages'));
  const last = {
    lastMessageId: messageRef.id,
    lastMessageText: trimmed,
    lastMessageAt: serverTimestamp(),
    lastMessageSenderRole: 'technician',
    updatedAt: serverTimestamp(),
    technicianLastReadAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(messageRef, {
    id: messageRef.id,
    senderId: auth.currentUser?.uid ?? '',
    senderRole: 'technician',
    senderName: senderName.trim(),
    text: trimmed,
    createdAt: serverTimestamp(),
  });
  if (existing) batch.update(chatRef, last);
  else
    batch.set(chatRef, {
      id: job.id,
      orderId: job.id,
      companyId: job.companyId,
      technicianId: job.technicianId,
      technicianName: job.technicianName,
      productName: job.productName,
      createdAt: serverTimestamp(),
      ...last,
    });
  const result = await settle(batch.commit());
  // The company's phones hear of it (best effort; the message is stored either way).
  if (result === 'sent') void pushJobChatMessage(job.id, messageRef.id);
  return result;
}

/** Best effort: a failure only leaves the unread mark on. */
export function markChatRead(orderId: string): void {
  updateDoc(doc(db, 'jobChats', orderId), { technicianLastReadAt: serverTimestamp() }).catch(() => undefined);
}

export function markNoticeRead(id: string): void {
  updateDoc(doc(db, 'notifications', id), { isRead: true }).catch(() => undefined);
}

/** Which kinds of push this person wants (users/{uid}.pushPrefs, read by the relay). */
export function savePushPrefs(uid: string, prefs: Record<string, boolean>): Promise<WriteResult> {
  return settle(updateDoc(doc(db, 'users', uid), { pushPrefs: prefs }));
}
