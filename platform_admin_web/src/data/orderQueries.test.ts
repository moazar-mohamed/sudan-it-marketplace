import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ getDocs: vi.fn(), getCountFromServer: vi.fn(), onSnapshot: vi.fn() }));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ collection: name }),
  where: (field: string, op: string, value: unknown) => ({ where: [field, op, value] }),
  orderBy: (field: string, dir: string) => ({ orderBy: [field, dir] }),
  limit: (n: number) => ({ limit: n }),
  startAfter: (cursor: unknown) => ({ startAfter: cursor }),
  query: (base: { collection: string }, ...constraints: unknown[]) => ({ ...base, constraints }),
  Timestamp: { fromDate: (d: Date) => ({ ts: d.getTime() }) },
  getDocs: fs.getDocs,
  getCountFromServer: fs.getCountFromServer,
  onSnapshot: fs.onSnapshot,
}));

import {
  cachedCustomerOrderCount,
  COUNTED_STATUSES,
  countOrders,
  countOrdersByStatus,
  countOrdersOf,
  fetchOrdersForExport,
  fetchOrdersPage,
  fetchOrdersSince,
  listenOrdersPage,
  ORDER_PAGE_SIZE,
  orderConstraints,
  rememberCustomerOrderCount,
  resetOrderCaches,
} from './orderQueries';

const db = {} as never;
const docs = (...items: [string, Record<string, unknown>][]) => ({ docs: items.map(([id, data]) => ({ id, data: () => data })) });
const many = (n: number) => docs(...Array.from({ length: n }, (_, i): [string, Record<string, unknown>] => [`o${i}`, { createdAt: { toDate: () => new Date(2026, 0, n - i) } }]));
const lastQuery = () => fs.getDocs.mock.calls[fs.getDocs.mock.calls.length - 1][0] as { collection: string; constraints: Record<string, unknown>[] };

beforeEach(() => {
  fs.getDocs.mockReset();
  fs.getCountFromServer.mockReset();
  fs.onSnapshot.mockReset();
  resetOrderCaches();
});

describe('what an order list asks the server for', () => {
  it('asks for nothing special when there is no filter', () => {
    expect(orderConstraints({})).toEqual([]);
  });

  it('filters by company, status and dates, as equality and range conditions', () => {
    const from = new Date(2026, 9, 1);
    const to = new Date(2026, 9, 5, 23, 59);
    expect(orderConstraints({ companyId: 'c1', status: 'completed', from, to })).toEqual([
      { where: ['companyId', '==', 'c1'] },
      { where: ['orderStatus', '==', 'completed'] },
      { where: ['createdAt', '>=', { ts: from.getTime() }] },
      { where: ['createdAt', '<=', { ts: to.getTime() }] },
    ]);
  });

  it('counts the older spelling of "out for delivery" too', () => {
    expect(orderConstraints({ status: 'out_for_delivery' })).toEqual([
      { where: ['orderStatus', 'in', ['out_for_delivery', 'outForDelivery']] },
    ]);
  });

  it('ignores an empty company and empty dates', () => {
    expect(orderConstraints({ companyId: '', status: null, from: null, to: null })).toEqual([]);
  });
});

describe('a page of orders', () => {
  it('is newest first and reads one more than a page, to know whether there is another', async () => {
    fs.getDocs.mockResolvedValue(many(3));
    await fetchOrdersPage(db, { status: 'processing' });
    const q = lastQuery();
    expect(q.collection).toBe('orders');
    expect(q.constraints).toEqual([
      { where: ['orderStatus', '==', 'processing'] },
      { orderBy: ['createdAt', 'desc'] },
      { limit: ORDER_PAGE_SIZE + 1 },
    ]);
  });

  it('says there is no next page when fewer than a page came back', async () => {
    fs.getDocs.mockResolvedValue(many(3));
    const page = await fetchOrdersPage(db, {});
    expect(page.orders).toHaveLength(3);
    expect(page.hasMore).toBe(false);
  });

  it('says there is a next page when it got the extra one, and hands back only a page', async () => {
    fs.getDocs.mockResolvedValue(many(ORDER_PAGE_SIZE + 1));
    const page = await fetchOrdersPage(db, {});
    expect(page.orders).toHaveLength(ORDER_PAGE_SIZE);
    expect(page.hasMore).toBe(true);
    // The next page starts after the last one shown, not after the extra.
    expect((page.cursor as unknown as { id: string }).id).toBe(`o${ORDER_PAGE_SIZE - 1}`);
  });

  it('starts the next page after the cursor', async () => {
    fs.getDocs.mockResolvedValue(many(2));
    const cursor = { id: 'o49' } as never;
    await fetchOrdersPage(db, {}, cursor);
    expect(lastQuery().constraints).toEqual([{ orderBy: ['createdAt', 'desc'] }, { startAfter: cursor }, { limit: ORDER_PAGE_SIZE + 1 }]);
  });

  it('has no cursor when there is nothing', async () => {
    fs.getDocs.mockResolvedValue(docs());
    expect(await fetchOrdersPage(db, {})).toEqual({ orders: [], cursor: null, hasMore: false });
  });
});

