import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Notice } from './inbox';
import { newArrivals, RINGING_TYPES } from './newArrivals';
import { titleWithCount } from './titleCount';
import { MAX_PUSH_TOKENS, nextPushTokens, VAPID_KEY } from './webPush';

const notice = (id: string, type = 'new_order', isRead = false): Notice => ({
  id,
  type,
  orderId: 'o1',
  serviceRequestId: '',
  productId: '',
  productName: 'Router',
  isRead,
  createdAt: new Date(),
});

describe('the devices an admin keeps for pushes', () => {
  it('adds this browser last, moves it last when known, and keeps the newest eight', () => {
    expect(MAX_PUSH_TOKENS).toBe(8);
    expect(nextPushTokens(['phone', 'web'], 'web')).toEqual(['phone', 'web']);
    expect(nextPushTokens(['web', 'phone'], 'web')).toEqual(['phone', 'web']);
    const eight = ['1', '2', '3', '4', '5', '6', '7', '8'];
    expect(nextPushTokens(eight, '9')).toEqual(['2', '3', '4', '5', '6', '7', '8', '9']);
    expect(nextPushTokens(null, 'web')).toEqual(['web']);
  });

  it('uses the project\'s own Web Push key, the same one as the customer site', () => {
    const customer = readFileSync(join(__dirname, '../../../customer_web/src/data/webPush.ts'), 'utf8');
    expect(customer).toContain(VAPID_KEY);
    expect(atob(VAPID_KEY.replace(/-/g, '+').replace(/_/g, '/')).length).toBe(65);
  });
});

describe('what rings while the panel is open', () => {
  it('nothing on the first list the panel reads', () => {
    const { fresh, known } = newArrivals(null, [notice('a'), notice('b')]);
    expect(fresh).toEqual([]);
    expect([...known].sort()).toEqual(['a', 'b']);
  });

  it('each unread notice that was not there before, once', () => {
    const first = newArrivals(null, [notice('a')]);
    const second = newArrivals(first.known, [notice('b'), notice('a')]);
    expect(second.fresh.map((n) => n.id)).toEqual(['b']);
    const third = newArrivals(second.known, [notice('b'), notice('a')]);
    expect(third.fresh).toEqual([]);
  });

  it('not a notice that arrives already read', () => {
    const first = newArrivals(null, []);
    expect(newArrivals(first.known, [notice('a', 'new_order', true)]).fresh).toEqual([]);
  });

  it('rings for new orders and service requests only', () => {
    expect(RINGING_TYPES.has('new_order')).toBe(true);
    expect(RINGING_TYPES.has('new_service_request')).toBe(true);
    expect(RINGING_TYPES.has('new_review')).toBe(false);
    expect(RINGING_TYPES.has('product_hidden')).toBe(false);
  });
});

describe('the count in the tab title', () => {
  it('puts the number in front, once, and takes it off', () => {
    expect(titleWithCount('Company panel', 2)).toBe('(2) Company panel');
    expect(titleWithCount('(2) Company panel', 4)).toBe('(4) Company panel');
    expect(titleWithCount('(4) Company panel', 0)).toBe('Company panel');
  });
});

describe('the push worker of the panel', () => {
  const worker = readFileSync(join(__dirname, '../../public/push-sw.js'), 'utf8');

  it('opens the panel\'s own pages: orders, chats (?c=), reviews, services, products', () => {
    expect(worker).toContain('`/orders/${data.orderId}`');
    expect(worker).toContain('/chats?c=');
    expect(worker).toContain("'/reviews'");
    expect(worker).toContain("'/services'");
    expect(worker).toContain('`/products/${data.productId}`');
  });

  it('opens the Today page for the dollar rate reminder, where the rate is set', () => {
    expect(worker).toMatch(/usd_rate_reminder'\) return '\/'/);
  });
});
