import { describe, expect, it } from 'vitest';
import { adminCancellationPlan } from './moderation';

const order = (extra: Record<string, unknown> = {}) => ({ companyId: 'c1', quantity: 3, stockReserved: true, ...extra });

describe('stock on an admin cancellation', () => {
  it('gives the quantity back for an order that took its stock', () => {
    expect(adminCancellationPlan(order(), { companyId: 'c1' })).toEqual({ returnsStock: true, quantity: 3 });
  });

  it('treats a missing stockReserved as taken (an older order), and only false as not taken', () => {
    const { stockReserved: _stockReserved, ...older } = order();
    void _stockReserved;
    expect(adminCancellationPlan(older, { companyId: 'c1' }).returnsStock).toBe(true);
    expect(adminCancellationPlan(order({ stockReserved: false }), { companyId: 'c1' }).returnsStock).toBe(false);
  });

  it('gives nothing back when the product is gone or belongs to another company now', () => {
    expect(adminCancellationPlan(order(), undefined).returnsStock).toBe(false);
    expect(adminCancellationPlan(order(), { companyId: 'c2' }).returnsStock).toBe(false);
  });
});
