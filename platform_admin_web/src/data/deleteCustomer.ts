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
import type { AuditInput } from './auditLog';
import { findOpenWork, hasOpenWork, type OpenWork } from './convertCustomer';

/*
 * Deleting a customer's account, from the browser. The login itself (Firebase
 * Authentication) cannot be removed from here: there is no Admin SDK on this
 * plan. So one batch does the part the rules can enforce:
 *
 *   1. deleted_accounts/{uid}: the record that keeps the person out (the rules
 *      refuse them a new profile and the app tells them the account was
 *      deleted); it holds no personal data,
 *   2. users/{uid}: the profile (name, email, phone, city, push tokens),
 *   3. the entry in Platform Admin's activity trail.
 *
 * Their notifications are then removed in chunks (best effort: the account is
 * already deleted). Orders, reviews, chats, service requests and reports stay
 * as the history companies and the platform keep, with the name that was on
 * them. A customer with work in progress is not deleted.
 */

export interface DeletableCustomer {
  id: string;
  fullName: string;
  email: string;
}

export class DeleteCustomerError extends Error {
  readonly code = 'delete/open-work';
  readonly work: OpenWork;
  constructor(work: OpenWork) {
    super('delete/open-work');
    this.name = 'DeleteCustomerError';
    this.work = work;
  }
}

export interface DeleteDeps {
  db: Firestore;
  /** The signed-in Platform Admin's uid. */
  adminId: string;
  /** Adds the activity entry to the batch (see data/auditLog.ts). */
  stageAudit: (batch: WriteBatch, input: AuditInput) => void;
}

export interface DeleteResult {
  /** Notifications that were removed with the account. */
  notificationsRemoved: number;
  /** True when some were left behind (they hold only a product name and a type). */
  notificationsLeft: boolean;
}

/** Firestore allows 500 writes in a batch. */
const CHUNK = 400;

export async function deleteCustomerAccount(
  customer: DeletableCustomer,
  deps: DeleteDeps,
): Promise<DeleteResult> {
  const work = await findOpenWork(deps.db, customer.id);
  if (hasOpenWork(work)) throw new DeleteCustomerError(work);

  const batch = writeBatch(deps.db);
  batch.set(doc(deps.db, 'deleted_accounts', customer.id), {
    id: customer.id,
    deletedAt: serverTimestamp(),
    deletedBy: deps.adminId,
  });
  batch.delete(doc(deps.db, 'users', customer.id));
  deps.stageAudit(batch, {
    action: 'customer.delete',
    targetType: 'customer',
    targetId: customer.id,
    targetName: customer.fullName || customer.email,
  });
  await batch.commit();

  // From here the account is gone; cleaning up after it must not look like a failure.
  let removed = 0;
  try {
    const notices = await getDocs(
      query(
        collection(deps.db, 'notifications'),
        where('recipientType', '==', 'customer'),
        where('recipientId', '==', customer.id),
      ),
    );
    for (let i = 0; i < notices.docs.length; i += CHUNK) {
      const chunk = writeBatch(deps.db);
      for (const notice of notices.docs.slice(i, i + CHUNK)) chunk.delete(notice.ref);
      await chunk.commit();
      removed += Math.min(CHUNK, notices.docs.length - i);
    }
    return { notificationsRemoved: removed, notificationsLeft: false };
  } catch {
    return { notificationsRemoved: removed, notificationsLeft: true };
  }
}
