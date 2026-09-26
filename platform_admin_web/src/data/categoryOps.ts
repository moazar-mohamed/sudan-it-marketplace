import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';
import {
  buildIndex,
  chainForChildOf,
  childrenOf,
  findChainMismatches,
  moveProblem,
  nextSortOrderAmong,
  subtreeIds,
  type CategoryIndex,
  type MoveProblem,
} from './categoryTree';
import type { Category } from './types';

/*
 * Writes for the category tree (shared by products and services), run by
 * Platform Admin from the browser: no Cloud Functions, no Admin SDK. Firestore has no
 * "delete a subtree" call, so every multi-document change here is a series of
 * batches that is safe to run again after a failure:
 *
 *  - a batch holds at most MAX_BATCH_WRITES writes (the limit is 500);
 *  - the security rules may look up at most 20 DISTINCT documents per batch
 *    (checked in the emulator), so items that need a lookup are grouped by the
 *    documents they look at and a batch stops at MAX_RULE_LOOKUPS of them;
 *  - transient failures are retried with a growing delay; a refusal by the
 *    rules is never retried;
 *  - every phase looks at the database again instead of trusting an earlier
 *    read, so running the same operation again finishes what stopped part-way.
 */

export const MAX_BATCH_WRITES = 400;
export const MAX_RULE_LOOKUPS = 14;
/** Firestore's limit on the number of values of an `in` query. */
export const IN_QUERY_LIMIT = 30;

export class CategoryOpError extends Error {
  constructor(
    readonly code:
      | 'invalid-parent'
      | 'invalid-move'
      | 'missing'
      | 'incomplete',
    message: string,
    readonly detail?: MoveProblem,
  ) {
    super(message);
    this.name = 'CategoryOpError';
  }
}

// ─────────────────────────────────────────────────────────── batching helpers

export interface Batchable {
  /** Documents the security rules look at for this write (distinct keys). */
  lookups?: readonly string[];
}

/**
 * Splits [items] (in order) into batches of at most [maxWrites] items whose
 * combined distinct lookups stay within [maxLookups].
 */
export function packBatches<T extends Batchable>(
  items: readonly T[],
  maxWrites: number = MAX_BATCH_WRITES,
  maxLookups: number = MAX_RULE_LOOKUPS,
): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let keys = new Set<string>();
  for (const item of items) {
    const own = new Set(item.lookups ?? []);
    if (own.size > maxLookups) {
      throw new Error(`One write needs ${own.size} rule lookups; the limit is ${maxLookups}.`);
    }
    const extra = [...own].filter((k) => !keys.has(k)).length;
    if (current.length >= maxWrites || (current.length > 0 && keys.size + extra > maxLookups)) {
      batches.push(current);
      current = [];
      keys = new Set();
    }
    current.push(item);
    own.forEach((k) => keys.add(k));
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

const TRANSIENT = new Set(['unavailable', 'deadline-exceeded', 'aborted', 'resource-exhausted', 'internal']);

export interface RunOptions {
  /** Attempts per batch (first try included). */
  attempts?: number;
  /** Waits before a retry; replaced in tests. */
  sleep?: (ms: number) => Promise<void>;
  onProgress?: (progress: Progress) => void;
}

export interface Progress {
  phase: 'mark' | 'links' | 'services' | 'products' | 'categories' | 'chains';
  done: number;
  total: number;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Commits [batch], retrying transient failures; a rules refusal is thrown at once. */
export async function commitWithRetry(batch: WriteBatch, options: RunOptions): Promise<void> {
  const attempts = options.attempts ?? 4;
  const sleep = options.sleep ?? realSleep;
  for (let attempt = 1; ; attempt++) {
    try {
      await batch.commit();
      return;
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      if (attempt >= attempts || !TRANSIENT.has(code)) throw error;
      await sleep(500 * 2 ** (attempt - 1));
    }
  }
}

/**
 * Runs [items] as packed batches. [build] receives a fresh batch and the items
 * of that batch and adds their writes. Reports progress after each commit.
 */
async function runPacked<T extends Batchable>(
  db: Firestore,
  items: readonly T[],
  build: (batch: WriteBatch, chunk: T[]) => void,
  phase: Progress['phase'],
  options: RunOptions,
): Promise<void> {
  const chunks = packBatches(items);
  let done = 0;
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    build(batch, chunk);
    await commitWithRetry(batch, options);
    done += chunk.length;
    options.onProgress?.({ phase, done, total: items.length });
  }
}

const chunkOf = <T,>(values: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
  return chunks;
};

// ─────────────────────────────────────────────────────────────── create / edit

export interface CategoryFields {
  nameAr: string;
  nameEn: string;
  description: string;
  iconName: string;
}

export interface NewCategoryInput extends CategoryFields {
  /** Null creates a top-level category. */
  parentId: string | null;
}

/** `name` stays filled (English first) for everything that reads the single name. */
const legacyName = (input: CategoryFields) => input.nameEn.trim() || input.nameAr.trim();

/** Adds a top-level category, or one under [input.parentId], last among its siblings. */
export async function createCategory(
  db: Firestore,
  input: NewCategoryInput,
  all: readonly Category[],
): Promise<string> {
  const index = buildIndex(all);
  if (input.parentId) {
    const parent = index.byId.get(input.parentId);
    if (!parent || parent.deletionPending) {
      throw new CategoryOpError('invalid-parent', 'That parent category cannot hold new categories.');
    }
  }
  const ref = doc(collection(db, 'categories'));
  const batch = writeBatch(db);
  batch.set(ref, {
    id: ref.id,
    name: legacyName(input),
    nameAr: input.nameAr.trim(),
    nameEn: input.nameEn.trim(),
    parentId: input.parentId,
    ancestorIds: chainForChildOf(index, input.parentId),
    sortOrder: nextSortOrderAmong(index, input.parentId),
    description: input.description.trim(),
    iconName: input.iconName.trim(),
    isActive: true,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}

export async function updateCategoryFields(
  db: Firestore,
  id: string,
  input: CategoryFields,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'categories', id), {
    name: legacyName(input),
    nameAr: input.nameAr.trim(),
    nameEn: input.nameEn.trim(),
    description: input.description.trim(),
    iconName: input.iconName.trim(),
  });
  await batch.commit();
}

export async function setCategoryActive(db: Firestore, id: string, isActive: boolean): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'categories', id), { isActive });
  await batch.commit();
}

