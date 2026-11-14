/*
 * What visitors must not read lives apart from the public documents:
 *   company_payment/{companyId}  the bank accounts: signed-in customers, the
 *                                company's admin and Platform Admin read them
 *   company_private/{companyId}  the email: the company's admin and Platform
 *                                Admin only
 *   reviews                      never name their customer; the customer is
 *                                found through the order with the review's id
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
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch, increment } from 'firebase/firestore';
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

const account = { bankName: 'Bank of Khartoum', accountName: 'Print Hub', accountNumber: '12345', phoneNumber: '' };

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/cust1'), { role: 'customer', isActive: true });
    await setDoc(doc(db, 'users/cust2'), { role: 'customer', isActive: true });
    await setDoc(doc(db, 'users/off'), { role: 'customer', isActive: false });
    await setDoc(doc(db, 'users/admin1'), { role: 'company_admin', companyId: 'c1', isActive: true });
    await setDoc(doc(db, 'users/admin2'), { role: 'company_admin', companyId: 'c2', isActive: true });
    await setDoc(doc(db, 'users/tech1'), { role: 'technician', companyId: 'c1', isActive: true });
    await setDoc(doc(db, 'users/pa'), { role: 'platform_admin', isActive: true });
    await setDoc(doc(db, 'companies/c1'), { name: 'Print Hub', status: 'active' });
    await setDoc(doc(db, 'company_payment/c1'), { companyId: 'c1', paymentAccounts: [account] });
    await setDoc(doc(db, 'company_private/c1'), { companyId: 'c1', email: 'owner@example.test' });
    await setDoc(doc(db, 'orders/o1'), {
      customerId: 'cust1', companyId: 'c1', productId: 'p1', orderStatus: 'completed',
      companyName: 'Print Hub', productName: 'Printer',
    });
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const visitor = () => env.unauthenticatedContext().firestore();

describe('the bank accounts (company_payment)', () => {
  it('a visitor cannot read them', async () => {
    await assertFails(getDoc(doc(visitor(), 'company_payment/c1')));
  });

  it('a signed-in customer, the company admin and Platform Admin read them', async () => {
    await assertSucceeds(getDoc(doc(as('cust1'), 'company_payment/c1')));
    await assertSucceeds(getDoc(doc(as('admin1'), 'company_payment/c1')));
    await assertSucceeds(getDoc(doc(as('pa'), 'company_payment/c1')));
  });

  it('a deactivated customer, another company and a technician cannot', async () => {
    await assertFails(getDoc(doc(as('off'), 'company_payment/c1')));
    await assertFails(getDoc(doc(as('admin2'), 'company_payment/c1')));
    await assertFails(getDoc(doc(as('tech1'), 'company_payment/c1')));
  });

  it('only the company admin writes them, in the expected shape', async () => {
    const write = (db: ReturnType<typeof as>, data: object) => setDoc(doc(db, 'company_payment/c1'), data);
    const good = { companyId: 'c1', paymentAccounts: [account, { ...account, accountNumber: '999' }], updatedAt: serverTimestamp() };
    await assertSucceeds(write(as('admin1'), good));
    await assertFails(write(as('admin2'), good));
    await assertFails(write(as('cust1'), good));
    await assertFails(write(as('admin1'), { ...good, companyId: 'c2' }));
    await assertFails(write(as('admin1'), { ...good, extra: true }));
    await assertFails(write(as('admin1'), { ...good, paymentAccounts: [{ ...account, accountNumber: '' }] }));
  });
});

describe('the email (company_private)', () => {
  it('only the company admin and Platform Admin read it', async () => {
    await assertFails(getDoc(doc(visitor(), 'company_private/c1')));
    await assertFails(getDoc(doc(as('cust1'), 'company_private/c1')));
    await assertFails(getDoc(doc(as('admin2'), 'company_private/c1')));
    await assertSucceeds(getDoc(doc(as('admin1'), 'company_private/c1')));
    await assertSucceeds(getDoc(doc(as('pa'), 'company_private/c1')));
  });

  it('the company admin may correct it; nobody else', async () => {
    const data = { companyId: 'c1', email: 'new@example.test', updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(as('admin1'), 'company_private/c1'), data));
    await assertFails(setDoc(doc(as('admin2'), 'company_private/c1'), data));
    await assertFails(setDoc(doc(as('cust1'), 'company_private/c1'), data));
  });
});

describe('the public company document', () => {
  it('can no longer carry the email or the bank accounts', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'companies/c1'), {
        name: 'Print Hub', logoUrl: '', description: '', city: '', address: '', phone: '', pickupAddress: '', status: 'active',
      });
    });
    const base = { name: 'Print Hub', logoUrl: '', description: 'New', city: '', address: '', phone: '', pickupAddress: '', updatedAt: serverTimestamp() };
    await assertSucceeds(updateDoc(doc(as('admin1'), 'companies/c1'), base));
    await assertFails(updateDoc(doc(as('admin1'), 'companies/c1'), { ...base, email: 'x@example.test' }));
    await assertFails(updateDoc(doc(as('admin1'), 'companies/c1'), { ...base, paymentAccounts: [account] }));
  });
});

describe('a review', () => {
  const review = {
    id: 'o1', sourceType: 'order', authorName: 'Ahmed M.', companyId: 'c1', companyName: 'Print Hub',
    targetType: 'product', targetId: 'p1', targetName: 'Printer', stars: 4, tags: [], comment: 'Good',
    hidden: false,
  };
  const rate = (uid: string, extra: object = {}) => {
    const db = as(uid);
    const batch = writeBatch(db);
    batch.set(doc(db, 'reviews/o1'), { ...review, ...extra, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    for (const key of ['company_c1', 'product_p1']) {
      batch.set(doc(db, 'ratings', key), { companyId: 'c1', sum: increment(4), count: increment(1), lastReviewId: 'o1', updatedAt: serverTimestamp() }, { merge: true });
    }
    return batch.commit();
  };

  it('is written by the order\'s customer without naming them', async () => {
    await assertSucceeds(rate('cust1'));
    const stored = await env.withSecurityRulesDisabled(async (ctx) => (await getDoc(doc(ctx.firestore(), 'reviews/o1'))).data());
    if (stored && 'customerId' in stored) throw new Error('the review names its customer');
  });

  it('refuses a customerId, and another customer', async () => {
    await assertFails(rate('cust1', { customerId: 'cust1' }));
    await assertFails(rate('cust2'));
  });

  it('is edited by its customer only (found through the order)', async () => {
    await assertSucceeds(rate('cust1'));
    await assertSucceeds(updateDoc(doc(as('cust1'), 'reviews/o1'), { comment: 'Very good', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('cust2'), 'reviews/o1'), { comment: 'Hacked', updatedAt: serverTimestamp() }));
  });

  it('when hidden, is still read by its own customer, not by others', async () => {
    await assertSucceeds(rate('cust1'));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'reviews/o1'), { hidden: true });
    });
    await assertSucceeds(getDoc(doc(as('cust1'), 'reviews/o1')));
    await assertFails(getDoc(doc(as('cust2'), 'reviews/o1')));
    await assertFails(getDoc(doc(visitor(), 'reviews/o1')));
  });
});
