import { COUNT_KEYS, type CountKey, type DashboardSnapshot, type Piece } from './dashboardData';

/** A snapshot for tests: every count 0 and every list empty, unless overridden. */
export function makeSnapshot(
  overrides: Partial<Omit<DashboardSnapshot, 'counts'>> & { counts?: Partial<Record<CountKey, Piece<number>>> } = {},
): DashboardSnapshot {
  const counts = Object.fromEntries(COUNT_KEYS.map((key) => [key, { ok: true, value: 0 }])) as Record<
    CountKey,
    Piece<number>
  >;
  const empty = <T,>(): Piece<T[]> => ({ ok: true, value: [] });
  return {
    at: Date.now(),
    recentOrders: empty(),
    recentCompanies: empty(),
    windowOrders: empty(),
    newCustomers: empty(),
    openOrders: empty(),
    pendingRequests: empty(),
    lowReviews: empty(),
    emptyCompanies: empty(),
    ...overrides,
    counts: { ...counts, ...overrides.counts },
  };
}

export const ok = <T,>(value: T): Piece<T> => ({ ok: true, value });
export const failed: Piece<never> = { ok: false };
