import {
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase';
import type { ImageSelection } from './imageRules';
import { resolveImageSelection } from './imageUpload';
import { deleteCompanyCascade } from './deleteCompany';
import {
  createCompanyWithAdminAccount,
  secondaryAppProvisioner,
  type NewCompanyInput,
} from './provisionCompany';
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
  /** Optional logo: a picked file (uploaded to Storage), a URL, or none. */
  logo?: ImageSelection;
}

/**
 * Adds an active, unrated company together with its company-admin login (see
 * provisionCompany.ts): the account is created in Firebase Authentication with
 * the given initial password and linked to the new company by its exact id.
 */
export const createCompany = (input: NewCompanyInput) =>
  createCompanyWithAdminAccount(input, {
    db,
    provisionAccount: secondaryAppProvisioner(firebaseConfig),
    resolveLogo: resolveImageSelection,
  });

/**
 * Deletes a company together with its admin, employees, invitations, products
 * and other company-owned data, keeping every order (see deleteCompany.ts).
 */
export const deleteCompany = (companyId: string) => deleteCompanyCascade(db, companyId);

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
  nameAr: string;
  nameEn: string;
  description: string;
  iconName: string;
}

/** `name` stays filled (English first) for everything that reads the single name. */
const legacyName = (input: CategoryInput) => input.nameEn.trim() || input.nameAr.trim();

export async function createCategory(input: CategoryInput, sortOrder: number): Promise<void> {
  const ref = doc(collection(db, 'categories'));
  await setDoc(ref, {
    id: ref.id,
    name: legacyName(input),
    nameAr: input.nameAr.trim(),
    nameEn: input.nameEn.trim(),
    sortOrder,
    description: input.description.trim(),
    iconName: input.iconName.trim(),
    isActive: true,
    createdAt: serverTimestamp(),
  });
}

export const updateCategory = (id: string, input: CategoryInput) =>
  updateDoc(doc(db, 'categories', id), {
    name: legacyName(input),
    nameAr: input.nameAr.trim(),
    nameEn: input.nameEn.trim(),
    description: input.description.trim(),
    iconName: input.iconName.trim(),
  });

/** Saves the customer-facing order: the category at index i gets position i. */
export async function saveCategoryOrder(orderedIds: readonly string[]): Promise<void> {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, 'categories', id), { sortOrder: index });
  });
  await batch.commit();
}

export const setCategoryActive = (id: string, isActive: boolean) =>
  updateDoc(doc(db, 'categories', id), { isActive });

/** Removes a category. The page only offers this for one nothing uses. */
export const deleteCategory = (id: string) => deleteDoc(doc(db, 'categories', id));

/** A catalogue service always belongs to one category (categoryId). */
export interface ServiceInput {
  categoryId: string;
  name: string;
  description: string;
}

export async function createService(input: ServiceInput): Promise<void> {
  const ref = doc(collection(db, 'services'));
  await setDoc(ref, {
    id: ref.id,
    categoryId: input.categoryId,
    name: input.name.trim(),
    description: input.description.trim(),
    isActive: true,
    createdAt: serverTimestamp(),
  });
}

export const updateService = (id: string, input: ServiceInput) =>
  updateDoc(doc(db, 'services', id), {
    categoryId: input.categoryId,
    name: input.name.trim(),
    description: input.description.trim(),
  });

export const setServiceActive = (id: string, isActive: boolean) =>
  updateDoc(doc(db, 'services', id), { isActive });
