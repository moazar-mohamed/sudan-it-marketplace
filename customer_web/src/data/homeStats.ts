import type { Ratings } from './browse';
import type { Company } from './types';

export type StatKey = 'companies' | 'items' | 'cities' | 'reviews';

export interface SiteStat {
  key: StatKey;
  value: number;
}

/**
 * The numbers on the Home band, all counted from what customers can see: active
 * companies, products and services offered, the cities companies are in, and
 * the reviews customers wrote. A number that is zero is left out, so a young
 * marketplace never advertises "0 reviews".
 */
export function siteStats(companies: Company[], items: number, ratings: Ratings): SiteStat[] {
  // Each review counts in two averages: its company's and its product's (or
  // service's). Only the company ones are summed, so it is counted once.
  let reviews = 0;
  for (const [key, stats] of ratings) if (key.startsWith('company_')) reviews += stats.count;
  const cities = new Set(companies.map((c) => c.city.trim()).filter((c) => c !== '')).size;
  const all: SiteStat[] = [
    { key: 'companies', value: companies.length },
    { key: 'items', value: items },
    { key: 'cities', value: cities },
    { key: 'reviews', value: reviews },
  ];
  return all.filter((s) => s.value > 0);
}
