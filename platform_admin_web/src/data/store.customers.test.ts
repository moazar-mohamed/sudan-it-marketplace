// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * "Total customers" on the Platform Admin dashboard is the number of `users`
 * documents whose role is "customer", kept live by one Firestore listener. It
 * rises the moment a customer profile is created (a customer registering, or
 * the first Google sign-in in the customer app), so the figure can legitimately
 * read 2 and then 3 while the dashboard stays open.
 */
const firestore = vi.hoisted(() => {
  const state = {
    queries: [] as { collection: string; wheres: unknown[][] }[],
    onNext: null as null | ((snap: unknown) => void),
    onError: null as null | ((error: Error) => void),
    unsubscribed: 0,
  };
  return state;
});

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ collection: name, wheres: [] as unknown[][] }),
  where: (...args: unknown[]) => ({ where: args }),
  query: (base: { collection: string }, ...clauses: { where: unknown[] }[]) => {
    const q = { collection: base.collection, wheres: clauses.map((c) => c.where) };
    firestore.queries.push(q);
    return q;
  },
  onSnapshot: (
    _query: unknown,
    next: (snap: unknown) => void,
    error: (e: Error) => void,
  ) => {
    firestore.onNext = next;
    firestore.onError = error;
    return () => {
      firestore.unsubscribed++;
    };
  },
}));
vi.mock('../firebase', () => ({ db: {}, auth: {} }));

const { stores } = await import('./store');

const userDoc = (id: string, data: Record<string, unknown>) => ({ id, data: () => data });
const snapshot = (...docs: ReturnType<typeof userDoc>[]) => ({ docs });

beforeEach(() => {
  stores.customers.reset();
  firestore.queries.length = 0;
  firestore.onNext = null;
  firestore.onError = null;
});

describe('customers store (the dashboard "Total customers" figure)', () => {
  it('reads only users whose role is customer', () => {
    stores.customers.subscribe(() => undefined);
    expect(firestore.queries).toEqual([
      { collection: 'users', wheres: [['role', '==', 'customer']] },
    ]);
  });

  it('starts loading, then holds exactly the customers received', () => {
    expect(stores.customers.getSnapshot().status).toBe('loading');
    stores.customers.subscribe(() => undefined);
    firestore.onNext!(
      snapshot(
        userDoc('c1', { fullName: 'A', email: 'a@x.test', role: 'customer' }),
        userDoc('c2', { fullName: 'B', email: 'b@x.test', role: 'customer' }),
      ),
    );
    const state = stores.customers.getSnapshot();
    expect(state.status).toBe('ready');
    expect(state.data.map((c) => c.id).sort()).toEqual(['c1', 'c2']);
  });

  it('follows the live collection: a new customer profile makes it 2 then 3', () => {
    const seen: number[] = [];
    stores.customers.subscribe(() => seen.push(stores.customers.getSnapshot().data.length));
    const a = userDoc('c1', { email: 'a@x.test' });
    const b = userDoc('c2', { email: 'b@x.test' });
    const google = userDoc('c3', { email: 'someone@gmail.test', fullName: 'Someone' });
    firestore.onNext!(snapshot(a, b));
    firestore.onNext!(snapshot(a, b, google)); // e.g. a first Google sign-in
    expect(seen).toEqual([2, 3]);
  });

  it('counts deactivated customers too (they are still customers)', () => {
    stores.customers.subscribe(() => undefined);
    firestore.onNext!(
      snapshot(
        userDoc('c1', { isActive: true }),
        userDoc('c2', { isActive: false }),
      ),
    );
    const { data } = stores.customers.getSnapshot();
    expect(data).toHaveLength(2);
    expect(data.filter((c) => c.isActive)).toHaveLength(1);
  });

  it('reports a listener failure as an error, not as a count', () => {
    stores.customers.subscribe(() => undefined);
    firestore.onError!(new Error('permission-denied'));
    const state = stores.customers.getSnapshot();
    expect(state.status).toBe('error');
    expect(state.data).toEqual([]);
  });
});
