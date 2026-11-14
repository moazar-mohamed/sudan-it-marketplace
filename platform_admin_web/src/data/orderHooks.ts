import { doc, onSnapshot, query, collection, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { mapOrder } from './mappers';
import {
  cachedCustomerOrderCount,
  countOrdersByStatus,
  countOrdersOf,
  fetchOrdersForExport,
  fetchOrdersPage,
  fetchOrdersSince,
  listenOrdersPage,
  rememberCustomerOrderCount,
  type OrderFilter,
  type OrderOwner,
  type OrdersPage,
} from './orderQueries';
import type { Order, OrderStatus } from './types';

/*
 * Hooks over orderQueries.ts. Each reads once when it mounts or when what it
 * was asked for changes (the list of orders also follows changes live), and says "loading" until the answer for the CURRENT
 * request arrives (an older answer is never shown for a newer request). They
 * set state only after an await, never while rendering or inside the effect's
 * first run.
 */

type Phase = 'loading' | 'ready' | 'error';

const time = (d: Date | null | undefined) => (d ? d.getTime() : '');
const filterKey = (f: OrderFilter) => JSON.stringify([f.status ?? '', f.companyId ?? '', time(f.from), time(f.to)]);
const newestFirst = (a: Order, b: Order) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);

/** Every order matching the filter, for a CSV file (at most ORDER_EXPORT_MAX). */
export const exportOrders = (filter: OrderFilter) => fetchOrdersForExport(db, filter);

