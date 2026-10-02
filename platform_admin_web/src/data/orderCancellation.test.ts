import { describe, expect, it } from 'vitest';
import { en, ar } from '../i18n/dictionary';
import { mapOrder, parseOrderCancelReason, parseOrderStatus } from './mappers';
import { ORDER_STATUSES, type OrderCancelReason } from './types';

// Every reason the rules accept; the type check fails here if one is added
// to (or removed from) OrderCancelReason without this list.
const REASONS: Record<OrderCancelReason, true> = { company: true, expired: true, out_of_stock: true };

describe('a cancelled order is never shown as Processing', () => {
  it('the stored value parses to cancelled; unknown values stay processing', () => {
    expect(parseOrderStatus('cancelled')).toBe('cancelled');
    expect(parseOrderStatus('processing')).toBe('processing');
    expect(parseOrderStatus('something-else')).toBe('processing');
  });

  it('is one of the statuses the Orders page filters by, named in both languages', () => {
    expect(ORDER_STATUSES).toContain('cancelled');
    expect(en['order.status.cancelled']).toBe('Cancelled');
    expect(ar['order.status.cancelled']).toBe('ملغى');
  });

  it('keeps why and when it was cancelled, and whether stock went back', () => {
    const cancelledAt = new Date('2026-09-21T12:30:00Z');
    const order = mapOrder('o1', {
      orderStatus: 'cancelled',
      paymentStatus: 'pending_verification',
      cancelReason: 'expired',
      cancelledAt,
      stockReleased: true,
    });
    expect(order.orderStatus).toBe('cancelled');
    expect(order.cancelReason).toBe('expired');
    expect(order.cancelledAt?.getTime()).toBe(cancelledAt.getTime());
    expect(order.stockReleased).toBe(true);
  });

  it('an order that was never cancelled has no cancellation details', () => {
    const order = mapOrder('o2', { orderStatus: 'processing' });
    expect(order.cancelReason).toBeNull();
    expect(order.cancelledAt).toBeNull();
    expect(order.stockReleased).toBe(false);
    expect(parseOrderCancelReason('made-up')).toBeNull();
  });
});

describe('an order cancelled because its product ran out (out_of_stock)', () => {
  it('the stored reason is kept, not dropped as unknown', () => {
    expect(parseOrderCancelReason('out_of_stock')).toBe('out_of_stock');
    const order = mapOrder('o3', {
      orderStatus: 'cancelled',
      paymentStatus: 'pending_verification',
      cancelReason: 'out_of_stock',
      stockReleased: false,
    });
    expect(order.cancelReason).toBe('out_of_stock');
    expect(order.stockReleased).toBe(false);
  });

  it('every cancellation reason has its own text in both languages', () => {
    for (const reason of Object.keys(REASONS) as OrderCancelReason[]) {
      expect(parseOrderCancelReason(reason)).toBe(reason);
      expect(en[`order.cancel.${reason}`].trim(), reason).not.toBe('');
      expect(ar[`order.cancel.${reason}`].trim(), reason).not.toBe('');
    }
    expect(en['order.cancel.out_of_stock']).not.toBe(en['order.cancel.company']);
    expect(ar['order.cancel.out_of_stock']).not.toBe(ar['order.cancel.company']);
  });

  it('says it ran out of stock and that the company refunds outside the app, not "cancelled by the company"', () => {
    expect(en['order.cancel.out_of_stock']).toMatch(/out of stock/i);
    expect(en['order.cancel.out_of_stock']).toMatch(/refunds .*outside the app/);
    expect(en['order.cancel.out_of_stock']).not.toMatch(/cancelled by the company/i);
    expect(ar['order.cancel.out_of_stock']).toContain('نفد المخزون');
    expect(ar['order.cancel.out_of_stock']).toContain('خارج التطبيق');
    expect(ar['order.cancel.out_of_stock']).not.toContain('ألغته الشركة');
  });

  it('an order that took no stock is not described as stock that was held back', () => {
    for (const dict of [en, ar]) {
      expect(dict['order.stockReturn']).not.toMatch(/reserved|المحجوز/i);
      expect(dict['order.stockNotReturned']).not.toMatch(/automatically|تلقائي/i);
    }
    expect(en['order.stockNotReturned']).toMatch(/payment was not confirmed/);
    expect(ar['order.stockNotReturned']).toContain('لم يتأكد دفعه');
  });
});
