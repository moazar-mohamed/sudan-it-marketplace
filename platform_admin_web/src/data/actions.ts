import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase';
import * as ops from './categoryOps';
import type { CategoryFields, NewCategoryInput, RunOptions } from './categoryOps';
import type { ImageSelection } from './imageRules';
import { resolveImageSelection } from './imageUpload';
import { deleteCompanyCascade } from './deleteCompany';
import {
  createCompanyWithAdminAccount,
  secondaryAppProvisioner,
  type NewCompanyInput,
} from './provisionCompany';
import type { Category, CompanyStatus } from './types';

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

/*
 * Categories: one tree of any depth, shared by products and services. The
 * multi-document operations (move, delete a subtree) live in
 * categoryOps.ts, where they are tested against the Firestore emulator.
 */
export type { CategoryFields, DeletionSummary, NewCategoryInput, Progress } from './categoryOps';

export const createCategory = (input: NewCategoryInput, all: readonly Category[]) =>
  ops.createCategory(db, input, all);

export const updateCategory = (id: string, fields: CategoryFields) =>
  ops.updateCategoryFields(db, id, fields);

export const setCategoryActive = (id: string, isActive: boolean) =>
  ops.setCategoryActive(db, id, isActive);

/** Saves the customer-facing order of one set of siblings. */
export const saveSiblingOrder = (orderedIds: readonly string[]) => ops.saveSiblingOrder(db, orderedIds);

export const moveCategory = (
  all: readonly Category[],
  id: string,
  newParentId: string | null,
  options?: RunOptions,
) => ops.moveCategory(db, all, id, newParentId, options);

export const repairCategoryChains = (all: readonly Category[], options?: RunOptions) =>
  ops.repairCategoryChains(db, all, options);

/** What deleting a category (and everything below it) would remove. */
export const summarizeCategoryDeletion = (all: readonly Category[], id: string) =>
  ops.summarizeDeletion(db, all, id);

/** Deletes a category, its sub-categories and the products, services and offers filed in them. */
export const deleteCategoryTree = (all: readonly Category[], id: string, options?: RunOptions) =>
  ops.deleteCategoryTree(db, all, id, options);

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
