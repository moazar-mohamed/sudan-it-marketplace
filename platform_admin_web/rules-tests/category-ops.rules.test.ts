/*
 * The real dashboard operations for category trees (src/data/categoryOps.ts)
 * run against the Firestore emulator with the project's security rules, as
 * Platform Admin: create, move, repair, delete a subtree (with its products,
 * services and service links). Local only.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createCategory,
  deleteCategoryTree,
  moveCategory,
  repairCategoryChains,
  summarizeDeletion,
  type Progress,
} from '../src/data/categoryOps';
import { buildIndex, descendantIds, findChainMismatches, pathOf } from '../src/data/categoryTree';
import { mapCategory } from '../src/data/mappers';
import type { Category } from '../src/data/types';

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
const noWait = { sleep: async () => {} };

/** All categories as the dashboard sees them. */
async function load(db: Firestore = admin()): Promise<Category[]> {
  const snap = await getDocs(collection(db, 'categories'));
  return snap.docs.map((d) => mapCategory(d.id, d.data()));
}

/** Reads bypass the rules, so assertions see the stored truth (some collections cannot be listed). */
async function truth<T>(read: (db: Firestore) => Promise<T>): Promise<T> {
  let result!: T;
  await env.withSecurityRulesDisabled(async (ctx) => {
    result = await read(ctx.firestore());
  });
  return result;
}

const exists = (path: string, id: string) =>
  truth(async (db) => (await getDoc(doc(db, path, id))).exists());

const ids = (name: string) =>
  truth(async (db) => (await getDocs(collection(db, name))).docs.map((d) => d.id).sort());

/** Writes many documents with the rules bypassed (chunked). */
async function seed(entries: [string, string, Record<string, unknown>][]) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (let i = 0; i < entries.length; i += 400) {
      const batch = writeBatch(db);
      for (const [c, id, data] of entries.slice(i, i + 400)) batch.set(doc(db, c, id), data);
      await batch.commit();
    }
  });
}

const catDoc = (
  id: string,
  parent?: { id: string; ancestorIds: string[] },
  extra: Record<string, unknown> = {},
): [string, string, Record<string, unknown>] => [
  'categories',
  id,
  {
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
    createdAt: now,
    ...extra,
  },
];

const productDoc = (id: string, categoryId: string | null, companyId = 'c1'): [string, string, Record<string, unknown>] => [
  'products',
  id,
  {
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
    createdAt: now,
    updatedAt: now,
  },
];

const serviceDoc = (id: string, categoryId: string, ownerCompanyId?: string): [string, string, Record<string, unknown>] => [
  'services',
  id,
  { id, categoryId, name: `Service ${id}`, description: 'd', isActive: true, ...(ownerCompanyId ? { ownerCompanyId } : {}), createdAt: now },
];

const linkDoc = (id: string, serviceId: string, companyId: string): [string, string, Record<string, unknown>] => [
  'company_services',
  id,
  { id, companyId, serviceId, isActive: true, price: null, note: '', createdAt: now, updatedAt: now },
];

/** Builds a tree from `[id, parentId|null]` pairs (parents first); returns its seed entries. */
function treeDocs(edges: [string, string | null][], extra: Record<string, unknown> = {}) {
  const chains = new Map<string, string[]>();
  return edges.map(([id, parent]) => {
    const ancestors = parent ? [...(chains.get(parent) ?? []), parent] : [];
    chains.set(id, ancestors);
    return catDoc(id, parent ? { id: parent, ancestorIds: chains.get(parent)! } : undefined, extra);
  });
}

/** The users and companies every test starts with (the database is emptied first). */
async function seedBase() {
  await env.clearFirestore();
  const user = (id: string, role: string, extra: Record<string, unknown> = {}): [string, string, Record<string, unknown>] => [
    'users',
    id,
    { id, fullName: id, email: `${id}@x.test`, role, isActive: true, createdAt: now, ...extra },
  ];
  await seed([
    user('admin', 'platform_admin'),
    user('ca1', 'company_admin', { companyId: 'c1' }),
    user('ca2', 'company_admin', { companyId: 'c2' }),
    user('tech1', 'technician', { companyId: 'c1' }),
    user('cust1', 'customer'),
    ...['c1', 'c2'].map((id): [string, string, Record<string, unknown>] => [
      'companies',
      id,
      { name: id, status: 'active', rating: 0, reviewCount: 0, createdAt: now },
    ]),
  ]);
}
beforeEach(seedBase);

// ───────────────────────────────────────────────────────────────── creating