/** Saves the customer-facing order of one set of siblings: the one at index i gets position i. */
export async function saveSiblingOrder(db: Firestore, orderedIds: readonly string[]): Promise<void> {
  const chunks = chunkOf(orderedIds, MAX_BATCH_WRITES);
  let position = 0;
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const id of chunk) batch.update(doc(db, 'categories', id), { sortOrder: position++ });
    await batch.commit();
  }
}

// ──────────────────────────────────────────────────────────────────── moving

interface ChainUpdate extends Batchable {
  id: string;
  parentId: string | null;
  ancestorIds: string[];
  sortOrder?: number;
}

async function writeChains(db: Firestore, updates: readonly ChainUpdate[], options: RunOptions) {
  await runPacked(
    db,
    updates,
    (batch, chunk) => {
      for (const u of chunk) {
        batch.update(doc(db, 'categories', u.id), {
          parentId: u.parentId,
          ancestorIds: u.ancestorIds,
          ...(u.sortOrder === undefined ? {} : { sortOrder: u.sortOrder }),
        });
      }
    },
    'chains',
    options,
  );
}

/** Ancestor chains for [rootId] and everything below it, parents before children. */
function chainUpdatesFor(
  index: CategoryIndex,
  rootId: string,
  rootParentId: string | null,
  rootSortOrder: number | undefined,
): ChainUpdate[] {
  const updates: ChainUpdate[] = [];
  const rootChain = chainForChildOf(index, rootParentId);
  updates.push({
    id: rootId,
    parentId: rootParentId,
    ancestorIds: rootChain,
    sortOrder: rootSortOrder,
    lookups: rootParentId ? [`categories/${rootParentId}`] : [],
  });
  const chains = new Map<string, string[]>([[rootId, [...rootChain, rootId]]]);
  let level = [rootId];
  const seen = new Set(level);
  while (level.length > 0) {
    const next: string[] = [];
    for (const parent of level) {
      for (const child of childrenOf(index, parent)) {
        if (seen.has(child.id)) continue;
        seen.add(child.id);
        const chain = chains.get(parent)!;
        chains.set(child.id, [...chain, child.id]);
        updates.push({
          id: child.id,
          parentId: parent,
          ancestorIds: chain,
          lookups: [`categories/${parent}`],
        });
        next.push(child.id);
      }
    }
    level = next;
  }
  return updates;
}

/**
 * Moves [id] (with everything below it) under [newParentId] (null = top level),
 * last among its new siblings. The category is written first, then its
 * descendants' ancestor chains, parents before children. If it stops part-way,
 * the tree is flagged by findChainMismatches and repairCategoryChains finishes it.
 */
