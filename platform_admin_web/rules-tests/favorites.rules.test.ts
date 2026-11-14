/*
 * A customer's favorites belong to that customer alone: only they read, add and
 * remove them, and only for a product or service that exists.
 * Local emulator only (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
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

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/ali'), { role: 'customer', isActive: true });
    await setDoc(doc(db, 'users/sara'), { role: 'customer', isActive: true });
    await setDoc(doc(db, 'users/off'), { role: 'customer', isActive: false });
    await setDoc(doc(db, 'users/boss'), { role: 'company_admin', isActive: true });
    await setDoc(doc(db, 'products/p1'), { name: 'Printer' });
    await setDoc(doc(db, 'services/s1'), { name: 'Repair' });
    await setDoc(doc(db, 'users/ali/favorites/product_p1'), { kind: 'product', targetId: 'p1', name: 'Printer', createdAt: Timestamp.now() });
  });
});

const dbOf = (uid: string) => env.authenticatedContext(uid).firestore();
const entry = (kind: string, targetId: string) => ({ kind, targetId, name: 'Item', createdAt: serverTimestamp() });

describe('favorites', () => {
  it('lets a customer add a product and a service', async () => {
    await assertSucceeds(setDoc(doc(dbOf('sara'), 'users/sara/favorites/product_p1'), entry('product', 'p1')));
    await assertSucceeds(setDoc(doc(dbOf('sara'), 'users/sara/favorites/service_s1'), entry('service', 's1')));
  });

  it('lets a customer read and remove their own', async () => {
    await assertSucceeds(getDocs(collection(dbOf('ali'), 'users/ali/favorites')));
    await assertSucceeds(deleteDoc(doc(dbOf('ali'), 'users/ali/favorites/product_p1')));
  });

  it("keeps a customer's favorites from everyone else", async () => {
    await assertFails(getDoc(doc(dbOf('sara'), 'users/ali/favorites/product_p1')));
    await assertFails(getDocs(collection(dbOf('sara'), 'users/ali/favorites')));
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'users/ali/favorites')));
    await assertFails(deleteDoc(doc(dbOf('sara'), 'users/ali/favorites/product_p1')));
    await assertFails(setDoc(doc(dbOf('sara'), 'users/ali/favorites/service_s1'), entry('service', 's1')));
  });

  it('accepts only an active customer', async () => {
    await assertFails(setDoc(doc(dbOf('off'), 'users/off/favorites/product_p1'), entry('product', 'p1')));
    await assertFails(setDoc(doc(dbOf('boss'), 'users/boss/favorites/product_p1'), entry('product', 'p1')));
  });

  it('refuses something that does not exist', async () => {
    await assertFails(setDoc(doc(dbOf('sara'), 'users/sara/favorites/product_gone'), entry('product', 'gone')));
    await assertFails(setDoc(doc(dbOf('sara'), 'users/sara/favorites/service_gone'), entry('service', 'gone')));
  });

  it('refuses an id, kind or shape that does not match', async () => {
    const mine = (id: string) => doc(dbOf('sara'), `users/sara/favorites/${id}`);
    await assertFails(setDoc(mine('product_other'), entry('product', 'p1')));
    await assertFails(setDoc(mine('company_p1'), entry('company', 'p1')));
    await assertFails(setDoc(mine('product_p1'), { ...entry('product', 'p1'), price: 1 }));
    await assertFails(setDoc(mine('product_p1'), { ...entry('product', 'p1'), name: 'x'.repeat(201) }));
    await assertFails(setDoc(mine('product_p1'), { ...entry('product', 'p1'), createdAt: Timestamp.fromMillis(0) }));
  });

  it('never edits an entry', async () => {
    await assertFails(updateDoc(doc(dbOf('ali'), 'users/ali/favorites/product_p1'), { name: 'Other' }));
  });
});
