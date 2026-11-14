import { describe, expect, it } from 'vitest';
import { activityAt, chatSubject, isInquiry, isUnread, mergeMessages, readByCompany } from './chats';
import type { ChatMessage, Conversation } from './types';

const at = (minute: number): Date => new Date(2026, 0, 1, 10, minute);

const conversation = (over: Partial<Conversation> = {}): Conversation => ({
  id: 'c',
  serviceRequestId: null,
  orderId: null,
  productId: null,
  companyServiceId: null,
  customerName: 'أحمد',
  companyId: 'co',
  companyName: 'شركة',
  serviceName: 'صيانة',
  productName: 'طابعة',
  createdAt: at(0),
  lastMessageText: '',
  lastMessageAt: null,
  lastMessageSenderRole: null,
  customerLastReadAt: null,
  companyLastReadAt: null,
  ...over,
});

const message = (id: string, minute: number, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  senderId: 'u',
  senderRole: 'customer',
  text: id,
  createdAt: at(minute),
  pending: false,
  ...over,
});

describe('conversations', () => {
  it('is unread only when the company wrote after the customer last read', () => {
    expect(isUnread(conversation())).toBe(false);
    expect(isUnread(conversation({ lastMessageAt: at(5), lastMessageSenderRole: 'customer' }))).toBe(false);
    expect(isUnread(conversation({ lastMessageAt: at(5), lastMessageSenderRole: 'company' }))).toBe(true);
    expect(isUnread(conversation({ lastMessageAt: at(5), lastMessageSenderRole: 'company', customerLastReadAt: at(4) }))).toBe(true);
    expect(isUnread(conversation({ lastMessageAt: at(5), lastMessageSenderRole: 'company', customerLastReadAt: at(5) }))).toBe(false);
  });

  it('names what it is about', () => {
    expect(chatSubject(conversation({ orderId: 'o' }))).toBe('طابعة');
    expect(chatSubject(conversation({ productId: 'p' }))).toBe('طابعة');
    expect(chatSubject(conversation({ serviceRequestId: 's' }))).toBe('صيانة');
    expect(isInquiry(conversation({ productId: 'p' }))).toBe(true);
    expect(isInquiry(conversation({ orderId: 'o' }))).toBe(false);
  });

  it('orders by the last message, or by when it began', () => {
    expect(activityAt(conversation())).toEqual(at(0));
    expect(activityAt(conversation({ lastMessageAt: at(9) }))).toEqual(at(9));
  });
});

describe('messages', () => {
  it('shows a message as read only once the company opened it after it was sent', () => {
    const sent = message('a', 5);
    expect(readByCompany(conversation(), sent)).toBe(false);
    expect(readByCompany(conversation({ companyLastReadAt: at(4) }), sent)).toBe(false);
    expect(readByCompany(conversation({ companyLastReadAt: at(5) }), sent)).toBe(true);
    expect(readByCompany(conversation({ companyLastReadAt: at(9) }), message('b', 5, { pending: true }))).toBe(false);
  });

  it('keeps older messages when newer ones arrive, each once, oldest first', () => {
    const older = [message('a', 1), message('b', 2)];
    const merged = mergeMessages(older, [message('c', 3), message('b', 2)]);
    expect(merged.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(mergeMessages(merged, [message('z', 0)]).map((m) => m.id)).toEqual(['z', 'a', 'b', 'c']);
  });

  it('replaces a pending copy with the confirmed one', () => {
    const merged = mergeMessages([message('a', 1, { pending: true })], [message('a', 1)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].pending).toBe(false);
  });
});
