import { describe, expect, it } from 'vitest';
import { cheapestPrice, specNames } from './compareTable';
import type { Product } from './types';

const product = (specifications: Record<string, string>): Product => ({ specifications }) as Product;

describe('the comparison table', () => {
  it('lists each specification once, in the order it first appears', () => {
    const names = specNames([product({ RAM: '8', CPU: 'i5' }), product({ CPU: 'i7', SSD: '256' }), product({})]);
    expect(names).toEqual(['RAM', 'CPU', 'SSD']);
  });

  it('marks the lowest price and ignores products priced on request', () => {
    expect(cheapestPrice([1500, null, 900, 1200])).toBe(900);
    expect(cheapestPrice([null, null])).toBeNull();
    expect(cheapestPrice([])).toBeNull();
  });
});
