import { bestDiscount } from './browse';
import type { ServiceListing } from './types';

/**
 * The services the home page puts forward: the ones with a running discount
 * first (the biggest first), then the ones the most companies offer, then by
 * name. Only services some company offers are listings at all.
 */
export function featuredServices(listings: readonly ServiceListing[], limit = 4): ServiceListing[] {
  return [...listings]
    .sort(
      (a, b) =>
        bestDiscount(b) - bestDiscount(a) ||
        b.offers.length - a.offers.length ||
        a.service.name.localeCompare(b.service.name, 'ar'),
    )
    .slice(0, limit);
}
