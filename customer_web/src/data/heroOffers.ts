import { discountPercent, hasActiveOffer, salePrice } from './format';
import type { Priced, Product, ServiceListing } from './types';

/** One slide of the home page's moving offers: a product or a company's service offer. */
export interface HeroOffer {
  key: string;
  kind: 'product' | 'service';
  /** Where the slide leads. */
  path: string;
  name: string;
  imageUrl: string;
  categoryId: string | null;
  currency: string;
  item: Priced;
}

/**
 * The offers the big banner at the top of the home page shows, as the app's
 * home does: every running offer of a product or a service, the biggest
 * discount first, then the one that ends first. A service shows once, with
 * its best offer.
 */
export function heroOffers(
  products: readonly Product[],
  listings: readonly ServiceListing[],
  limit = 5,
  now = new Date(),
): HeroOffer[] {
  const items: HeroOffer[] = [];
  for (const p of products) {
    if (!hasActiveOffer(p, now) || salePrice(p, now) === null) continue;
    items.push({
      key: `p:${p.id}`,
      kind: 'product',
      path: `/product/${p.id}`,
      name: p.name,
      imageUrl: p.imageUrl,
      categoryId: p.categoryId,
      currency: p.currency,
      item: p,
    });
  }
  for (const l of listings) {
    const running = l.offers.filter((o) => hasActiveOffer(o, now));
    if (running.length === 0) continue;
    const best = running.reduce((a, b) => (discountPercent(b) > discountPercent(a) ? b : a));
    items.push({
      key: `s:${l.service.id}`,
      kind: 'service',
      path: `/service/${l.service.id}`,
      name: l.service.name,
      imageUrl: '',
      categoryId: l.service.categoryId,
      currency: 'SDG',
      item: best,
    });
  }
  const ends = (o: HeroOffer) => o.item.offerEndsAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return items
    .sort((a, b) => discountPercent(b.item) - discountPercent(a.item) || ends(a) - ends(b) || a.name.localeCompare(b.name, 'ar'))
    .slice(0, limit);
}

/** What is left of an offer: whole days when a day or more, else hh:mm:ss parts. null once over. */
export function offerTimeLeft(endsAt: Date, now: Date): { days: number } | { parts: [string, string, string] } | null {
  const ms = endsAt.getTime() - now.getTime();
  if (ms <= 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds >= 86400) return { days: Math.floor(totalSeconds / 86400) };
  const two = (n: number) => String(n).padStart(2, '0');
  return { parts: [two(Math.floor(totalSeconds / 3600)), two(Math.floor((totalSeconds % 3600) / 60)), two(totalSeconds % 60)] };
}
