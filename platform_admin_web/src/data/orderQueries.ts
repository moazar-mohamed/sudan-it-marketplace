import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { mapOrder } from './mappers';
import type { Order, OrderStatus } from './types';

/*
 * Reading orders without opening the whole collection. Orders are the
 * collection that grows without end, so the panel asks for what it needs: a
 * page of 50 (newest first) for a list, a count for a figure, the orders of one
 * customer or one period for a detail page or the analytics. Every list query
 * is a filter on equality fields plus a date range, ordered by date, so it
 * needs a composite index (firestore.indexes.json).
 */

export const ORDER_PAGE_SIZE = 50;

export interface OrderFilter {
  status?: OrderStatus | null;
  companyId?: string | null;
  /** Orders placed at or after this time. */
  from?: Date | null;
  /** Orders placed at or before this time. */
  to?: Date | null;
}

/** "Out for delivery" was once stored as `outForDelivery`; both spellings are the same status. */
const statusValues = (status: OrderStatus): string[] =>
  status === 'out_for_delivery' ? ['out_for_delivery', 'outForDelivery'] : [status];

export function orderConstraints(filter: OrderFilter): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  if (filter.companyId) constraints.push(where('companyId', '==', filter.companyId));
  if (filter.status) {
    const values = statusValues(filter.status);
    constraints.push(values.length === 1 ? where('orderStatus', '==', values[0]) : where('orderStatus', 'in', values));
  }
  if (filter.from) constraints.push(where('createdAt', '>=', Timestamp.fromDate(filter.from)));
  if (filter.to) constraints.push(where('createdAt', '<=', Timestamp.fromDate(filter.to)));
  return constraints;
}

export interface OrdersPage {
  orders: Order[];
  /** Where the next page starts; null when this was the last. */
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

const pageOf = (snapshot: QuerySnapshot<DocumentData>, size: number): OrdersPage => {
  const docs = snapshot.docs.slice(0, size);
  return {
    orders: docs.map((d) => mapOrder(d.id, d.data())),
    cursor: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore: snapshot.docs.length > size,
  };
};

/**
 * The first page of orders, live: [onPage] is called with it now and again each
 * time an order in it is added or changes (Firestore sends only what changed,
 * so this costs far fewer reads than reading the page again and again).
 */
export function listenOrdersPage(
  db: Firestore,
  filter: OrderFilter,
  onPage: (page: OrdersPage) => void,
  onError: (error: unknown) => void,
  size = ORDER_PAGE_SIZE,
): Unsubscribe {
  const constraints = [...orderConstraints(filter), orderBy('createdAt', 'desc'), limit(size + 1)];
  return onSnapshot(query(collection(db, 'orders'), ...constraints), (snapshot) => onPage(pageOf(snapshot, size)), onError);
}

/** One page of orders, newest first. One more than a page is read, to know whether there is a next one. */
export async function fetchOrdersPage(
  db: Firestore,
  filter: OrderFilter,
  after: QueryDocumentSnapshot<DocumentData> | null = null,
  size = ORDER_PAGE_SIZE,
): Promise<OrdersPage> {
  const constraints = [...orderConstraints(filter), orderBy('createdAt', 'desc')];
  if (after) constraints.push(startAfter(after));
  constraints.push(limit(size + 1));
  return pageOf(await getDocs(query(collection(db, 'orders'), ...constraints)), size);
}

/** Orders in one export, so a file can never cost more reads than this. */
export const ORDER_EXPORT_MAX = 5000;
const EXPORT_PAGE = 500;

/**
 * Every order that matches, newest first, for a file: pages of 500 until there
 * are no more or [max] have been read. `capped` says there were more.
 */
export async function fetchOrdersForExport(
  db: Firestore,
  filter: OrderFilter,
  max = ORDER_EXPORT_MAX,
): Promise<{ orders: Order[]; capped: boolean }> {
  const orders: Order[] = [];
  let after: QueryDocumentSnapshot<DocumentData> | null = null;
  for (;;) {
    const page: OrdersPage = await fetchOrdersPage(db, filter, after, Math.min(EXPORT_PAGE, max - orders.length));
    orders.push(...page.orders);
    if (!page.hasMore) return { orders, capped: false };
    if (orders.length >= max) return { orders, capped: true };
    after = page.cursor;
  }
}

/** How many orders match (a server count: one read per 1,000 matches). */
export async function countOrders(db: Firestore, filter: OrderFilter): Promise<number> {
  const snapshot = await getCountFromServer(query(collection(db, 'orders'), ...orderConstraints(filter)));
  return snapshot.data().count;
}

export const COUNTED_STATUSES: OrderStatus[] = ['processing', 'out_for_delivery', 'completed', 'cancelled'];

/** The count of each status within the rest of the filter (company, dates); the statuses add up to every order. */
export async function countOrdersByStatus(db: Firestore, filter: Omit<OrderFilter, 'status'>): Promise<Record<OrderStatus, number>> {
  const counts = await Promise.all(COUNTED_STATUSES.map((status) => countOrders(db, { ...filter, status })));
  return Object.fromEntries(COUNTED_STATUSES.map((status, i) => [status, counts[i]])) as Record<OrderStatus, number>;
}

/** Every order placed at or after `since` (all orders when null), newest first. */
export async function fetchOrdersSince(db: Firestore, since: Date | null): Promise<Order[]> {
  const base = collection(db, 'orders');
  const snapshot = await getDocs(since ? query(base, where('createdAt', '>=', Timestamp.fromDate(since))) : query(base));
  return snapshot.docs
    .map((d) => mapOrder(d.id, d.data()))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

export type OrderOwner = 'customerId' | 'companyId';

/** How many orders one customer or one company has. */
export async function countOrdersOf(db: Firestore, field: OrderOwner, id: string): Promise<number> {
  const snapshot = await getCountFromServer(query(collection(db, 'orders'), where(field, '==', id)));
  return snapshot.data().count;
}

/** A small cache of per-customer counts, so paging back and forth does not read them again. */
const customerCounts = new Map<string, number>();
export const cachedCustomerOrderCount = (id: string): number | undefined => customerCounts.get(id);
export const rememberCustomerOrderCount = (id: string, count: number) => customerCounts.set(id, count);
export const resetOrderCaches = () => customerCounts.clear();