export async function moveCategory(
  db: Firestore,
  all: readonly Category[],
  id: string,
  newParentId: string | null,
  options: RunOptions = {},
): Promise<void> {
  const index = buildIndex(all);
  if (findChainMismatches(all).length > 0) {
    throw new CategoryOpError('incomplete', 'The tree needs repairing before anything is moved.');
  }
  const problem = moveProblem(index, id, newParentId);
  if (problem) {
    throw new CategoryOpError('invalid-move', `That category cannot be moved there (${problem}).`, problem);
  }
  const updates = chainUpdatesFor(index, id, newParentId, nextSortOrderAmong(index, newParentId));
  await writeChains(db, updates, options);
}

/**
 * Rewrites every ancestor chain that does not match the parent links (which are
 * the source of truth), parents before children. Safe to run again; a no-op on
 * a consistent tree.
 */
export async function repairCategoryChains(
  db: Firestore,
  all: readonly Category[],
  options: RunOptions = {},
): Promise<number> {
  const mismatched = new Set(findChainMismatches(all).map((c) => c.id));
  if (mismatched.size === 0) return 0;
  const index = buildIndex(all);
  const updates: ChainUpdate[] = [];
  const chains = new Map<string, string[]>();
  const visit = (parentId: string | null, chain: string[], seen: Set<string>) => {
    for (const category of childrenOf(index, parentId)) {
      if (seen.has(category.id)) continue;
      seen.add(category.id);
      if (mismatched.has(category.id)) {
        updates.push({
          id: category.id,
          parentId,
          ancestorIds: chain,
          lookups: parentId ? [`categories/${parentId}`] : [],
        });
      }
      chains.set(category.id, [...chain, category.id]);
      visit(category.id, [...chain, category.id], seen);
    }
  };
  visit(null, [], new Set());
  await writeChains(db, updates, options);
  return updates.length;
}

// ────────────────────────────────────────────────────────────────── deleting

export interface DeletionSummary {
  categories: number;
  /** Products filed under any of those categories. */
  products: number;
  /** Catalogue services (Platform Admin's and companies' own) in those categories. */
  services: number;
  /** Company offers (company_services) of those services. */
  serviceLinks: number;
}

const idsInTree = (all: readonly Category[], rootId: string): string[] => {
  const index = buildIndex(all);
  if (!index.byId.has(rootId)) throw new CategoryOpError('missing', 'That category no longer exists.');
  return subtreeIds(index, rootId);
};

async function sumCounts(counts: Promise<number>[]): Promise<number> {
  return (await Promise.all(counts)).reduce((a, b) => a + b, 0);
}

async function countIn(db: Firestore, collectionName: string, field: string, values: string[]) {
  return sumCounts(
    chunkOf(values, IN_QUERY_LIMIT).map(async (chunk) => {
      const snap = await getCountFromServer(query(collection(db, collectionName), where(field, 'in', chunk)));
      return snap.data().count;
    }),
  );
}

async function docsIn(db: Firestore, collectionName: string, field: string, values: string[]) {
  const found: { ref: DocumentReference; data: Record<string, unknown> }[] = [];
  for (const chunk of chunkOf(values, IN_QUERY_LIMIT)) {
    const snap = await getDocs(query(collection(db, collectionName), where(field, 'in', chunk)));
    snap.docs.forEach((d) => found.push({ ref: d.ref, data: d.data() }));
  }
  return found;
}

/**
 * What deleting [rootId] would remove, for the confirmation dialog. Counts only
 * (aggregate queries), so it is cheap even for a large tree.
 */
export async function summarizeDeletion(
  db: Firestore,
  all: readonly Category[],
  rootId: string,
): Promise<DeletionSummary> {
  const ids = idsInTree(all, rootId);
  const [products, services] = await Promise.all([
    countIn(db, 'products', 'categoryId', ids),
    countIn(db, 'services', 'categoryId', ids),
  ]);
  let serviceLinks = 0;
  if (services > 0) {
    const serviceDocs = await docsIn(db, 'services', 'categoryId', ids);
    serviceLinks = await countIn(
      db,
      'company_services',
      'serviceId',
      serviceDocs.map((s) => s.ref.id),
    );
  }
  return { categories: ids.length, products, services, serviceLinks };
}

