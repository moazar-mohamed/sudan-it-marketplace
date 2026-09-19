import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
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
