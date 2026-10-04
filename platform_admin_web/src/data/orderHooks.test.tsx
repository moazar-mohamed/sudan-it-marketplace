// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapOrder } from './mappers';
import type { Order } from './types';

const q = vi.hoisted(() => ({
  fetchOrdersPage: vi.fn(),
  listenOrdersPage: vi.fn(),
  countOrdersByStatus: vi.fn(),
  countOrdersOf: vi.fn(),
  fetchOrdersSince: vi.fn(),
}));
const fs = vi.hoisted(() => ({ onSnapshot: vi.fn() }));

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string) => ({ doc: `${col}/${id}` }),
  collection: (_db: unknown, name: string) => ({ collection: name }),
  where: (f: string, op: string, v: unknown) => ({ where: [f, op, v] }),
  query: (base: unknown, ...c: unknown[]) => ({ base, c }),
  onSnapshot: fs.onSnapshot,
}));
vi.mock('./orderQueries', async (importOriginal) => ({ ...(await importOriginal<typeof import('./orderQueries')>()), ...q }));

import { resetOrderCaches } from './orderQueries';
import { useCustomerOrderCounts, useOrder, useOrderCountOf, useOrdersOf, useOrdersSince, useOrderStatusCounts, usePagedOrders } from './orderHooks';

const order = (id: string, day = 1): Order => mapOrder(id, { createdAt: new Date(2026, 0, day) });
const page = (ids: string[], hasMore = false) => ({ orders: ids.map((i) => order(i)), cursor: { id: ids[ids.length - 1] }, hasMore });

/** Stands in for the live first page: `live.send(page)` is a snapshot arriving. */
const live = {
  send: ((): void => undefined) as (page: unknown) => void,
  fail: ((): void => undefined) as (error: unknown) => void,
  stop: vi.fn(),
  starts: 0,
  filters: [] as unknown[],
};
const listen = (first?: unknown) =>
  q.listenOrdersPage.mockImplementation((_db: unknown, filter: unknown, onPage: (p: unknown) => void, onError: (e: unknown) => void) => {
    live.starts += 1;
    live.filters.push(filter);
    live.send = onPage;
    live.fail = onError;
    if (first !== undefined) onPage(first);
    return live.stop;
  });

beforeEach(() => {
  for (const fn of [...Object.values(q), fs.onSnapshot]) fn.mockReset();
  live.stop.mockReset();
  live.starts = 0;
  live.filters = [];
  resetOrderCaches();
});
afterEach(cleanup);

describe('a list of orders, a page at a time', () => {
  it('says loading, then shows the first page', async () => {
    listen();
    const { result } = renderHook(() => usePagedOrders({}));
    expect(result.current.status).toBe('loading');
    act(() => live.send(page(['a', 'b'], true)));
    expect(result.current.status).toBe('ready');
    expect(result.current.orders.map((o) => o.id)).toEqual(['a', 'b']);
    expect(result.current.hasMore).toBe(true);
  });

  it('reads nothing while it is turned off', async () => {
    listen();
    renderHook(() => usePagedOrders({}, false));
    await Promise.resolve();
    expect(live.starts).toBe(0);
    expect(q.fetchOrdersPage).not.toHaveBeenCalled();
  });

  it('follows a new or changed order by itself, and counts the changes after the first arrival', () => {
    listen();
    const { result } = renderHook(() => usePagedOrders({}));
    act(() => live.send(page(['a'])));
    expect(result.current.changes).toBe(0);
    act(() => live.send(page(['new', 'a'])));
    expect(result.current.orders.map((o) => o.id)).toEqual(['new', 'a']);
    expect(result.current.changes).toBe(1);
    act(() => live.send(page(['new', 'a'])));
    expect(result.current.changes).toBe(2);
  });

  it('stops listening when it goes away', () => {
    listen(page(['a']));
    const { unmount } = renderHook(() => usePagedOrders({}));
    unmount();
    expect(live.stop).toHaveBeenCalledTimes(1);
  });

  it('appends the next page after the cursor, without repeating an order, and keeps them when the live page changes', async () => {
    listen(page(['a', 'b'], true));
    q.fetchOrdersPage.mockResolvedValueOnce(page(['b', 'c'], false));
    const { result } = renderHook(() => usePagedOrders({}));
    act(() => result.current.loadMore());
    expect(result.current.loadingMore).toBe(true);
    await waitFor(() => expect(result.current.loadingMore).toBe(false));
    expect(result.current.orders.map((o) => o.id)).toEqual(['a', 'b', 'c']);
    expect(result.current.hasMore).toBe(false);
    expect(q.fetchOrdersPage.mock.calls[0][2]).toEqual({ id: 'b' });
    act(() => live.send(page(['new', 'a', 'b'], true)));
    expect(result.current.orders.map((o) => o.id)).toEqual(['new', 'a', 'b', 'c']);
  });

  it('does not load more when there is no more', () => {
    listen(page(['a'], false));
    const { result } = renderHook(() => usePagedOrders({}));
    act(() => result.current.loadMore());
    expect(q.fetchOrdersPage).not.toHaveBeenCalled();
  });

  it('listens again, and says loading, when the filter changes', () => {
    listen(page(['a']));
    const { result, rerender } = renderHook(({ status }) => usePagedOrders({ status }), { initialProps: { status: null as 'completed' | null } });
    expect(result.current.orders.map((o) => o.id)).toEqual(['a']);
    listen();
    rerender({ status: 'completed' });
    expect(live.stop).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('loading');
    expect(result.current.orders).toEqual([]);
    act(() => live.send(page(['z'])));
    expect(result.current.orders.map((o) => o.id)).toEqual(['z']);
    expect(live.filters[1]).toEqual({ status: 'completed' });
  });

  it('does not listen again for a filter that is the same, only a new object', () => {
    listen(page(['a']));
    const { rerender } = renderHook(() => usePagedOrders({ status: 'completed', from: new Date(2026, 0, 1) }));
    rerender();
    rerender();
    expect(live.starts).toBe(1);
  });

  it('says error when the read fails, and retries', () => {
    listen();
    const { result } = renderHook(() => usePagedOrders({}));
    act(() => live.fail(new Error('index missing')));
    expect(result.current.status).toBe('error');
    act(() => result.current.retry());
    expect(live.starts).toBe(2);
    act(() => live.send(page(['a'])));
    expect(result.current.status).toBe('ready');
    expect(result.current.changes).toBe(0);
  });
});

