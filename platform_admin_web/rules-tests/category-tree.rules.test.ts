/*
 * Category trees: two independent trees (products, services) of unlimited depth
 * in the `categories` collection. These are the security rules for them; the
 * dashboard operations built on top are in category-ops.rules.test.ts.
 * Local emulator only (npm run test:rules); every user is a fake identity.
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
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
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
const admin = () => as('admin');

/** A valid category document; `parent` is the parent's own document data. */
function category(
  id: string,
  parent?: { id: string; ancestorIds: string[] },
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    name: id,
    nameAr: `${id}-ar`,
    nameEn: `${id}-en`,
    parentId: parent ? parent.id : null,
    ancestorIds: parent ? [...parent.ancestorIds, parent.id] : [],
    sortOrder: 0,
    description: '',
    iconName: '',
    isActive: true,
    ...extra,
  };
}

const create = (db: ReturnType<typeof as>, data: Record<string, unknown>) =>
  setDoc(doc(db, 'categories', data.id as string), { ...data, createdAt: serverTimestamp() });

/** Seeds categories (rules bypassed) as `{data, createdAt: now}`. */
async function seedCategories(...docs: Record<string, unknown>[]) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const d of docs) await setDoc(doc(ctx.firestore(), 'categories', d.id as string), { ...d, createdAt: now });
  });
}

const productData = (id: string, categoryId: string | null, companyId = 'c1') => ({
  id,
  companyId,
  companyName: companyId,
  ...(categoryId ? { categoryId } : {}),
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
});

const serviceData = (id: string, categoryId: string, extra: Record<string, unknown> = {}) => ({
  id,
  categoryId,
  name: `Service ${id}`,
  description: 'd',
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
    await user('tech1', 'technician', { companyId: 'c1' });
    await user('cust1', 'customer');
    for (const id of ['c1', 'c2']) {
      await setDoc(doc(db, 'companies', id), { name: id, status: 'active', rating: 0, reviewCount: 0, createdAt: now });
    }
  });
});

describe('building trees of any depth', () => {
  it('Platform Admin creates top-level and nested categories, several under one parent', async () => {
    await assertSucceeds(create(admin(), category('p-root')));
    await assertSucceeds(create(admin(), category('p-kid', { id: 'p-root', ancestorIds: [] })));
    await assertSucceeds(create(admin(), category('p-grand', { id: 'p-kid', ancestorIds: ['p-root'] })));
    await assertSucceeds(create(admin(), category('s-root')));
    await assertSucceeds(create(admin(), category('s-kid', { id: 's-root', ancestorIds: [] })));
    // several children under one parent
    await assertSucceeds(create(admin(), category('p-kid2', { id: 'p-root', ancestorIds: [] })));
  });

  it('there is no fixed depth: a chain of 60 levels is accepted level by level', async () => {
    let parent: { id: string; ancestorIds: string[] } | undefined;
    for (let level = 0; level < 60; level++) {
      const data = category(`deep-${level}`, parent);
      await assertSucceeds(create(admin(), data));
      parent = { id: data.id, ancestorIds: data.ancestorIds };
    }
    const last = (await getDoc(doc(admin(), 'categories', 'deep-59'))).data()!;
    expect(last.ancestorIds).toHaveLength(59);
  });

  it('a new category must be active and start not awaiting deletion', async () => {
    await assertFails(create(admin(), category('x1', undefined, { isActive: false })));
    await assertFails(create(admin(), category('x2', undefined, { deletionPending: true })));
  });

  it('there is no separate product and service tree: a tree marker is not a category field', async () => {
    await assertFails(create(admin(), category('x3', undefined, { type: 'product' })));
  });

  it('the stored ancestor chain must be exactly the parent chain plus the parent', async () => {
    await seedCategories(category('a'), category('b', { id: 'a', ancestorIds: [] }));
    // chain omits an ancestor, adds a stranger, or is in the wrong order
    await assertFails(create(admin(), category('c1x', { id: 'b', ancestorIds: [] })));
    await assertFails(create(admin(), { ...category('c2x', { id: 'b', ancestorIds: ['a'] }), ancestorIds: ['zzz', 'b'] }));
    await assertFails(create(admin(), { ...category('c3x', { id: 'b', ancestorIds: ['a'] }), ancestorIds: ['b', 'a'] }));
    await assertFails(create(admin(), { ...category('c4x'), ancestorIds: ['a'] })); // top level with a chain
    await assertSucceeds(create(admin(), category('c5x', { id: 'b', ancestorIds: ['a'] })));
  });

  it('a parent must exist and not be the category itself', async () => {
    await seedCategories(category('p'));
    await assertFails(create(admin(), category('n1', { id: 'ghost', ancestorIds: [] })));
    await assertSucceeds(create(admin(), category('n3', { id: 'p', ancestorIds: [] })));
    await assertFails(create(admin(), { ...category('n4'), parentId: 'n4', ancestorIds: ['n4'] }));
  });

  it('a category cannot go under a parent that is awaiting deletion', async () => {
    await seedCategories(category('gone', undefined, { deletionPending: true, isActive: false }));
    await assertFails(create(admin(), category('n5', { id: 'gone', ancestorIds: [] })));
  });

  it('names, icon, description and position are still validated', async () => {
    await assertFails(create(admin(), category('v1', undefined, { nameAr: 5 })));
    await assertFails(create(admin(), category('v2', undefined, { name: '' })));
    await assertFails(create(admin(), category('v3', undefined, { sortOrder: -1 })));
    await assertFails(create(admin(), category('v4', undefined, { extra: 1 })));
  });
});

