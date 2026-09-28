/*
 * Offers on products: a company sets an offer price below the product's normal
 * price, with an optional end time, and can end it. Local emulator only
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
import {
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
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
    await setDoc(doc(db, 'products', 'onOffer'), {
      ...fields('onOffer', { offerPrice: 80, offerEndsAt: null }),
      createdAt: now,
      updatedAt: now,
    });
  });
});

describe('product offers', () => {
  const later = Timestamp.fromDate(new Date(Date.now() + 7 * 86400000));

  it('a company puts its product on offer below the normal price', async () => {
    await assertSucceeds(edit('priced', { offerPrice: 80, offerEndsAt: later }));
    await assertSucceeds(edit('priced', { offerPrice: 70, offerEndsAt: null }));
  });

  it('a product can be created already on offer', async () => {
    await assertSucceeds(create('n1', { offerPrice: 60, offerEndsAt: later }));
  });

  it('the offer price must be a positive number below the price', async () => {
    await assertFails(edit('priced', { offerPrice: 100 }));
    await assertFails(edit('priced', { offerPrice: 150 }));
    await assertFails(edit('priced', { offerPrice: 0 }));
    await assertFails(edit('priced', { offerPrice: '80' }));
  });

  it('an unpriced product cannot be on offer', async () => {
    await assertFails(edit('unpriced', { offerPrice: 10 }));
  });

  it('an end date needs an offer price and must be a timestamp', async () => {
    await assertFails(edit('priced', { offerEndsAt: later }));
    await assertFails(edit('priced', { offerPrice: 80, offerEndsAt: '2026-10-15' }));
  });

  it('the price cannot drop to or below a running offer price', async () => {
    await assertFails(edit('onOffer', { price: 80 }));
    await assertSucceeds(edit('onOffer', { price: 90 }));
  });

  it('the badge must be one of the known ones, and only on an offer', async () => {
    await assertSucceeds(edit('priced', { offerPrice: 80, offerBadge: 'limited' }));
    await assertSucceeds(edit('priced', { offerPrice: 80, offerBadge: 'special' }));
    await assertFails(edit('priced', { offerPrice: 80, offerBadge: 'free' }));
    await assertFails(edit('unpriced', { offerBadge: 'special' }));
  });

  it('the offer is ended by clearing it', async () => {
    await assertSucceeds(edit('onOffer', { offerPrice: null, offerEndsAt: null, offerBadge: null }));
  });

  it('another company cannot put the product on offer', async () => {
    await assertFails(
      updateDoc(doc(as('cust1'), 'products', 'priced'), {
        offerPrice: 1,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('a customer ordering an offer product still only touches stock', async () => {
    const db = as('cust1');
    await assertFails(
      updateDoc(doc(db, 'products', 'onOffer'), {
        stockCount: 4,
        lastOrderId: 'o1',
        offerPrice: 1,
        updatedAt: serverTimestamp(),
      }),
    );
  });
});
