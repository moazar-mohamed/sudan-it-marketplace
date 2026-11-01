import { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import type { DocumentData, Query } from 'firebase/firestore';
import { db } from '../firebase';
import { BUILT_IN_CITIES, citiesFromDocument } from './cities';
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
} from './mappers';
import type {
  AppNotification,
  CatalogService,
  Category,
  City,
  Company,
  CompanyService,
  Order,
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

function useCollection<T>(build: () => Query<DocumentData>, map: (id: string, d: DocumentData) => T, key = ''): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ items: null, error: false });
  useEffect(
    () =>
      onSnapshot(
        build(),
        (snap) => setState({ items: snap.docs.map((d) => map(d.id, d.data())), error: false }),
        () => setState({ items: null, error: true }),
      ),
    // build/map are stable for one [key]: each call site passes module-level code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return state;
}

/** Every category: an inactive parent is what makes its children inactive too. */
export const useCategories = () =>
  useCollection<Category>(() => query(collection(db, 'categories')), mapCategory);

/** Products with units left, as the app queries them. */
export const useProducts = () =>
  useCollection<Product>(
    () => query(collection(db, 'products'), where('stockCount', '>', 0)),
    mapProduct,
  );

export const useCompanies = () =>
  useCollection<Company>(() => query(collection(db, 'companies')), mapCompany);

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
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'orders', id),
        (snap) => setState({ order: snap.exists() ? mapOrder(snap.id, snap.data()) : null, loaded: true }),
        () => setState({ order: null, loaded: true }),
      ),
    [id],
  );
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

/** The customer's notifications, newest first (sorted here: no composite index). */
export function useNotifications(uid: string): AppNotification[] | null {
  const { items } = useCollection<AppNotification>(
    () =>
      query(
        collection(db, 'notifications'),
        where('recipientType', '==', 'customer'),
        where('recipientId', '==', uid),
      ),
    mapNotification,
    uid,
  );
  return items ? [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) : null;
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
