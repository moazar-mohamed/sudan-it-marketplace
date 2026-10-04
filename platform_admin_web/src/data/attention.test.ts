import { describe, expect, it } from 'vitest';
import { buildAuditEntry } from './auditLog';
import { mapAuditEntry, mapOrder, mapReview, mapServiceRequest } from './mappers';
import {
  compareWindows,
  isRecentLowReview,
  isStaleServiceRequest,
  isStuckOrder,
  isUnverifiedPaymentOverdue,
  matchesOrderAttention,
  percentChange,
} from './stats';

const NOW = new Date('2026-10-03T12:00:00Z').getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000);
const daysAgo = (d: number) => hoursAgo(d * 24);

const order = (extra: Record<string, unknown>) =>
  mapOrder('o', { customerId: 'u', totalAmount: 100, ...extra });

describe('orders that need attention', () => {
  it('an unverified payment is overdue only after 24 hours, and only while processing', () => {
    const base = { orderStatus: 'processing', paymentStatus: 'pending_verification' };
    expect(isUnverifiedPaymentOverdue(order({ ...base, createdAt: hoursAgo(25) }), NOW)).toBe(true);
    expect(isUnverifiedPaymentOverdue(order({ ...base, createdAt: hoursAgo(23) }), NOW)).toBe(false);
    expect(
      isUnverifiedPaymentOverdue(order({ ...base, orderStatus: 'cancelled', createdAt: hoursAgo(30) }), NOW),
    ).toBe(false);
    expect(
      isUnverifiedPaymentOverdue(order({ ...base, paymentStatus: 'confirmed', createdAt: hoursAgo(30) }), NOW),
    ).toBe(false);
  });

  it('an order with no date is never flagged', () => {
    expect(
      isUnverifiedPaymentOverdue(order({ orderStatus: 'processing', paymentStatus: 'pending_verification' }), NOW),
    ).toBe(false);
  });

  it('a paid order is stuck after 5 days unless it is finished', () => {
    const paid = { paymentStatus: 'confirmed', createdAt: daysAgo(6) };
    expect(isStuckOrder(order({ ...paid, orderStatus: 'processing' }), NOW)).toBe(true);
    expect(isStuckOrder(order({ ...paid, orderStatus: 'out_for_delivery' }), NOW)).toBe(true);
    expect(isStuckOrder(order({ ...paid, orderStatus: 'completed' }), NOW)).toBe(false);
    expect(isStuckOrder(order({ ...paid, orderStatus: 'cancelled' }), NOW)).toBe(false);
    expect(isStuckOrder(order({ ...paid, orderStatus: 'processing', createdAt: daysAgo(4) }), NOW)).toBe(false);
    // Unpaid orders are the other rule's business.
    expect(isStuckOrder(order({ ...paid, paymentStatus: 'pending_verification', orderStatus: 'processing' }), NOW)).toBe(
      false,
    );
  });

  it('the list filter uses the same rule as the count', () => {
    const o = order({ orderStatus: 'processing', paymentStatus: 'pending_verification', createdAt: hoursAgo(40) });
    expect(matchesOrderAttention(o, 'unverified', NOW)).toBe(isUnverifiedPaymentOverdue(o, NOW));
    expect(matchesOrderAttention(o, 'stuck', NOW)).toBe(isStuckOrder(o, NOW));
  });
});

