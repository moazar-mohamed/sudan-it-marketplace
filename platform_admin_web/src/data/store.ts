import { useSyncExternalStore } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type FirestoreError,
  type Query,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  mapCategory,
  mapCompany,
  mapCustomer,
  mapOrder,
  mapProduct,
  mapReview,
} from './mappers';
import type { Category, Company, Customer, Order, Product, Review } from './types';

export interface StoreState<T> {
  status: 'loading' | 'ready' | 'error';
  data: T[];
  error: FirestoreError | Error | null;
}

/**
 * One live Firestore listener per collection, shared by every screen.
 * The listener starts the first time any screen needs the data and then stays
 * open for the whole signed-in session, so moving between sections reuses the
 * already-fetched data instead of re-reading the collection. Everything is
 * torn down on sign-out via resetStores().
 */
class LiveCollection<T> {
  private state: StoreState<T> = { status: 'loading', data: [], error: null };
  private listeners = new Set<() => void>();
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly makeQuery: () => Query<DocumentData>,
    private readonly map: (id: string, data: DocumentData) => T,
    private readonly compare?: (a: T, b: T) => number,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    this.start();
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): StoreState<T> => this.state;

  private publish(next: StoreState<T>) {
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  private start() {
    if (this.unsubscribe) return;
    this.unsubscribe = onSnapshot(
      this.makeQuery(),
      (snapshot) => {
        const data = snapshot.docs.map((d) => this.map(d.id, d.data()));
        if (this.compare) data.sort(this.compare);
        this.publish({ status: 'ready', data, error: null });
      },
      (error) => {
        this.unsubscribe = null;
        this.publish({ status: 'error', data: [], error });
      },
    );
  }

  retry() {
    this.stop();
    this.publish({ status: 'loading', data: [], error: null });
    this.start();
  }

  reset() {
    this.stop();
    this.publish({ status: 'loading', data: [], error: null });
  }

  private stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}

const time = (d: Date | null) => (d ? d.getTime() : 0);
const newestFirst = <T extends { createdAt: Date | null }>(a: T, b: T) =>
  time(b.createdAt) - time(a.createdAt);

export const stores = {
  companies: new LiveCollection<Company>(
    () => collection(db, 'companies'),
    mapCompany,
    (a, b) => a.name.localeCompare(b.name),
  ),
  // Customers are the users whose role is "customer"; other roles are never
  // requested (and the security rules would not return them anyway).
  customers: new LiveCollection<Customer>(
    () => query(collection(db, 'users'), where('role', '==', 'customer')),
    mapCustomer,
    newestFirst,
  ),
  products: new LiveCollection<Product>(
    () => collection(db, 'products'),
    mapProduct,
    newestFirst,
  ),
  orders: new LiveCollection<Order>(
    () => collection(db, 'orders'),
    mapOrder,
    newestFirst,
  ),
  categories: new LiveCollection<Category>(
    () => collection(db, 'categories'),
    mapCategory,
    (a, b) => a.name.localeCompare(b.name),
  ),
  reviews: new LiveCollection<Review>(
    () => collection(db, 'reviews'),
    mapReview,
    newestFirst,
  ),
};

export function resetStores() {
  Object.values(stores).forEach((s) => s.reset());
}

export function useStore<T>(store: LiveCollection<T>): StoreState<T> & {
  retry: () => void;
} {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { ...state, retry: () => store.retry() };
}