export interface PagedOrders {
  status: Phase;
  error: unknown;
  orders: Order[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  /** How many times the live first page changed after it first arrived: a cue to read the counts again. */
  changes: number;
  retry: () => void;
}

/**
 * The orders matching a filter, 50 at a time, newest first. The first page is
 * live (a new or changed order shows up by itself); "load more" reads the older
 * ones once. `enabled = false` reads nothing.
 */
export function usePagedOrders(filter: OrderFilter, enabled = true): PagedOrders {
  const key = filterKey(filter);
  const [reloads, setReloads] = useState(0);
  const loadKey = `${key}|${reloads}`;
  const [loaded, setLoaded] = useState<{ loadKey: string; first: OrdersPage; changes: number; error: unknown } | null>(null);
  // The pages after the first, read on demand; the last one decides where the next starts.
  const [older, setOlder] = useState<{ loadKey: string; orders: Order[]; page: OrdersPage } | null>(null);
  const [moreFor, setMoreFor] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    return listenOrdersPage(
      db,
      filter,
      (first) =>
        setLoaded((now) => ({ loadKey, first, changes: now && now.loadKey === loadKey && !now.error ? now.changes + 1 : 0, error: null })),
      (error) => setLoaded({ loadKey, first: { orders: [], cursor: null, hasMore: false }, changes: 0, error }),
    );
    // `filter` is represented by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey, enabled]);

  const here = loaded && loaded.loadKey === loadKey ? loaded : null;
  const more = older && older.loadKey === loadKey ? older : null;
  const nextPage = more ? more.page : here?.first;

  const loadMore = useCallback(() => {
    if (!here || !nextPage || !nextPage.hasMore || moreFor === loadKey) return;
    setMoreFor(loadKey);
    fetchOrdersPage(db, filter, nextPage.cursor)
      .then((next) =>
        setOlder((now) => ({
          loadKey,
          orders: [...(now && now.loadKey === loadKey ? now.orders : []), ...next.orders],
          page: next,
        })),
      )
      .catch(() => undefined)
      .finally(() => setMoreFor((now) => (now === loadKey ? null : now)));
    // `filter` is represented by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here, nextPage, moreFor, loadKey]);

  const orders = useMemo(() => {
    if (!here) return [];
    const seen = new Set(here.first.orders.map((o) => o.id));
    return [...here.first.orders, ...(more ? more.orders.filter((o) => !seen.has(o.id)) : [])];
  }, [here, more]);

  return {
    status: !enabled || !here ? 'loading' : here.error ? 'error' : 'ready',
    error: here?.error ?? null,
    orders,
    hasMore: nextPage?.hasMore ?? false,
    loadingMore: moreFor === loadKey,
    loadMore,
    changes: here?.changes ?? 0,
    retry: () => setReloads((n) => n + 1),
  };
}

/** How many orders each status has within a company and a date range; null while unknown (or if it could not be read). */
export function useOrderStatusCounts(
  filter: Omit<OrderFilter, 'status'>,
  enabled = true,
  reload = 0,
): Record<OrderStatus, number> | null {
  const base = filterKey(filter);
  const key = `${base}|${reload}`;
  const [loaded, setLoaded] = useState<{ base: string; counts: Record<OrderStatus, number> | null } | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    countOrdersByStatus(db, filter)
      .then((counts) => current && setLoaded({ base, counts }))
      .catch(() => current && setLoaded({ base, counts: null }));
    return () => {
      current = false;
    };
    // `filter` is represented by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  // A reload keeps the figures on screen until the new ones arrive; another filter does not.
  return enabled && loaded && loaded.base === base ? loaded.counts : null;
}

/** One order, live; `order` is null when there is none with this id. */
export function useOrder(id: string | undefined): { status: Phase; error: unknown; order: Order | null; retry: () => void } {
  const [tries, setTries] = useState(0);
  const key = `${id ?? ''}|${tries}`;
  const [loaded, setLoaded] = useState<{ key: string; order: Order | null; error: unknown } | null>(null);

  useEffect(() => {
    if (!id) return undefined;
    return onSnapshot(
      doc(db, 'orders', id),
      (snapshot) => setLoaded({ key, order: snapshot.exists() ? mapOrder(snapshot.id, snapshot.data()) : null, error: null }),
      (error) => setLoaded({ key, order: null, error }),
    );
  }, [id, key]);

  const here = id && loaded && loaded.key === key ? loaded : null;
  return {
    status: !id ? 'ready' : !here ? 'loading' : here.error ? 'error' : 'ready',
    error: here?.error ?? null,
    order: here?.order ?? null,
    retry: () => setTries((n) => n + 1),
  };
}

/** Every order of one customer or one company, live, newest first. */
export function useOrdersOf(field: OrderOwner, id: string | undefined): { status: Phase; error: unknown; orders: Order[]; retry: () => void } {
  const [tries, setTries] = useState(0);
  const key = `${field}|${id ?? ''}|${tries}`;
  const [loaded, setLoaded] = useState<{ key: string; orders: Order[]; error: unknown } | null>(null);

  useEffect(() => {
    if (!id) return undefined;
    return onSnapshot(
      query(collection(db, 'orders'), where(field, '==', id)),
      (snapshot) => setLoaded({ key, orders: snapshot.docs.map((d) => mapOrder(d.id, d.data())).sort(newestFirst), error: null }),
      (error) => setLoaded({ key, orders: [], error }),
    );
  }, [field, id, key]);

  const here = id && loaded && loaded.key === key ? loaded : null;
  return {
    status: !id ? 'ready' : !here ? 'loading' : here.error ? 'error' : 'ready',
    error: here?.error ?? null,
    orders: here?.orders ?? [],
    retry: () => setTries((n) => n + 1),
  };
}

/** How many orders one customer or company has (a server count); null while unknown. */
export function useOrderCountOf(field: OrderOwner, id: string | undefined): number | null {
  const key = `${field}|${id ?? ''}`;
  const [loaded, setLoaded] = useState<{ key: string; count: number | null } | null>(null);
  useEffect(() => {
    if (!id) return undefined;
    let current = true;
    countOrdersOf(db, field, id)
      .then((count) => current && setLoaded({ key, count }))
      .catch(() => current && setLoaded({ key, count: null }));
    return () => {
      current = false;
    };
  }, [field, id, key]);
  return id && loaded && loaded.key === key ? loaded.count : null;
}

/** The order count of each of these customers (the ones on screen), read once each and remembered. */
export function useCustomerOrderCounts(ids: readonly string[]): ReadonlyMap<string, number> {
  // A new array every render is the same list: only its content decides.
  const listKey = ids.join('|');
  const wanted = useMemo(() => (listKey ? listKey.split('|') : []), [listKey]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let current = true;
    for (const id of wanted) {
      if (cachedCustomerOrderCount(id) !== undefined) continue;
      countOrdersOf(db, 'customerId', id)
        .then((count) => {
          rememberCustomerOrderCount(id, count);
          if (current) setVersion((v) => v + 1);
        })
        .catch(() => undefined);
    }
    return () => {
      current = false;
    };
  }, [wanted]);

  // `version` changes when a count arrives, so the map below is read fresh.
  return useMemo(() => {
    void version;
    const map = new Map<string, number>();
    for (const id of wanted) {
      const count = cachedCustomerOrderCount(id);
      if (count !== undefined) map.set(id, count);
    }
    return map;
  }, [wanted, version]);
}

/**
 * The orders placed since a time (every order when `since` is null), read once;
 * `reload` reads them again. For the analytics, which needs a period, not the
 * whole history.
 */
export function useOrdersSince(since: Date | null, enabled = true): {
  status: Phase;
  error: unknown;
  orders: Order[];
  reload: () => void;
  retry: () => void;
} {
  const [tries, setTries] = useState(0);
  const key = `${time(since) || 'all'}|${tries}`;
  const [loaded, setLoaded] = useState<{ key: string; orders: Order[]; error: unknown } | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    fetchOrdersSince(db, since)
      .then((orders) => current && setLoaded({ key, orders, error: null }))
      .catch((error: unknown) => current && setLoaded({ key, orders: [], error }));
    return () => {
      current = false;
    };
    // `since` is represented by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const here = enabled && loaded && loaded.key === key ? loaded : null;
  const reload = useCallback(() => setTries((n) => n + 1), []);
  return {
    status: !here ? 'loading' : here.error ? 'error' : 'ready',
    error: here?.error ?? null,
    orders: here?.orders ?? [],
    reload,
    retry: reload,
  };
}
