import { useEffect, useState } from 'react';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import type { DocumentData, Query } from 'firebase/firestore';
import { db } from '../firebase';
import { BUILT_IN_CITIES, citiesFromDocument } from './cities';
import { useRetryKey } from './retry';
import {
  mapCategory,
  mapCompany,
  mapCompanyService,
  mapNotification,
  mapOrder,
  mapProduct,
  mapProfile,
  mapReport,
  mapReview,
  mapService,
  paymentAccounts,
} from './mappers';
import type {
  AppNotification,
  CatalogService,
  Category,
  City,
  Company,
  CompanyService,
  Order,
  PaymentAccount,
  Product,
  RatingStats,
  Report,
  Review,
  UserProfile,
} from './types';

export interface Loaded<T> {
  /** null until the first snapshot, so an unfinished load never looks empty. */
  items: T[] | null;
  error: boolean;
}

/** [build] returning null reads nothing: an empty list (a visitor has no orders). */
export function useCollection<T>(build: () => Query<DocumentData> | null, map: (id: string, d: DocumentData) => T, key = ''): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ items: null, error: false });
  const retry = useRetryKey();
  useEffect(
    () => {
      const built = build();
      if (built === null) {
        setState({ items: [], error: false });
        return;
      }
      setState((s) => (s.error ? { items: null, error: false } : s));
      return onSnapshot(
        built,
        (snap) => setState({ items: snap.docs.map((d) => map(d.id, d.data())), error: false }),
        () => setState({ items: null, error: true }),
      );
    },
    // build/map are stable for one [key]: each call site passes module-level code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, retry],
  );
  return state;
}

/** Every category: an inactive parent is what makes its children inactive too. */
export const useCategories = () =>
  useCollection<Category>(() => query(collection(db, 'categories')), mapCategory);

/** Products with units left, as the app queries them. */
export const useProducts = () =>
  useCollection<Product>(
    // A hidden product is left out by the query: the rules refuse a list that could include one.
    () => query(collection(db, 'products'), where('hidden', '==', false), where('stockCount', '>', 0)),
    mapProduct,
  );

export const useCompanies = () =>
  // Only active companies are readable by customers and visitors (the rules
  // refuse a list that could include a pending, rejected or deactivated one).
  useCollection<Company>(() => query(collection(db, 'companies'), where('status', '==', 'active')), mapCompany);

export const useServices = () =>
  useCollection<CatalogService>(
    () => query(collection(db, 'services'), where('isActive', '==', true)),
    mapService,
  );

export const useCompanyServices = () =>
  useCollection<CompanyService>(
    () => query(collection(db, 'company_services'), where('isActive', '==', true)),
    mapCompanyService,
  );

export const useRatings = () =>
  useCollection<[string, RatingStats]>(
    () => query(collection(db, 'ratings')),
    (id, d) => [id, { sum: Number(d.sum) || 0, count: Number(d.count) || 0 }],
  );

/** Visible reviews of one product or company, newest first. */
export function useReviews(field: 'targetId' | 'companyId', id: string): Review[] {
  const { items } = useCollection<Review>(
    () => query(collection(db, 'reviews'), where(field, '==', id), where('hidden', '==', false)),
    mapReview,
    `${field}/${id}`,
  );
  return items ? [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) : [];
}

export interface ProfileState {
  profile: UserProfile | null;
  /** The first answer has arrived (a missing profile is an answer). */
  loaded: boolean;
  failed: boolean;
}

export function useProfile(uid: string): ProfileState {
  const [state, setState] = useState<ProfileState>({ profile: null, loaded: false, failed: false });
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'users', uid),
        (snap) =>
          setState({ profile: snap.exists() ? mapProfile(snap.id, snap.data()) : null, loaded: true, failed: false }),
        () => setState({ profile: null, loaded: true, failed: true }),
      ),
    [uid],
  );
  return state;
}

/** The customer's orders, newest first (sorted here: no composite index). */
export function useMyOrders(uid: string): Loaded<Order> {
  const r = useCollection<Order>(
    () => query(collection(db, 'orders'), where('customerId', '==', uid)),
    mapOrder,
    uid,
  );
  return { ...r, items: r.items ? [...r.items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) : null };
}

