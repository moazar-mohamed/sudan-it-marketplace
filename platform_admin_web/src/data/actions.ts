import {
  doc,
  getDoc,
  increment,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../firebase';
import { recordAudit, stageAudit } from './auditLog';
import * as ops from './categoryOps';
import type { CategoryFields, NewCategoryInput, RunOptions } from './categoryOps';
import type { ImageSelection } from './imageRules';
import { resolveImageSelection } from './imageUpload';
import {
  fetchCompanyDocument,
  saveCompanyDocument,
  type PreparedDocumentFile,
} from './companyDocuments';
import { deleteCompanyCascade } from './deleteCompany';
import { createAdminAccount, type NewAdminInput } from './provisionAdmin';
import { createCustomerAccount, type NewCustomerInput } from './provisionCustomer';
import {
  createCompanyWithAdminAccount,
  secondaryAppProvisioner,
  type NewCompanyInput,
} from './provisionCompany';
import { adminCancellationPlan } from './moderation';
import { cleanUpdate, noticeData, type PlatformSettings } from './platformSettings';
import { pushToPhone } from './pushRelay';
import { reportNotificationFor } from './reportNotifications';
import type { Category, CompanyStatus, Report, ReportStatus, Review } from './types';

/*
 * The only writes Platform Admin can make from this dashboard. Each one
 * touches a fixed, minimal set of fields; the matching Firestore rules
 * independently reject anything wider, so a tampered client cannot use these
 * to change roles, ownership, prices, or order/payment data.
 */

/**
 * Hides an abusive review from customers (or shows it again). A hidden review
 * leaves the company's and the product's / service's averages, so the same
 * batch moves both running averages by its stars; the rules check they match.
 */
export async function setReviewHidden(review: Review, hidden: boolean) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'reviews', review.id), { hidden });
  for (const key of [`company_${review.companyId}`, `${review.targetType}_${review.targetId}`]) {
    batch.set(
      doc(db, 'ratings', key),
      {
        companyId: review.companyId,
        sum: increment(hidden ? -review.rating : review.rating),
        count: increment(hidden ? -1 : 1),
        lastReviewId: review.id,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
  stageAudit(batch, {
    action: hidden ? 'review.hide' : 'review.show',
    targetType: 'review',
    targetId: review.id,
    targetName: `${review.customerName} → ${review.companyName}`,
  });
  await batch.commit();
}

export async function setCompanyStatus(companyId: string, status: CompanyStatus, name = '') {
  const batch = writeBatch(db);
  batch.update(doc(db, 'companies', companyId), { status, updatedAt: serverTimestamp() });
  stageAudit(batch, {
    action: 'company.status',
    targetType: 'company',
    targetId: companyId,
    targetName: name,
    detail: status,
  });
  await batch.commit();
}

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
export async function createCompany(input: NewCompanyInput) {
  const created = await createCompanyWithAdminAccount(input, {
    db,
    provisionAccount: secondaryAppProvisioner(firebaseConfig),
    resolveLogo: resolveImageSelection,
  });
  await recordAudit({
    action: 'company.create',
    targetType: 'company',
    targetId: created.companyId,
    targetName: input.name,
  });
  return created;
}

/** Adds a real customer account (see provisionCustomer.ts) and records it. */
export async function createCustomer(input: NewCustomerInput) {
  const created = await createCustomerAccount(input);
  await recordAudit({
    action: 'customer.create',
    targetType: 'customer',
    targetId: created.uid,
    targetName: input.fullName,
  });
  return created;
}

/**
 * Moves a report along and writes the outcome the sender will read (status and
 * outcome only). When the status changes to "in progress" or "closed" the
 * sender is told too: a notification in the same batch (they see it in the app)
 * and then a push to their phone, which is best effort.
 */
export async function setReportStatus(report: Report, status: ReportStatus, resolution: string) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'reports', report.id), {
    status,
    resolution: resolution.trim(),
    updatedAt: serverTimestamp(),
  });
  stageAudit(batch, {
    action: 'report.status',
    targetType: 'report',
    targetId: report.id,
    targetName: report.subject,
    detail: status,
  });

  // One notification per report and type: a status reached before (the report was reopened) does not tell them twice.
  let notificationId: string | null = null;
  const note = reportNotificationFor(report, status);
  const adminId = auth.currentUser?.uid;
  if (note && adminId) {
    const already = await getDoc(doc(db, 'notifications', note.id)).then(
      (snapshot) => snapshot.exists(),
      () => true,
    );
    if (!already) {
      const { id, ...fields } = note;
      batch.set(doc(db, 'notifications', id), {
        id,
        ...fields,
        isRead: false,
        createdAt: serverTimestamp(),
        senderId: adminId,
      });
      notificationId = id;
    }
  }
  await batch.commit();
  if (notificationId) void pushToPhone(notificationId);
}

/** Adds another Platform Admin (see data/provisionAdmin.ts). */
export async function createAdmin(input: NewAdminInput) {
  const created = await createAdminAccount(input);
  await recordAudit({
    action: 'admin.create',
    targetType: 'admin',
    targetId: created.uid,
    targetName: input.fullName,
  });
  return created;
}

