/*
 * Usage figures: one document per person per day they opened the app
 * (usage_days/{day}_{uid}, written once), and a running count of product views
 * (product_stats/{productId}, one added at a time by a customer). Only Platform
 * Admin reads either. Local emulator only (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, increment, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
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
  await user('pa_off', 'platform_admin', { isActive: false });
  await user('cust1', 'customer');
  await user('cust2', 'customer');
  await user('cust_off', 'customer', { isActive: false });
  await user('ca1', 'company_admin', { companyId: 'c1' });
  await user('tech1', 'technician', { companyId: 'c1' });
  await put('products/p1', { id: 'p1', name: 'Router' });
});

const DAY = '2026-10-04';
const usage = (uid: string, role: string, extra: Record<string, unknown> = {}) => ({
  day: DAY,
  userId: uid,
  role,
  createdAt: serverTimestamp(),
  ...extra,
});
const open = (uid: string, role: string, extra: Record<string, unknown> = {}, id = `${DAY}_${uid}`) =>
  setDoc(doc(as(uid), 'usage_days', id), usage(uid, role, extra));

describe('a day of use', () => {
  it('a customer, a company admin and a technician each record their own day', async () => {
    await assertSucceeds(open('cust1', 'customer'));
    await assertSucceeds(open('ca1', 'company_admin'));
    await assertSucceeds(open('tech1', 'technician'));
  });

  it('only once: the same day cannot be written again or changed', async () => {
    await assertSucceeds(open('cust1', 'customer'));
    await assertFails(open('cust1', 'customer'));
    await assertFails(updateDoc(doc(as('cust1'), 'usage_days', `${DAY}_cust1`), { role: 'customer' }));
    await assertFails(deleteDoc(doc(as('cust1'), 'usage_days', `${DAY}_cust1`)));
  });

  it('only in your own name, role and day-and-id', async () => {
    await assertFails(open('cust1', 'customer', { userId: 'cust2' }));
    await assertFails(open('cust1', 'company_admin'));
    await assertFails(open('cust1', 'customer', {}, `${DAY}_cust2`));
    await assertFails(open('cust1', 'customer', { day: '2026-10-05' }));
    await assertFails(open('cust1', 'customer', { day: 'today' }, 'today_cust1'));
    await assertFails(open('cust1', 'customer', { createdAt: new Date() }));
  });

  it('no extra field, and not a Platform Admin, a deactivated account or a stranger', async () => {
    await assertFails(open('cust1', 'customer', { screen: 'home' }));
    await assertFails(open('pa', 'platform_admin'));
    await assertFails(open('cust_off', 'customer'));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'usage_days', `${DAY}_x`), usage('x', 'customer')));
    await assertFails(setDoc(doc(as('nobody'), 'usage_days', `${DAY}_nobody`), usage('nobody', 'customer')));
  });

  it('only Platform Admin reads them (a count by day, or one)', async () => {
    await put(`usage_days/${DAY}_cust1`, { day: DAY, userId: 'cust1', role: 'customer', createdAt: new Date() });
    await assertSucceeds(getDocs(query(collection(as('pa'), 'usage_days'), where('day', '==', DAY))));
    await assertSucceeds(getDoc(doc(as('pa'), 'usage_days', `${DAY}_cust1`)));
    for (const uid of ['cust1', 'ca1', 'pa_off']) {
      await assertFails(getDoc(doc(as(uid), 'usage_days', `${DAY}_cust1`)));
      await assertFails(getDocs(query(collection(as(uid), 'usage_days'), where('day', '==', DAY))));
    }
  });
});

describe('product views', () => {
  const view = (uid: string, productId = 'p1') =>
    setDoc(doc(as(uid), 'product_stats', productId), { views: increment(1), updatedAt: serverTimestamp() }, { merge: true });

  it('a customer adds the first view, then one more at a time', async () => {
    await assertSucceeds(view('cust1'));
    await assertSucceeds(view('cust2'));
    await assertSucceeds(view('cust1'));
  });

  it('never more than one at a time, and nothing else changes', async () => {
    await put('product_stats/p1', { views: 5, updatedAt: new Date() });
    await assertFails(updateDoc(doc(as('cust1'), 'product_stats', 'p1'), { views: increment(10), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('cust1'), 'product_stats', 'p1'), { views: 1, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('cust1'), 'product_stats', 'p1'), { views: increment(1), updatedAt: serverTimestamp(), note: 'x' }));
    await assertFails(updateDoc(doc(as('cust1'), 'product_stats', 'p1'), { views: increment(1) }));
  });

  it('a new count starts at one, for a product that exists', async () => {
    await assertFails(setDoc(doc(as('cust1'), 'product_stats', 'p1'), { views: 50, updatedAt: serverTimestamp() }));
    await assertFails(view('cust1', 'no-such-product'));
  });

  it('only a customer counts: not a company, a technician, a Platform Admin or a deactivated account', async () => {
    for (const uid of ['ca1', 'tech1', 'pa', 'cust_off']) await assertFails(view(uid));
  });

  it('nobody deletes a count; only Platform Admin reads them, best first', async () => {
    await put('product_stats/p1', { views: 5, updatedAt: new Date() });
    await assertFails(deleteDoc(doc(as('cust1'), 'product_stats', 'p1')));
    await assertFails(deleteDoc(doc(as('pa'), 'product_stats', 'p1')));
    await assertSucceeds(getDocs(collection(as('pa'), 'product_stats')));
    await assertFails(getDocs(collection(as('cust1'), 'product_stats')));
    await assertFails(getDoc(doc(as('cust1'), 'product_stats', 'p1')));
    await assertFails(getDoc(doc(as('pa_off'), 'product_stats', 'p1')));
  });
});