/**
 * Deletes [rootId], every category below it (any depth), and the products,
 * services and company service links filed in that tree - nothing else. The
 * companies that own them, their staff, orders, receipts and service requests
 * are never touched.
 *
 *  1. mark every category of the tree `deletionPending` and inactive; from now
 *     on the rules refuse to attach anything new to it, and allow the deletes
 *     below;
 *  2. delete the company service links, then the services, then the products
 *     (repeated until a look at the database finds none left);
 *  3. delete the categories, deepest first.
 *
 * Running it again after a failure continues where it stopped (the root is
 * deleted last, so it is still there to run again).
 */
export async function deleteCategoryTree(
  db: Firestore,
  all: readonly Category[],
  rootId: string,
  options: RunOptions = {},
): Promise<DeletionSummary> {
  const index = buildIndex(all);
  const root = index.byId.get(rootId);
  if (!root) throw new CategoryOpError('missing', 'That category no longer exists.');
  const ids = subtreeIds(index, rootId);
  const idSet = new Set(ids);
  const total: DeletionSummary = { categories: ids.length, products: 0, services: 0, serviceLinks: 0 };

  // 1. mark
  const toMark = ids.filter((id) => !index.byId.get(id)!.deletionPending || index.byId.get(id)!.isActive);
  await runPacked(
    db,
    toMark.map((id) => ({ id, lookups: [] as string[] })),
    (batch, chunk) => {
      for (const { id } of chunk) {
        batch.update(doc(db, 'categories', id), { deletionPending: true, isActive: false });
      }
    },
    'mark',
    options,
  );

  // 2. links -> services -> products, until nothing is left
  for (let round = 0; round < 5; round++) {
    let found = 0;

    const services = (await docsIn(db, 'services', 'categoryId', ids)).filter((s) =>
      idSet.has(String(s.data.categoryId)),
    );
    const links = (
      await docsIn(
        db,
        'company_services',
        'serviceId',
        services.map((s) => s.ref.id),
      )
    ).map((l) => {
      const category = String(services.find((s) => s.ref.id === l.data.serviceId)?.data.categoryId);
      return {
        ref: l.ref,
        // The rules look at the company (is it gone?), then the service and its category.
        lookups: [`companies/${String(l.data.companyId)}`, `services/${String(l.data.serviceId)}`, `categories/${category}`],
        sortKey: `${category}/${String(l.data.serviceId)}`,
      };
    });
    links.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    await runPacked(db, links, (batch, chunk) => chunk.forEach((l) => batch.delete(l.ref)), 'links', options);
    total.serviceLinks += links.length;
    found += links.length;

    const serviceItems = services
      .map((s) => ({ ref: s.ref, lookups: [`categories/${String(s.data.categoryId)}`] }))
      .sort((a, b) => a.lookups[0].localeCompare(b.lookups[0]));
    await runPacked(db, serviceItems, (batch, chunk) => chunk.forEach((s) => batch.delete(s.ref)), 'services', options);
    total.services += serviceItems.length;
    found += serviceItems.length;

    const products = (await docsIn(db, 'products', 'categoryId', ids))
      .filter((p) => idSet.has(String(p.data.categoryId)))
      .map((p) => ({
        ref: p.ref,
        // The rules check whether the company is gone before they look at the category.
        lookups: [`categories/${String(p.data.categoryId)}`, `companies/${String(p.data.companyId)}`],
        sortKey: `${String(p.data.categoryId)}/${String(p.data.companyId)}`,
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    await runPacked(db, products, (batch, chunk) => chunk.forEach((p) => batch.delete(p.ref)), 'products', options);
    total.products += products.length;
    found += products.length;

    if (found === 0) break;
  }

  // Nothing may be left pointing at the categories about to go.
  for (const [name, field] of [['products', 'categoryId'], ['services', 'categoryId']] as const) {
    for (const chunk of chunkOf(ids, IN_QUERY_LIMIT)) {
      const left = await getDocs(query(collection(db, name), where(field, 'in', chunk), limit(1)));
      if (!left.empty) {
        throw new CategoryOpError(
          'incomplete',
          `Some ${name} are still filed in this tree; run the deletion again.`,
        );
      }
    }
  }

  // 3. categories, deepest first
  const depth = (id: string) => index.byId.get(id)!.ancestorIds.length;
  const ordered = [...ids].sort((a, b) => depth(b) - depth(a));
  await runPacked(
    db,
    ordered.map((id) => ({ id, lookups: [] as string[] })),
    (batch, chunk) => chunk.forEach(({ id }) => batch.delete(doc(db, 'categories', id))),
    'categories',
    options,
  );
  return total;
}