describe('editing and moving', () => {
  beforeEach(async () => {
    // a > b > c > d, and an unrelated root z
    await seedCategories(
      category('a'),
      category('b', { id: 'a', ancestorIds: [] }),
      category('c', { id: 'b', ancestorIds: ['a'] }),
      category('d', { id: 'c', ancestorIds: ['a', 'b'] }),
      category('z'),
    );
  });

  it('renaming, deactivating and reordering need no tree change', async () => {
    await assertSucceeds(updateDoc(doc(admin(), 'categories', 'c'), { nameAr: 'جديد', nameEn: 'New', name: 'New' }));
    await assertSucceeds(updateDoc(doc(admin(), 'categories', 'c'), { isActive: false }));
    await assertSucceeds(updateDoc(doc(admin(), 'categories', 'c'), { sortOrder: 4 }));
  });

  it('a category can be moved to another parent when its whole chain is rewritten with it', async () => {
    const db = admin();
    const batch = writeBatch(db);
    batch.update(doc(db, 'categories', 'b'), { parentId: 'z', ancestorIds: ['z'] });
    batch.update(doc(db, 'categories', 'c'), { ancestorIds: ['z', 'b'] });
    batch.update(doc(db, 'categories', 'd'), { ancestorIds: ['z', 'b', 'c'] });
    await assertSucceeds(batch.commit());
  });

  it('a category can be moved to the top level', async () => {
    await assertSucceeds(updateDoc(doc(admin(), 'categories', 'b'), { parentId: null, ancestorIds: [] }));
  });

  it('a move whose chain does not match the new parent is refused', async () => {
    await assertFails(updateDoc(doc(admin(), 'categories', 'b'), { parentId: 'z', ancestorIds: [] }));
    await assertFails(updateDoc(doc(admin(), 'categories', 'b'), { parentId: 'z', ancestorIds: ['a', 'z'] }));
  });

  it('a category can never become its own parent', async () => {
    await assertFails(updateDoc(doc(admin(), 'categories', 'b'), { parentId: 'b', ancestorIds: ['a', 'b'] }));
  });

  it('a category can never be moved under one of its own descendants (no cycles)', async () => {
    // b under d (d's chain is [a, b, c], which contains b)
    await assertFails(updateDoc(doc(admin(), 'categories', 'b'), { parentId: 'd', ancestorIds: ['a', 'b', 'c', 'd'] }));
    // a under c
    await assertFails(updateDoc(doc(admin(), 'categories', 'a'), { parentId: 'c', ancestorIds: ['a', 'b', 'c'] }));
    // even when the descendants are rewritten in the same batch
    const db = admin();
    const batch = writeBatch(db);
    batch.update(doc(db, 'categories', 'a'), { parentId: 'd', ancestorIds: ['a', 'b', 'c', 'd'] });
    batch.update(doc(db, 'categories', 'b'), { ancestorIds: ['a', 'b', 'c', 'd', 'a'] });
    await assertFails(batch.commit());
  });

  it('cannot be moved under a category that is awaiting deletion', async () => {
    await seedCategories(category('dying', undefined, { deletionPending: true, isActive: false }));
    await assertFails(updateDoc(doc(admin(), 'categories', 'b'), { parentId: 'dying', ancestorIds: ['dying'] }));
  });

  it('moving under a category that does not exist is refused', async () => {
    await assertFails(updateDoc(doc(admin(), 'categories', 'b'), { parentId: 'ghost', ancestorIds: ['ghost'] }));
  });
});

