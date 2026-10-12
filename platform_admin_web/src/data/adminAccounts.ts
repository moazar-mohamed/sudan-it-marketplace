import {
  collection,
  deleteField,
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

/*
 * The accounts of the people who can sign in to the panel:
 *
 *  - trash / restore: another admin is switched off and moved to the trash
 *    (their active flag, and when, are remembered); nothing is deleted, and a
 *    restore brings them back as they were;
 *  - delete forever: from the trash only, the profile goes and
 *    deleted_accounts/{uid} records it (same batch);
 *  - delete your own account: the profile goes with that record, and then the
 *    login itself is deleted (a person may delete their own Firebase account,
 *    after proving the password again). The panel never leaves itself without
 *    an active admin: the rules cannot count, so this checks it first.
 */

export interface AdminRef {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
}

export interface AdminDeps {
  db: Firestore;
  /** The signed-in Platform Admin's uid. */
  adminId: string;
  /** Adds the activity entry to the batch (see data/auditLog.ts). */
  stageAudit: (batch: WriteBatch, input: AuditInput) => void;
}

const nameOf = (admin: AdminRef) => admin.fullName || admin.email;

/** Switches the admin off and moves them to the trash, remembering whether they were active. */
export async function trashAdmin(admin: AdminRef, deps: AdminDeps) {
  const batch = writeBatch(deps.db);
  batch.update(doc(deps.db, 'users', admin.id), {
    isActive: false,
    activeBeforeTrash: admin.isActive,
    trashedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  deps.stageAudit(batch, {
    action: 'admin.trash',
    targetType: 'admin',
    targetId: admin.id,
    targetName: nameOf(admin),
    detail: admin.isActive ? 'active' : 'inactive',
  });
  await batch.commit();
}

/** Takes an admin out of the trash with the access they had before. */
export async function restoreAdmin(admin: AdminRef & { activeBeforeTrash: boolean | null }, deps: AdminDeps) {
  const wasActive = admin.activeBeforeTrash === true;
  const batch = writeBatch(deps.db);
  batch.update(doc(deps.db, 'users', admin.id), {
    isActive: wasActive,
    trashedAt: deleteField(),
    activeBeforeTrash: deleteField(),
    updatedAt: serverTimestamp(),
  });
  deps.stageAudit(batch, {
    action: 'admin.restore',
    targetType: 'admin',
    targetId: admin.id,
    targetName: nameOf(admin),
    detail: wasActive ? 'active' : 'inactive',
  });
  await batch.commit();
}

function stageDeletion(batch: WriteBatch, admin: AdminRef, deps: AdminDeps, action: string) {
  batch.set(doc(deps.db, 'deleted_accounts', admin.id), {
    id: admin.id,
    deletedAt: serverTimestamp(),
    deletedBy: deps.adminId,
  });
  batch.delete(doc(deps.db, 'users', admin.id));
  deps.stageAudit(batch, { action, targetType: 'admin', targetId: admin.id, targetName: nameOf(admin) });
}

/** Deletes an admin who is in the trash for good (the login stays in Firebase Authentication, unusable). */
export async function deleteTrashedAdmin(admin: AdminRef, deps: AdminDeps) {
  const batch = writeBatch(deps.db);
  stageDeletion(batch, admin, deps, 'admin.delete');
  await batch.commit();
}

export type OwnAccountErrorCode = 'delete-self/last-admin';

export class OwnAccountError extends Error {
  readonly code: OwnAccountErrorCode;
  constructor(code: OwnAccountErrorCode) {
    super(code);
    this.name = 'OwnAccountError';
    this.code = code;
  }
}

export interface OwnDeleteDeps extends AdminDeps {
  /** Proves the password again; rejects (and nothing is deleted) when it is wrong. */
  reauthenticate: () => Promise<void>;
  /** Deletes the signed-in Firebase account. */
  deleteLogin: () => Promise<void>;
}

/**
 * Deletes the signed-in admin's own account. Returns whether the login itself
 * was removed too: the profile and record are written first (the account is
 * gone for the panel and the apps either way), and a login that could not be
 * removed after that is reported, not thrown.
 */
export async function deleteOwnAccount(me: AdminRef, deps: OwnDeleteDeps): Promise<{ loginRemoved: boolean }> {
  await deps.reauthenticate();

  const active = await getDocs(
    query(collection(deps.db, 'users'), where('role', '==', 'platform_admin'), where('isActive', '==', true)),
  );
  if (!active.docs.some((d) => d.id !== me.id)) throw new OwnAccountError('delete-self/last-admin');

  const batch = writeBatch(deps.db);
  stageDeletion(batch, me, deps, 'admin.deleteSelf');
  await batch.commit();

  try {
    await deps.deleteLogin();
    return { loginRemoved: true };
  } catch {
    return { loginRemoved: false };
  }
}
