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
    await setDoc(doc(db, 'products/p1'), { id: 'p1', name: 'Printer', companyId: 'c1', stockCount: 3, hidden: false });
    await setDoc(doc(db, 'services/s1'), { id: 's1', name: 'Repair', isActive: true });
    await setDoc(doc(db, 'companies/c1'), { name: 'Print Hub', status: 'active' });
    await setDoc(doc(db, 'company_services/on'), { companyId: 'c1', serviceId: 's1', isActive: true });
    await setDoc(doc(db, 'company_services/off'), { companyId: 'c1', serviceId: 's1', isActive: false });
    // A review's customer is the one who placed the order with its id.
    await setDoc(doc(db, 'reviews/shown'), { sourceType: 'order', targetId: 'p1', companyId: 'c1', hidden: false, stars: 5 });
    await setDoc(doc(db, 'reviews/hidden'), { sourceType: 'order', targetId: 'p1', companyId: 'c1', hidden: true, stars: 1 });
    await setDoc(doc(db, 'orders/hidden'), { customerId: 'cust1', companyId: 'c1' });
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
    await assertSucceeds(getDocs(query(collection(db, 'products'), where('hidden', '==', false), where('stockCount', '>', 0))));
    await assertSucceeds(getDoc(doc(db, 'products/p1')));
    await assertSucceeds(getDocs(query(collection(db, 'services'), where('isActive', '==', true))));
    await assertSucceeds(getDocs(query(collection(db, 'companies'), where('status', '==', 'active'))));
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

describe('a product Platform Admin hid', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'products/hid'), {
        id: 'hid', name: 'Fake laptop', companyId: 'c1', stockCount: 5, hidden: true, hiddenReason: 'Fraud report',
      });
      // An older product with no hidden field at all reads as shown.
      await setDoc(doc(db, 'products/legacy'), { id: 'legacy', name: 'Old', companyId: 'c1', stockCount: 1 });
      await setDoc(doc(db, 'users/ca1'), { role: 'company_admin', isActive: true, companyId: 'c1' });
      await setDoc(doc(db, 'users/ca2'), { role: 'company_admin', isActive: true, companyId: 'c2' });
      await setDoc(doc(db, 'users/pa'), { role: 'platform_admin', isActive: true });
    });
  });

  it('is not read by a visitor or a customer, not even directly', async () => {
    for (const db of [visitor(), env.authenticatedContext('cust1').firestore()]) {
      await assertFails(getDoc(doc(db, 'products/hid')));
      // A list that does not leave hidden products out is refused.
      await assertFails(getDocs(collection(db, 'products')));
      await assertFails(getDocs(query(collection(db, 'products'), where('stockCount', '>', 0))));
      await assertFails(getDocs(query(collection(db, 'products'), where('hidden', '==', true))));
      // The customer site's query works.
      await assertSucceeds(getDocs(query(collection(db, 'products'), where('hidden', '==', false), where('stockCount', '>', 0))));
      await assertSucceeds(getDoc(doc(db, 'products/legacy')));
    }
  });

  it('is read by its own company and by Platform Admin', async () => {
    const own = env.authenticatedContext('ca1').firestore();
    await assertSucceeds(getDoc(doc(own, 'products/hid')));
    await assertSucceeds(getDocs(query(collection(own, 'products'), where('companyId', '==', 'c1'))));
    const admin = env.authenticatedContext('pa').firestore();
    await assertSucceeds(getDoc(doc(admin, 'products/hid')));
    await assertSucceeds(getDocs(collection(admin, 'products')));
  });

  it('is not read by another company', async () => {
    const other = env.authenticatedContext('ca2').firestore();
    await assertFails(getDoc(doc(other, 'products/hid')));
    await assertFails(getDocs(query(collection(other, 'products'), where('companyId', '==', 'c1'))));
  });
});

describe('a company that is not active', () => {
  // Pending, rejected, deactivated and trashed (a trashed company is inactive).
  const statuses = ['pending', 'rejected', 'inactive'];

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (const status of statuses) {
        await setDoc(doc(db, `companies/${status}`), {
          name: `Company ${status}`,
          status,
          phone: '+249900000000',
          email: 'owner@example.test',
          paymentAccounts: [{ bankName: 'Bank', accountName: 'Owner', accountNumber: '12345', phoneNumber: '' }],
        });
        await setDoc(doc(db, `users/admin_${status}`), { role: 'company_admin', isActive: true, companyId: status });
        await setDoc(doc(db, `users/tech_${status}`), { role: 'technician', isActive: true, companyId: status });
      }
      await setDoc(doc(db, 'users/pa'), { role: 'platform_admin', isActive: true });
    });
  });

  it('is hidden from a visitor and from a customer, phone, e-mail and accounts with it', async () => {
    for (const db of [visitor(), env.authenticatedContext('cust1').firestore()]) {
      for (const status of statuses) await assertFails(getDoc(doc(db, `companies/${status}`)));
      // A list that does not ask for active companies only is refused.
      await assertFails(getDocs(collection(db, 'companies')));
      await assertFails(getDocs(query(collection(db, 'companies'), where('status', '==', 'pending'))));
      // Asking for the active ones works and returns only them.
      await assertSucceeds(getDocs(query(collection(db, 'companies'), where('status', '==', 'active'))));
    }
  });

  it('is read by its own admin and technicians', async () => {
    for (const status of statuses) {
      await assertSucceeds(getDoc(doc(env.authenticatedContext(`admin_${status}`).firestore(), `companies/${status}`)));
      await assertSucceeds(getDoc(doc(env.authenticatedContext(`tech_${status}`).firestore(), `companies/${status}`)));
    }
  });

  it('is not read by another company\'s admin or technician', async () => {
    await assertFails(getDoc(doc(env.authenticatedContext('admin_pending').firestore(), 'companies/rejected')));
    await assertFails(getDoc(doc(env.authenticatedContext('tech_pending').firestore(), 'companies/inactive')));
  });

  it('is read and listed by Platform Admin', async () => {
    const db = env.authenticatedContext('pa').firestore();
    for (const status of statuses) await assertSucceeds(getDoc(doc(db, `companies/${status}`)));
    await assertSucceeds(getDocs(collection(db, 'companies')));
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