describe('older categories (no parent fields yet)', () => {
  beforeEach(async () => {
    await seedCategories({ id: 'old', name: 'Old', description: '', iconName: '', isActive: true });
  });

  it('stay readable and editable, exactly as before', async () => {
    await assertSucceeds(getDoc(doc(as('ca1'), 'categories', 'old')));
    await assertSucceeds(updateDoc(doc(admin(), 'categories', 'old'), { nameEn: 'Old' }));
  });

  it('can be a parent (it is a top-level category with an empty chain)', async () => {
    await assertSucceeds(create(admin(), category('kid', { id: 'old', ancestorIds: [] })));
  });
});

describe('who may change categories', () => {
  beforeEach(async () => {
    await seedCategories(category('k'), category('s'));
  });

  it('a company admin, technician, customer and anonymous user cannot create, edit or delete', async () => {
    const anon = env.unauthenticatedContext().firestore();
    for (const db of [as('ca1'), as('tech1'), as('cust1'), anon]) {
      await assertFails(create(db, category('mine')));
      await assertFails(updateDoc(doc(db, 'categories', 'k'), { isActive: false }));
      await assertFails(updateDoc(doc(db, 'categories', 'k'), { deletionPending: true }));
      await assertFails(deleteDoc(doc(db, 'categories', 'k')));
    }
  });

  it('every signed-in user can read categories (so company forms always show the current trees)', async () => {
    for (const uid of ['ca1', 'ca2', 'tech1', 'cust1', 'admin']) {
      await assertSucceeds(getDoc(doc(as(uid), 'categories', 'k')));
    }
  });

  it('an admin can delete only a category that is marked for deletion', async () => {
    await assertFails(deleteDoc(doc(admin(), 'categories', 'k')));
    await assertSucceeds(updateDoc(doc(admin(), 'categories', 'k'), { deletionPending: true, isActive: false }));
    await assertSucceeds(deleteDoc(doc(admin(), 'categories', 'k')));
    await assertFails(deleteDoc(doc(as('ca1'), 'categories', 's')));
  });
});

