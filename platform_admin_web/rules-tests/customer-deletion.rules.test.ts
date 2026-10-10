/*
 * Platform Admin deletes a customer's account. The login itself cannot be
 * removed from the panel, so one batch records the deletion (deleted_accounts)
 * and removes the profile; the notifications follow. The record is what keeps
 * the person from making a new profile. Local emulator only (npm run test:rules).
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
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DeleteCustomerError, deleteCustomerAccount, type DeleteDeps } from '../src/data/deleteCustomer';

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
async function exists(path: string) {
  let found = false;
  await env.withSecurityRulesDisabled(async (ctx) => {
    found = (await getDoc(doc(ctx.firestore(), path))).exists();
  });
  return found;
}
async function data(path: string) {
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
  await user('pa', 'platform_admin');
  await user('cust1', 'customer', { phone: '+249911111111', pushTokens: ['t1'] });
  await user('cust2', 'customer');
  await user('ca1', 'company_admin', { companyId: 'c1' });
  await user('tech1', 'technician', { companyId: 'c1' });
  await put('companies/c1', { name: 'Co', status: 'active', rating: 0, reviewCount: 0, createdAt: now });
  const notice = (id: string, recipientType: string, recipientId: string) =>
    put(`notifications/${id}`, {
      id, recipientType, recipientId, orderId: 'o1', type: 'order_completed', productName: 'Router', isRead: false, createdAt: now, senderId: 'ca1',
    });
  await notice('n1', 'customer', 'cust1');
  await notice('n2', 'customer', 'cust1');
  await notice('n3', 'customer', 'cust2');
  await notice('n4', 'company_admin', 'c1');
  await put('orders/done', { id: 'done', customerId: 'cust1', companyId: 'c1', productName: 'Router', orderStatus: 'completed', createdAt: now });
});

function deps(uid = 'pa'): DeleteDeps {
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
        createdAt: serverTimestamp(),
      }),
  };
}

const person = (id = 'cust1') => ({ id, fullName: `Name ${id}`, email: `${id}@x.test` });

const newProfile = (uid: string) => ({
  id: uid,
  fullName: 'Back Again',
  email: `${uid}@x.test`,
  role: 'customer',
  isActive: true,
  createdAt: serverTimestamp(),
});

describe('the dashboard deletion', () => {
  it('removes the profile and notifications, records the deletion, and keeps the history', async () => {
    const result = await deleteCustomerAccount(person(), deps());
    expect(result).toEqual({ notificationsRemoved: 2, notificationsLeft: false });

    expect(await exists('users/cust1')).toBe(false);
    expect(await exists('notifications/n1')).toBe(false);
    expect(await exists('notifications/n2')).toBe(false);
    expect(await data('deleted_accounts/cust1')).toMatchObject({ id: 'cust1', deletedBy: 'pa' });
    // Nobody else's notifications, and the order they placed, are untouched.
    expect(await exists('notifications/n3')).toBe(true);
    expect(await exists('notifications/n4')).toBe(true);
    expect(await exists('orders/done')).toBe(true);
    expect(await exists('users/cust2')).toBe(true);
  });

  it('the person cannot make a new profile afterwards, while a new person can', async () => {
    await deleteCustomerAccount(person(), deps());
    await assertFails(setDoc(doc(as('cust1'), 'users', 'cust1'), newProfile('cust1')));
    await assertSucceeds(setDoc(doc(as('fresh1'), 'users', 'fresh1'), newProfile('fresh1')));
  });

  it('refuses while the customer has an order or a service request in progress, and writes nothing', async () => {
    await put('orders/o1', { id: 'o1', customerId: 'cust1', companyId: 'c1', productName: 'Router', orderStatus: 'out_for_delivery', createdAt: now });
    await put('service_requests/s1', { id: 's1', customerId: 'cust1', companyId: 'c1', serviceName: 'Setup', status: 'accepted', createdAt: now });
    const attempt = deleteCustomerAccount(person(), deps());
    await expect(attempt).rejects.toBeInstanceOf(DeleteCustomerError);
    expect(await exists('users/cust1')).toBe(true);
    expect(await exists('deleted_accounts/cust1')).toBe(false);
    expect(await exists('notifications/n1')).toBe(true);
  });

  it('is not open to anyone but a Platform Admin', async () => {
    for (const uid of ['cust1', 'cust2', 'ca1', 'tech1']) {
      await expect(deleteCustomerAccount(person('cust1'), deps(uid))).rejects.toBeTruthy();
    }
    expect(await exists('users/cust1')).toBe(true);
  });
});

/** The batch built by hand, so each rule can be broken on its own. */
function raw(options: { actor?: string; uid?: string; tombstone?: Record<string, unknown> | null; deleteProfile?: boolean } = {}) {
  const { actor = 'pa', uid = 'cust1', tombstone = {}, deleteProfile = true } = options;
  const db = as(actor);
  const batch = writeBatch(db);
  if (tombstone) {
    batch.set(doc(db, 'deleted_accounts', uid), {
      id: uid,
      deletedAt: serverTimestamp(),
      deletedBy: actor,
      ...tombstone,
    });
  }
  if (deleteProfile) batch.delete(doc(db, 'users', uid));
  return batch.commit();
}

