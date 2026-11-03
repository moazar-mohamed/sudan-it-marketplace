import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { canEdit, reviewAuthorName } from './reviews';
import { effectivePickupPoints, matchesProduct, nextOrderAllowedAt, pickupLabel, shortOrderId } from './orders';
import { fitWithin, jpegName } from './receiptImage';
import type { Company, Product, Review } from './types';

const product = (over: Partial<Product> = {}): Product => ({
  id: 'p', companyId: 'c', companyName: 'C', categoryId: null, name: 'p', imageUrl: '', price: 100,
  currency: 'SDG', description: '', brand: '', inStock: true, stockCount: 5, specifications: {},
  isDeliveryAvailable: true, isInstallationAvailable: false, installationPrice: null, offerPrice: null,
  offerEndsAt: null, offerBadge: null, hidden: false, status: 'published', imageUrls: [], createdAt: null, ...over,
});

describe('order pricing', () => {
  it('matches the price customers pay now, the offer while it runs', () => {
    expect(matchesProduct(product(), 100, false, 0)).toBe(true);
    expect(matchesProduct(product({ offerPrice: 80 }), 80, false, 0)).toBe(true);
    expect(matchesProduct(product({ offerPrice: 80 }), 100, false, 0)).toBe(false);
  });

  it('never matches a product without a price', () => {
    expect(matchesProduct(product({ price: null }), 0, false, 0)).toBe(false);
  });

  it('checks installation against the product', () => {
    const offered = product({ isInstallationAvailable: true, installationPrice: 50 });
    expect(matchesProduct(offered, 100, true, 50)).toBe(true);
    expect(matchesProduct(offered, 100, true, 40)).toBe(false);
    expect(matchesProduct(product(), 100, true, 0)).toBe(false);
    expect(matchesProduct(offered, 100, false, 50)).toBe(false);
  });
});

describe('order quota', () => {
  const now = new Date('2026-11-02T12:00:00Z');
  const at = (hoursAgo: number) => Timestamp.fromDate(new Date(now.getTime() - hoursAgo * 3600000));

  it('allows an order while the next slot is empty', () => {
    expect(nextOrderAllowedAt(undefined, now)).toBeNull();
    expect(nextOrderAllowedAt({ next: 3 }, now)).toBeNull();
  });

  it('holds the next order until the oldest of ten is 24 hours old', () => {
    expect(nextOrderAllowedAt({ next: 2, t2: at(23) }, now)?.getTime()).toBe(now.getTime() + 3600000);
    expect(nextOrderAllowedAt({ next: 2, t2: at(24) }, now)).toBeNull();
  });

  it('reads a bad slot number as the first', () => {
    expect(nextOrderAllowedAt({ next: 12, t0: at(1) }, now)).not.toBeNull();
  });
});

describe('pickup', () => {
  const company = (over: Partial<Company>): Company => ({
    id: 'c', name: 'C', rating: 0, reviewCount: 0, logoUrl: '', description: '', city: '', address: '',
    latitude: null, longitude: null, phone: '', status: 'active', serviceCityIds: [], pickupAddress: '',
    pickupPoints: [], paymentAccounts: [], ...over,
  });

  it('uses the points, else the one written address, else nothing', () => {
    const point = { name: 'الفرع', address: 'السوق', latitude: null, longitude: null };
    expect(effectivePickupPoints(company({ pickupPoints: [point], pickupAddress: 'قديم' }))).toEqual([point]);
    expect(effectivePickupPoints(company({ pickupAddress: 'قديم' }))[0].address).toBe('قديم');
    expect(effectivePickupPoints(company({}))).toEqual([]);
  });

  it('labels a point by what it has', () => {
    expect(pickupLabel({ name: 'الفرع', address: 'السوق', latitude: null, longitude: null })).toBe('الفرع — السوق');
    expect(pickupLabel({ name: 'الفرع', address: '', latitude: null, longitude: null })).toBe('الفرع');
    expect(pickupLabel({ name: '', address: 'السوق', latitude: null, longitude: null })).toBe('السوق');
  });
});

describe('receipt image', () => {
  it('always names a jpg within the limit', () => {
    expect(jpegName('C:\\photos\\transfer.heic')).toBe('transfer.jpg');
    expect(jpegName('')).toBe('receipt.jpg');
    expect(jpegName(`${'a'.repeat(200)}.png`)).toHaveLength(100);
  });

  it('shrinks to the long edge and never enlarges', () => {
    expect(fitWithin(2560, 1280, 1280)).toEqual({ width: 1280, height: 640 });
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 });
  });
});

describe('reviews', () => {
  it('never shows a full name', () => {
    expect(reviewAuthorName('أحمد محمد علي')).toBe('أحمد م.');
    expect(reviewAuthorName('أحمد')).toBe('أحمد');
    expect(reviewAuthorName('  ')).toBe('');
  });

  it('can be changed for seven days, unless hidden', () => {
    const review = (daysAgo: number, hidden = false) =>
      ({ hidden, createdAt: new Date(Date.now() - daysAgo * 86400000) }) as Review;
    expect(canEdit(review(6))).toBe(true);
    expect(canEdit(review(8))).toBe(false);
    expect(canEdit(review(1, true))).toBe(false);
  });

  it('shows short order numbers', () => {
    expect(shortOrderId('abcdefghijkl')).toBe('abcdefgh');
  });
});