/** Switches another admin's access off or on; only isActive changes (never your own). */
export async function setAdminActive(userId: string, isActive: boolean, name = '') {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', userId), { isActive });
  stageAudit(batch, {
    action: 'admin.active',
    targetType: 'admin',
    targetId: userId,
    targetName: name,
    detail: isActive ? 'active' : 'inactive',
  });
  await batch.commit();
}

/** The company's registration document (Platform Admin only). */
export const loadCompanyDocument = (companyId: string) => fetchCompanyDocument(db, companyId);

export async function saveCompanyRegistration(
  companyId: string,
  registrationNumber: string,
  image: PreparedDocumentFile,
) {
  await saveCompanyDocument(db, companyId, registrationNumber, image);
  await recordAudit({ action: 'company.registration', targetType: 'company', targetId: companyId });
}

/**
 * Deletes a company together with its admin, employees, invitations, products
 * and other company-owned data, keeping every order (see deleteCompany.ts).
 */
export async function deleteCompany(companyId: string, name = '') {
  const summary = await deleteCompanyCascade(db, companyId);
  await recordAudit({ action: 'company.delete', targetType: 'company', targetId: companyId, targetName: name });
  return summary;
}

// Deactivate / reactivate writes isActive and nothing else. The account and
// every order stay exactly as they are.
export async function setCustomerActive(userId: string, isActive: boolean, name = '') {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', userId), { isActive });
  stageAudit(batch, {
    action: 'customer.active',
    targetType: 'customer',
    targetId: userId,
    targetName: name,
    detail: isActive ? 'active' : 'inactive',
  });
  await batch.commit();
}

export interface CustomerProfileInput {
  fullName: string;
  phone: string;
}

// The only profile fields Platform Admin may edit on a customer; the rules
// reject any other key (role, companyId, email, uid, ...).
export async function updateCustomerProfile(userId: string, input: CustomerProfileInput) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', userId), {
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    updatedAt: serverTimestamp(),
  });
  stageAudit(batch, {
    action: 'customer.edit',
    targetType: 'customer',
    targetId: userId,
    targetName: input.fullName,
  });
  await batch.commit();
}

/*
 * Categories: one tree of any depth, shared by products and services. The
 * multi-document operations (move, delete a subtree) live in
 * categoryOps.ts, where they are tested against the Firestore emulator.
 */
export type { CategoryFields, DeletionSummary, NewCategoryInput, Progress } from './categoryOps';

const categoryLabel = (c: { nameEn: string; nameAr: string }) => c.nameEn.trim() || c.nameAr.trim();
const categoryNameIn = (all: readonly Category[], id: string) => {
  const found = all.find((c) => c.id === id);
  return found ? categoryLabel(found) || found.name : '';
};

export async function createCategory(input: NewCategoryInput, all: readonly Category[]) {
  const id = await ops.createCategory(db, input, all);
  await recordAudit({ action: 'category.create', targetType: 'category', targetId: id, targetName: categoryLabel(input) });
  return id;
}

export async function updateCategory(id: string, fields: CategoryFields) {
  await ops.updateCategoryFields(db, id, fields);
  await recordAudit({ action: 'category.update', targetType: 'category', targetId: id, targetName: categoryLabel(fields) });
}

export async function setCategoryActive(id: string, isActive: boolean, name = '') {
  await ops.setCategoryActive(db, id, isActive);
  await recordAudit({
    action: 'category.active',
    targetType: 'category',
    targetId: id,
    targetName: name,
    detail: isActive ? 'active' : 'inactive',
  });
}

/** Saves the customer-facing order of one set of siblings. */
export const saveSiblingOrder = (orderedIds: readonly string[]) => ops.saveSiblingOrder(db, orderedIds);

export async function moveCategory(
  all: readonly Category[],
  id: string,
  newParentId: string | null,
  options?: RunOptions,
) {
  const result = await ops.moveCategory(db, all, id, newParentId, options);
  await recordAudit({
    action: 'category.move',
    targetType: 'category',
    targetId: id,
    targetName: categoryNameIn(all, id),
    detail: newParentId ? categoryNameIn(all, newParentId) : '',
  });
  return result;
}

export const repairCategoryChains = (all: readonly Category[], options?: RunOptions) =>
  ops.repairCategoryChains(db, all, options);

/** What deleting a category (and everything below it) would remove. */
export const summarizeCategoryDeletion = (all: readonly Category[], id: string) =>
  ops.summarizeDeletion(db, all, id);

/** Deletes a category, its sub-categories and the products, services and offers filed in them. */
export async function deleteCategoryTree(all: readonly Category[], id: string, options?: RunOptions) {
  const result = await ops.deleteCategoryTree(db, all, id, options);
  await recordAudit({
    action: 'category.delete',
    targetType: 'category',
    targetId: id,
    targetName: categoryNameIn(all, id),
  });
  return result;
}

