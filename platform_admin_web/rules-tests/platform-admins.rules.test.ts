/*
 * Adding and switching off Platform Admins: an active admin reads the other
 * admins (queries filtered on the role), adds a new one with exactly the right
 * profile, and switches ANOTHER one off or on. Nobody else can, and no admin can
 * lock themselves out or turn a user into an admin. Local emulator only
 * (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

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

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const put = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));

beforeEach(async () => {
  await env.clearFirestore();
  const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
    put(`users/${id}`, { id, fullName: id, email: `${id}@x.test`, role, isActive: true, ...extra });
  await user('pa', 'platform_admin');
  await user('pa2', 'platform_admin');
  await user('pa_off', 'platform_admin', { isActive: false });
  await user('cust1', 'customer');
  await user('ca1', 'company_admin', { companyId: 'c1' });
});

const newAdmin = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  fullName: 'New Admin',
  email: `${id}@x.test`,
  role: 'platform_admin',
  isActive: true,
  createdAt: serverTimestamp(),
  ...extra,
});
const create = (as_: string, id: string, extra: Record<string, unknown> = {}) =>
  setDoc(doc(as(as_), 'users', id), newAdmin(id, extra));

describe('reading the admins', () => {
  it('an active admin lists the admins when the query asks for that role', async () => {
    await assertSucceeds(getDocs(query(collection(as('pa'), 'users'), where('role', '==', 'platform_admin'))));
  });

  it('still lists customers the same way', async () => {
    await assertSucceeds(getDocs(query(collection(as('pa'), 'users'), where('role', '==', 'customer'))));
  });

  it('cannot list every user, or the staff of a live company', async () => {
    await assertFails(getDocs(collection(as('pa'), 'users')));
    await assertFails(getDocs(query(collection(as('pa'), 'users'), where('role', '==', 'company_admin'))));
  });

  it('a deactivated admin, a customer and a company admin read no admins', async () => {
    for (const uid of ['pa_off', 'cust1', 'ca1']) {
      await assertFails(getDocs(query(collection(as(uid), 'users'), where('role', '==', 'platform_admin'))));
      await assertFails(getDoc(doc(as(uid), 'users', 'pa2')));
    }
  });

  it('an admin reads another admin\'s profile', async () => {
    await assertSucceeds(getDoc(doc(as('pa'), 'users', 'pa2')));
  });
});

describe('adding an admin', () => {
  it('an active admin adds a new one with exactly the right profile', async () => {
    await assertSucceeds(create('pa', 'n1'));
  });

  it('nobody else can', async () => {
    await assertFails(create('pa_off', 'n2'));
    await assertFails(create('cust1', 'n3'));
    await assertFails(create('ca1', 'n4'));
  });

  it('only a platform_admin profile, active, with the server time', async () => {
    await assertFails(create('pa', 'x1', { role: 'customer' }));
    await assertFails(create('pa', 'x2', { role: 'company_admin' }));
    await assertFails(create('pa', 'x3', { isActive: false }));
    await assertFails(create('pa', 'x4', { createdAt: new Date() }));
  });

  it('no extra field, no missing field, and the id is the uid', async () => {
    await assertFails(create('pa', 'y1', { companyId: 'c1' }));
    await assertFails(create('pa', 'y2', { mustChangePassword: true }));
    await assertFails(setDoc(doc(as('pa'), 'users', 'y3'), { id: 'y3', fullName: 'A', role: 'platform_admin', isActive: true, createdAt: serverTimestamp() }));
    await assertFails(create('pa', 'y4', { id: 'someone-else' }));
  });

  it('needs a name and a lower-case email', async () => {
    await assertFails(create('pa', 'z1', { fullName: '' }));
    await assertFails(create('pa', 'z2', { fullName: 'x'.repeat(101) }));
    await assertFails(create('pa', 'z3', { email: 'Mixed@X.test' }));
    await assertFails(create('pa', 'z4', { email: 5 }));
  });

  it('cannot overwrite a profile that exists (a customer cannot be turned into an admin)', async () => {
    await assertFails(create('pa', 'cust1'));
    await assertFails(updateDoc(doc(as('pa'), 'users', 'cust1'), { role: 'platform_admin' }));
  });

  it('a new account cannot make itself an admin', async () => {
    await assertFails(setDoc(doc(as('selfmade'), 'users', 'selfmade'), newAdmin('selfmade')));
  });
});

describe('switching an admin off and on', () => {
  it('switches another admin off, and back on', async () => {
    await assertSucceeds(updateDoc(doc(as('pa'), 'users', 'pa2'), { isActive: false }));
    await assertSucceeds(updateDoc(doc(as('pa'), 'users', 'pa_off'), { isActive: true }));
  });

  it('cannot switch themselves off', async () => {
    await assertFails(updateDoc(doc(as('pa'), 'users', 'pa'), { isActive: false }));
  });

  it('changes nothing but isActive', async () => {
    await assertFails(updateDoc(doc(as('pa'), 'users', 'pa2'), { role: 'customer' }));
    await assertFails(updateDoc(doc(as('pa'), 'users', 'pa2'), { fullName: 'Renamed' }));
    await assertFails(updateDoc(doc(as('pa'), 'users', 'pa2'), { isActive: 'no' }));
    await assertFails(updateDoc(doc(as('pa'), 'users', 'pa2'), { isActive: false, email: 'z@x.test' }));
  });

  it('is not allowed to a deactivated admin, a customer or a company admin', async () => {
    for (const uid of ['pa_off', 'cust1', 'ca1']) {
      await assertFails(updateDoc(doc(as(uid), 'users', 'pa2'), { isActive: false }));
    }
  });

  it('never deletes an admin', async () => {
    await assertFails(deleteDoc(doc(as('pa'), 'users', 'pa2')));
  });
});

describe('the activity trail', () => {
  const entry = (extra: Record<string, unknown> = {}) => ({
    actorId: 'pa',
    actorName: 'pa',
    action: 'admin.create',
    targetType: 'admin',
    targetId: 'n1',
    targetName: 'New Admin',
    createdAt: serverTimestamp(),
    ...extra,
  });

  it('accepts an entry about an admin', async () => {
    await assertSucceeds(setDoc(doc(collection(as('pa'), 'admin_audit_log')), entry()));
  });

  it('still refuses an unknown kind of record', async () => {
    await assertFails(setDoc(doc(collection(as('pa'), 'admin_audit_log')), entry({ targetType: 'user' })));
  });
});
