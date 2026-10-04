import type { Company, Order, OrderStatus, Product, Review, ServiceRequest } from './types';

/*
 * The counting rules behind the dashboard cards. They run on documents that
 * were read live from Firestore and mapped by data/mappers.ts, and the pages
 * behind the cards filter with these same rules, so a card's number is exactly
 * the number of rows its link shows.
 */

/** A company without a stored status counts as active (same as the customer app). */
export const isActiveCompany = (company: Company): boolean => company.status === 'active';

export const countActiveCompanies = (companies: Company[]): number =>
  companies.filter(isActiveCompany).length;

export const countOrdersWithStatus = (orders: Order[], status: OrderStatus): number =>
  orders.filter((o) => o.orderStatus === status).length;

/*
 * What needs the admin's attention, and how the last 30 days compare. Each
 * rule is one predicate used both for the dashboard's count and for the list
 * its link opens (?attention=...), so a count is exactly the rows behind it.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A payment unverified this long is past the 24 hours after which the order expires. */
export const UNVERIFIED_PAYMENT_HOURS = 24;
/** A paid order still not completed after this many days is stuck. */
export const STUCK_ORDER_DAYS = 5;
/** A service request no company has answered after this many hours. */
export const STALE_REQUEST_HOURS = 48;
/** A visible review of at most this many stars is worth a look... */
export const LOW_RATING_MAX = 2;
/** ...for this many days after it is written. */
export const LOW_REVIEW_DAYS = 14;

export type OrderAttention = 'unverified' | 'stuck';
export const ORDER_ATTENTIONS: OrderAttention[] = ['unverified', 'stuck'];

const olderThan = (date: Date | null, ms: number, now: number) =>
  date !== null && now - date.getTime() > ms;

export const isUnverifiedPaymentOverdue = (o: Order, now: number): boolean =>
  o.orderStatus === 'processing' &&
  o.paymentStatus === 'pending_verification' &&
  olderThan(o.createdAt, UNVERIFIED_PAYMENT_HOURS * HOUR, now);

export const isStuckOrder = (o: Order, now: number): boolean =>
  o.paymentStatus === 'confirmed' &&
  (o.orderStatus === 'processing' || o.orderStatus === 'out_for_delivery') &&
  olderThan(o.createdAt, STUCK_ORDER_DAYS * DAY, now);

export const matchesOrderAttention = (o: Order, attention: OrderAttention, now: number): boolean =>
  attention === 'unverified' ? isUnverifiedPaymentOverdue(o, now) : isStuckOrder(o, now);

export const isStaleServiceRequest = (r: ServiceRequest, now: number): boolean =>
  r.status === 'pending' && olderThan(r.createdAt, STALE_REQUEST_HOURS * HOUR, now);

export const isRecentLowReview = (r: Review, now: number): boolean =>
  !r.hidden &&
  r.rating <= LOW_RATING_MAX &&
  r.createdAt !== null &&
  now - r.createdAt.getTime() <= LOW_REVIEW_DAYS * DAY;

export const WINDOW_DAYS = 30;

/** The periods the dashboard can compare; each needs twice its length of data (the page reads 60 days). */
export const PERIOD_DAYS = [7, 14, 30] as const;
export type PeriodDays = (typeof PERIOD_DAYS)[number];

export interface WindowTotals {
  /** Within the last `days` days (30 unless said otherwise). */
  current: number;
  /** The same number of days before that. */
  previous: number;
}

/** Sums `valueOf` over items dated in the last `days` days and in the same number of days before. */
export function compareWindows<T>(
  items: readonly T[],
  dateOf: (item: T) => Date | null,
  now: number,
  valueOf: (item: T) => number = () => 1,
  days: number = WINDOW_DAYS,
): WindowTotals {
  const totals: WindowTotals = { current: 0, previous: 0 };
  for (const item of items) {
    const date = dateOf(item);
    if (!date) continue;
    const age = now - date.getTime();
    if (age < 0) continue;
    if (age <= days * DAY) totals.current += valueOf(item);
    else if (age <= 2 * days * DAY) totals.previous += valueOf(item);
  }
  return totals;
}

/**
 * The current period cut into `days` consecutive 24-hour slots ending at `now`
 * (oldest first). The slots add up to exactly `compareWindows(...).current`.
 */
export function dailySeries<T>(
  items: readonly T[],
  dateOf: (item: T) => Date | null,
  now: number,
  days: number,
  valueOf: (item: T) => number = () => 1,
): number[] {
  const series: number[] = Array.from({ length: days }, () => 0);
  for (const item of items) {
    const date = dateOf(item);
    if (!date) continue;
    const age = now - date.getTime();
    if (age < 0 || age > days * DAY) continue;
    series[days - 1 - Math.min(Math.floor(age / DAY), days - 1)] += valueOf(item);
  }
  return series;
}

/** Whole-percent change from `previous` to `current`; null when there is nothing to compare with. */
export function percentChange({ current, previous }: WindowTotals): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** A new company gets this long to list its first product before it is flagged. */
export const NO_PRODUCTS_GRACE_DAYS = 3;

/**
 * An active company that has been around for a while and still lists no
 * product. A company with no creation date is old enough; `hasProducts` is
 * whatever the caller counted (a server count on the dashboard, the loaded
 * catalogue on the Companies page).
 */
export const isStalledCompany = (company: Company, hasProducts: boolean, now: number): boolean =>
  company.status === 'active' &&
  !hasProducts &&
  (company.createdAt === null || now - company.createdAt.getTime() > NO_PRODUCTS_GRACE_DAYS * DAY);

/** An offer that is running now: a price below the normal one, not past its end time. */
export const isOfferRunning = (
  offer: { price: number | null; offerPrice: number | null; offerEndsAt: Date | null },
  now: number,
): boolean =>
  offer.offerPrice !== null &&
  offer.price !== null &&
  offer.offerPrice < offer.price &&
  (offer.offerEndsAt === null || offer.offerEndsAt.getTime() > now);

/** A product's offer that is running now. */
export const hasRunningOffer = (product: Product, now: number): boolean => isOfferRunning(product, now);
