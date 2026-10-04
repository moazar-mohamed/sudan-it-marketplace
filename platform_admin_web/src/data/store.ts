import { useSyncExternalStore } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type FirestoreError,
  type Query,
} from 'firebase/firestore';
import { db } from '../firebase';
import { resetOrderCaches } from './orderQueries';
import {
  mapAuditEntry,
  mapCategory,
  mapCompany,
  mapCompanyService,
  mapCustomer,
  mapPlatformAdmin,
  mapProduct,
  mapReport,
  mapReview,
  mapService,
  mapServiceRequest,
} from './mappers';
import type {
  AuditEntry,
  CatalogService,
  Category,
  Company,
  CompanyServiceLink,
  Customer,
  PlatformAdmin,
  Product,
  Report,
  Review,
  ServiceRequest,
} from './types';

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

export const AUDIT_LOG_LIMIT = 300;

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
  // The other Platform Admins: users whose role is "platform_admin" (the rules
  // return only those, and only to an active admin).
  admins: new LiveCollection<PlatformAdmin>(
    () => query(collection(db, 'users'), where('role', '==', 'platform_admin')),
    mapPlatformAdmin,
    newestFirst,
  ),
  // Every report, for the Reports page.
  reports: new LiveCollection<Report>(() => collection(db, 'reports'), mapReport, newestFirst),
  // Only the ones nobody has started on: the sidebar badge (a handful of documents).
  newReports: new LiveCollection<Report>(
    () => query(collection(db, 'reports'), where('status', '==', 'new')),
    mapReport,
    newestFirst,
  ),
  products: new LiveCollection<Product>(
    () => collection(db, 'products'),
    mapProduct,
    newestFirst,
  ),
  categories: new LiveCollection<Category>(
    () => collection(db, 'categories'),
    mapCategory,
    (a, b) => a.name.localeCompare(b.name),
  ),
  services: new LiveCollection<CatalogService>(
    () => collection(db, 'services'),
    mapService,
    (a, b) => a.name.localeCompare(b.name),
  ),
  // Which company offers which service, with its price and offer.
  companyServices: new LiveCollection<CompanyServiceLink>(
    () => collection(db, 'company_services'),
    mapCompanyService,
    newestFirst,
  ),
  // Read-only. Chats are never read by Platform Admin. (Orders are not kept open here: they are
  // read a page, a count or a period at a time, see orderQueries.ts.)
  serviceRequests: new LiveCollection<ServiceRequest>(
    () => collection(db, 'service_requests'),
    mapServiceRequest,
    newestFirst,
  ),
  reviews: new LiveCollection<Review>(
    () => collection(db, 'reviews'),
    mapReview,
    newestFirst,
  ),
  // Only the newest entries: the trail grows forever, the screen shows recent history.
  auditLog: new LiveCollection<AuditEntry>(
    () => query(collection(db, 'admin_audit_log'), orderBy('createdAt', 'desc'), limit(AUDIT_LOG_LIMIT)),
    mapAuditEntry,
  ),
};

export function resetStores() {
  Object.values(stores).forEach((s) => s.reset());
  resetOrderCaches();
}

const NEVER_SUBSCRIBED = () => () => undefined;

/**
 * `enabled = false` leaves the collection unread (its listener never starts) for
 * a screen that only needs it under some filter; the state then stays "loading".
 */
export function useStore<T>(store: LiveCollection<T>, enabled = true): StoreState<T> & {
  retry: () => void;
} {
  const state = useSyncExternalStore(enabled ? store.subscribe : NEVER_SUBSCRIBED, store.getSnapshot);
  return { ...state, retry: () => store.retry() };
}