/** A catalogue service always belongs to one category (categoryId). */
export interface ServiceInput {
  categoryId: string;
  name: string;
  description: string;
}

export async function updateService(id: string, input: ServiceInput) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'services', id), {
    categoryId: input.categoryId,
    name: input.name.trim(),
    description: input.description.trim(),
  });
  stageAudit(batch, { action: 'service.update', targetType: 'service', targetId: id, targetName: input.name });
  await batch.commit();
}

export async function setServiceActive(id: string, isActive: boolean, name = '') {
  const batch = writeBatch(db);
  batch.update(doc(db, 'services', id), { isActive });
  stageAudit(batch, {
    action: 'service.active',
    targetType: 'service',
    targetId: id,
    targetName: name,
    detail: isActive ? 'active' : 'inactive',
  });
  await batch.commit();
}

/**
 * Saves the platform notices (platform_settings/public) together with the
 * activity entry for the one that changed. The document always carries all
 * three notices, so `changed` only names what the entry says.
 */
export async function savePlatformSettings(next: PlatformSettings, changed: 'maintenance' | 'announcement' | 'update') {
  const batch = writeBatch(db);
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  const stored = (notice: ReturnType<typeof noticeData>) => ({
    ...notice,
    startsAt: notice.startsAt ? Timestamp.fromDate(notice.startsAt) : null,
    endsAt: notice.endsAt ? Timestamp.fromDate(notice.endsAt) : null,
  });
  batch.set(doc(db, 'platform_settings', 'public'), {
    maintenance: stored(noticeData(next.maintenance)),
    announcement: {
      ...stored(noticeData(next.announcement)),
      audience: next.announcement.audience,
      kind: next.announcement.kind,
    },
    update: cleanUpdate(next.update),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
  stageAudit(batch, {
    action: `settings.${changed}`,
    targetType: 'settings',
    targetId: 'public',
    detail: changed === 'update' ? String(next.update.minBuild) : next[changed].enabled ? 'on' : 'off',
  });
  await batch.commit();
}

/**
 * Hides a product from customers, with the reason its company will see, or
 * shows it again. Nothing else on the product changes.
 */
export async function setProductHidden(product: { id: string; name: string }, hidden: boolean, reason = '') {
  const note = reason.trim();
  const batch = writeBatch(db);
  batch.update(doc(db, 'products', product.id), { hidden, hiddenReason: hidden ? note : '' });
  stageAudit(batch, {
    action: hidden ? 'product.hide' : 'product.show',
    targetType: 'product',
    targetId: product.id,
    targetName: product.name,
    detail: hidden ? note : undefined,
  });
  await batch.commit();
}

/** Ends a product's running offer now: the price, the end time and the badge are cleared together. */
export async function endProductOffer(product: { id: string; name: string }) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'products', product.id), { offerPrice: null, offerEndsAt: null, offerBadge: null });
  stageAudit(batch, { action: 'product.endOffer', targetType: 'product', targetId: product.id, targetName: product.name });
  await batch.commit();
}

/** The order cannot be cancelled any more: it left Processing (the company moved it) since the page loaded. */
export class OrderNotCancellableError extends Error {
  readonly code = 'order/not-processing';
}

/**
 * Cancels a stuck order with the reason `admin`. An order that took its stock
 * (payment confirmed, or placed before stock moved to the confirmation) gives
 * exactly its quantity back to its own company's product in the same batch,
 * once; the rules check every part. The admin's reason goes to the activity log.
 */
export async function cancelOrderAsAdmin(orderId: string, reason: string) {
  const orderRef = doc(db, 'orders', orderId);
  const order = (await getDoc(orderRef)).data();
  if (!order || order.orderStatus !== 'processing') throw new OrderNotCancellableError();

  const productRef = doc(db, 'products', String(order.productId));
  const product = (await getDoc(productRef)).data();
  const { returnsStock, quantity } = adminCancellationPlan(order, product);

  const batch = writeBatch(db);
  if (returnsStock) {
    batch.update(productRef, {
      stockCount: increment(quantity),
      lastReleasedOrderId: orderId,
      updatedAt: serverTimestamp(),
    });
  }
  batch.update(orderRef, {
    orderStatus: 'cancelled',
    cancelReason: 'admin',
    cancelledAt: serverTimestamp(),
    stockReleased: returnsStock,
    updatedAt: serverTimestamp(),
  });
  stageAudit(batch, {
    action: 'order.cancel',
    targetType: 'order',
    targetId: orderId,
    targetName: String(order.productName ?? ''),
    detail: reason.trim(),
  });
  await batch.commit();
}

/**
 * Ends the running offer on a company's service now (price, end time and badge
 * cleared together). The link's normal price and everything else stay as they are.
 */
export async function endServiceOffer(link: { id: string }, label: string) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'company_services', link.id), {
    offerPrice: null,
    offerEndsAt: null,
    offerBadge: null,
    updatedAt: serverTimestamp(),
  });
  stageAudit(batch, { action: 'service.endOffer', targetType: 'service', targetId: link.id, targetName: label });
  await batch.commit();
}
