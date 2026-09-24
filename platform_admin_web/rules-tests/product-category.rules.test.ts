/*
 * Product categories: Platform Admin is the single source of truth for the
 * `categories` collection (already covered by platform-admin.rules.test.ts).
 * This file covers the product side only: a product's `categoryId` is an
 * optional reference into that collection. A company admin can create or
 * update a product with no category (legacy-safe), can only newly assign or
 * change it to a category that exists and is active, and can never create,
 * edit or deactivate a category itself. Local emulator only (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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

const category = (extra: Record<string, unknown> = {}) => ({
  name: 'Electronics',
  description: '',
  iconName: '',
  isActive: true,
  createdAt: now,
  ...extra,
});

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
    await setDoc(doc(db, 'categories', 'active1'), { id: 'active1', ...category() });
    await setDoc(doc(db, 'categories', 'inactive1'), {
      id: 'inactive1',
      ...category({ name: 'Retired', isActive: false }),
    });
    await setDoc(doc(db, 'products', 'uncategorized'), {
      ...fields('uncategorized'),
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'products', 'categorized'), {
      ...fields('categorized', { categoryId: 'active1' }),
      createdAt: now,
      updatedAt: now,
    });
  });
});

describe('assigning a category to a product', () => {
  it('can be created with no category at all', async () => {
    await assertSucceeds(create('n1', { categoryId: null }));
    const withoutKey = Object.fromEntries(
      Object.entries(fields('n2')).filter(([key]) => key !== 'categoryId'),
    );
    await assertSucceeds(
      setDoc(doc(as('ca1'), 'products', 'n2'), {
        ...withoutKey,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('can be created with a valid, active category', async () => {
    await assertSucceeds(create('n3', { categoryId: 'active1' }));
  });

  it('cannot be created pointing at an inactive category', async () => {
    await assertFails(create('bad1', { categoryId: 'inactive1' }));
  });

  it('cannot be created pointing at a category that does not exist', async () => {
    await assertFails(create('bad2', { categoryId: 'no-such-category' }));
  });

  it('an uncategorized product can be edited without ever setting one', async () => {
    await assertSucceeds(edit('uncategorized', { stockCount: 9 }));
  });

  it('a category can be added to a product that had none', async () => {
    await assertSucceeds(edit('uncategorized', { categoryId: 'active1' }));
  });

  it('a category can be changed to another active one', async () => {
    await assertSucceeds(edit('categorized', { categoryId: 'active1' }));
  });

  it('a category cannot be changed to an inactive one', async () => {
    await assertFails(edit('categorized', { categoryId: 'inactive1' }));
  });

  it('a category can be cleared back to none', async () => {
    await assertSucceeds(edit('categorized', { categoryId: null }));
  });

  it(
    'a product keeps working after its category is deactivated, as long as the ' +
      'assignment itself is left untouched',
    async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'categories', 'active1'), { isActive: false });
      });
      await assertSucceeds(edit('categorized', { stockCount: 1 }));
      await assertSucceeds(edit('categorized', { categoryId: 'active1', stockCount: 2 }));
    },
  );
});

describe('stock reservation cannot be used to change the category', () => {
  const order = (productId: string) => ({
    id: 'o1',
    customerId: 'cust1',
    companyId: 'c1',
    companyName: 'Company 1',
    productId,
    productName: `Product ${productId}`,
    quantity: 1,
    unitPrice: 100,
    productSubtotal: 100,
    installationSelected: false,
    installationFee: 0,
    deliveryFee: 0,
    totalAmount: 100,
    deliveryAddress: 'Street',
    contactPhone: '1',
    deliveryMethod: 'delivery',
    customerName: 'C',
    paymentStatus: 'pending_verification',
    orderStatus: 'processing',
    receiptFileName: 'r.jpg',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const reserve = (extra: Record<string, unknown>) => {
    const db = as('cust1');
    const batch = writeBatch(db);
    batch.update(doc(db, 'products', 'categorized'), {
      stockCount: 4,
      lastOrderId: 'o1',
      updatedAt: serverTimestamp(),
      ...extra,
    });
    batch.set(doc(db, 'orders', 'o1'), order('categorized'));
    return batch.commit();
  };

  it('a customer can reserve stock on a categorized product', async () => {
    await assertSucceeds(reserve({}));
  });

  it('a customer cannot change or clear the category while reserving', async () => {
    await assertFails(reserve({ categoryId: 'inactive1' }));
    await assertFails(reserve({ categoryId: null }));
  });
});

describe('company admin cannot manage the categories collection itself', () => {
  it('cannot create a category', async () => {
    await assertFails(
      setDoc(doc(as('ca1'), 'categories', 'new1'), {
        id: 'new1',
        ...category(),
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('cannot edit a category', async () => {
    await assertFails(updateDoc(doc(as('ca1'), 'categories', 'active1'), { name: 'Renamed' }));
  });

  it('cannot deactivate or reactivate a category', async () => {
    await assertFails(updateDoc(doc(as('ca1'), 'categories', 'active1'), { isActive: false }));
    await assertFails(updateDoc(doc(as('ca1'), 'categories', 'inactive1'), { isActive: true }));
  });

  it('cannot delete a category', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    await assertFails(deleteDoc(doc(as('ca1'), 'categories', 'active1')));
  });

  it('can still read categories to populate its product form', async () => {
    const { getDocs, collection } = await import('firebase/firestore');
    await assertSucceeds(getDocs(collection(as('ca1'), 'categories')));
  });
});