describe('the profile and the record', () => {
  it('go together, in the shape the dashboard writes', async () => {
    await assertSucceeds(raw());
  });

  it('are refused one without the other', async () => {
    await assertFails(raw({ deleteProfile: false }));
    await assertFails(raw({ tombstone: null }));
  });

  it('are signed with the admin and the server time, and hold nothing else', async () => {
    await assertFails(raw({ tombstone: { deletedBy: 'cust2' } }));
    await assertFails(raw({ tombstone: { deletedAt: new Date('2020-01-01') } }));
    await assertFails(raw({ tombstone: { id: 'cust2' } }));
    await assertFails(raw({ tombstone: { email: 'cust1@x.test' } }));
  });

  it('are only for a customer: not a company admin, a technician or an admin', async () => {
    await assertFails(raw({ uid: 'ca1' }));
    await assertFails(raw({ uid: 'tech1' }));
    await assertFails(raw({ uid: 'pa' }));
  });

  it('are not open to the customer themselves or to a company', async () => {
    await assertFails(raw({ actor: 'cust1' }));
    await assertFails(raw({ actor: 'ca1' }));
    await assertFails(raw({ actor: 'cust2', uid: 'cust1' }));
  });

  it('the profile cannot be deleted on its own, even by Platform Admin', async () => {
    await assertFails(deleteDoc(doc(as('pa'), 'users', 'cust1')));
  });

  it('the record is never changed or removed, not even by Platform Admin', async () => {
    await assertSucceeds(raw());
    await assertFails(updateDoc(doc(as('pa'), 'deleted_accounts', 'cust1'), { deletedBy: 'pa2' }));
    await assertFails(deleteDoc(doc(as('pa'), 'deleted_accounts', 'cust1')));
  });

  it('is read by the person it is about and by Platform Admin, listed by nobody', async () => {
    await assertSucceeds(raw());
    await assertSucceeds(getDoc(doc(as('cust1'), 'deleted_accounts', 'cust1')));
    await assertSucceeds(getDoc(doc(as('pa'), 'deleted_accounts', 'cust1')));
    await assertFails(getDoc(doc(as('cust2'), 'deleted_accounts', 'cust1')));
    await assertFails(getDocs(collection(as('pa'), 'deleted_accounts')));
    // Asking about their own when nothing was deleted is allowed and says "no".
    await assertSucceeds(getDoc(doc(as('cust2'), 'deleted_accounts', 'cust2')));
  });
});

describe('the notifications of a deleted account', () => {
  it('stay out of reach while the account exists', async () => {
    await assertFails(deleteDoc(doc(as('pa'), 'notifications', 'n1')));
  });

  it('Platform Admin removes them once it is deleted, and only theirs', async () => {
    await assertSucceeds(raw());
    await assertSucceeds(deleteDoc(doc(as('pa'), 'notifications', 'n1')));
    await assertFails(deleteDoc(doc(as('pa'), 'notifications', 'n3')));
    await assertFails(deleteDoc(doc(as('pa'), 'notifications', 'n4')));
  });
});
