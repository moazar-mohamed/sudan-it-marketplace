/*
 * Categories carry a name in each language (nameAr, nameEn) and a position
 * (sortOrder) that Platform Admin controls. All three are optional so older
 * categories stay valid. Only Platform Admin can write them. Local emulator
 * only (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
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
  name: 'Laptops',
  description: '',
  iconName: '',
  isActive: true,
  ...extra,
});

const create = (uid: string, id: string, extra: Record<string, unknown> = {}) =>
  setDoc(doc(as(uid), 'categories', id), {
    ...fields(id, extra),
    createdAt: serverTimestamp(),
  });

const edit = (uid: string, id: string, patch: Record<string, unknown>) =>
  updateDoc(doc(as(uid), 'categories', id), patch);

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
    await user('cust1', 'customer');
    // A category from before names had two languages.
    await setDoc(doc(db, 'categories', 'legacy'), { ...fields('legacy'), createdAt: now });
    await setDoc(doc(db, 'categories', 'k1'), {
      ...fields('k1', { nameAr: 'لابتوب', nameEn: 'Laptops', sortOrder: 0 }),
      createdAt: now,
    });
  });
});

describe('creating a category with names in both languages', () => {
  it('accepts an Arabic name, an English name and a position', async () => {
    await assertSucceeds(
      create('admin', 'new1', { nameAr: 'شبكات', nameEn: 'Networking', sortOrder: 3 }),
    );
  });

  it('accepts a category with only the single name (the two names stay optional)', async () => {
    await assertSucceeds(create('admin', 'new2'));
  });

  it('a new category carries no tree marker (products and services share one tree)', async () => {
    await assertSucceeds(
      setDoc(doc(as('admin'), 'categories', 'notype'), { ...fields('notype'), createdAt: serverTimestamp() }),
    );
    await assertFails(create('admin', 'badtype', { type: 'product' }));
  });

  it('rejects names that are not text or are too long', async () => {
    await assertFails(create('admin', 'bad1', { nameAr: 5 }));
    await assertFails(create('admin', 'bad2', { nameEn: 'x'.repeat(101) }));
    await assertFails(create('admin', 'bad3', { name: 'x'.repeat(101) }));
  });

  it('rejects a position that is not a whole number in range', async () => {
    await assertFails(create('admin', 'bad4', { sortOrder: 1.5 }));
    await assertFails(create('admin', 'bad5', { sortOrder: -1 }));
    await assertFails(create('admin', 'bad6', { sortOrder: '2' }));
    await assertFails(create('admin', 'bad7', { sortOrder: 100000 }));
  });

  it('rejects unknown fields', async () => {
    await assertFails(create('admin', 'bad8', { nameFr: 'Ordinateurs' }));
  });
});

describe('editing names and position', () => {
  it('Platform Admin can add the two names to an older category', async () => {
    await assertSucceeds(edit('admin', 'legacy', { nameAr: 'لابتوب', nameEn: 'Laptops' }));
  });

  it('Platform Admin can change the position, alone or in a batch', async () => {
    await assertSucceeds(edit('admin', 'k1', { sortOrder: 5 }));
    const db = as('admin');
    const batch = writeBatch(db);
    batch.update(doc(db, 'categories', 'k1'), { sortOrder: 1 });
    batch.update(doc(db, 'categories', 'legacy'), { sortOrder: 0 });
    await assertSucceeds(batch.commit());
  });

  it('rejects an invalid position or name on an existing category', async () => {
    await assertFails(edit('admin', 'k1', { sortOrder: -3 }));
    await assertFails(edit('admin', 'k1', { nameEn: 7 }));
  });

  it('a company admin and a customer cannot change names or position', async () => {
    await assertFails(edit('ca1', 'k1', { nameEn: 'Hijack' }));
    await assertFails(edit('ca1', 'k1', { sortOrder: 9 }));
    await assertFails(edit('cust1', 'k1', { nameAr: 'x' }));
    await assertFails(create('ca1', 'bad9', { nameEn: 'Mine', sortOrder: 0 }));
  });
});

describe('deleting a category', () => {
  const markForDeletion = (id: string) => edit('admin', id, { deletionPending: true, isActive: false });

  it('Platform Admin can delete one, older or new, once it is marked for deletion', async () => {
    await assertFails(deleteDoc(doc(as('admin'), 'categories', 'legacy'))); // not marked yet
    await assertSucceeds(markForDeletion('legacy'));
    await assertSucceeds(deleteDoc(doc(as('admin'), 'categories', 'legacy')));
    await assertSucceeds(markForDeletion('k1'));
    await assertSucceeds(deleteDoc(doc(as('admin'), 'categories', 'k1')));
  });

  it('a company admin and a customer cannot', async () => {
    await assertFails(deleteDoc(doc(as('ca1'), 'categories', 'k1')));
    await assertFails(deleteDoc(doc(as('cust1'), 'categories', 'k1')));
  });

  it('a product that still points at a deleted category can be edited, but not moved to it again', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'companies', 'c1'), {
        name: 'C1',
        status: 'active',
        rating: 0,
        reviewCount: 0,
        createdAt: now,
      });
      await setDoc(doc(ctx.firestore(), 'products', 'p1'), {
        id: 'p1',
        companyId: 'c1',
        companyName: 'C1',
        categoryId: 'k1',
        name: 'Router',
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
        createdAt: now,
        updatedAt: now,
      });
    });
    await assertSucceeds(markForDeletion('k1'));
    await assertSucceeds(deleteDoc(doc(as('admin'), 'categories', 'k1')));
    // Unchanged reference: the company can still edit stock, price and so on.
    await assertSucceeds(
      updateDoc(doc(as('ca1'), 'products', 'p1'), { stockCount: 9, updatedAt: serverTimestamp() }),
    );
    // Pointing it at a category that no longer exists is refused.
    await assertFails(
      updateDoc(doc(as('ca1'), 'products', 'p1'), { categoryId: 'legacy-gone', updatedAt: serverTimestamp() }),
    );
  });
});