describe('service requests and reviews that need attention', () => {
  const request = (extra: Record<string, unknown>) => mapServiceRequest('r', { ...extra });

  it('a pending request is stale after 48 hours', () => {
    expect(isStaleServiceRequest(request({ status: 'pending', createdAt: hoursAgo(49) }), NOW)).toBe(true);
    expect(isStaleServiceRequest(request({ status: 'pending', createdAt: hoursAgo(47) }), NOW)).toBe(false);
    expect(isStaleServiceRequest(request({ status: 'accepted', createdAt: hoursAgo(90) }), NOW)).toBe(false);
  });

  it('a low review counts for 14 days, only while visible', () => {
    const review = (extra: Record<string, unknown>) => mapReview('v', { stars: 1, createdAt: daysAgo(3), ...extra });
    expect(isRecentLowReview(review({}), NOW)).toBe(true);
    expect(isRecentLowReview(review({ stars: 2 }), NOW)).toBe(true);
    expect(isRecentLowReview(review({ stars: 3 }), NOW)).toBe(false);
    expect(isRecentLowReview(review({ createdAt: daysAgo(15) }), NOW)).toBe(false);
    expect(isRecentLowReview(review({ hidden: true }), NOW)).toBe(false);
    expect(isRecentLowReview(review({ createdAt: undefined }), NOW)).toBe(false);
  });
});

describe('30-day comparison', () => {
  const dated = [daysAgo(1), daysAgo(29), daysAgo(31), daysAgo(59), daysAgo(61), null];

  it('splits items into the last 30 days and the 30 before', () => {
    expect(compareWindows(dated, (d) => d, NOW)).toEqual({ current: 2, previous: 2 });
  });

  it('sums a value instead of counting', () => {
    const items = [
      { at: daysAgo(2), amount: 40 },
      { at: daysAgo(40), amount: 10 },
    ];
    expect(
      compareWindows(items, (i) => i.at, NOW, (i) => i.amount),
    ).toEqual({ current: 40, previous: 10 });
  });

  it('ignores dates in the future', () => {
    expect(compareWindows([new Date(NOW + 1000)], (d) => d, NOW)).toEqual({ current: 0, previous: 0 });
  });

  it('percent change rounds, and is null with nothing to compare against', () => {
    expect(percentChange({ current: 15, previous: 10 })).toBe(50);
    expect(percentChange({ current: 5, previous: 10 })).toBe(-50);
    expect(percentChange({ current: 1, previous: 3 })).toBe(-67);
    expect(percentChange({ current: 7, previous: 0 })).toBeNull();
  });
});

describe('activity entries', () => {
  const actor = { id: 'admin1', name: '  Mona  ' };

  it('builds exactly the fields the rules accept, trimmed', () => {
    expect(
      buildAuditEntry(actor, { action: 'company.status', targetType: 'company', targetId: 'c1', targetName: ' Nile Co ', detail: 'inactive' }),
    ).toEqual({
      actorId: 'admin1',
      actorName: 'Mona',
      action: 'company.status',
      targetType: 'company',
      targetId: 'c1',
      targetName: 'Nile Co',
      detail: 'inactive',
    });
  });

  it('leaves detail out when empty (the rules treat it as optional) and name as an empty string', () => {
    const entry = buildAuditEntry(actor, { action: 'company.delete', targetType: 'company', targetId: 'c1' });
    expect('detail' in entry).toBe(false);
    expect(entry.targetName).toBe('');
  });

  it('clips long text to the limits in the rules', () => {
    const entry = buildAuditEntry(
      { id: 'a', name: 'x'.repeat(500) },
      { action: 'a'.repeat(99), targetType: 'review', targetId: 'i'.repeat(300), targetName: 'n'.repeat(900), detail: 'd'.repeat(900) },
    );
    expect(entry.actorName).toHaveLength(200);
    expect(entry.action).toHaveLength(60);
    expect(entry.targetId).toHaveLength(128);
    expect(entry.targetName).toHaveLength(200);
    expect(entry.detail).toHaveLength(200);
  });

  it('maps a stored entry, tolerating missing fields', () => {
    const entry = mapAuditEntry('e1', { action: 'review.hide', targetType: 'review', createdAt: daysAgo(1) });
    expect(entry).toMatchObject({ id: 'e1', action: 'review.hide', actorName: '', detail: '' });
    expect(entry.createdAt).toEqual(daysAgo(1));
  });
});
