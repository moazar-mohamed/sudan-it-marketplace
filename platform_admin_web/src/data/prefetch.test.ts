import { afterEach, describe, expect, it, vi } from 'vitest';

const started = vi.hoisted(() => [] as string[]);

vi.mock('./store', () => ({
  stores: new Proxy(
    {},
    {
      get: (_t, name: string) => ({
        subscribe: () => {
          started.push(name);
          return () => undefined;
        },
      }),
    },
  ),
}));

import { prefetchAllPages, prefetchPath, SECTION_STORES } from './prefetch';

afterEach(() => {
  started.length = 0;
  vi.useRealTimers();
});

describe('getting ready before a click', () => {
  it('fetches the page file and starts the collections of the section reached', () => {
    const products = vi.fn().mockResolvedValue({});
    const orders = vi.fn().mockResolvedValue({});
    prefetchPath('/products?company=c1', { products, orders });
    expect(products).toHaveBeenCalledTimes(1);
    expect(orders).not.toHaveBeenCalled();
    expect(started).toEqual(['products']);
  });

  it('reads nothing for orders (they are read a page at a time) and ignores unknown addresses', () => {
    const orders = vi.fn().mockResolvedValue({});
    prefetchPath('/orders/abc', { orders });
    expect(orders).toHaveBeenCalledTimes(1);
    expect(started).toEqual([]);
    expect(() => prefetchPath('/nowhere', {})).not.toThrow();
  });

  it('survives a page file that fails to load', () => {
    const broken = vi.fn().mockRejectedValue(new Error('offline'));
    expect(() => prefetchPath('/reports', { reports: broken })).not.toThrow();
  });

  it('every section it warms is one the stores know', () => {
    const known = ['companies', 'customers', 'admins', 'reports', 'products', 'categories', 'services', 'companyServices', 'serviceRequests', 'reviews', 'auditLog'];
    for (const names of Object.values(SECTION_STORES)) for (const n of names) expect(known).toContain(n);
  });

  it('fetches all the page files one after the other when idle, and can be stopped', async () => {
    vi.useFakeTimers();
    const a = vi.fn().mockResolvedValue({});
    const b = vi.fn().mockResolvedValue({});
    const c = vi.fn().mockResolvedValue({});
    const stop = prefetchAllPages({ a, b, c });
    await vi.advanceTimersByTimeAsync(250);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(250);
    expect(b).toHaveBeenCalledTimes(1);
    stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(c).not.toHaveBeenCalled();
  });
});