/** One order, live; null when it is not there or is not the reader's. */
export function useOrder(id: string): { order: Order | null; loaded: boolean } {
  const [state, setState] = useState<{ order: Order | null; loaded: boolean }>({ order: null, loaded: false });
  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      doc(db, 'orders', id),
      (snap) => setState({ order: snap.exists() ? mapOrder(snap.id, snap.data()) : null, loaded: true }),
      () => setState({ order: null, loaded: true }),
    );
  }, [id]);
  return state;
}

/** The review of one order (null until rated). */
export function useReview(id: string): Review | null {
  const [review, setReview] = useState<Review | null>(null);
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'reviews', id),
        (snap) => setReview(snap.exists() ? mapReview(snap.id, snap.data()) : null),
        () => setReview(null),
      ),
    [id],
  );
  return review;
}

/** How many notifications are read and shown: the newest ones (each read spends the free quota). */
export const NOTIFICATIONS_SHOWN = 50;

const newestFirst = (list: AppNotification[]) => [...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

/**
 * The customer's newest notifications, newest first, live. It reads only the
 * newest [NOTIFICATIONS_SHOWN] (firestore.indexes.json has the index); while
 * that index is not ready on the server it reads them all, as before, and
 * keeps the newest. Null until the first answer; empty for a visitor (no [uid]).
 */
export function useNotifications(uid: string): AppNotification[] | null {
  const [items, setItems] = useState<AppNotification[] | null>(null);
  useEffect(() => {
    if (uid === '') {
      setItems([]);
      return;
    }
    const base = [where('recipientType', '==', 'customer'), where('recipientId', '==', uid)] as const;
    const map = (docs: { id: string; data: () => DocumentData }[]) => docs.map((d) => mapNotification(d.id, d.data()));
    let stop = onSnapshot(
      query(collection(db, 'notifications'), ...base, orderBy('createdAt', 'desc'), limit(NOTIFICATIONS_SHOWN)),
      (snap) => setItems(newestFirst(map(snap.docs))),
      () => {
        stop = onSnapshot(
          query(collection(db, 'notifications'), ...base),
          (snap) => setItems(newestFirst(map(snap.docs)).slice(0, NOTIFICATIONS_SHOWN)),
          () => setItems([]),
        );
      },
    );
    return () => stop();
  }, [uid]);
  return items;
}

/** The person's own reports, newest first. */
export function useMyReports(uid: string): Loaded<Report> {
  const r = useCollection<Report>(
    () => query(collection(db, 'reports'), where('reporterId', '==', uid)),
    mapReport,
    uid,
  );
  return { ...r, items: r.items ? [...r.items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) : null };
}

/** Platform Admin's cities, or the built-in list until they can be read. */
export function useCities(): City[] {
  const [cities, setCities] = useState<City[]>(BUILT_IN_CITIES);
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'platform_settings', 'cities'),
        (snap) => setCities(citiesFromDocument(snap.data())),
        () => undefined,
      ),
    [],
  );
  return cities;
}

/**
 * The bank accounts a company is paid into. They live apart from the public
 * company document, and only a signed-in customer may read them. Null until
 * they have loaded; empty when the company has none or they cannot be read.
 */
export function usePaymentAccounts(companyId: string): { accounts: PaymentAccount[] | null; failed: boolean } {
  const [state, setState] = useState<{ id: string; accounts: PaymentAccount[] | null; failed: boolean }>({ id: companyId, accounts: null, failed: false });
  const retry = useRetryKey();
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'company_payment', companyId),
        (snap) => setState({ id: companyId, accounts: paymentAccounts(snap.data()?.paymentAccounts), failed: false }),
        () => setState({ id: companyId, accounts: [], failed: true }),
      ),
    [companyId, retry],
  );
  return state.id === companyId ? state : { accounts: null, failed: false };
}

/** One product read directly: for a link to a product that left the marketplace. */
export function useProductDoc(id: string, skip: boolean): Product | null | undefined {
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  useEffect(() => {
    if (skip) return;
    let live = true;
    getDoc(doc(db, 'products', id)).then(
      (snap) => live && setProduct(snap.exists() ? mapProduct(snap.id, snap.data()) : null),
      () => live && setProduct(null),
    );
    return () => {
      live = false;
    };
  }, [id, skip]);
  return product;
}
