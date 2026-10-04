import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ getDocs: vi.fn() }));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ collection: name }),
  documentId: () => '__name__',
  limit: (n: number) => ({ limit: n }),
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
  query: (base: { collection: string }, ...parts: unknown[]) => ({ ...base, parts }),
  getDocs: fs.getDocs,
}));

import { HITS_PER_GROUP, hitPath, planSearch, searchRecords, searchVariants, type SearchHit } from './globalSearch';

const docs = (...items: [string, Record<string, unknown>][]) => ({ docs: items.map(([id, data]) => ({ id, data: () => data })) });

describe('what a search tries', () => {
  it('tries a Latin name as typed, in lower case, capitalised and in Title Case', () => {
    expect(searchVariants('nile co')).toEqual(['nile co', 'Nile co', 'Nile Co']);
    expect(searchVariants('NILE')).toEqual(['NILE', 'nile', 'Nile']);
    expect(searchVariants('Nile')).toEqual(['Nile', 'nile']);
    expect(searchVariants('blue-sky')).toEqual(['blue-sky', 'Blue-sky', 'Blue-Sky']);
  });

  it('tries Arabic and numbers once, as typed', () => {
    expect(searchVariants('النيل')).toEqual(['النيل']);
    expect(searchVariants('  123 ')).toEqual(['123']);
    expect(searchVariants('   ')).toEqual([]);
  });

  it('runs nothing for a term that is too short', () => {
    expect(planSearch('')).toEqual([]);
    expect(planSearch(' a ')).toEqual([]);
    expect(planSearch('ال').length).toBeGreaterThan(0);
  });

  it('asks every kind of record, once per spelling', () => {
    const plans = planSearch('nile');
    for (const kind of ['company', 'product', 'customer', 'order'] as const) {
      expect(plans.filter((p) => p.kind === kind && p.field !== 'email' && p.field !== '__id__').map((p) => p.value)).toEqual(['nile', 'Nile']);
    }
  });

  it('searches customers only among the users whose role is customer', () => {
    const customers = planSearch('nile').filter((p) => p.collection === 'users');
    expect(customers.length).toBeGreaterThan(0);
    expect(customers.every((p) => p.customersOnly === true)).toBe(true);
    expect(planSearch('nile').filter((p) => p.collection !== 'users').every((p) => !p.customersOnly)).toBe(true);
  });

  it('looks an e-mail up in lower case, only for a term that could be one', () => {
    expect(planSearch('Sara@X.test').find((p) => p.field === 'email')?.value).toBe('sara@x.test');
    expect(planSearch('أحمد').find((p) => p.field === 'email')).toBeUndefined();
    expect(planSearch('12345').find((p) => p.field === 'email')).toBeUndefined();
  });

  it('looks an order number up by the start of its id, with or without the #', () => {
    expect(planSearch('#abcd1234').find((p) => p.field === '__id__')?.value).toBe('abcd1234');
    expect(planSearch('abcd').find((p) => p.field === '__id__')?.value).toBe('abcd');
    expect(planSearch('two words').find((p) => p.field === '__id__')).toBeUndefined();
    expect(planSearch('ab').find((p) => p.field === '__id__')).toBeUndefined();
    expect(planSearch('أحمد').find((p) => p.field === '__id__')).toBeUndefined();
  });
});

