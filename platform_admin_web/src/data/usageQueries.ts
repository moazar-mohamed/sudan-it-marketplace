import {
  collection,
  documentId,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
  type Firestore,
} from 'firebase/firestore';
import { businessDay } from './analytics';

/*
 * How the apps are used, read as counts. The apps write one tiny document per
 * person per day they opened the app (usage_days, whose `day` is the phone's
 * calendar day) and a running count per product (product_stats); the panel only
 * ever asks the server to COUNT them (one read per 1,000), so a page costs a
 * few dozen reads however many people there are. New customers come from the
 * accounts themselves. Counting starts when the app began writing these;
 * earlier days read 0.
 */

export const USAGE_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

/** The last [n] calendar days (Khartoum), oldest first, ending with the day of [now]: `2026-10-04`. */
export function lastBusinessDays(n: number, now: number): string[] {
  return Array.from({ length: n }, (_, i) => businessDay(new Date(now - (n - 1 - i) * DAY)));
}

/** The start and end of a Khartoum day (fixed UTC+2, no daylight saving). */
export function dayBounds(day: string): { start: Date; end: Date } {
  const start = new Date(`${day}T00:00:00+02:00`);
  return { start, end: new Date(start.getTime() + DAY - 1) };
}

/** How many people opened the app on [day]. */
export async function countActiveOn(db: Firestore, day: string): Promise<number> {
  const snapshot = await getCountFromServer(query(collection(db, 'usage_days'), where('day', '==', day)));
  return snapshot.data().count;
}

/** How many customer accounts were created on [day]. */
export async function countNewCustomersOn(db: Firestore, day: string): Promise<number> {
  const { start, end } = dayBounds(day);
  const snapshot = await getCountFromServer(
    query(
      collection(db, 'users'),
      where('role', '==', 'customer'),
      where('createdAt', '>=', Timestamp.fromDate(start)),
      where('createdAt', '<=', Timestamp.fromDate(end)),
    ),
  );
  return snapshot.data().count;
}

export interface ViewedProduct {
  id: string;
  views: number;
  /** Empty when the product no longer exists. */
  name: string;
  companyName: string;
}

/** The products opened most, best first, with their names. */
export async function fetchMostViewed(db: Firestore, max = 10): Promise<ViewedProduct[]> {
  const stats = await getDocs(query(collection(db, 'product_stats'), orderBy('views', 'desc'), limit(max)));
  const rows = stats.docs.map((d) => ({ id: d.id, views: Number(d.data().views) || 0 }));
  if (rows.length === 0) return [];
  const products = await getDocs(query(collection(db, 'products'), where(documentId(), 'in', rows.map((r) => r.id))));
  const byId = new Map(products.docs.map((d) => [d.id, d.data()]));
  return rows.map((r) => ({
    ...r,
    name: String(byId.get(r.id)?.name ?? ''),
    companyName: String(byId.get(r.id)?.companyName ?? ''),
  }));
}

/** One piece of the page: its figures, or that it could not be read (the others still show). */
export type Piece<T> = { ok: true; value: T } | { ok: false; error: unknown };

async function piece<T>(read: () => Promise<T>): Promise<Piece<T>> {
  try {
    return { ok: true, value: await read() };
  } catch (error) {
    return { ok: false, error };
  }
}

export interface UsageFigures {
  days: string[];
  active: Piece<number[]>;
  newCustomers: Piece<number[]>;
  mostViewed: Piece<ViewedProduct[]>;
}

/** Everything the usage section shows. Never rejects: a piece that fails says so on its own. */
export async function fetchUsage(db: Firestore, now: number, n = USAGE_DAYS): Promise<UsageFigures> {
  const days = lastBusinessDays(n, now);
  const [active, newCustomers, mostViewed] = await Promise.all([
    piece(() => Promise.all(days.map((d) => countActiveOn(db, d)))),
    piece(() => Promise.all(days.map((d) => countNewCustomersOn(db, d)))),
    piece(() => fetchMostViewed(db)),
  ]);
  return { days, active, newCustomers, mostViewed };
}