describe('the first page, live', () => {
  it('asks the same question as a page, and hands over each snapshot as a page', () => {
    const stop = () => undefined;
    let push: (s: unknown) => void = () => undefined;
    fs.onSnapshot.mockImplementation((_q: unknown, next: (s: unknown) => void) => {
      push = next;
      return stop;
    });
    const pages: { orders: { id: string }[]; hasMore: boolean }[] = [];
    const unsubscribe = listenOrdersPage(db, { status: 'processing' }, (p) => pages.push(p), () => undefined);
    expect(unsubscribe).toBe(stop);
    expect((fs.onSnapshot.mock.calls[0][0] as { constraints: unknown[] }).constraints).toEqual([
      { where: ['orderStatus', '==', 'processing'] },
      { orderBy: ['createdAt', 'desc'] },
      { limit: ORDER_PAGE_SIZE + 1 },
    ]);
    push(many(ORDER_PAGE_SIZE + 1));
    push(many(2));
    expect(pages.map((p) => [p.orders.length, p.hasMore])).toEqual([[ORDER_PAGE_SIZE, true], [2, false]]);
  });

  it('passes a refusal on', () => {
    const onError = vi.fn();
    fs.onSnapshot.mockImplementation((_q: unknown, _next: unknown, fail: (e: unknown) => void) => {
      fail(new Error('permission-denied'));
      return () => undefined;
    });
    listenOrdersPage(db, {}, () => undefined, onError);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('every order for a file', () => {
  const pageOf = (n: number, offset: number) =>
    docs(...Array.from({ length: n }, (_, i): [string, Record<string, unknown>] => [`o${offset + i}`, { createdAt: { toDate: () => new Date(2026, 0, 1) } }]));

  it('reads pages of 500 until there are no more', async () => {
    fs.getDocs.mockResolvedValueOnce(pageOf(501, 0)).mockResolvedValueOnce(pageOf(200, 500));
    const result = await fetchOrdersForExport(db, { status: 'completed' });
    expect(result.orders).toHaveLength(700);
    expect(result.capped).toBe(false);
    expect(fs.getDocs).toHaveBeenCalledTimes(2);
    expect(lastQuery().constraints).toContainEqual({ limit: 501 });
    expect(lastQuery().constraints.some((c) => 'startAfter' in c)).toBe(true);
  });

  it('stops at the cap and says there was more', async () => {
    // Asked for at most 15, the server is asked for 16 (one extra, to know there is more) and has them.
    fs.getDocs.mockResolvedValueOnce(pageOf(16, 0));
    const result = await fetchOrdersForExport(db, {}, 15);
    expect(result.orders).toHaveLength(15);
    expect(result.capped).toBe(true);
    expect(fs.getDocs).toHaveBeenCalledTimes(1);
    expect(lastQuery().constraints).toContainEqual({ limit: 16 });
  });

  it('is not capped when the last page fits exactly', async () => {
    fs.getDocs.mockResolvedValueOnce(pageOf(10, 0));
    const result = await fetchOrdersForExport(db, {}, 10);
    expect(result).toMatchObject({ capped: false });
    expect(result.orders).toHaveLength(10);
  });
});

describe('counts', () => {
  it('counts the orders that match, on the server', async () => {
    fs.getCountFromServer.mockResolvedValue({ data: () => ({ count: 42 }) });
    expect(await countOrders(db, { companyId: 'c1' })).toBe(42);
    const q = fs.getCountFromServer.mock.calls[0][0] as { collection: string; constraints: unknown[] };
    expect(q.collection).toBe('orders');
    expect(q.constraints).toEqual([{ where: ['companyId', '==', 'c1'] }]);
  });

  it('counts each status inside the rest of the filter; the statuses add up to every order', async () => {
    fs.getCountFromServer.mockImplementation(async (q: { constraints: { where: [string, string, unknown] }[] }) => {
      const status = q.constraints.find((c) => c.where[0] === 'orderStatus')!.where[2];
      const n = status === 'processing' ? 5 : status === 'completed' ? 20 : status === 'cancelled' ? 3 : 0;
      return { data: () => ({ count: n }) };
    });
    // out_for_delivery uses `in`, whose value is a list: the mock reads it as 0.
    const counts = await countOrdersByStatus(db, { companyId: 'c1' });
    expect(Object.keys(counts).sort()).toEqual([...COUNTED_STATUSES].sort());
    expect(counts.processing).toBe(5);
    expect(counts.completed).toBe(20);
    expect(counts.cancelled).toBe(3);
    expect(fs.getCountFromServer).toHaveBeenCalledTimes(COUNTED_STATUSES.length);
  });

  it('counts one customer\'s or one company\'s orders', async () => {
    fs.getCountFromServer.mockResolvedValue({ data: () => ({ count: 7 }) });
    expect(await countOrdersOf(db, 'customerId', 'u1')).toBe(7);
    const q = fs.getCountFromServer.mock.calls[0][0] as { constraints: unknown[] };
    expect(q.constraints).toEqual([{ where: ['customerId', '==', 'u1'] }]);
  });
});

describe('orders since a time', () => {
  it('reads those placed at or after it, newest first', async () => {
    const since = new Date(2026, 0, 1);
    fs.getDocs.mockResolvedValue(
      docs(
        ['old', { createdAt: { toDate: () => new Date(2026, 1, 1) } }],
        ['new', { createdAt: { toDate: () => new Date(2026, 5, 1) } }],
        ['undated', {}],
      ),
    );
    const orders = await fetchOrdersSince(db, since);
    expect(lastQuery().constraints).toEqual([{ where: ['createdAt', '>=', { ts: since.getTime() }] }]);
    expect(orders.map((o) => o.id)).toEqual(['new', 'old', 'undated']);
  });

  it('reads every order when there is no start', async () => {
    fs.getDocs.mockResolvedValue(docs());
    await fetchOrdersSince(db, null);
    expect(lastQuery().constraints).toEqual([]);
  });
});

describe('the per-customer count cache', () => {
  it('remembers a count until it is reset', () => {
    expect(cachedCustomerOrderCount('u1')).toBeUndefined();
    rememberCustomerOrderCount('u1', 4);
    expect(cachedCustomerOrderCount('u1')).toBe(4);
    resetOrderCaches();
    expect(cachedCustomerOrderCount('u1')).toBeUndefined();
  });
});
