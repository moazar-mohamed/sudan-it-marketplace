/*
 * Dollar pricing: each company keeps its own dollar rate (companies/{id}.usdRate
 * with the time it was set or confirmed), a product may carry what the company
 * typed in dollars next to the pounds worked out from that rate, and a change
 * of rate rewrites the company's dollar products in one batch. Orders keep
 * reading the pounds, so a dollar product is ordered and confirmed as before.
 * The company can switch the daily rate reminder off (pushPrefs.usdRate).
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
import { doc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
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

const as = (uid: string) => env.authenticatedContext(uid, { email_verified: true }).firestore();

const fields = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  companyId: 'c1',
  companyName: 'Company 1',
  name: `Product ${id}`,
  imageUrl: '',
  price: 750000,
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

const dollars = { priceUsd: 250, usdRateApplied: 3000 };

const create = (id: string, extra: Record<string, unknown> = {}) =>
  setDoc(doc(as('ca1'), 'products', id), {
    ...fields(id, extra),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

const edit = (id: string, patch: Record<string, unknown>) =>
  updateDoc(doc(as('ca1'), 'products', id), { ...patch, updatedAt: serverTimestamp() });

const setRate = (uid: string, companyId: string, rate: unknown, extra: Record<string, unknown> = {}) =>
  updateDoc(doc(as(uid), 'companies', companyId), { usdRate: rate, usdRateUpdatedAt: serverTimestamp(), ...extra });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, companyId] of [['ca1', 'c1'], ['ca2', 'c2']]) {
      await setDoc(doc(db, 'users', uid), {
        id: uid,
        fullName: 'Admin',
        email: `${uid}@x.test`,
        role: 'company_admin',
        isActive: true,
        companyId,
        createdAt: now,
      });
    }
    await setDoc(doc(db, 'users', 'cust1'), {
      id: 'cust1',
      fullName: 'Customer',
      email: 'cust1@x.test',
      role: 'customer',
      isActive: true,
      createdAt: now,
    });
    // Each company carries the name its products show ('Company 1' for c1).
    for (const id of ['c1', 'c2']) {
      await setDoc(doc(db, 'companies', id), {
        name: `Company ${id.slice(1)}`,
        logoUrl: '',
        description: '',
        city: '',
        address: '',
        phone: '',
        email: '',
        pickupAddress: '',
        status: 'active',
        rating: 0,
        reviewCount: 0,
        usdRate: 3000,
        usdRateUpdatedAt: Timestamp.fromDate(new Date(now.getTime() - 2 * 24 * 3600 * 1000)),
        createdAt: now,
      });
    }
    await setDoc(doc(db, 'products', 'usd'), { ...fields('usd', dollars), createdAt: now, updatedAt: now });
    await setDoc(doc(db, 'products', 'sdg'), { ...fields('sdg', { price: 100000 }), createdAt: now, updatedAt: now });
  });
});

describe("the company's dollar rate", () => {
  it('the company admin sets a new rate, stamped with the server time', async () => {
    await assertSucceeds(setRate('ca1', 'c1', 3200));
    await assertSucceeds(setRate('ca1', 'c1', 3250.5));
  });

  it('confirming the same rate changes only the time', async () => {
    await assertSucceeds(setRate('ca1', 'c1', 3000));
  });

  it('a rate must be a sensible number', async () => {
    await assertFails(setRate('ca1', 'c1', 0));
    await assertFails(setRate('ca1', 'c1', -5));
    await assertFails(setRate('ca1', 'c1', '3000'));
    await assertFails(setRate('ca1', 'c1', 2000000));
  });

  it('the time is the server time, never one the client picks', async () => {
    await assertFails(
      updateDoc(doc(as('ca1'), 'companies', 'c1'), { usdRate: 3200, usdRateUpdatedAt: Timestamp.fromDate(now) }),
    );
  });

  it('nothing else rides along with the rate', async () => {
    await assertFails(setRate('ca1', 'c1', 3200, { rating: 5 }));
    await assertFails(setRate('ca1', 'c1', 3200, { status: 'active', name: 'X' }));
    await assertFails(setRate('ca1', 'c1', 3200, { usdRateRemindedAt: serverTimestamp() }));
  });

  it('only the company itself sets its rate', async () => {
    await assertFails(setRate('ca2', 'c1', 3200));
    await assertFails(setRate('cust1', 'c1', 3200));
  });

  it('a company with a rate still edits its profile as before', async () => {
    await assertSucceeds(
      updateDoc(doc(as('ca1'), 'companies', 'c1'), {
        name: 'Renamed',
        logoUrl: '',
        description: '',
        city: '',
        address: '',
        phone: '',
        email: '',
        pickupAddress: '',
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('dollar prices on a product', () => {
  it('a product is created with its dollar prices next to the pounds', async () => {
    await assertSucceeds(create('n1', dollars));
    await assertSucceeds(
      create('n2', {
        ...dollars,
        offerPriceUsd: 229,
        offerPrice: 687000,
        isInstallationAvailable: true,
        installationPrice: 45000,
        installationPriceUsd: 15,
      }),
    );
  });

  it('a dollar price needs its pounds', async () => {
    await assertFails(create('bad1', { ...dollars, price: null }));
  });

  it('the dollar prices must be positive numbers', async () => {
    await assertFails(create('bad2', { ...dollars, priceUsd: 0 }));
    await assertFails(create('bad3', { ...dollars, priceUsd: '250' }));
    await assertFails(create('bad4', { ...dollars, usdRateApplied: 0 }));
  });

  it('a dollar offer sits below the dollar price, on a dollar product', async () => {
    await assertFails(create('bad5', { ...dollars, offerPriceUsd: 250, offerPrice: 700000 }));
    await assertFails(create('bad6', { offerPriceUsd: 200, offerPrice: 600000 }));
    await assertFails(create('bad7', { ...dollars, installationPriceUsd: 0 }));
  });

  it('a product stays editable after Platform Admin ends its dollar offer', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users', 'pa'), {
        id: 'pa',
        fullName: 'Platform',
        email: 'pa@x.test',
        role: 'platform_admin',
        isActive: true,
        createdAt: now,
      });
      await setDoc(doc(db, 'products', 'offer'), {
        ...fields('offer', { ...dollars, offerPriceUsd: 229, offerPrice: 687000, offerBadge: 'discount' }),
        createdAt: now,
        updatedAt: now,
      });
    });
    await assertSucceeds(
      updateDoc(doc(as('pa'), 'products', 'offer'), { offerPrice: null, offerEndsAt: null, offerBadge: null }),
    );
    // Its stock still moves, and the company still edits it.
    await assertSucceeds(edit('offer', { stockCount: 4 }));
    await assertSucceeds(edit('offer', { offerPriceUsd: null }));
  });

  it('a product moves from pounds to dollars and back', async () => {
    await assertSucceeds(edit('sdg', { ...dollars, price: 750000 }));
    await assertSucceeds(edit('sdg', { priceUsd: null, usdRateApplied: null, price: 760000 }));
  });
});

describe('a new rate rewrites the dollar products', () => {
  it('the rate and every dollar product change in one batch', async () => {
    const db = as('ca1');
    const batch = writeBatch(db);
    batch.update(doc(db, 'companies', 'c1'), { usdRate: 3200, usdRateUpdatedAt: serverTimestamp() });
    batch.update(doc(db, 'products', 'usd'), { price: 800000, usdRateApplied: 3200, updatedAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
  });

  it("another company cannot rewrite this company's products", async () => {
    await assertFails(
      updateDoc(doc(as('ca2'), 'products', 'usd'), { price: 1, usdRateApplied: 1, updatedAt: serverTimestamp() }),
    );
  });
});

describe('a dollar product is ordered in pounds', () => {
  const order = {
    id: 'o1',
    customerId: 'cust1',
    companyId: 'c1',
    companyName: 'Company 1',
    productId: 'usd',
    productName: 'Product usd',
    quantity: 1,
    unitPrice: 750000,
    productSubtotal: 750000,
    installationSelected: false,
    installationFee: 0,
    deliveryFee: 15000,
    totalAmount: 765000,
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
  };

  it('ordered at its pounds price and confirmed, taking its stock', async () => {
    await assertSucceeds(placeOrder(as('cust1'), 'cust1', order));
    await assertSucceeds(confirmPayment(as('ca1'), 'o1'));
  });

  it('an order at the dollar figure is refused', async () => {
    await assertFails(
      placeOrder(as('cust1'), 'cust1', { ...order, unitPrice: 250, productSubtotal: 250, totalAmount: 15250 }),
    );
  });

  it('an order placed before a rate change is still confirmed after it', async () => {
    await assertSucceeds(placeOrder(as('cust1'), 'cust1', order));
    await assertSucceeds(edit('usd', { price: 800000, usdRateApplied: 3200 }));
    await assertSucceeds(confirmPayment(as('ca1'), 'o1'));
  });
});

describe('the rate reminder switch', () => {
  it('a company admin switches the reminder off and on', async () => {
    const ref = doc(as('ca1'), 'users', 'ca1');
    await assertSucceeds(updateDoc(ref, { 'pushPrefs.usdRate': false }));
    await assertSucceeds(updateDoc(ref, { 'pushPrefs.usdRate': true }));
    await assertFails(updateDoc(ref, { 'pushPrefs.usdRate': 'off' }));
  });
});
