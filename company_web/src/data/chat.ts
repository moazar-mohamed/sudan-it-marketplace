import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { mapMessage } from './mappers';
import type { ChatMessage } from './types';

/** The order's conversation: null while loading, false when the order has none. */
export function useOrderChat(orderId: string): { exists: boolean | null; messages: ChatMessage[] } {
  const [exists, setExists] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    setExists(null);
    const offChat = onSnapshot(doc(db, 'chats', orderId), (s) => setExists(s.exists()), () => setExists(false));
    const offMessages = onSnapshot(
      query(collection(db, 'chats', orderId, 'messages'), orderBy('createdAt', 'asc')),
      (s) => setMessages(s.docs.map((d) => mapMessage(d.id, d.data()))),
      () => setMessages([]),
    );
    return () => {
      offChat();
      offMessages();
    };
  }, [orderId]);
  return { exists, messages };
}

/**
 * Sends a text message as the company, in one batch with the conversation's
 * last-message update (the rules require both together). Returns false when the
 * order has no conversation or the write is refused.
 */
export async function sendChatMessage(chatId: string, text: string, senderName: string): Promise<boolean> {
  const user = auth.currentUser;
  const clean = text.trim();
  if (!user || !clean || clean.length > 2000) return false;
  try {
    if (!(await getDoc(doc(db, 'chats', chatId))).exists()) return false;
    const chatRef = doc(db, 'chats', chatId);
    const messageRef = doc(collection(db, 'chats', chatId, 'messages'));
    const batch = writeBatch(db);
    batch.set(messageRef, {
      id: messageRef.id,
      senderId: user.uid,
      senderRole: 'company',
      senderName: senderName.slice(0, 200),
      text: clean,
      createdAt: serverTimestamp(),
    });
    batch.update(chatRef, {
      lastMessageId: messageRef.id,
      lastMessageText: clean,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderRole: 'company',
      updatedAt: serverTimestamp(),
      companyLastReadAt: serverTimestamp(),
    });
    await batch.commit();
    return true;
  } catch {
    return false;
  }
}
