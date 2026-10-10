import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';
import type { CompanyInput } from './actions';
import { accountConvertedNotice } from './adminNotices';
import { isValidEmail, normalizeEmail } from './companyAccount';
import {
  companyDocumentData,
  registrationProblems,
  type PreparedDocumentFile,
} from './companyDocuments';
import { NO_IMAGE, type ImageSelection } from './imageRules';
import { companyDocument } from './provisionCompany';
import type { AuditInput } from './auditLog';

/*
 * Turning a customer's account into the admin of a company, from the browser:
 * the person keeps the same login and password; only their role and the link to
 * the company change. One batch writes everything, so either all of it exists
 * or none of it does:
 *
 *   1. the company (active, carrying the account's own email),
 *   2. its registration document (number + photo, Platform Admin only),
 *   3. users/{uid}: role customer -> company_admin and companyId,
 *   4. the notice the person reads once they sign in again,
 *   5. the entry in Platform Admin's activity trail.
 *
 * The rules re-check the account, the new company, its email and the registration
 * document in the same batch, so a tampered client cannot link a customer to an
 * existing company or change anything else on the profile.
 *
 * A person who still has work in progress as a customer is not converted: their
 * company app would not show it, and they could no longer confirm or cancel it.
 */

export interface ConvertibleCustomer {
  id: string;
  fullName: string;
  email: string;
}

/** The company's own details; its email is the customer's, so none is asked for. */
export type ConvertCompanyInput = Omit<CompanyInput, 'email'> & {
  /** Commercial registration / licence number (required). */
  registrationNumber: string;
  /** Photo of the registration document, already compressed (required). */
  registrationDocument: PreparedDocumentFile | null;
};

export interface OpenWork {
  orders: { id: string; productName: string; status: string }[];
  requests: { id: string; serviceName: string; status: string }[];
}

/** Statuses that are still going: not completed, cancelled or declined. */
const OPEN_ORDER_STATUSES = new Set(['processing', 'out_for_delivery']);
const OPEN_REQUEST_STATUSES = new Set(['pending', 'accepted', 'in_progress']);
export const isOpenOrderStatus = (status: string) => OPEN_ORDER_STATUSES.has(status);
export const isOpenRequestStatus = (status: string) => OPEN_REQUEST_STATUSES.has(status);

export const hasOpenWork = (work: OpenWork) => work.orders.length > 0 || work.requests.length > 0;

export type ConvertCustomerErrorCode =
  | 'convert/invalid-email'
  | 'convert/registration-required'
  | 'convert/open-work';

/** A problem the Platform Admin can see and fix, or wait out. */
export class ConvertCustomerError extends Error {
  readonly code: ConvertCustomerErrorCode;
  /** Set for 'convert/open-work': what is still going. */
  readonly work?: OpenWork;
  constructor(code: ConvertCustomerErrorCode, work?: OpenWork) {
    super(code);
    this.name = 'ConvertCustomerError';
    this.code = code;
    this.work = work;
  }
}

/** What the customer still has in progress, read from the server. */
export async function findOpenWork(db: Firestore, customerId: string): Promise<OpenWork> {
  const [orders, requests] = await Promise.all([
    getDocs(query(collection(db, 'orders'), where('customerId', '==', customerId))),
    getDocs(query(collection(db, 'service_requests'), where('customerId', '==', customerId))),
  ]);
  return {
    orders: orders.docs
      .map((d) => ({ id: d.id, productName: String(d.data().productName ?? ''), status: String(d.data().orderStatus ?? '') }))
      .filter((o) => OPEN_ORDER_STATUSES.has(o.status)),
    requests: requests.docs
      .map((d) => ({ id: d.id, serviceName: String(d.data().serviceName ?? ''), status: String(d.data().status ?? '') }))
      .filter((r) => OPEN_REQUEST_STATUSES.has(r.status)),
  };
}

export interface ConvertDeps {
  db: Firestore;
  /** The signed-in Platform Admin's uid: the sender of the notice. */
  adminId: string;
  resolveLogo: (logo: ImageSelection, storagePath: string) => Promise<string>;
  /** Adds the activity entry to the batch (see data/auditLog.ts). */
  stageAudit: (batch: WriteBatch, input: AuditInput) => void;
}

export async function convertCustomerToCompany(
  customer: ConvertibleCustomer,
  input: ConvertCompanyInput,
  deps: ConvertDeps,
): Promise<{ companyId: string; noticeId: string }> {
  const email = normalizeEmail(customer.email);
  if (!isValidEmail(email)) throw new ConvertCustomerError('convert/invalid-email');
  const registrationDocument = input.registrationDocument;
  if (
    !registrationDocument ||
    registrationProblems({ registrationNumber: input.registrationNumber, document: registrationDocument })
      .length > 0
  ) {
    throw new ConvertCustomerError('convert/registration-required');
  }
  const work = await findOpenWork(deps.db, customer.id);
  if (hasOpenWork(work)) throw new ConvertCustomerError('convert/open-work', work);

  const companyRef = doc(collection(deps.db, 'companies'));
  const logoUrl = await deps.resolveLogo(input.logo ?? NO_IMAGE, `company-logos/${companyRef.id}`);

  const batch = writeBatch(deps.db);
  batch.set(companyRef, companyDocument({ ...input, email }, email, logoUrl));
  batch.set(
    doc(deps.db, 'company_documents', companyRef.id),
    companyDocumentData(companyRef.id, input.registrationNumber, registrationDocument),
  );
  batch.update(doc(deps.db, 'users', customer.id), {
    role: 'company_admin',
    companyId: companyRef.id,
    // A deactivated customer is converted too; the account comes out active.
    isActive: true,
    updatedAt: serverTimestamp(),
  });
  const { id: noticeId, ...notice } = accountConvertedNotice({
    userId: customer.id,
    companyId: companyRef.id,
    companyName: input.name.trim(),
  });
  batch.set(doc(deps.db, 'notifications', noticeId), {
    id: noticeId,
    ...notice,
    isRead: false,
    createdAt: serverTimestamp(),
    senderId: deps.adminId,
  });
  deps.stageAudit(batch, {
    action: 'customer.convert',
    targetType: 'customer',
    targetId: customer.id,
    targetName: customer.fullName || customer.email,
    detail: input.name.trim(),
  });
  await batch.commit();
  return { companyId: companyRef.id, noticeId };
}
