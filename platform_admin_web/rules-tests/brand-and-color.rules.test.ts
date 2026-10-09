/*
 * A product can carry a brand ("HP"), and a category can carry the colour of
 * its tile. Both are optional strings, so older documents stay valid. Only the
 * owning company writes a brand and only Platform Admin writes a colour. Local
 * emulator only (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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

const productFields = (id: string, extra: Record<string, unknown> = {}) => ({
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

const createProduct = (uid: string, id: string, extra: Record<string, unknown> = {}) =>
  setDoc(doc(as(uid), 'products', id), {
    ...productFields(id, extra),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

const editProduct = (uid: string, id: string, patch: Record<string, unknown>) =>
  updateDoc(doc(as(uid), 'products', id), { ...patch, updatedAt: serverTimestamp() });

const categoryFields = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: 'Printers',
  description: '',
  iconName: '',
  isActive: true,
  ...extra,
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
      setDoc(doc(db, 'users', id), {
        id,
        fullName: id,
        email: `${id}@x.test`,
        role,
        isActive: true,
        createdAt: now,
        ...extra,
      });
    await user('admin', 'platform_admin');
    await user('ca1', 'company_admin', { companyId: 'c1' });
    await user('ca2', 'company_admin', { companyId: 'c2' });
    await setDoc(doc(db, 'products', 'old'), {
      ...productFields('old'),
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'categories', 'k1'), { ...categoryFields('k1'), createdAt: now });
  });
});

describe('a product brand', () => {
  it('is accepted on a new product', async () => {
    await assertSucceeds(createProduct('ca1', 'p1', { brand: 'HP' }));
  });

  it('is optional: a product without one is still valid', async () => {
    await assertSucceeds(createProduct('ca1', 'p2'));
  });

  it('is set or changed by the owning company on an existing product', async () => {
    await assertSucceeds(editProduct('ca1', 'old', { brand: 'Canon' }));
  });

  it('must be text', async () => {
    await assertFails(createProduct('ca1', 'p3', { brand: 5 }));
    await assertFails(createProduct('ca1', 'p4', { brand: null }));
  });

  it('is at most 60 characters', async () => {
    await assertSucceeds(createProduct('ca1', 'p5', { brand: 'x'.repeat(60) }));
    await assertFails(createProduct('ca1', 'p6', { brand: 'x'.repeat(61) }));
  });

  it('cannot be changed by another company', async () => {
    await assertFails(editProduct('ca2', 'old', { brand: 'Canon' }));
  });
});

describe('a category colour', () => {
  const create = (uid: string, id: string, extra: Record<string, unknown> = {}) =>
    setDoc(doc(as(uid), 'categories', id), {
      ...categoryFields(id, extra),
      createdAt: serverTimestamp(),
    });

  it('is accepted when Platform Admin creates a category', async () => {
    await assertSucceeds(create('admin', 'n1', { color: 'teal' }));
  });

  it('is optional: a category without one is still valid', async () => {
    await assertSucceeds(create('admin', 'n2'));
  });

  it('is set or cleared by Platform Admin on an existing category', async () => {
    await assertSucceeds(updateDoc(doc(as('admin'), 'categories', 'k1'), { color: 'pink' }));
    await assertSucceeds(updateDoc(doc(as('admin'), 'categories', 'k1'), { color: '' }));
  });

  it('must be short text', async () => {
    await assertFails(create('admin', 'n3', { color: 7 }));
    await assertFails(create('admin', 'n4', { color: 'x'.repeat(21) }));
  });

  it('cannot be written by a company', async () => {
    await assertFails(updateDoc(doc(as('ca1'), 'categories', 'k1'), { color: 'pink' }));
  });
});
