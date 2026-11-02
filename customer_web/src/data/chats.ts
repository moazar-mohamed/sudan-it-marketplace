import { useCallback, useEffect, useRef, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useCollection } from './hooks';
import type { Loaded } from './hooks';
import { mapConversation, mapMessage } from './mappers';
import { useRetryKey } from './retry';
import type { ChatMessage, Conversation, Order, Product } from './types';
import { t } from '../i18n';

// Port of firestore_chats_remote_data_source.dart, except that a conversation
// loads its latest messages and fetches older ones as the reader scrolls up:
// every message read spends part of the free daily quota.

export const MESSAGE_MAX = 2000;
const CUSTOMER_NAME_MAX = 120;
const PAGE = 30;

/** A message for the customer: why nothing was sent or opened. */
export class ChatRefused extends Error {}

const refusal = (error: unknown): string => (error instanceof FirebaseError ? error.code : '');

export const isInquiry = (c: Conversation): boolean => c.orderId === null && c.serviceRequestId === null;

/** What the conversation is about: the service name, or the product name. */
export const chatSubject = (c: Conversation): string =>
  c.orderId !== null || c.productId !== null ? c.productName : c.serviceName;

export const activityAt = (c: Conversation): Date => c.lastMessageAt ?? c.createdAt;

/** The company wrote last and the customer has not opened it since. */
export function isUnread(c: Conversation): boolean {
  if (!c.lastMessageAt || c.lastMessageSenderRole !== 'company') return false;
  return !c.customerLastReadAt || c.customerLastReadAt < c.lastMessageAt;
}

/** The company has opened the conversation since [message] was sent. */
export const readByCompany = (c: Conversation, message: ChatMessage): boolean =>
  !message.pending && c.companyLastReadAt !== null && c.companyLastReadAt >= message.createdAt;

/** Oldest first, each message once: messages never change, so a later copy only replaces a pending one. */
export function mergeMessages(known: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(known.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/** Sorted here (most recent activity first) so no composite index is needed. */
export function useConversations(uid: string): Loaded<Conversation> {
  const r = useCollection<Conversation>(
    () => query(collection(db, 'chats'), where('customerId', '==', uid)),
    mapConversation,
    uid,
  );
  return { ...r, items: r.items ? [...r.items].sort((a, b) => activityAt(b).getTime() - activityAt(a).getTime()) : null };
}

/** One conversation, live; null when it is not there or is not the reader's. */
export function useConversation(id: string): { conversation: Conversation | null; loaded: boolean } {
  const [state, setState] = useState<{ id: string; conversation: Conversation | null; loaded: boolean }>({ id, conversation: null, loaded: false });
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'chats', id),
        (snap) => setState({ id, conversation: snap.exists() ? mapConversation(snap.id, snap.data()) : null, loaded: true }),
        () => setState({ id, conversation: null, loaded: true }),
      ),
    [id],
  );
  return state.id === id ? state : { conversation: null, loaded: false };
}

export interface MessagesState {
  messages: ChatMessage[];
  loaded: boolean;
  failed: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
}

/**
 * The latest messages live, and older ones page by page. What has been shown
 * stays shown, so a long burst of new messages never pushes older ones away.
 */
