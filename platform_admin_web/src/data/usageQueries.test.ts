import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ getDocs: vi.fn(), getCountFromServer: vi.fn() }));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ collection: name }),
  where: (field: unknown, op: string, value: unknown) => ({ where: [typeof field === 'string' ? field : 'docId', op, value] }),
  orderBy: (field: string, dir: string) => ({ orderBy: [field, dir] }),
  limit: (n: number) => ({ limit: n }),
  documentId: () => ({ docId: true }),
  query: (base: { collection: string }, ...constraints: unknown[]) => ({ ...base, constraints }),
  Timestamp: { fromDate: (d: Date) => ({ ts: d.getTime() }) },
  getDocs: fs.getDocs,
  getCountFromServer: fs.getCountFromServer,
}));

import { countActiveOn, countNewCustomersOn, dayBounds, fetchMostViewed, fetchUsage, lastBusinessDays } from './usageQueries';

const db = {} as never;
const NOW = Date.UTC(2026, 9, 4, 10); // 4 Oct 2026, 12:00 in Khartoum

beforeEach(() => {
  fs.getDocs.mockReset();
  fs.getCountFromServer.mockReset();
});

describe('the days', () => {
  it('are the last n Khartoum days, oldest first, ending today', () => {
    expect(lastBusinessDays(3, NOW)).toEqual(['2026-10-02', '2026-10-03', '2026-10-04']);
  });

  it('count the day by Khartoum time: 23:30 UTC is already the next day there', () => {
    expect(lastBusinessDays(1, Date.UTC(2026, 9, 4, 23, 30))).toEqual(['2026-10-05']);
  });

  it('start and end at Khartoum midnight (UTC+2)', () => {
    const { start, end } = dayBounds('2026-10-04');
    expect(start.toISOString()).toBe('2026-10-03T22:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-04T21:59:59.999Z');
  });
});

describe('counting', () => {
  it('counts the people recorded on a day, on the server', async () => {
    fs.getCountFromServer.mockResolvedValue({ data: () => ({ count: 12 }) });
    expect(await countActiveOn(db, '2026-10-04')).toBe(12);
    const q = fs.getCountFromServer.mock.calls[0][0] as { collection: string; constraints: unknown[] };
    expect(q.collection).toBe('usage_days');
    expect(q.constraints).toEqual([{ where: ['day', '==', '2026-10-04'] }]);
  });

  it('counts the customers created on a day, inside that day only', async () => {
    fs.getCountFromServer.mockResolvedValue({ data: () => ({ count: 3 }) });
    expect(await countNewCustomersOn(db, '2026-10-04')).toBe(3);
    const q = fs.getCountFromServer.mock.calls[0][0] as { collection: string; constraints: unknown[] };
    expect(q.collection).toBe('users');
    expect(q.constraints).toEqual([
      { where: ['role', '==', 'customer'] },
      { where: ['createdAt', '>=', { ts: Date.UTC(2026, 9, 3, 22) }] },
      { where: ['createdAt', '<=', { ts: Date.UTC(2026, 9, 4, 21, 59, 59, 999) }] },
    ]);
  });
});

describe('the most viewed products', () => {
  it('lists the best first with their names, and marks one that no longer exists', async () => {
    fs.getDocs
      .mockResolvedValueOnce({ docs: [{ id: 'p2', data: () => ({ views: 40 }) }, { id: 'gone', data: () => ({ views: 7 }) }] })
      .mockResolvedValueOnce({ docs: [{ id: 'p2', data: () => ({ name: 'Router', companyName: 'Nile Co' }) }] });
    expect(await fetchMostViewed(db, 10)).toEqual([
      { id: 'p2', views: 40, name: 'Router', companyName: 'Nile Co' },
      { id: 'gone', views: 7, name: '', companyName: '' },
    ]);
    const first = fs.getDocs.mock.calls[0][0] as { collection: string; constraints: unknown[] };
    expect(first.collection).toBe('product_stats');
    expect(first.constraints).toEqual([{ orderBy: ['views', 'desc'] }, { limit: 10 }]);
  });

  it('asks for no product names when nothing was viewed', async () => {
    fs.getDocs.mockResolvedValueOnce({ docs: [] });
    expect(await fetchMostViewed(db)).toEqual([]);
    expect(fs.getDocs).toHaveBeenCalledTimes(1);
  });
});

describe('everything the section shows', () => {
  it('reads each piece, and one that fails does not take the others with it', async () => {
    fs.getCountFromServer.mockImplementation(async (q: { collection: string }) => {
      if (q.collection === 'usage_days') throw new Error('offline');
      return { data: () => ({ count: 2 }) };
    });
    fs.getDocs.mockResolvedValue({ docs: [] });
    const figures = await fetchUsage(db, NOW, 3);
    expect(figures.days).toEqual(['2026-10-02', '2026-10-03', '2026-10-04']);
    expect(figures.active.ok).toBe(false);
    expect(figures.newCustomers).toEqual({ ok: true, value: [2, 2, 2] });
    expect(figures.mostViewed).toEqual({ ok: true, value: [] });
  });
});
