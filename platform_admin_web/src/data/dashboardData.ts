import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
  type DocumentData,
  type Firestore,
  type Query,
} from 'firebase/firestore';
import { mapCompany, mapCustomer, mapOrder, mapReview, mapServiceRequest } from './mappers';
import { LOW_RATING_MAX, WINDOW_DAYS } from './stats';
import type { Company, Customer, Order, Review, ServiceRequest } from './types';

/*
 * What the dashboard reads, without keeping whole collections open.
 *
 * The totals are server-side counts (one billed read per 1,000 matching
 * documents), the two "recent" tables are five documents each, the 30-day
 * trends read only the last 60 days of orders and new accounts, and the
 * attention rules read only the documents that can still need attention (open
 * orders, pending requests, low-star reviews). Only the new-customers query
 * needs a composite index (users: role, createdAt; firestore.indexes.json);
 * the others use one field or equality filters. The figures are a snapshot; the
 * page refreshes them.
 *
 * Each piece is fetched on its own, so one that fails (a rule, a network
 * error) shows as "–" without hiding the others.
 */

export type Piece<T> = { ok: true; value: T } | { ok: false };

export const COUNT_KEYS = [
  'companies',
  'inactiveCompanies',
  'customers',
  'products',
  'orders',
  'processingOrders',
  'completedOrders',
] as const;
export type CountKey = (typeof COUNT_KEYS)[number];

export interface DashboardSnapshot {
  /** The clock every rule below was read against. */
  at: number;
  counts: Record<CountKey, Piece<number>>;
  recentOrders: Piece<Order[]>;
  recentCompanies: Piece<Company[]>;
  /** Orders created in the last 60 days (the 30 days shown and the 30 before). */
  windowOrders: Piece<Order[]>;
  /** Customer accounts created in the last 60 days. */
  newCustomers: Piece<Customer[]>;
  /** Orders still processing or out for delivery. */
  openOrders: Piece<Order[]>;
  pendingRequests: Piece<ServiceRequest[]>;
  /** Reviews of at most LOW_RATING_MAX stars (the page keeps the visible, recent ones). */
  lowReviews: Piece<Review[]>;
  /** Active companies with no product at all (the page keeps the ones past their grace period). */
  emptyCompanies: Piece<Company[]>;
}

/** Companies that are not active; a company with no stored status counts as active. */
const NON_ACTIVE = ['inactive', 'pending', 'rejected'];

const RECENT = 5;

async function piece<T>(read: () => Promise<T>): Promise<Piece<T>> {
  try {
    return { ok: true, value: await read() };
  } catch {
    return { ok: false };
  }
}

const countOf = async (q: Query<DocumentData>) => (await getCountFromServer(q)).data().count;

const docsOf = async <T>(q: Query<DocumentData>, map: (id: string, data: DocumentData) => T): Promise<T[]> =>
  (await getDocs(q)).docs.map((d) => map(d.id, d.data()));

export async function fetchDashboard(db: Firestore, at: number): Promise<DashboardSnapshot> {
  const windowStart = Timestamp.fromMillis(at - 2 * WINDOW_DAYS * 86_400_000);
  const orders = collection(db, 'orders');
  const companies = collection(db, 'companies');
  const users = collection(db, 'users');

  // Companies in the trash are inactive but are not part of the figures.
  const trashed = () => countOf(query(companies, where('trashedAt', '>', Timestamp.fromMillis(0))));

  const counts: Record<CountKey, () => Promise<number>> = {
    companies: async () => (await countOf(query(companies))) - (await trashed()),
    inactiveCompanies: async () =>
      (await countOf(query(companies, where('status', 'in', NON_ACTIVE)))) - (await trashed()),
    customers: () => countOf(query(users, where('role', '==', 'customer'))),
    products: () => countOf(query(collection(db, 'products'))),
    orders: () => countOf(query(orders)),
    processingOrders: () => countOf(query(orders, where('orderStatus', '==', 'processing'))),
    completedOrders: () => countOf(query(orders, where('orderStatus', '==', 'completed'))),
  };

  const [
    countPieces,
    recentOrders,
    recentCompanies,
    windowOrders,
    newCustomers,
    openOrders,
    pendingRequests,
    lowReviews,
    emptyCompanies,
  ] = await Promise.all([
      Promise.all(COUNT_KEYS.map((key) => piece(counts[key]))),
      piece(() => docsOf(query(orders, orderBy('createdAt', 'desc'), limit(RECENT)), mapOrder)),
      piece(async () =>
        (await docsOf(query(companies, orderBy('createdAt', 'desc'), limit(RECENT)), mapCompany)).filter((c) => !c.trashedAt),
      ),
      piece(() => docsOf(query(orders, where('createdAt', '>=', windowStart)), mapOrder)),
      // The rules let Platform Admin list customer profiles only (role == 'customer'), so the
      // query must say so; with the date range that is the users(role, createdAt) index.
      piece(() =>
        docsOf(query(users, where('role', '==', 'customer'), where('createdAt', '>=', windowStart)), mapCustomer),
      ),
      piece(() => docsOf(query(orders, where('orderStatus', 'in', ['processing', 'out_for_delivery'])), mapOrder)),
      piece(() => docsOf(query(collection(db, 'service_requests'), where('status', '==', 'pending')), mapServiceRequest)),
      piece(() =>
        docsOf(
          query(collection(db, 'reviews'), where('stars', 'in', Array.from({ length: LOW_RATING_MAX }, (_, i) => i + 1))),
          mapReview,
        ),
      ),
      // One count per active company: companies are few, and a count is one read.
      piece(async () => {
        const active = (await docsOf(query(companies), mapCompany)).filter((c) => c.status === 'active');
        const products = collection(db, 'products');
        const sizes = await Promise.all(active.map((c) => countOf(query(products, where('companyId', '==', c.id)))));
        return active.filter((_, i) => sizes[i] === 0);
      }),
    ]);

  return {
    at,
    counts: Object.fromEntries(COUNT_KEYS.map((key, i) => [key, countPieces[i]])) as DashboardSnapshot['counts'],
    recentOrders,
    recentCompanies,
    windowOrders,
    newCustomers,
    openOrders,
    pendingRequests,
    lowReviews,
    emptyCompanies,
  };
}

/** Active companies = all companies minus the ones stored as not active. */
export function activeCompanyCount(counts: DashboardSnapshot['counts']): number | null {
  const all = counts.companies;
  const inactive = counts.inactiveCompanies;
  return all.ok && inactive.ok ? Math.max(0, all.value - inactive.value) : null;
}
