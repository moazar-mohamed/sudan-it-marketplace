/*
 * Push notifications: each user registers their own phones
 * (users/{uid}.fcmTokens), a notification names who created it (senderId,
 * so the push relay only sends it for them), and the relay's send log
 * (push_log) is closed to the app. Local emulator only (npm run test:rules);
 * every user is a fake identity.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

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

const as = (uid: string) => env.authenticatedContext(uid).firestore();

const user = (id: string, role: string, extra: Record<string, unknown> = {}) => ({
  id,
  fullName: id,
  email: `${id}@x.test`,
  role,
  isActive: true,
  createdAt: now,
  ...extra,
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const u of [
      user('cust1', 'customer'),
      user('cust2', 'customer'),
      user('ca1', 'company_admin', { companyId: 'c1' }),
      user('tech1', 'technician', { companyId: 'c1' }),
      user('pa1', 'platform_admin'),
    ]) {
      await setDoc(doc(db, 'users', u.id), u);
    }
    await setDoc(doc(db, 'companies', 'c1'), { name: 'c1', status: 'active', createdAt: now });
    await setDoc(doc(db, 'orders', 'o1'), {
      id: 'o1',
      customerId: 'cust1',
      companyId: 'c1',
      productId: 'p1',
      productName: 'Router',
      createdAt: now,
    });
    await setDoc(doc(db, 'push_log', 'n_old'), { kind: 'notification', by: 'cust1' });
  });
});

const newOrderNotification = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  recipientType: 'company_admin',
  recipientId: 'c1',
  orderId: 'o1',
  type: 'new_order',
  title: 'New order received',
  body: 'A new order for "Router" was placed and is awaiting payment verification.',
  isRead: false,
  createdAt: serverTimestamp(),
  ...extra,
});

describe('registering the phones that receive pushes', () => {
  it('every kind of user saves their own device tokens', async () => {
    for (const uid of ['cust1', 'ca1', 'tech1', 'pa1']) {
      await assertSucceeds(updateDoc(doc(as(uid), 'users', uid), { fcmTokens: [`phone-${uid}`] }));
    }
    await assertSucceeds(updateDoc(doc(as('cust1'), 'users', 'cust1'), { fcmTokens: [] }));
  });

  it("never someone else's, and nothing else rides along", async () => {
    await assertFails(updateDoc(doc(as('cust2'), 'users', 'cust1'), { fcmTokens: ['mine'] }));
    await assertFails(updateDoc(doc(as('cust1'), 'users', 'cust1'), { fcmTokens: ['a'], role: 'company_admin' }));
    await assertFails(updateDoc(doc(as('ca1'), 'users', 'ca1'), { fcmTokens: ['a'], companyId: 'c2' }));
  });

  it('a short list only', async () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `phone-${i}`);
    await assertFails(updateDoc(doc(as('cust1'), 'users', 'cust1'), { fcmTokens: eleven }));
    await assertFails(updateDoc(doc(as('cust1'), 'users', 'cust1'), { fcmTokens: 'phone' }));
    await assertSucceeds(updateDoc(doc(as('cust1'), 'users', 'cust1'), { fcmTokens: eleven.slice(0, 10) }));
  });
});

describe('a notification names who created it', () => {
  it('the creator may sign it with their own id', async () => {
    await assertSucceeds(setDoc(doc(as('cust1'), 'notifications', 'n1'), newOrderNotification('n1', { senderId: 'cust1' })));
  });

  it("but not with someone else's", async () => {
    await assertFails(setDoc(doc(as('cust1'), 'notifications', 'n2'), newOrderNotification('n2', { senderId: 'ca1' })));
  });

  it('older app versions that do not sign it keep working', async () => {
    await assertSucceeds(setDoc(doc(as('cust1'), 'notifications', 'n3'), newOrderNotification('n3')));
  });
});

describe("the relay's send log", () => {
  it('is closed to every app user', async () => {
    for (const uid of ['cust1', 'ca1', 'pa1']) {
      await assertFails(getDoc(doc(as(uid), 'push_log', 'n_old')));
      await assertFails(setDoc(doc(as(uid), 'push_log', 'n_new'), { kind: 'notification', by: uid }));
    }
  });
});