describe('the count of each status', () => {
  const counts = { processing: 1, out_for_delivery: 2, completed: 3, cancelled: 4 };

  it('is unknown until it is read, then the counts', async () => {
    q.countOrdersByStatus.mockResolvedValue(counts);
    const { result } = renderHook(() => useOrderStatusCounts({ companyId: 'c1' }));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toEqual(counts));
  });

  it('reads again when the filter changes (null in between) or a reload is asked for (the old figures stay)', async () => {
    q.countOrdersByStatus.mockResolvedValue(counts);
    const { result, rerender } = renderHook(({ company, reload }) => useOrderStatusCounts({ companyId: company }, true, reload), {
      initialProps: { company: 'c1', reload: 0 },
    });
    await waitFor(() => expect(result.current).toEqual(counts));
    rerender({ company: 'c2', reload: 0 });
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toEqual(counts));
    rerender({ company: 'c2', reload: 1 });
    expect(result.current).toEqual(counts);
    await waitFor(() => expect(q.countOrdersByStatus).toHaveBeenCalledTimes(3));
  });

  it('is null when it cannot be read, and reads nothing while turned off', async () => {
    q.countOrdersByStatus.mockRejectedValue(new Error('no'));
    const { result } = renderHook(() => useOrderStatusCounts({}));
    await waitFor(() => expect(q.countOrdersByStatus).toHaveBeenCalled());
    expect(result.current).toBeNull();
    q.countOrdersByStatus.mockClear();
    renderHook(() => useOrderStatusCounts({}, false));
    await Promise.resolve();
    expect(q.countOrdersByStatus).not.toHaveBeenCalled();
  });
});

describe('one order, live', () => {
  const snapshot = (id: string, exists: boolean) => ({ id, exists: () => exists, data: () => ({ customerName: 'Aya' }) });

  it('is loading, then the order, then follows changes', () => {
    let push: (s: unknown) => void = () => undefined;
    fs.onSnapshot.mockImplementation((_ref: unknown, next: (s: unknown) => void) => {
      push = next;
      return () => undefined;
    });
    const { result } = renderHook(() => useOrder('o1'));
    expect(result.current.status).toBe('loading');
    act(() => push(snapshot('o1', true)));
    expect(result.current.status).toBe('ready');
    expect(result.current.order?.customerName).toBe('Aya');
  });

  it('is ready with no order when there is none with that id', () => {
    fs.onSnapshot.mockImplementation((_ref: unknown, next: (s: unknown) => void) => {
      next(snapshot('x', false));
      return () => undefined;
    });
    const { result } = renderHook(() => useOrder('x'));
    expect(result.current).toMatchObject({ status: 'ready', order: null });
  });

  it('says error when the read is refused, and stops listening when it goes away', () => {
    const stop = vi.fn();
    fs.onSnapshot.mockImplementation((_ref: unknown, _next: unknown, fail: (e: unknown) => void) => {
      fail(new Error('permission-denied'));
      return stop;
    });
    const { result, unmount } = renderHook(() => useOrder('o1'));
    expect(result.current.status).toBe('error');
    unmount();
    expect(stop).toHaveBeenCalled();
  });

  it('listens to the document of this id only', () => {
    fs.onSnapshot.mockReturnValue(() => undefined);
    renderHook(() => useOrder('o9'));
    expect(fs.onSnapshot.mock.calls[0][0]).toEqual({ doc: 'orders/o9' });
  });
});

