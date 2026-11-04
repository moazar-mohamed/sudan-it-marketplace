import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { mapOrder } from './mappers';
import { cancelledLines } from './orders';

const order = (over: Record<string, unknown> = {}) =>
  mapOrder('o1', {
    customerId: 'u1', companyId: 'c1', companyName: 'C1', productId: 'p1', productName: 'Router', quantity: 1,
    orderStatus: 'cancelled', paymentStatus: 'pending_verification', cancelReason: 'company',
    cancelledAt: Timestamp.fromDate(new Date('2026-11-01T10:00:00Z')), ...over,
  });

describe('what a customer reads about a cancelled order', () => {
  it('shows the note the company wrote', () => {
    const o = order({ cancelNote: '  المنتج غير متوفر عند المورد  ' });
    expect(o.cancelNote).toBe('المنتج غير متوفر عند المورد');
    expect(cancelledLines(o).some((l) => l.includes('المنتج غير متوفر عند المورد'))).toBe(true);
  });

  it('has no note line when there is none', () => {
    expect(order().cancelNote).toBeNull();
    expect(cancelledLines(order()).some((l) => l.includes('ملاحظة'))).toBe(false);
  });

  it('says the money is still to come back until the company records it', () => {
    const waiting = cancelledLines(order({ paymentStatus: 'confirmed' }));
    expect(waiting.some((l) => l.includes('تعيد الشركة إليك المبلغ'))).toBe(true);
  });

  it('says it came back once the company recorded it', () => {
    const o = order({ paymentStatus: 'confirmed', refundedAt: Timestamp.fromDate(new Date('2026-11-02T09:00:00Z')) });
    expect(o.refundedAt).toBeInstanceOf(Date);
    const lines = cancelledLines(o);
    expect(lines.some((l) => l.includes('أعادت الشركة المبلغ'))).toBe(true);
    expect(lines.some((l) => l.includes('تعيد الشركة إليك المبلغ'))).toBe(false);
  });
});
