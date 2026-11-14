import { describe, expect, it } from 'vitest';
import { siteStats } from './homeStats';
import type { Company } from './types';

const company = (city: string): Company => ({ id: city, name: city, city }) as Company;

describe('the numbers on the Home band', () => {
  it('counts companies, items, the cities companies are in and all reviews', () => {
    // Three reviews: two of product a (company b) and one of service s (company c).
    // Each also counts in its company's average, which is what is summed.
    const ratings = new Map([
      ['product_a', { sum: 9, count: 2 }],
      ['service_s', { sum: 5, count: 1 }],
      ['company_b', { sum: 9, count: 2 }],
      ['company_c', { sum: 5, count: 1 }],
    ]);
    const stats = siteStats([company('الخرطوم'), company('الخرطوم '), company('بورتسودان')], 12, ratings);
    expect(stats).toEqual([
      { key: 'companies', value: 3 },
      { key: 'items', value: 12 },
      { key: 'cities', value: 2 },
      { key: 'reviews', value: 3 },
    ]);
  });

  it('counts one review once, not once per average it is in', () => {
    const ratings = new Map([
      ['product_p1', { sum: 4, count: 1 }],
      ['company_c1', { sum: 4, count: 1 }],
    ]);
    expect(siteStats([], 0, ratings)).toEqual([{ key: 'reviews', value: 1 }]);
  });

  it('leaves out a number that is zero', () => {
    const stats = siteStats([company('')], 0, new Map());
    expect(stats).toEqual([{ key: 'companies', value: 1 }]);
  });

  it('is empty when there is nothing to show yet', () => {
    expect(siteStats([], 0, new Map())).toEqual([]);
  });
});
