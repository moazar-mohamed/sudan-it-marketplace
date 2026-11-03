import { describe, expect, it } from 'vitest';
import { isOnSale, mapProduct } from './mappers';

const doc = (over: Record<string, unknown> = {}) => ({
  companyId: 'c1', companyName: 'C1', name: 'Router', imageUrl: '', stockCount: 5, ...over,
});

describe('what the company decides about a product', () => {
  it('treats an older document, with no status, as published', () => {
    const p = mapProduct('p', doc());
    expect(p.status).toBe('published');
    expect(isOnSale(p)).toBe(true);
  });

  it('keeps a draft and an archived product off sale', () => {
    expect(isOnSale(mapProduct('p', doc({ status: 'draft' })))).toBe(false);
    expect(isOnSale(mapProduct('p', doc({ status: 'archived' })))).toBe(false);
  });

  it('reads an unknown status as published, never as a way around the rules', () => {
    expect(mapProduct('p', doc({ status: 'whatever' })).status).toBe('published');
  });

  it('still hides a product Platform Admin hid, whatever its status', () => {
    expect(isOnSale(mapProduct('p', doc({ hidden: true, status: 'published' })))).toBe(false);
  });
});

describe('pictures and specification order', () => {
  it('uses imageUrl as the only picture when there is no gallery', () => {
    expect(mapProduct('p', doc({ imageUrl: 'https://a.test/1.jpg' })).imageUrls).toEqual(['https://a.test/1.jpg']);
    expect(mapProduct('p', doc()).imageUrls).toEqual([]);
  });

  it('reads at most five gallery pictures', () => {
    const urls = Array.from({ length: 8 }, (_, i) => `https://a.test/${i}.jpg`);
    expect(mapProduct('p', doc({ imageUrls: urls })).imageUrls).toHaveLength(5);
  });

  it('shows specifications in the company order, the rest after', () => {
    const p = mapProduct('p', doc({ specifications: { A: '1', B: '2', C: '3' }, specificationsOrder: ['C', 'A'] }));
    expect(Object.keys(p.specifications)).toEqual(['C', 'A', 'B']);
  });
});
