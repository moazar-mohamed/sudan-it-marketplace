/*
 * Product price is optional: a company can save a product without one (null or
 * absent), a price that is given must still be a positive number, an unpriced
 * product is listed in the customer marketplace query but cannot be ordered
 * through checkout. Local emulator only (npm run test:rules).
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
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { confirmPayment, placeOrder } from './support/checkout';

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

/** Every account here has confirmed its e-mail (placing an order needs it). */
const as = (uid: string) => env.authenticatedContext(uid, { email_verified: true }).firestore();

const fields = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  companyId: 'c1',
  companyName: 'Company 1',
  name: `Product ${id}`,
  imageUrl: '',
  price: 100,
  currency: 'SDG',
  stockCount: 5,
  inStock: true,
  description: 'd',
  specifications: {},
  isDeliveryAvailable: true,
  isInstallationAvailable: false,
  installationPrice: null,
  ...extra,
});

const create = (id: string, extra: Record<string, unknown> = {}) =>
  setDoc(doc(as('ca1'), 'products', id), {
    ...fields(id, extra),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

const edit = (id: string, patch: Record<string, unknown>) =>
  updateDoc(doc(as('ca1'), 'products', id), { ...patch, updatedAt: serverTimestamp() });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', 'ca1'), {
      id: 'ca1',
      fullName: 'Admin',
      email: 'ca1@x.test',
      role: 'company_admin',
      isActive: true,
      companyId: 'c1',
      createdAt: now,
    });
    // Only an active customer may place an order.
    await setDoc(doc(db, 'users', 'cust1'), {
      id: 'cust1',
      fullName: 'Customer',
      email: 'cust1@x.test',
      role: 'customer',
      isActive: true,
      createdAt: now,
    });
    await setDoc(doc(db, 'companies', 'c1'), {
      name: 'Company 1',
      status: 'active',
      rating: 0,
      reviewCount: 0,
      createdAt: now,
    });
    await setDoc(doc(db, 'products', 'priced'), { ...fields('priced'), createdAt: now, updatedAt: now });
    await setDoc(doc(db, 'products', 'unpriced'), {
      ...fields('unpriced', { price: null }),
      createdAt: now,
      updatedAt: now,
    });
  });
});

describe('optional product price', () => {
  it('a product can be created without a price (null)', async () => {
    await assertSucceeds(create('n1', { price: null }));
  });

  it('a product can be created with the price key absent', async () => {
    const withoutPrice = Object.fromEntries(Object.entries(fields('n2')).filter(([key]) => key !== 'price'));
    await assertSucceeds(
      setDoc(doc(as('ca1'), 'products', 'n2'), {
        ...withoutPrice,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('a product with a price is still created as before', async () => {
    await assertSucceeds(create('n3', { price: 850000 }));
  });

  it('a given price must still be a positive number', async () => {
    await assertFails(create('bad1', { price: 0 }));
    await assertFails(create('bad2', { price: -5 }));
    await assertFails(create('bad3', { price: '100' }));
  });

  it('a price can be removed and added back on an existing product', async () => {
    await assertSucceeds(edit('priced', { price: null }));
    await assertSucceeds(edit('priced', { price: 250 }));
    await assertFails(edit('priced', { price: 0 }));
  });

  it('an unpriced product can be restocked without touching price', async () => {
    await assertSucceeds(edit('unpriced', { stockCount: 20 }));
  });

  const order = (productId: string, quantity = 2) => ({
    id: 'o1',
    customerId: 'cust1',
    companyId: 'c1',
    companyName: 'Company 1',
    productId,
    productName: `Product ${productId}`,
    quantity,
    unitPrice: 100,
    productSubtotal: 100 * quantity,
    installationSelected: false,
    installationFee: 0,
    // Delivery costs the standard fee (standardDeliveryFee in firestore.rules).
    deliveryFee: 15000,
    totalAmount: 100 * quantity + 15000,
    deliveryAddress: 'Street',
    contactPhone: '1',
    deliveryMethod: 'delivery',
    customerName: 'C',
    paymentStatus: 'pending_verification',
    orderStatus: 'processing',
    stockReserved: false,
    receiptFileName: 'r.jpg',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  /** The app's checkout: the order with its receipt and a quota step. */
  const checkout = (productId: string) => placeOrder(as('cust1'), 'cust1', order(productId));

  it('an unpriced product cannot be ordered through checkout', async () => {
    await assertFails(checkout('unpriced'));
  });

  it('a priced product is still ordered, and its stock is taken when the company confirms the payment', async () => {
    await assertSucceeds(checkout('priced'));
    await assertSucceeds(confirmPayment(as('ca1'), 'o1'));
  });

  it('a product whose price is removed after the order can still have that order confirmed', async () => {
    await assertSucceeds(checkout('priced'));
    await assertSucceeds(edit('priced', { price: null }));
    await assertSucceeds(confirmPayment(as('ca1'), 'o1'));
  });
});

describe('customer marketplace query sees priced and unpriced products', () => {
  const marketplace = async () =>
    (await assertSucceeds(getDocs(query(collection(as('cust1'), 'products'), where('stockCount', '>', 0)))))
      .docs.map((d) => d.id)
      .sort();

  it('lists both, with the unpriced one keeping a null price (not 0)', async () => {
    expect(await marketplace()).toEqual(['priced', 'unpriced']);
    const snap = await getDocs(query(collection(as('cust1'), 'products'), where('stockCount', '>', 0)));
    const unpriced = snap.docs.find((d) => d.id === 'unpriced');
    expect(unpriced?.data().price).toBeNull();
  });

  it('a product a company admin just created without a price is listed straight away', async () => {
    await assertSucceeds(create('fresh', { price: null, stockCount: 3 }));
    expect(await marketplace()).toEqual(['fresh', 'priced', 'unpriced']);
  });

  it('a sold-out unpriced product stays out of the marketplace until restocked', async () => {
    await assertSucceeds(edit('unpriced', { stockCount: 0 }));
    expect(await marketplace()).toEqual(['priced']);
    await assertSucceeds(edit('unpriced', { stockCount: 6 }));
    expect(await marketplace()).toEqual(['priced', 'unpriced']);
  });
});
