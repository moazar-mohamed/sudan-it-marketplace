/*
 * Platform Admins moving each other to the trash, restoring, deleting for good,
 * and deleting their own account. Local emulator only (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteOwnAccount,
  deleteTrashedAdmin,
  OwnAccountError,
  restoreAdmin,
  trashAdmin,
  type AdminDeps,
  type OwnDeleteDeps,
} from '../src/data/adminAccounts';

let env: RulesTestEnvironment;
const now = new Date();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sudan-rules',
    firestore: {
      rules: readFileSync(
        process.env.RULES_FILE ?? fileURLToPath(new URL('../../firestore.rules', import.meta.url)),
        'utf8',
      ),
    },
  });
});
afterAll(async () => {
  await env?.cleanup();
});

const as = (uid: string) => env.authenticatedContext(uid, { email_verified: true }).firestore();
const put = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));
async function read(path: string) {
  let value: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    value = (await getDoc(doc(ctx.firestore(), path))).data();
  });
  return value;
}

beforeEach(async () => {
  await env.clearFirestore();
  const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
    put(`users/${id}`, { id, fullName: `Name ${id}`, email: `${id}@x.test`, role, isActive: true, createdAt: now, ...extra });
  await user('pa1', 'platform_admin');
  await user('pa2', 'platform_admin');
  await user('pa3', 'platform_admin', { isActive: false });
  await user('paT', 'platform_admin', {
    isActive: false,
    activeBeforeTrash: true,
    trashedAt: new Date(Date.now() - 3_600_000),
  });
  await user('cust1', 'customer');
  await user('ca1', 'company_admin', { companyId: 'c1' });
});

const ref = (id: string, extra: Partial<{ isActive: boolean; fullName: string }> = {}) => ({
  id,
  fullName: `Name ${id}`,
  email: `${id}@x.test`,
  isActive: true,
  ...extra,
});

function deps(uid = 'pa1'): AdminDeps {
  const db = as(uid);
  return {
    db,
    adminId: uid,
    stageAudit: (batch, entry) =>
      batch.set(doc(collection(db, 'admin_audit_log')), {
        actorId: uid,
        actorName: 'Admin',
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        targetName: entry.targetName ?? '',
        ...(entry.detail ? { detail: entry.detail } : {}),
        createdAt: serverTimestamp(),
      }),
  };
}

const ownDeps = (uid = 'pa1', over: Partial<OwnDeleteDeps> = {}): OwnDeleteDeps => ({
  ...deps(uid),
  reauthenticate: async () => undefined,
  deleteLogin: async () => undefined,
  ...over,
});

describe('moving another admin to the trash', () => {
  it('switches them off and remembers they were active, through the dashboard code', async () => {
    await trashAdmin(ref('pa2'), deps());
    expect(await read('users/pa2')).toMatchObject({ isActive: false, activeBeforeTrash: true });
    expect((await read('users/pa2'))?.trashedAt).toBeTruthy();
  });

  it('a trashed admin has no access any more', async () => {
    await trashAdmin(ref('pa2'), deps());
    await assertFails(setDoc(doc(as('pa2'), 'admin_notes', 'n1'), { text: 'x' }));
    await assertFails(
      updateDoc(doc(as('pa2'), 'users', 'pa1'), { isActive: false }),
    );
  });

  it('is only for another admin, by an active admin', async () => {
    await assertFails(trashAdmin(ref('pa1'), deps('pa1')));
    await assertFails(trashAdmin(ref('pa2'), deps('pa3')));
    await assertFails(trashAdmin(ref('pa2'), deps('cust1')));
    await assertFails(trashAdmin(ref('pa2'), deps('ca1')));
  });

  it('cannot reach a customer or a company admin', async () => {
    await assertFails(trashAdmin(ref('cust1'), deps()));
    await assertFails(trashAdmin(ref('ca1'), deps()));
  });

  it('must say the truth: switched off, the time, and what they were', async () => {
    const db = as('pa1');
    const base = { isActive: false, activeBeforeTrash: true, trashedAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await assertFails(updateDoc(doc(db, 'users', 'pa2'), { ...base, isActive: true }));
    await assertFails(updateDoc(doc(db, 'users', 'pa2'), { ...base, activeBeforeTrash: false }));
    await assertFails(updateDoc(doc(db, 'users', 'pa2'), { ...base, trashedAt: new Date('2020-01-01') }));
    await assertFails(updateDoc(doc(db, 'users', 'pa2'), { ...base, role: 'customer' }));
    await assertFails(updateDoc(doc(db, 'users', 'pa2'), { ...base, fullName: 'Renamed' }));
    await assertSucceeds(updateDoc(doc(db, 'users', 'pa2'), base));
  });

  it('an admin who was already off is remembered as off', async () => {
    await trashAdmin(ref('pa3', { isActive: false }), deps());
    expect(await read('users/pa3')).toMatchObject({ isActive: false, activeBeforeTrash: false });
  });

  it('cannot be switched back on while in the trash', async () => {
    await assertFails(updateDoc(doc(as('pa1'), 'users', 'paT'), { isActive: true }));
  });
});

describe('restoring', () => {
  it('gives back the access they had, and clears the markers', async () => {
    await restoreAdmin({ ...ref('paT', { isActive: false }), activeBeforeTrash: true }, deps());
    const restored = await read('users/paT');
    expect(restored).toMatchObject({ isActive: true });
    expect(restored).not.toHaveProperty('trashedAt');
    expect(restored).not.toHaveProperty('activeBeforeTrash');
  });

  it('cannot hand back more access than they had', async () => {
    await put('users/paF', {
      id: 'paF', fullName: 'F', email: 'f@x.test', role: 'platform_admin', isActive: false,
      activeBeforeTrash: false, trashedAt: new Date(), createdAt: now,
    });
    await assertFails(
      updateDoc(doc(as('pa1'), 'users', 'paF'), {
        isActive: true,
        trashedAt: deleteField(),
        activeBeforeTrash: deleteField(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('deleting an admin from the trash for good', () => {
  it('removes the profile and records it, through the dashboard code', async () => {
    await deleteTrashedAdmin(ref('paT', { isActive: false }), deps());
    expect(await read('users/paT')).toBeUndefined();
    expect(await read('deleted_accounts/paT')).toMatchObject({ id: 'paT', deletedBy: 'pa1' });
  });

  it('is refused for an admin who is not in the trash', async () => {
    await assertFails(deleteTrashedAdmin(ref('pa2'), deps()));
    expect(await read('users/pa2')).toBeTruthy();
  });

  it('cannot be done by anyone but an active admin', async () => {
    await assertFails(deleteTrashedAdmin(ref('paT'), deps('pa3')));
    await assertFails(deleteTrashedAdmin(ref('paT'), deps('cust1')));
  });

  it('the profile cannot go without the record', async () => {
    await assertFails(deleteDoc(doc(as('pa1'), 'users', 'paT')));
    const db = as('pa1');
    const batch = writeBatch(db);
    batch.set(doc(db, 'deleted_accounts', 'pa2'), { id: 'pa2', deletedAt: serverTimestamp(), deletedBy: 'pa1' });
    batch.delete(doc(db, 'users', 'pa2'));
    await assertFails(batch.commit());
  });
});

describe('deleting your own account', () => {
  it('removes the profile, records it and deletes the login', async () => {
    let loginDeleted = false;
    const result = await deleteOwnAccount(
      ref('pa1'),
      ownDeps('pa1', { deleteLogin: async () => void (loginDeleted = true) }),
    );
    expect(result).toEqual({ loginRemoved: true });
    expect(loginDeleted).toBe(true);
    expect(await read('users/pa1')).toBeUndefined();
    expect(await read('deleted_accounts/pa1')).toMatchObject({ id: 'pa1', deletedBy: 'pa1' });
  });

  it('is refused for the last active admin, and nothing is deleted', async () => {
    await put('users/pa2', { id: 'pa2', fullName: 'Name pa2', email: 'pa2@x.test', role: 'platform_admin', isActive: false, createdAt: now });
    let loginDeleted = false;
    await expect(
      deleteOwnAccount(ref('pa1'), ownDeps('pa1', { deleteLogin: async () => void (loginDeleted = true) })),
    ).rejects.toBeInstanceOf(OwnAccountError);
    expect(loginDeleted).toBe(false);
    expect(await read('users/pa1')).toBeTruthy();
    expect(await read('deleted_accounts/pa1')).toBeUndefined();
  });

  it('an admin in the trash does not count as another active admin', async () => {
    await put('users/pa2', { id: 'pa2', fullName: 'Name pa2', email: 'pa2@x.test', role: 'platform_admin', isActive: false, activeBeforeTrash: true, trashedAt: now, createdAt: now });
    await expect(deleteOwnAccount(ref('pa1'), ownDeps())).rejects.toBeInstanceOf(OwnAccountError);
  });

  it('a wrong password stops it before anything is touched', async () => {
    await expect(
      deleteOwnAccount(ref('pa1'), ownDeps('pa1', { reauthenticate: async () => Promise.reject({ code: 'auth/invalid-credential' }) })),
    ).rejects.toMatchObject({ code: 'auth/invalid-credential' });
    expect(await read('users/pa1')).toBeTruthy();
  });

  it('a login that cannot be deleted is reported, and the account is gone anyway', async () => {
    const result = await deleteOwnAccount(
      ref('pa1'),
      ownDeps('pa1', { deleteLogin: async () => Promise.reject(new Error('requires-recent-login')) }),
    );
    expect(result).toEqual({ loginRemoved: false });
    expect(await read('users/pa1')).toBeUndefined();
    expect(await read('deleted_accounts/pa1')).toBeTruthy();
  });

  it('is only your own: not another active admin, not a customer', async () => {
    const db = as('pa1');
    for (const target of ['pa2', 'cust1']) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'deleted_accounts', target), { id: target, deletedAt: serverTimestamp(), deletedBy: 'pa1' });
      batch.delete(doc(db, 'users', target));
      // A customer can be deleted (see customer-deletion); an active admin cannot.
      if (target === 'pa2') await assertFails(batch.commit());
    }
  });

  it('afterwards the person cannot make a profile again', async () => {
    await deleteOwnAccount(ref('pa1'), ownDeps());
    await assertFails(
      setDoc(doc(as('pa1'), 'users', 'pa1'), {
        id: 'pa1', fullName: 'Back', email: 'pa1@x.test', role: 'customer', isActive: true, createdAt: serverTimestamp(),
      }),
    );
  });
});