describe('products can use any active category', () => {
  beforeEach(async () => {
    await seedCategories(
      category('pcat'),
      category('pkid', { id: 'pcat', ancestorIds: [] }),
      category('scat'),
      category('pinactive', undefined, { isActive: false }),
      category('ppending', undefined, { deletionPending: true, isActive: false }),
      { id: 'old', name: 'Old', description: '', iconName: '', isActive: true },
    );
  });

  const add = (id: string, categoryId: string | null) =>
    setDoc(doc(as('ca1'), 'products', id), {
      ...productData(id, categoryId),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

  it('a company files a product in any active category, at any level', async () => {
    await assertSucceeds(add('p1', 'pcat'));
    await assertSucceeds(add('p2', 'pkid'));
    await assertSucceeds(add('p3', null));
  });

  it('never in an inactive one, one awaiting deletion, or one that does not exist', async () => {
    await assertSucceeds(add('q1', 'scat')); // the same tree serves services
    await assertFails(add('q2', 'pinactive'));
    await assertFails(add('q3', 'ppending'));
    await assertFails(add('q4', 'ghost'));
  });

  it('an older category is accepted like any other', async () => {
    await assertSucceeds(add('q5', 'old'));
  });

  it('moving an existing product to another category follows the same rules', async () => {
    await assertSucceeds(add('p1', 'pcat'));
    const patch = (categoryId: string) =>
      updateDoc(doc(as('ca1'), 'products', 'p1'), { categoryId, updatedAt: serverTimestamp() });
    await assertSucceeds(patch('pkid'));
    await assertFails(patch('ppending'));
  });

  it('another company cannot file a product for this company', async () => {
    await assertFails(
      setDoc(doc(as('ca2'), 'products', 'x'), {
        ...productData('x', 'pcat', 'c1'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('services can use any active category', () => {
  beforeEach(async () => {
    await seedCategories(
      category('scat'),
      category('skid', { id: 'scat', ancestorIds: [] }),
      category('pcat'),
      category('spending', undefined, { deletionPending: true, isActive: false }),
    );
  });

  const own = (id: string, categoryId: string) =>
    setDoc(doc(as('ca1'), 'services', id), {
      ...serviceData(id, categoryId, { ownerCompanyId: 'c1' }),
      createdAt: serverTimestamp(),
    });

  it('a company creates its own service in any active category, at any level', async () => {
    await assertSucceeds(own('s1', 'scat'));
    await assertSucceeds(own('s2', 'skid'));
  });

  it('never in one awaiting deletion, or one that does not exist', async () => {
    await assertSucceeds(own('t1', 'pcat')); // the same tree serves products
    await assertFails(own('t2', 'spending'));
    await assertFails(own('t3', 'ghost'));
  });

  it('Platform Admin creates and moves catalogue services among existing categories', async () => {
    await assertSucceeds(
      setDoc(doc(admin(), 'services', 'cat1'), { ...serviceData('cat1', 'scat'), createdAt: serverTimestamp() }),
    );
    await assertSucceeds(
      setDoc(doc(admin(), 'services', 'cat2'), { ...serviceData('cat2', 'pcat'), createdAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(admin(), 'services', 'cat3'), { ...serviceData('cat3', 'ghost'), createdAt: serverTimestamp() }),
    );
    await assertSucceeds(updateDoc(doc(admin(), 'services', 'cat1'), { categoryId: 'skid' }));
    await assertFails(updateDoc(doc(admin(), 'services', 'cat1'), { categoryId: 'ghost' }));
  });

  it('a company can move its service to another active category, but not to one being deleted', async () => {
    await assertSucceeds(own('s1', 'scat'));
    await assertSucceeds(updateDoc(doc(as('ca1'), 'services', 's1'), { categoryId: 'skid' }));
    await assertFails(updateDoc(doc(as('ca1'), 'services', 's1'), { categoryId: 'spending' }));
  });
});

describe('deleting the contents of a category (only once it is marked for deletion)', () => {
  beforeEach(async () => {
    await seedCategories(
      category('live'),
      category('dying', undefined, { deletionPending: true, isActive: false }),
      category('slive'),
      category('sdying', undefined, { deletionPending: true, isActive: false }),
    );
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const p = (id: string, categoryId: string | null, companyId = 'c1') =>
        setDoc(doc(db, 'products', id), { ...productData(id, categoryId, companyId), createdAt: now, updatedAt: now });
      await p('p-live', 'live');
      await p('p-dying', 'dying');
      await p('p-dying-c2', 'dying', 'c2');
      await p('p-none', null);
      await p('p-orphan', 'vanished'); // points at a category that no longer exists
      await setDoc(doc(db, 'services', 's-live'), { ...serviceData('s-live', 'slive'), createdAt: now });
      await setDoc(doc(db, 'services', 's-dying'), {
        ...serviceData('s-dying', 'sdying', { ownerCompanyId: 'c1' }),
        createdAt: now,
      });
      const link = (id: string, serviceId: string, companyId = 'c1') =>
        setDoc(doc(db, 'company_services', id), {
          id,
          companyId,
          serviceId,
          isActive: true,
          price: null,
          note: '',
          createdAt: now,
          updatedAt: now,
        });
      await link('l-live', 's-live');
      await link('l-dying', 's-dying');
      await link('l-dying-c2', 's-dying', 'c2');
      await link('l-ghost', 'ghost-service');
    });
  });

  it('Platform Admin deletes a product only while its category is awaiting deletion', async () => {
    await assertFails(deleteDoc(doc(admin(), 'products', 'p-live')));
    await assertFails(deleteDoc(doc(admin(), 'products', 'p-none')));
    await assertSucceeds(deleteDoc(doc(admin(), 'products', 'p-dying')));
    await assertSucceeds(deleteDoc(doc(admin(), 'products', 'p-dying-c2')));
    await assertFails(deleteDoc(doc(admin(), 'products', 'p-orphan'))); // category missing: not this path
  });

  it('nobody but Platform Admin (and the owning company for its own product) can delete them', async () => {
    await assertFails(deleteDoc(doc(as('ca2'), 'products', 'p-dying'))); // another company
    await assertFails(deleteDoc(doc(as('cust1'), 'products', 'p-dying')));
    await assertFails(deleteDoc(doc(as('tech1'), 'products', 'p-dying')));
    await assertSucceeds(deleteDoc(doc(as('ca1'), 'products', 'p-dying'))); // unchanged existing right
  });

  it('a service is deleted only while its category is awaiting deletion', async () => {
    await assertFails(deleteDoc(doc(admin(), 'services', 's-live')));
    await assertFails(deleteDoc(doc(as('ca1'), 'services', 's-dying'))); // not even the owning company
    await assertSucceeds(deleteDoc(doc(admin(), 'services', 's-dying')));
  });

  it('a company offer (link) goes only with a service in a category being deleted', async () => {
    await assertFails(deleteDoc(doc(admin(), 'company_services', 'l-live')));
    await assertSucceeds(deleteDoc(doc(admin(), 'company_services', 'l-dying')));
    await assertSucceeds(deleteDoc(doc(admin(), 'company_services', 'l-dying-c2')));
    await assertFails(deleteDoc(doc(admin(), 'company_services', 'l-ghost'))); // its service is not there
    await assertFails(deleteDoc(doc(as('ca1'), 'company_services', 'l-live')));
  });

  it('deleting them never lets Platform Admin touch a company, an order or a receipt', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'orders', 'o1'), { id: 'o1', customerId: 'cust1', companyId: 'c1' });
      await setDoc(doc(ctx.firestore(), 'order_receipts', 'o1'), { orderId: 'o1' });
    });
    await assertFails(deleteDoc(doc(admin(), 'companies', 'c1')));
    await assertFails(deleteDoc(doc(admin(), 'orders', 'o1')));
    await assertFails(deleteDoc(doc(admin(), 'order_receipts', 'o1')));
    await assertFails(deleteDoc(doc(admin(), 'users', 'ca1')));
  });

  it('once a category is marked, nothing new can be attached to it', async () => {
    await assertFails(
      setDoc(doc(as('ca1'), 'products', 'late'), {
        ...productData('late', 'dying'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(as('ca1'), 'services', 'late-s'), {
        ...serviceData('late-s', 'sdying', { ownerCompanyId: 'c1' }),
        createdAt: serverTimestamp(),
      }),
    );
  });
});
