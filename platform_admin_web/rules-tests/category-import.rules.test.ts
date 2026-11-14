/*
 * The ready-made category tree imported with the real dashboard operation
 * (src/data/categoryImport.ts) against the Firestore emulator and the project's
 * security rules, as Platform Admin. Local only.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, writeBatch, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { importCategoryTree } from '../src/data/categoryImport';
import { buildIndex, findChainMismatches, childrenOf } from '../src/data/categoryTree';
import { DEFAULT_CATEGORY_TREE } from '../src/data/defaultCategoryTree';
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

const admin = () => env.authenticatedContext('admin').firestore();
const noWait = { sleep: async () => {} };

async function load(db: Firestore = admin()): Promise<Category[]> {
  const snap = await getDocs(collection(db, 'categories'));
  return snap.docs.map((d) => mapCategory(d.id, d.data()));
}

async function seed(entries: [string, string, Record<string, unknown>][]) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const batch = writeBatch(ctx.firestore());
    for (const [c, id, data] of entries) batch.set(doc(ctx.firestore(), c, id), data);
    await batch.commit();
  });
}

beforeEach(async () => {
  await env.clearFirestore();
  await seed([['users', 'admin', { id: 'admin', fullName: 'admin', email: 'admin@x.test', role: 'platform_admin', isActive: true, createdAt: now }]]);
});

const options = { trashOthers: false, ...noWait };

describe('importing the ready-made tree under the security rules', () => {
  it('creates all 54 categories with correct parents, chains, order, icons and colours', async () => {
    const result = await importCategoryTree(admin(), [], DEFAULT_CATEGORY_TREE, options);
    expect(result).toEqual({ created: 54, existing: 0, trashed: 0 });

    const all = await load();
    expect(all).toHaveLength(54);
    expect(findChainMismatches(all)).toEqual([]);
    const index = buildIndex(all);
    const top = childrenOf(index, null);
    expect(top.map((c) => c.nameAr)).toEqual(DEFAULT_CATEGORY_TREE.map((t) => t.ar));
    expect(top.every((c) => c.isActive && c.ancestorIds.length === 0)).toBe(true);

    const networks = top.find((c) => c.nameEn === 'Networks & Infrastructure')!;
    expect(networks.iconName).toBe('network');
    expect(networks.color).toBe('sky');
    const subs = childrenOf(index, networks.id);
    expect(subs.map((c) => c.nameEn)).toEqual(['Routers & Switches', 'Wireless', 'Cabling', 'Firewalls']);
    expect(subs.every((c) => c.ancestorIds.join() === networks.id && c.isActive)).toBe(true);
    // The same sub-category name under two parents is two categories.
    expect(all.filter((c) => c.nameEn === 'Firewalls')).toHaveLength(2);
  });

  it('can be run again: it adds nothing and keeps what exists', async () => {
    await importCategoryTree(admin(), [], DEFAULT_CATEGORY_TREE, options);
    const result = await importCategoryTree(admin(), await load(), DEFAULT_CATEGORY_TREE, options);
    expect(result).toEqual({ created: 0, existing: 54, trashed: 0 });
    expect(await load()).toHaveLength(54);
  });

  it('finishes what stopped part-way', async () => {
    // Only the first main category with two of its sub-categories exist.
    const first = DEFAULT_CATEGORY_TREE[0];
    const partial = {
      ...first,
      children: first.children!.slice(0, 2),
    };
    await importCategoryTree(admin(), [], [partial], options);
    expect(await load()).toHaveLength(3);
    const result = await importCategoryTree(admin(), await load(), DEFAULT_CATEGORY_TREE, options);
    expect(result.existing).toBe(3);
    expect(result.created).toBe(51);
    const all = await load();
    expect(all).toHaveLength(54);
    expect(findChainMismatches(all)).toEqual([]);
  });

  it('sends the other main categories to the trash, with their children, and keeps what is filed in them', async () => {
    await seed([
      ['categories', 'old', { id: 'old', name: 'Printers', nameAr: 'الطابعات والمستلزمات', nameEn: '', parentId: null, ancestorIds: [], sortOrder: 0, description: '', iconName: '', isActive: true, createdAt: now }],
      ['categories', 'old_laser', { id: 'old_laser', name: 'Laser', nameAr: 'طابعات الليزر', nameEn: '', parentId: 'old', ancestorIds: ['old'], sortOrder: 0, description: '', iconName: '', isActive: true, createdAt: now }],
      ['products', 'p1', { id: 'p1', companyId: 'c1', companyName: 'c1', categoryId: 'old_laser', name: 'Laser printer', imageUrl: '', price: 100, currency: 'SDG', createdAt: now }],
    ]);
    const result = await importCategoryTree(admin(), await load(), DEFAULT_CATEGORY_TREE, { trashOthers: true, ...noWait });
    expect(result.created).toBe(54);
    expect(result.trashed).toBe(2);

    const all = await load();
    const old = all.find((c) => c.id === 'old')!;
    const laser = all.find((c) => c.id === 'old_laser')!;
    expect(old.isActive).toBe(false);
    expect(old.trashedAt).toBeTruthy();
    expect(laser.isActive).toBe(false);
    expect(laser.trashRootId).toBe('old');
    // The new tree is untouched by the trash.
    expect(all.filter((c) => !c.trashedAt && c.isActive)).toHaveLength(54);
    // The product is still there, still pointing at its category.
    await env.withSecurityRulesDisabled(async (ctx) => {
      const products = await getDocs(collection(ctx.firestore(), 'products'));
      expect(products.docs.map((d) => d.data().categoryId)).toEqual(['old_laser']);
    });
  });
});
