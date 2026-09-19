import type { Order } from './data/types';

export const shortId = (id: string) => (id.length > 8 ? id.slice(0, 8) : id);

export const customerLabel = (order: Pick<Order, 'customerName' | 'customerId'>) =>
  order.customerName.trim() || shortId(order.customerId);

/** Lower-cases and folds common Arabic spelling variants so search matches. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

export function matchesQuery(query: string, ...fields: string[]): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  return fields.some((f) => normalizeText(f).includes(q));
}

export const joinLocation = (city: string, address: string) =>
  [city, address].filter((v) => v.trim() !== '').join(', ') || '—';
