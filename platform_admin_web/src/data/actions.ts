import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { toGeoPoint } from './location';
import type { CompanyStatus } from './types';

/*
 * The only writes Platform Admin can make from this dashboard. Each one
 * touches a fixed, minimal set of fields; the matching Firestore rules
 * independently reject anything wider, so a tampered client cannot use these
 * to change roles, ownership, prices, or order/payment data.
 */

export const setCompanyStatus = (companyId: string, status: CompanyStatus) =>
  updateDoc(doc(db, 'companies', companyId), {
    status,
    updatedAt: serverTimestamp(),
  });

export interface CompanyInput {
  name: string;
  description: string;
  city: string;
  /** Written location. Optional if a map point is given. */
  address: string;
  /** Optional exact map point; both set, or both null. */
  latitude: number | null;
  longitude: number | null;
  phone: string;
  email: string;
  pickupAddress: string;
}

/** Adds an active, unrated company. Its company-admin account is linked separately. */
export async function createCompany(input: CompanyInput): Promise<void> {
  const ref = doc(collection(db, 'companies'));
  // Coordinates are saved as numbers and only when a real point was picked;
  // a text-only company simply has no latitude/longitude fields.
  const point = toGeoPoint(input.latitude, input.longitude);
  await setDoc(ref, {
    name: input.name.trim(),
    logoUrl: '',
    description: input.description.trim(),
    city: input.city.trim(),
    address: input.address.trim(),
    ...(point ? { latitude: point.latitude, longitude: point.longitude } : {}),
    phone: input.phone.trim(),
    email: input.email.trim(),
    pickupAddress: input.pickupAddress.trim(),
    rating: 0,
    reviewCount: 0,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Firestore allows 500 writes per batch.
const BATCH_LIMIT = 500;

/**
 * Deletes a company together with its products. The company goes in the first
 * batch, and the security rules only let Platform Admin delete a product in a
 * batch that also removes its company (or after it is gone). Orders are never
 * touched: they keep their own copy of the company and product names.
 */
export async function deleteCompany(companyId: string): Promise<void> {
  const products = await getDocs(query(collection(db, 'products'), where('companyId', '==', companyId)));
  const refs = products.docs.map((d) => d.ref);

  const first = writeBatch(db);
  first.delete(doc(db, 'companies', companyId));
  refs.slice(0, BATCH_LIMIT - 1).forEach((ref) => first.delete(ref));
  await first.commit();

  for (let i = BATCH_LIMIT - 1; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    refs.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

// Deactivate / reactivate writes isActive and nothing else. The account and
// every order stay exactly as they are.
export const setCustomerActive = (userId: string, isActive: boolean) =>
  updateDoc(doc(db, 'users', userId), { isActive });

export interface CustomerProfileInput {
  fullName: string;
  phone: string;
}

// The only profile fields Platform Admin may edit on a customer; the rules
// reject any other key (role, companyId, email, uid, ...).
export const updateCustomerProfile = (userId: string, input: CustomerProfileInput) =>
  updateDoc(doc(db, 'users', userId), {
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    updatedAt: serverTimestamp(),
  });

export interface CategoryInput {
  name: string;
  description: string;
  iconName: string;
}

export async function createCategory(input: CategoryInput): Promise<void> {
  const ref = doc(collection(db, 'categories'));
  await setDoc(ref, {
    id: ref.id,
    name: input.name.trim(),
    description: input.description.trim(),
    iconName: input.iconName.trim(),
    isActive: true,
    createdAt: serverTimestamp(),
  });
}

export const updateCategory = (id: string, input: CategoryInput) =>
  updateDoc(doc(db, 'categories', id), {
    name: input.name.trim(),
    description: input.description.trim(),
    iconName: input.iconName.trim(),
  });

export const setCategoryActive = (id: string, isActive: boolean) =>
  updateDoc(doc(db, 'categories', id), { isActive });