describe('running a search', () => {
  beforeEach(() => {
    fs.getDocs.mockReset();
  });

  it('builds "starts with" ranges with a small limit, and a role filter for customers', async () => {
    fs.getDocs.mockResolvedValue(docs());
    await searchRecords({} as never, 'Nile');
    const queries = fs.getDocs.mock.calls.map((c) => c[0] as { collection: string; parts: { field?: string; op?: string; value?: unknown; limit?: number }[] });
    const company = queries.find((q) => q.collection === 'companies')!;
    expect(company.parts).toEqual([
      { field: 'name', op: '>=', value: 'Nile' },
      { field: 'name', op: '<=', value: 'Nile' },
      { limit: HITS_PER_GROUP },
    ]);
    const customer = queries.find((q) => q.collection === 'users')!;
    expect(customer.parts[0]).toEqual({ field: 'role', op: '==', value: 'customer' });
    const byId = queries.find((q) => q.parts.some((p) => p.field === '__name__'))!;
    expect(byId.collection).toBe('orders');
  });

  it('reads nothing for a term that is too short', async () => {
    const results = await searchRecords({} as never, 'a');
    expect(fs.getDocs).not.toHaveBeenCalled();
    expect(results.company).toEqual({ ok: true, value: [] });
  });

  it('turns the documents found into records, grouped by kind, without repeats', async () => {
    fs.getDocs.mockImplementation(async (q: { collection: string; parts: { value?: unknown }[] }) => {
      if (q.collection === 'companies') return docs(['c1', { name: 'Nile Co' }]);
      if (q.collection === 'products') return docs(['p1', { name: 'Nile Router', companyName: 'Nile Co' }]);
      if (q.collection === 'users') return docs(['u1', { fullName: 'Nile User', email: 'n@x.test', role: 'customer' }]);
      return docs(['ord12345xyz', { customerName: 'Nile Buyer', totalAmount: 10 }]);
    });
    const results = await searchRecords({} as never, 'nile');
    const kinds = (['company', 'customer', 'order', 'product'] as const).map((k) => {
      const piece = results[k];
      if (!piece.ok) throw new Error('failed');
      return piece.value.map((h: SearchHit) => h.item.id);
    });
    // Several spellings and queries return the same document: it appears once.
    expect(kinds).toEqual([['c1'], ['u1'], ['ord12345xyz'], ['p1']]);
  });

  it('keeps at most five of a kind, in the order found', async () => {
    fs.getDocs.mockImplementation(async (q: { collection: string }) =>
      q.collection === 'companies'
        ? docs(...Array.from({ length: 8 }, (_, i): [string, Record<string, unknown>] => [`c${i}`, { name: `Nile ${i}` }]))
        : docs(),
    );
    const piece = (await searchRecords({} as never, 'nile')).company;
    expect(piece.ok && piece.value.map((h) => h.item.id)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4']);
  });

  it('shows a kind as unavailable when every query for it fails, and keeps the other kinds', async () => {
    fs.getDocs.mockImplementation(async (q: { collection: string }) => {
      if (q.collection === 'users') throw new Error('The query requires an index');
      return q.collection === 'companies' ? docs(['c1', { name: 'Nile Co' }]) : docs();
    });
    const results = await searchRecords({} as never, 'nile');
    expect(results.customer).toEqual({ ok: false });
    expect(results.company.ok).toBe(true);
    expect(results.product).toEqual({ ok: true, value: [] });
  });

  it('keeps what the other queries of a kind found when only some fail', async () => {
    fs.getDocs.mockImplementation(async (q: { collection: string; parts: { field?: string }[] }) => {
      if (q.collection === 'users' && q.parts.some((p) => p.field === 'email')) throw new Error('index');
      return q.collection === 'users' ? docs(['u1', { fullName: 'Nile', email: 'n@x.test' }]) : docs();
    });
    const piece = (await searchRecords({} as never, 'nile')).customer;
    expect(piece.ok && piece.value.map((h) => h.item.id)).toEqual(['u1']);
  });
});

describe('where a result opens', () => {
  it('goes to the record\'s own page', () => {
    const hit = (kind: SearchHit['kind']) => ({ kind, item: { id: 'x1' } }) as unknown as SearchHit;
    expect(hitPath(hit('company'))).toBe('/companies/x1');
    expect(hitPath(hit('customer'))).toBe('/customers/x1');
    expect(hitPath(hit('order'))).toBe('/orders/x1');
    expect(hitPath(hit('product'))).toBe('/products/x1');
  });
});
