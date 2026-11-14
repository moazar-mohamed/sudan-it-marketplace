import type { DashboardSnapshot, Piece } from './dashboardData';
import {
  isRecentLowReview,
  isStaleServiceRequest,
  isStalledCompany,
  isStuckOrder,
  isUnverifiedPaymentOverdue,
} from './stats';

/** How many records each attention rule flags; null when its data could not be read. */
export interface AttentionCounts {
  unverified: number | null;
  stuck: number | null;
  staleRequests: number | null;
  lowReviews: number | null;
  noProducts: number | null;
}

const countWhere = <T>(piece: Piece<T[]>, test: (item: T) => boolean): number | null =>
  piece.ok ? piece.value.filter(test).length : null;

/** The rules of the dashboard's "needs attention" panel, over one snapshot. */
export function attentionCounts(snapshot: DashboardSnapshot): AttentionCounts {
  const now = snapshot.at;
  return {
    unverified: countWhere(snapshot.openOrders, (o) => isUnverifiedPaymentOverdue(o, now)),
    stuck: countWhere(snapshot.openOrders, (o) => isStuckOrder(o, now)),
    staleRequests: countWhere(snapshot.pendingRequests, (r) => isStaleServiceRequest(r, now)),
    lowReviews: countWhere(snapshot.lowReviews, (r) => isRecentLowReview(r, now)),
    noProducts: countWhere(snapshot.emptyCompanies, (c) => isStalledCompany(c, false, now)),
  };
}

/** Sums the counts that could be read; null when none could. */
export function sumCounts(...counts: (number | null)[]): number | null {
  const known = counts.filter((c): c is number => c !== null);
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
}
