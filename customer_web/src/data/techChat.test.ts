import { describe, expect, it } from 'vitest';
import { techChatOpen, techChatUnread } from './techChat';
import type { TechChat } from './techChat';

const chat = (over: Partial<TechChat> = {}): TechChat => ({
  id: 'o1', lastMessageAt: new Date('2026-11-15T10:00:00Z'), lastMessageSenderRole: 'technician', customerLastReadAt: null, ...over,
});

describe('the customer and technician conversation', () => {
  it('marks a technician message the customer has not read', () => {
    expect(techChatUnread(chat())).toBe(true);
    expect(techChatUnread(chat({ customerLastReadAt: new Date('2026-11-15T09:00:00Z') }))).toBe(true);
  });

  it('is read once the customer opened it after the last message', () => {
    expect(techChatUnread(chat({ customerLastReadAt: new Date('2026-11-15T10:05:00Z') }))).toBe(false);
  });

  it('never marks the customer\'s own last message, or a conversation that does not exist yet', () => {
    expect(techChatUnread(chat({ lastMessageSenderRole: 'customer' }))).toBe(false);
    expect(techChatUnread(null)).toBe(false);
    expect(techChatUnread(chat({ lastMessageAt: null }))).toBe(false);
  });

  it('is open only while a technician is assigned and the order is not finished', () => {
    expect(techChatOpen({ technicianId: 't1', orderStatus: 'processing' })).toBe(true);
    expect(techChatOpen({ technicianId: 't1', orderStatus: 'out_for_delivery' })).toBe(true);
    expect(techChatOpen({ technicianId: null, orderStatus: 'processing' })).toBe(false);
    expect(techChatOpen({ technicianId: 't1', orderStatus: 'completed' })).toBe(false);
    expect(techChatOpen({ technicianId: 't1', orderStatus: 'cancelled' })).toBe(false);
  });
});