export function useMessages(chatId: string): MessagesState {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const oldest = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const anchored = useRef(false);
  const busy = useRef(false);
  const retry = useRetryKey();
  const messagesRef = collection(db, 'chats', chatId, 'messages');

  useEffect(() => {
    setMessages([]);
    setLoaded(false);
    setFailed(false);
    setHasOlder(false);
    oldest.current = null;
    anchored.current = false;
    return onSnapshot(
      query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(PAGE)),
      { includeMetadataChanges: true },
      (snap) => {
        // What this browser saved may be only part of the page, so the place to
        // continue from comes from the server's first answer.
        if (!anchored.current && !snap.metadata.fromCache) {
          anchored.current = true;
          // A message still being sent has no time yet, so it cannot be a cursor.
          const settled = snap.docs.filter((d) => !d.metadata.hasPendingWrites);
          oldest.current = settled[settled.length - 1] ?? null;
          setHasOlder(snap.size >= PAGE);
        }
        setMessages((known) =>
          mergeMessages(known, snap.docs.map((d) => mapMessage(d.id, d.data(), d.metadata.hasPendingWrites))),
        );
        setLoaded(true);
      },
      () => {
        setFailed(true);
        setLoaded(true);
      },
    );
  }, [chatId, retry]);

  const loadOlder = useCallback(() => {
    if (busy.current || !oldest.current) return;
    busy.current = true;
    setLoadingOlder(true);
    getDocs(query(messagesRef, orderBy('createdAt', 'desc'), startAfter(oldest.current), limit(PAGE)))
      .then((snap) => {
        if (!snap.empty) oldest.current = snap.docs[snap.docs.length - 1];
        setHasOlder(snap.size >= PAGE);
        setMessages((known) => mergeMessages(known, snap.docs.map((d) => mapMessage(d.id, d.data(), false))));
      })
      .catch(() => setHasOlder(true))
      .finally(() => {
        busy.current = false;
        setLoadingOlder(false);
      });
    // messagesRef follows chatId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  return { messages, loaded, failed, hasOlder, loadingOlder, loadOlder };
}

/** The message and the conversation's "last message" go together: the rules require both. */
export async function sendMessage(conversation: Conversation, senderId: string, text: string): Promise<void> {
  const chatRef = doc(db, 'chats', conversation.id);
  const messageRef = doc(collection(chatRef, 'messages'));
  const batch = writeBatch(db);
  batch.set(messageRef, {
    id: messageRef.id,
    senderId,
    senderRole: 'customer',
    senderName: conversation.customerName,
    text,
    createdAt: serverTimestamp(),
  });
  batch.update(chatRef, {
    lastMessageId: messageRef.id,
    lastMessageText: text,
    lastMessageAt: serverTimestamp(),
    lastMessageSenderRole: 'customer',
    updatedAt: serverTimestamp(),
    customerLastReadAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (error) {
    throw new ChatRefused(
      refusal(error) === 'permission-denied'
        ? t('لا يمكنك إرسال رسائل في هذه المحادثة.')
        : t('تعذر إرسال الرسالة. يرجى المحاولة مرة أخرى.'),
    );
  }
}

/** Best effort: a failure only leaves the unread mark until it is opened again. */
export const markRead = (chatId: string): Promise<void> =>
  updateDoc(doc(db, 'chats', chatId), { customerLastReadAt: serverTimestamp() }).catch(() => undefined);

/**
 * Reuses the conversation when it exists, otherwise creates it. The rules refuse
 * reading one that does not exist yet just as they refuse a stranger's, so a
 * refused read means "not there yet"; only the create can tell a real refusal.
 */
async function openChat(id: string, data: DocumentData): Promise<string> {
  const chatRef = doc(db, 'chats', id);
  try {
    if ((await getDoc(chatRef)).exists()) return id;
  } catch (error) {
    if (refusal(error) !== 'permission-denied') throw new ChatRefused(t('تعذر بدء المحادثة. يرجى المحاولة مرة أخرى.'));
  }
  try {
    await setDoc(chatRef, {
      id,
      serviceRequestId: null,
      orderId: null,
      serviceName: '',
      productName: '',
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    throw new ChatRefused(
      refusal(error) === 'permission-denied'
        ? t('لا يمكنك مراسلة هذه الشركة الآن.')
        : t('تعذر بدء المحادثة. يرجى المحاولة مرة أخرى.'),
    );
  }
}

/** The customer's questions about one product, before ordering; asking again reopens them. */
export const openProductInquiry = (customerId: string, customerName: string, product: Product): Promise<string> =>
  openChat(`${customerId}_product_${product.id}`, {
    productId: product.id,
    productName: product.name,
    customerId,
    customerName: customerName.slice(0, CUSTOMER_NAME_MAX),
    companyId: product.companyId,
    companyName: product.companyName,
  });

/** The same for one company's offer of a service. */
export const openServiceInquiry = (
  customerId: string,
  customerName: string,
  offerId: string,
  companyId: string,
  companyName: string,
  serviceName: string,
): Promise<string> =>
  openChat(`${customerId}_service_${offerId}`, {
    companyServiceId: offerId,
    serviceName,
    customerId,
    customerName: customerName.slice(0, CUSTOMER_NAME_MAX),
    companyId,
    companyName,
  });

/** An order placed before conversations existed gets its one on first use. */
export const openOrderChat = (customerId: string, order: Order): Promise<string> =>
  openChat(order.id, {
    orderId: order.id,
    productName: order.productName,
    customerId,
    customerName: order.customerName,
    companyId: order.companyId,
    companyName: order.companyName,
  });