describe('the orders of one customer or company', () => {
  it('is the matching orders, newest first, live', () => {
    fs.onSnapshot.mockImplementation((_ref: unknown, next: (s: unknown) => void) => {
      next({
        docs: [
          { id: 'old', data: () => ({ createdAt: new Date(2026, 0, 1) }) },
          { id: 'new', data: () => ({ createdAt: new Date(2026, 5, 1) }) },
        ],
      });
      return () => undefined;
    });
    const { result } = renderHook(() => useOrdersOf('customerId', 'u1'));
    expect(result.current.status).toBe('ready');
    expect(result.current.orders.map((o) => o.id)).toEqual(['new', 'old']);
    expect(fs.onSnapshot.mock.calls[0][0]).toEqual({ base: { collection: 'orders' }, c: [{ where: ['customerId', '==', 'u1'] }] });
  });
});

describe('a count of one customer\'s or company\'s orders', () => {
  it('is null until read, then the number', async () => {
    q.countOrdersOf.mockResolvedValue(12);
    const { result } = renderHook(() => useOrderCountOf('companyId', 'c1'));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(12));
  });
});

describe('the order count of each customer on screen', () => {
  it('reads one count each, remembers them, and does not read the same customer twice', async () => {
    q.countOrdersOf.mockImplementation(async (_db: unknown, _field: string, id: string) => (id === 'u1' ? 3 : 0));
    const { result, rerender } = renderHook(({ ids }) => useCustomerOrderCounts(ids), { initialProps: { ids: ['u1', 'u2'] } });
    await waitFor(() => expect(result.current.size).toBe(2));
    expect(result.current.get('u1')).toBe(3);
    expect(result.current.get('u2')).toBe(0);
    // Another page, then back: only the new customer is read.
    rerender({ ids: ['u3'] });
    await waitFor(() => expect(result.current.has('u3')).toBe(true));
    rerender({ ids: ['u1', 'u2'] });
    expect(result.current.size).toBe(2);
    expect(q.countOrdersOf).toHaveBeenCalledTimes(3);
  });

  it('does not read again just because the list is a new array with the same customers', async () => {
    q.countOrdersOf.mockResolvedValue(1);
    const { result, rerender } = renderHook(() => useCustomerOrderCounts(['u1']));
    await waitFor(() => expect(result.current.size).toBe(1));
    rerender();
    rerender();
    expect(q.countOrdersOf).toHaveBeenCalledTimes(1);
  });

  it('leaves out a customer whose count could not be read', async () => {
    q.countOrdersOf.mockRejectedValue(new Error('no'));
    const { result } = renderHook(() => useCustomerOrderCounts(['u1']));
    await waitFor(() => expect(q.countOrdersOf).toHaveBeenCalled());
    expect(result.current.has('u1')).toBe(false);
  });
});

describe('orders since a time', () => {
  it('reads them once, and again only for another start or a reload', async () => {
    q.fetchOrdersSince.mockResolvedValue([order('a')]);
    const since = new Date(2026, 0, 1);
    const { result, rerender } = renderHook(({ s }) => useOrdersSince(s), { initialProps: { s: since as Date | null } });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ s: new Date(2026, 0, 1) });
    expect(q.fetchOrdersSince).toHaveBeenCalledTimes(1);
    rerender({ s: null });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(q.fetchOrdersSince.mock.calls[1][1]).toBeNull();
    act(() => result.current.reload());
    await waitFor(() => expect(q.fetchOrdersSince).toHaveBeenCalledTimes(3));
  });

  it('says error when it cannot read', async () => {
    q.fetchOrdersSince.mockRejectedValue(new Error('no'));
    const { result } = renderHook(() => useOrdersSince(null));
    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});
