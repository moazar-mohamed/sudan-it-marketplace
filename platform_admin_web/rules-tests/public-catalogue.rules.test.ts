/*
 * The catalogue is public: a signed-out visitor browses the customer site.
 * They read categories, products, services, companies, active service links,
 * visible reviews and ratings, and nothing else; they write nothing.
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
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
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
    await setDoc(doc(db, 'users/cust1'), { role: 'customer', isActive: true });
    await setDoc(doc(db, 'categories/k'), { id: 'k', name: 'Printers', isActive: true });
    await setDoc(doc(db, 'products/p1'), { id: 'p1', name: 'Printer', companyId: 'c1', stockCount: 3 });
    await setDoc(doc(db, 'services/s1'), { id: 's1', name: 'Repair', isActive: true });
    await setDoc(doc(db, 'companies/c1'), { name: 'Print Hub', status: 'active' });
    await setDoc(doc(db, 'company_services/on'), { companyId: 'c1', serviceId: 's1', isActive: true });
    await setDoc(doc(db, 'company_services/off'), { companyId: 'c1', serviceId: 's1', isActive: false });
    await setDoc(doc(db, 'reviews/shown'), { targetId: 'p1', companyId: 'c1', customerId: 'cust1', hidden: false, stars: 5 });
    await setDoc(doc(db, 'reviews/hidden'), { targetId: 'p1', companyId: 'c1', customerId: 'cust1', hidden: true, stars: 1 });
    await setDoc(doc(db, 'ratings/product_p1'), { sum: 5, count: 1 });
    await setDoc(doc(db, 'orders/o1'), { customerId: 'cust1', companyId: 'c1' });
    await setDoc(doc(db, 'chats/o1'), { customerId: 'cust1', companyId: 'c1' });
    await setDoc(doc(db, 'notifications/n1'), { recipientType: 'customer', recipientId: 'cust1' });
    await setDoc(doc(db, 'users/cust1/favorites/product_p1'), { kind: 'product', targetId: 'p1' });
  });
});

const visitor = () => env.unauthenticatedContext().firestore();

describe('a signed-out visitor', () => {
  it('reads the catalogue the customer site shows', async () => {
    const db = visitor();
    await assertSucceeds(getDocs(collection(db, 'categories')));
    await assertSucceeds(getDoc(doc(db, 'categories/k')));
    await assertSucceeds(getDocs(query(collection(db, 'products'), where('stockCount', '>', 0))));
    await assertSucceeds(getDoc(doc(db, 'products/p1')));
    await assertSucceeds(getDocs(query(collection(db, 'services'), where('isActive', '==', true))));
    await assertSucceeds(getDocs(collection(db, 'companies')));
    await assertSucceeds(getDoc(doc(db, 'companies/c1')));
    await assertSucceeds(getDocs(query(collection(db, 'company_services'), where('isActive', '==', true))));
    await assertSucceeds(getDoc(doc(db, 'company_services/on')));
    await assertSucceeds(getDocs(query(collection(db, 'reviews'), where('targetId', '==', 'p1'), where('hidden', '==', false))));
    await assertSucceeds(getDoc(doc(db, 'reviews/shown')));
    await assertSucceeds(getDocs(collection(db, 'ratings')));
  });

  it('does not read switched-off links, hidden reviews or unknown review ids', async () => {
    const db = visitor();
    await assertFails(getDoc(doc(db, 'company_services/off')));
    await assertFails(getDocs(collection(db, 'company_services')));
    await assertFails(getDoc(doc(db, 'reviews/hidden')));
    await assertFails(getDocs(query(collection(db, 'reviews'), where('targetId', '==', 'p1'))));
    await assertFails(getDoc(doc(db, 'reviews/none')));
  });

  it('reads nothing private', async () => {
    const db = visitor();
    await assertFails(getDoc(doc(db, 'users/cust1')));
    await assertFails(getDocs(collection(db, 'users/cust1/favorites')));
    await assertFails(getDoc(doc(db, 'orders/o1')));
    await assertFails(getDocs(collection(db, 'orders')));
    await assertFails(getDoc(doc(db, 'chats/o1')));
    await assertFails(getDocs(collection(db, 'chats')));
    await assertFails(getDoc(doc(db, 'notifications/n1')));
    await assertFails(getDocs(collection(db, 'notifications')));
    await assertFails(getDoc(doc(db, 'company_documents/c1')));
  });

  it('writes nothing to the catalogue', async () => {
    const db = visitor();
    await assertFails(setDoc(doc(db, 'categories/new'), { id: 'new', name: 'New', isActive: true }));
    await assertFails(updateDoc(doc(db, 'categories/k'), { isActive: false }));
    await assertFails(deleteDoc(doc(db, 'categories/k')));
    await assertFails(updateDoc(doc(db, 'products/p1'), { stockCount: 0 }));
    await assertFails(deleteDoc(doc(db, 'products/p1')));
    await assertFails(setDoc(doc(db, 'services/new'), { id: 'new', name: 'New', isActive: true }));
    await assertFails(updateDoc(doc(db, 'companies/c1'), { name: 'Mine' }));
    await assertFails(updateDoc(doc(db, 'company_services/on'), { isActive: false }));
    await assertFails(updateDoc(doc(db, 'reviews/shown'), { hidden: true }));
    await assertFails(setDoc(doc(db, 'ratings/product_p1'), { sum: 50, count: 1 }));
  });
});

describe('a signed-in customer', () => {
  it('still reads its own hidden review and asks after a missing one', async () => {
    const db = env.authenticatedContext('cust1').firestore();
    await assertSucceeds(getDoc(doc(db, 'reviews/hidden')));
    await assertSucceeds(getDoc(doc(db, 'reviews/none')));
  });

  it('does not read someone else\'s hidden review', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/cust2'), { role: 'customer', isActive: true });
    });
    const db = env.authenticatedContext('cust2').firestore();
    await assertFails(getDoc(doc(db, 'reviews/hidden')));
    await assertFails(getDoc(doc(db, 'company_services/off')));
  });
});