describe('creating categories with the dashboard operation', () => {
  const fields = (n: string) => ({ nameAr: `${n}-ar`, nameEn: n, description: '', iconName: '' });

  it('builds top-level and nested categories with correct parent, chain and order', async () => {
    let all = await load();
    const root = await createCategory(admin(), { ...fields('Networking'), parentId: null }, all);
    all = await load();
    const routers = await createCategory(admin(), { ...fields('Routers'), parentId: root }, all);
    all = await load();
    const switches = await createCategory(admin(), { ...fields('Switches'), parentId: root }, all);
    all = await load();
    const wifi = await createCategory(admin(), { ...fields('Wi-Fi 6'), parentId: routers }, all);
    all = await load();

    const byId = new Map(all.map((c) => [c.id, c]));
    expect(byId.get(root)).toMatchObject({ parentId: null, ancestorIds: [], name: 'Networking' });
    expect(byId.get(routers)).toMatchObject({ parentId: root, ancestorIds: [root], sortOrder: 0 });
    expect(byId.get(switches)).toMatchObject({ parentId: root, ancestorIds: [root], sortOrder: 1 });
    expect(byId.get(wifi)).toMatchObject({ parentId: routers, ancestorIds: [root, routers] });
    expect(findChainMismatches(all)).toEqual([]);
    expect(pathOf(buildIndex(all), wifi).map((c) => c.nameEn)).toEqual(['Networking', 'Routers', 'Wi-Fi 6']);
  });

  it('products and services share the one tree: a category can hold both', async () => {
    let all = await load();
    const root = await createCategory(admin(), { ...fields('Networking'), parentId: null }, all);
    all = await load();
    const kid = await createCategory(admin(), { ...fields('Installation'), parentId: root }, all);
    // the same name twice is two separate categories, both usable by both kinds
    const twin = await createCategory(admin(), { ...fields('Networking'), parentId: null }, await load());
    expect(twin).not.toBe(root);
    await seed([serviceDoc('s1', kid), productDoc('p1', kid)]);
    expect(await exists('services', 's1')).toBe(true);
    expect(await exists('products', 'p1')).toBe(true);
    // a marker of a separate tree is not accepted by the rules
    await assertFails(
      setDoc(doc(admin(), 'categories', 'forced'), {
        id: 'forced', name: 'x', type: 'service', parentId: null, ancestorIds: [], isActive: true,
        description: '', iconName: '', createdAt: new Date(),
      }),
    );
  });

  it('goes as deep as needed: 40 nested levels', async () => {
    let parent: string | null = null;
    for (let level = 0; level < 40; level++) {
      parent = await createCategory(admin(), { ...fields(`L${level}`), parentId: parent }, await load());
    }
    const all = await load();
    expect(all).toHaveLength(40);
    expect(findChainMismatches(all)).toEqual([]);
    expect(all.find((c) => c.id === parent)!.ancestorIds).toHaveLength(39);
  });

  it('a company cannot use the operation (the rules refuse it)', async () => {
    await expect(
      createCategory(as('ca1'), { ...fields('Mine'), parentId: null }, []),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(await load()).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────── moving

describe('moving categories', () => {
  /** r > a > (a1 > a1a > a1b, a2), r > b ; z. All product categories. */
  const shape: [string, string | null][] = [
    ['r', null], ['a', 'r'], ['b', 'r'], ['a1', 'a'], ['a2', 'a'], ['a1a', 'a1'], ['a1b', 'a1'], ['z', null],
  ];
  beforeEach(async () => {
    await seed(treeDocs(shape));
  });

  it('moves a subtree under another parent and rewrites every chain', async () => {
    await moveCategory(admin(), await load(), 'a', 'z');
    const all = await load();
    const byId = new Map(all.map((c) => [c.id, c]));
    expect(byId.get('a')).toMatchObject({ parentId: 'z', ancestorIds: ['z'] });
    expect(byId.get('a1')!.ancestorIds).toEqual(['z', 'a']);
    expect(byId.get('a1a')!.ancestorIds).toEqual(['z', 'a', 'a1']);
    expect(byId.get('a2')!.ancestorIds).toEqual(['z', 'a']);
    expect(byId.get('b')!.ancestorIds).toEqual(['r']); // untouched
    expect(findChainMismatches(all)).toEqual([]);
    expect(descendantIds(buildIndex(all), 'z').sort()).toEqual(['a', 'a1', 'a1a', 'a1b', 'a2']);
  });

  it('moves to the top level and appears last among the top-level categories', async () => {
    await moveCategory(admin(), await load(), 'a1', null);
    const all = await load();
    const a1 = all.find((c) => c.id === 'a1')!;
    expect(a1).toMatchObject({ parentId: null, ancestorIds: [] });
    expect(all.find((c) => c.id === 'a1a')!.ancestorIds).toEqual(['a1']);
    expect(a1.sortOrder).toBeGreaterThanOrEqual(2);
    expect(findChainMismatches(all)).toEqual([]);
  });

  it('refuses a move under itself or under one of its own descendants (no cycle)', async () => {
    const all = await load();
    await expect(moveCategory(admin(), all, 'a', 'a')).rejects.toMatchObject({ code: 'invalid-move', detail: 'self' });
    await expect(moveCategory(admin(), all, 'a', 'a1a')).rejects.toMatchObject({ detail: 'descendant' });
    await expect(moveCategory(admin(), all, 'r', 'a2')).rejects.toMatchObject({ detail: 'descendant' });
    await expect(moveCategory(admin(), all, 'a', 'r')).rejects.toMatchObject({ detail: 'same' });
    expect(findChainMismatches(await load())).toEqual([]);
  });

  it('a wide, deep subtree is moved in several batches without hitting the rule lookup limit', async () => {
    // wide: 25 parents, each with 2 children, all below one root (76 categories)
    const edges: [string, string | null][] = [['w', null]];
    for (let i = 0; i < 25; i++) {
      edges.push([`w${i}`, 'w']);
      edges.push([`w${i}x`, `w${i}`], [`w${i}y`, `w${i}`]);
    }
    await seed(treeDocs(edges));
    const progress: Progress[] = [];
    await moveCategory(admin(), await load(), 'w', 'z', { onProgress: (p) => progress.push(p) });
    const all = await load();
    expect(findChainMismatches(all)).toEqual([]);
    expect(all.find((c) => c.id === 'w9y')!.ancestorIds).toEqual(['z', 'w', 'w9']);
    expect(progress.filter((p) => p.phase === 'chains').length).toBeGreaterThan(1); // more than one batch
  });

  it('a move that stops half-way is detected, blocks further moves, and is finished by a repair', async () => {
    const edges: [string, string | null][] = [['big', null]];
    for (let i = 0; i < 20; i++) edges.push([`m${i}`, 'big'], [`m${i}c`, `m${i}`]);
    await seed([...treeDocs(edges), ...treeDocs([['z', null]])]);
    const before = await load();
    // one of the last descendants vanishes between reading the tree and writing it
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(ctx.firestore(), 'categories', 'm9c')); // sorts last, so it is in the last batch
    });
    await expect(moveCategory(admin(), before, 'big', 'z', noWait)).rejects.toThrow();

    const half = await load();
    expect(half.find((c) => c.id === 'big')).toMatchObject({ parentId: 'z' }); // the first part was written
    expect(findChainMismatches(half).length).toBeGreaterThan(0); // and the rest is flagged
    await expect(moveCategory(admin(), half, 'z', null)).rejects.toMatchObject({ code: 'incomplete' });

    const fixed = await repairCategoryChains(admin(), half);
    expect(fixed).toBeGreaterThan(0);
    const after = await load();
    expect(findChainMismatches(after)).toEqual([]);
    expect(after.find((c) => c.id === 'm5c')!.ancestorIds).toEqual(['z', 'big', 'm5']);
    expect(await repairCategoryChains(admin(), after)).toBe(0); // running it again changes nothing
  });
});

// ─────────────────────────────────────────────────────────────────── deleting

describe('deleting a category tree', () => {
  /** Product tree R > A > (A1 > A1a > A1a1, A2), R > B; an untouched root Q > Q1. */
  const productTree: [string, string | null][] = [
    ['R', null], ['A', 'R'], ['B', 'R'], ['A1', 'A'], ['A2', 'A'], ['A1a', 'A1'], ['A1a1', 'A1a'],
    ['Q', null], ['Q1', 'Q'],
  ];
  /** Service tree S > SK > SG, and an untouched service root T. */
  const serviceTree: [string, string | null][] = [['S', null], ['SK', 'S'], ['SG', 'SK'], ['T', null]];

  const untouched = async () => {
    expect(await ids('companies')).toEqual(['c1', 'c2']);
    expect(await ids('users')).toEqual(['admin', 'ca1', 'ca2', 'cust1', 'tech1']);
    expect(await ids('orders')).toEqual(['o1', 'o2']);
    expect(await ids('order_receipts')).toEqual(['o1', 'o2']);
    expect(await ids('service_requests')).toEqual(['sr1']);
  };

  beforeEach(async () => {
    await seed([
      ...treeDocs(productTree),
      ...treeDocs(serviceTree),
      // products: in the doomed tree (two companies), outside it, and uncategorised
      productDoc('pR', 'R'),
      productDoc('pA', 'A', 'c2'),
      productDoc('pA1a1', 'A1a1'),
      productDoc('pA1a1b', 'A1a1', 'c2'),
      productDoc('pB', 'B'),
      productDoc('pQ', 'Q'),
      productDoc('pQ1', 'Q1', 'c2'),
      productDoc('pNone', null),
      // services and offers
      serviceDoc('sSK', 'SK', 'c1'),
      serviceDoc('sSG', 'SG'),
      serviceDoc('sT', 'T'),
      linkDoc('lSK1', 'sSK', 'c1'),
      linkDoc('lSK2', 'sSK', 'c2'),
      linkDoc('lSG', 'sSG', 'c2'),
      linkDoc('lT', 'sT', 'c1'),
      // history that must survive any deletion
      ['orders', 'o1', { id: 'o1', customerId: 'cust1', companyId: 'c1', productId: 'pA1a1', productName: 'Product pA1a1', paymentStatus: 'confirmed' }],
      ['orders', 'o2', { id: 'o2', customerId: 'cust1', companyId: 'c2', productId: 'pB', productName: 'Product pB', paymentStatus: 'pending_verification' }],
      ['order_receipts', 'o1', { orderId: 'o1', customerId: 'cust1', companyId: 'c1', fileName: 'r.jpg' }],
      ['order_receipts', 'o2', { orderId: 'o2', customerId: 'cust1', companyId: 'c2', fileName: 'r.jpg' }],
      ['service_requests', 'sr1', { id: 'sr1', customerId: 'cust1', companyId: 'c1', serviceId: 'sSK', serviceName: 'Service sSK', status: 'completed' }],
    ]);
  });

  it('shows what will be deleted before deleting anything', async () => {
    expect(await summarizeDeletion(admin(), await load(), 'A')).toEqual({
      categories: 5, products: 3, services: 0, serviceLinks: 0,
    });
    expect(await summarizeDeletion(admin(), await load(), 'SK')).toEqual({
      categories: 2, products: 0, services: 2, serviceLinks: 3,
    });
    expect(await summarizeDeletion(admin(), await load(), 'B')).toEqual({
      categories: 1, products: 1, services: 0, serviceLinks: 0,
    });
    expect(await ids('products')).toHaveLength(8); // summaries delete nothing
  });

  it('deletes a deep product subtree with its products, and nothing outside it', async () => {
    const summary = await summarizeDeletion(admin(), await load(), 'A');
    const result = await deleteCategoryTree(admin(), await load(), 'A');

    expect(result).toEqual(summary); // exactly what the confirmation said
    expect(await ids('categories')).toEqual(['B', 'Q', 'Q1', 'R', 'S', 'SG', 'SK', 'T']);
    expect(await ids('products')).toEqual(['pB', 'pNone', 'pQ', 'pQ1', 'pR']);
    // the other tree, its services and offers are unaffected
    expect(await ids('services')).toEqual(['sSG', 'sSK', 'sT']);
    expect(await ids('company_services')).toEqual(['lSG', 'lSK1', 'lSK2', 'lT']);
    await untouched();
    // the remaining tree is still consistent
    expect(findChainMismatches(await load())).toEqual([]);
  });

  it('deleting a top-level category deletes every level below it', async () => {
    await deleteCategoryTree(admin(), await load(), 'R');
    expect(await ids('categories')).toEqual(['Q', 'Q1', 'S', 'SG', 'SK', 'T']);
    expect(await ids('products')).toEqual(['pNone', 'pQ', 'pQ1']);
    await untouched();
  });

  it('deleting a service category deletes its services and their company offers only', async () => {
    const result = await deleteCategoryTree(admin(), await load(), 'SK');
    expect(result).toMatchObject({ categories: 2, services: 2, serviceLinks: 3, products: 0 });
    expect(await ids('services')).toEqual(['sT']);
    expect(await ids('company_services')).toEqual(['lT']);
    expect(await ids('categories')).toEqual(['A', 'A1', 'A1a', 'A1a1', 'A2', 'B', 'Q', 'Q1', 'R', 'S', 'T']);
    expect(await ids('products')).toHaveLength(8); // products are never touched by a service category
    await untouched();
  });

  it('a leaf category with nothing in it is deleted alone', async () => {
    await deleteCategoryTree(admin(), await load(), 'A2');
    expect((await ids('categories'))).not.toContain('A2');
    expect(await ids('products')).toHaveLength(8);
  });

  it('orders keep their own copy of the product, so history is unaffected by deleted products', async () => {
    await deleteCategoryTree(admin(), await load(), 'A');
    expect(await exists('products', 'pA1a1')).toBe(false);
    const order = (await truth((db) => getDoc(doc(db, 'orders', 'o1')))).data()!;
    expect(order).toMatchObject({ productId: 'pA1a1', productName: 'Product pA1a1', paymentStatus: 'confirmed' });
    expect(await exists('order_receipts', 'o1')).toBe(true);
  });

  it('a failure part-way leaves a consistent state and running it again finishes the job', async () => {
    const all = await load();
    let calls = 0;
    await expect(
      deleteCategoryTree(admin(), all, 'R', {
        onProgress: (p) => {
          if (p.phase === 'products' && ++calls === 1) throw new Error('network dropped');
        },
      }),
    ).rejects.toThrow('network dropped');

    // Everything of the tree is marked, nothing new can be attached, and the root is still there.
    const half = await load();
    const marked = half.filter((c) => ['R', 'A', 'B', 'A1', 'A2', 'A1a', 'A1a1'].includes(c.id));
    expect(marked.every((c) => c.deletionPending && !c.isActive)).toBe(true);
    expect(half.find((c) => c.id === 'R')).toBeDefined();
    expect(half.find((c) => c.id === 'Q')!.deletionPending).toBe(false);

    const result = await deleteCategoryTree(admin(), half, 'R');
    expect(result.categories).toBe(7);
    expect(await ids('categories')).toEqual(['Q', 'Q1', 'S', 'SG', 'SK', 'T']);
    expect(await ids('products')).toEqual(['pNone', 'pQ', 'pQ1']);
    await untouched();
  });

  it('a company cannot attach a product to a category once its deletion has started', async () => {
    await expect(
      deleteCategoryTree(admin(), await load(), 'R', {
        onProgress: (p) => {
          if (p.phase === 'mark') throw new Error('stop after marking');
        },
      }),
    ).rejects.toThrow();
    const late = productDoc('late', 'A1a')[2];
    await assertFails(
      setDoc(doc(as('ca1'), 'products', 'late'), { ...late, createdAt: new Date(), updatedAt: new Date() }),
    );
  });

  it('only Platform Admin can run it: a company gets refused and nothing changes', async () => {
    await expect(deleteCategoryTree(as('ca1'), await load(as('ca1')), 'A')).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(await ids('products')).toHaveLength(8);
    expect((await load()).filter((c) => c.deletionPending)).toEqual([]);
  });

  it('refuses a category that no longer exists', async () => {
    await expect(deleteCategoryTree(admin(), await load(), 'ghost')).rejects.toMatchObject({ code: 'missing' });
  });

  it('deletes an older category (no parent fields) with its products AND services', async () => {
    await seed([
      ['categories', 'old', { id: 'old', name: 'Old', description: '', iconName: '', isActive: true, createdAt: now }],
      productDoc('oldP', 'old'),
      serviceDoc('oldS', 'old'),
      productDoc('keepP', null),
    ]);
    const result = await deleteCategoryTree(admin(), await load(), 'old');
    expect(result).toMatchObject({ categories: 1, products: 1, services: 1 });
    expect(await exists('categories', 'old')).toBe(false);
    expect(await exists('products', 'oldP')).toBe(false);
    expect(await exists('services', 'oldS')).toBe(false);
    expect(await exists('products', 'keepP')).toBe(true);
  });

  it('a large tree: 850 products in one category and 45 categories with products, in many batches', async () => {
    const edges: [string, string | null][] = [['BIG', null]];
    for (let i = 0; i < 45; i++) edges.push([`BIG${i}`, 'BIG']);
    const entries = [
      ...treeDocs(edges),
      ...Array.from({ length: 850 }, (_, i) => productDoc(`bulk${i}`, 'BIG', i % 2 ? 'c1' : 'c2')),
      ...Array.from({ length: 45 * 3 }, (_, i) => productDoc(`spread${i}`, `BIG${i % 45}`)),
    ];
    await seed(entries);
    const progress: Progress[] = [];
    const before = (await ids('products')).length;
    const result = await deleteCategoryTree(admin(), await load(), 'BIG', { onProgress: (p) => progress.push(p) });
    expect(result).toMatchObject({ categories: 46, products: 850 + 135 });
    expect((await ids('products')).length).toBe(before - 985);
    expect(progress.filter((p) => p.phase === 'products').length).toBeGreaterThan(3); // several batches
    expect(await exists('categories', 'BIG')).toBe(false);
    await untouched();
  });
});
