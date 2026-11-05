import type { Product } from './types';

/** Every specification name used by [products], in the order they first appear. */
export function specNames(products: Product[]): string[] {
  const names: string[] = [];
  for (const p of products) for (const key of Object.keys(p.specifications)) if (!names.includes(key)) names.push(key);
  return names;
}

/** The lowest price among those that exist (a product "on request" has none), or null. */
export function cheapestPrice(prices: (number | null)[]): number | null {
  return prices.reduce<number | null>((min, v) => (v !== null && (min === null || v < min) ? v : min), null);
}
