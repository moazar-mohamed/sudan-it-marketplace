/*
 * A product shows its company's own name, never another company's: the
 * customer reads it on the product and it is copied into the order, so a
 * company selling under a trusted company's name would take the payment while
 * the order names the other company. The name is checked when a product is
 * made and whenever it changes; an edit that keeps the name works even after
 * the company renamed itself. Local emulator only (npm run test:rules).
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

const renameCompany = (name: string) =>
  env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'companies', 'c1'), { name }));

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
    await setDoc(doc(db, 'companies', 'c1'), { name: 'Company 1', status: 'active', rating: 0, reviewCount: 0, createdAt: now });
    await setDoc(doc(db, 'companies', 'c2'), { name: 'Trusted Company', status: 'active', rating: 0, reviewCount: 0, createdAt: now });
    await setDoc(doc(db, 'products', 'p1'), { ...fields('p1'), createdAt: now, updatedAt: now });
  });
});

describe('the company name on a product', () => {
  it('a new product carries its company\'s own name', async () => {
    await assertSucceeds(create('ok'));
  });

  it('a new product cannot carry another company\'s name, or none', async () => {
    await assertFails(create('fake', { companyName: 'Trusted Company' }));
    await assertFails(create('blank', { companyName: '' }));
  });

  it('an edit cannot put another company\'s name on a product', async () => {
    await assertFails(edit('p1', { companyName: 'Trusted Company' }));
    // The same edit without the name change goes through.
    await assertSucceeds(edit('p1', { stockCount: 4 }));
  });

  it('after the company renamed itself, an edit that keeps the old name still works', async () => {
    await renameCompany('Company One');
    await assertSucceeds(edit('p1', { stockCount: 2 }));
  });

  it('the name can be brought up to the company\'s new name, and only that one', async () => {
    await renameCompany('Company One');
    await assertSucceeds(edit('p1', { companyName: 'Company One' }));
    await assertFails(edit('p1', { companyName: 'Company 1 (old)' }));
  });
});
