import { describe, expect, it } from 'vitest';
import { csvCell } from './csv';
import { arCount, discountPercent, displayPhone, hasActiveOffer, hasEndedOffer, isLowStock, leftLabel, lowLevelOf, parseNumber, productsText, salePrice, shortId, unitsText, urgencyOf } from './format';
import { mapProduct } from './mappers';
import { awaitsRefund, nextStatusLabel, nextStatusOf } from './orderRules';
import { nextStock } from './stock';

describe('numbers and text', () => {
  it('parses what people type', () => {
    expect(parseNumber('1,450,000')).toBe(1450000);
    expect(parseNumber('١٤٥٠٠٠٠')).toBe(1450000);
    expect(parseNumber('12.5')).toBe(12.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });

  it('counts in Arabic', () => {
    expect(unitsText(1)).toBe('وحدة واحدة');
    expect(unitsText(2)).toBe('وحدتان');
    expect(unitsText(3)).toBe('3 وحدات');
    expect(unitsText(11)).toBe('11 وحدة');
    expect(productsText(0)).toBe('لا منتجات');
    expect(arCount(2, 'a', 'b', 'c', 'd')).toBe('b');
  });

  it('shows short ids and phones', () => {
    expect(shortId('abcdefghijklmnop')).toBe('abcdefgh');
    expect(shortId('abc')).toBe('abc');
    expect(displayPhone('+249912345678')).toBe('0912 345 678');
    expect(displayPhone('12345')).toBe('12345');
  });

  it('counts down the payment window', () => {
    expect(leftLabel(4 * 3600_000 + 20 * 60_000)).toBe('4س 20د');
    expect(leftLabel(-1)).toBe('انتهت');
    expect(urgencyOf(3 * 3600_000)).toBe('bad');
    expect(urgencyOf(8 * 3600_000)).toBe('warn');
    expect(urgencyOf(20 * 3600_000)).toBe('n');
  });
});

describe('offers', () => {
  const now = Date.now();
  const running = { price: 1000, offerPrice: 800, offerEndsAt: new Date(now + 86_400_000) };
  const ended = { price: 1000, offerPrice: 800, offerEndsAt: new Date(now - 1000) };
  const none = { price: 1000, offerPrice: null, offerEndsAt: null };

  it('tells running, ended and none apart', () => {
    expect(hasActiveOffer(running)).toBe(true);
    expect(hasEndedOffer(ended)).toBe(true);
    expect(hasActiveOffer(ended)).toBe(false);
    expect(hasActiveOffer(none)).toBe(false);
  });

  it('prices by the offer only while it runs', () => {
    expect(salePrice(running)).toBe(800);
    expect(salePrice(ended)).toBe(1000);
    expect(discountPercent(running)).toBe(20);
  });

  it('never treats a missing price as zero', () => {
    expect(hasActiveOffer({ price: null, offerPrice: 800, offerEndsAt: null })).toBe(false);
  });
});

describe('stock', () => {
  it('adds, subtracts and sets from the number given', () => {
    expect(nextStock(3, 'add', 5)).toBe(8);
    expect(nextStock(3, 'subtract', 5)).toBe(-2);
    expect(nextStock(3, 'set', 10)).toBe(10);
  });
});

describe('order steps', () => {
  const base = { paymentStatus: 'confirmed', orderStatus: 'processing', deliveryMethod: 'delivery' } as const;

  it('does not move before the payment is confirmed', () => {
    expect(nextStatusOf({ ...base, paymentStatus: 'pending_verification' })).toBeNull();
  });

  it('sends a delivery order out first, and completes a pickup order directly', () => {
    expect(nextStatusOf(base)).toBe('out_for_delivery');
    expect(nextStatusOf({ ...base, deliveryMethod: 'pickup' })).toBe('completed');
    expect(nextStatusOf({ ...base, orderStatus: 'out_for_delivery' })).toBe('completed');
  });

  it('has nothing after completed or cancelled', () => {
    expect(nextStatusOf({ ...base, orderStatus: 'completed' })).toBeNull();
    expect(nextStatusOf({ ...base, orderStatus: 'cancelled' })).toBeNull();
    expect(nextStatusLabel({ ...base, orderStatus: 'completed' })).toBe('');
  });
});

describe('refunds', () => {
  const cancelledPaid = { orderStatus: 'cancelled', paymentStatus: 'confirmed', refundedAt: null } as const;
  it('waits for the refund of a paid, cancelled order only', () => {
    expect(awaitsRefund(cancelledPaid)).toBe(true);
    expect(awaitsRefund({ ...cancelledPaid, refundedAt: new Date() })).toBe(false);
    expect(awaitsRefund({ ...cancelledPaid, paymentStatus: 'pending_verification' })).toBe(false);
    expect(awaitsRefund({ ...cancelledPaid, orderStatus: 'processing' })).toBe(false);
  });
});

describe('the company\'s own product fields', () => {
  const doc = (over: Record<string, unknown> = {}) => ({ companyId: 'c1', name: 'Router', imageUrl: '', stockCount: 5, ...over });

  it('reads an older document as published, with no extras', () => {
    const p = mapProduct('p', doc());
    expect(p.status).toBe('published');
    expect(p.sku).toBe('');
    expect(p.lowStockThreshold).toBeNull();
    expect(p.imageUrls).toEqual([]);
  });

  it('reads status only from the three known values', () => {
    expect(mapProduct('p', doc({ status: 'draft' })).status).toBe('draft');
    expect(mapProduct('p', doc({ status: 'archived' })).status).toBe('archived');
    expect(mapProduct('p', doc({ status: 'x' })).status).toBe('published');
  });

  it('uses imageUrl as the only picture when there is no gallery, and keeps the gallery to five', () => {
    expect(mapProduct('p', doc({ imageUrl: 'https://a.test/1.jpg' })).imageUrls).toEqual(['https://a.test/1.jpg']);
    const urls = Array.from({ length: 8 }, (_, i) => `https://a.test/${i}.jpg`);
    expect(mapProduct('p', doc({ imageUrls: urls })).imageUrls).toHaveLength(5);
  });

  it('shows specifications in the order the company gave', () => {
    const p = mapProduct('p', doc({ specifications: { A: '1', B: '2', C: '3' }, specificationsOrder: ['C', 'A'] }));
    expect(Object.keys(p.specifications)).toEqual(['C', 'A', 'B']);
  });

  it('warns at the product\'s own level, else the default', () => {
    expect(lowLevelOf({ lowStockThreshold: 10 })).toBe(10);
    expect(lowLevelOf({ lowStockThreshold: null })).toBe(3);
    expect(isLowStock({ stockCount: 8, lowStockThreshold: 10 })).toBe(true);
    expect(isLowStock({ stockCount: 8, lowStockThreshold: null })).toBe(false);
  });
});

describe('csv', () => {
  it('quotes and neutralises formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell(null)).toBe('');
    expect(csvCell(12)).toBe('12');
  });
});
