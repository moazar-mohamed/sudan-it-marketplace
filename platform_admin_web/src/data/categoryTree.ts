import { matchesQuery } from '../utils';
import { categoryDisplayName } from './categoryIcons';
import type { Category } from './types';

/*
 * Category trees (pure functions, no Firestore).
 *
 * Products and services share ONE tree of categories. Every category names its parent (`parentId`, null at the top) and
 * stores the ids of all its ancestors (`ancestorIds`, top-level first). The
 * `parentId` links are the source of truth; `ancestorIds` is derived from them
 * and can be recomputed at any time (see findChainMismatches). Nothing here
 * limits how deep a tree goes, and every walk guards against a broken cycle so
 * bad data can never hang the page.
 */

export interface CategoryIndex {
  byId: Map<string, Category>;
  /** Children by parent id; the key `null` holds the top-level categories. */
  children: Map<string | null, Category[]>;
}

/** Orders siblings: Platform Admin's position first, then by name. */
export function compareSiblings(a: Category, b: Category): number {
  if (a.sortOrder !== null && b.sortOrder !== null && a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }
  if (a.sortOrder !== null && b.sortOrder === null) return -1;
  if (a.sortOrder === null && b.sortOrder !== null) return 1;
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}

/**
 * Indexes [all]. A category whose parent is missing from [all] is treated as a
 * top-level one, so nothing ever disappears from the page.
 */
export function buildIndex(all: readonly Category[]): CategoryIndex {
  const byId = new Map(all.map((c) => [c.id, c]));
  const children = new Map<string | null, Category[]>();
  for (const category of all) {
    const key = category.parentId && byId.has(category.parentId) ? category.parentId : null;
    const list = children.get(key);
    if (list) list.push(category);
    else children.set(key, [category]);
  }
  for (const list of children.values()) list.sort(compareSiblings);
  return { byId, children };
}

export const childrenOf = (index: CategoryIndex, parentId: string | null): Category[] =>
  index.children.get(parentId) ?? [];

/** Ids of every category below [id], any depth (breadth first). */
export function descendantIds(index: CategoryIndex, id: string): string[] {
  const seen = new Set<string>([id]);
  const result: string[] = [];
  let level = [id];
  while (level.length > 0) {
    const next: string[] = [];
    for (const parent of level) {
      for (const child of childrenOf(index, parent)) {
        if (seen.has(child.id)) continue; // a cycle in bad data
        seen.add(child.id);
        result.push(child.id);
        next.push(child.id);
      }
    }
    level = next;
  }
  return result;
}

/** [id] followed by all its descendants. */
export const subtreeIds = (index: CategoryIndex, id: string): string[] => [
  id,
  ...descendantIds(index, id),
];

/** The categories from the top of the tree down to [id] (inclusive). */
export function pathOf(index: CategoryIndex, id: string): Category[] {
  const path: Category[] = [];
  const seen = new Set<string>();
  let current = index.byId.get(id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? index.byId.get(current.parentId) : undefined;
  }
  return path;
}

/** "Networking › Routers › Wi-Fi 6", in the language shown. */
export function pathLabel(
  index: CategoryIndex,
  id: string,
  locale: 'ar' | 'en',
  separator = ' › ',
): string {
  return pathOf(index, id)
    .map((c) => categoryDisplayName(c, locale))
    .join(separator);
}

export const depthOf = (index: CategoryIndex, id: string): number =>
  Math.max(0, pathOf(index, id).length - 1);

/** The ancestor chain a child of [parentId] must store (parent's chain + parent). */
export function chainForChildOf(index: CategoryIndex, parentId: string | null): string[] {
  if (!parentId) return [];
  return pathOf(index, parentId).map((c) => c.id);
}

export type MoveProblem = 'self' | 'descendant' | 'missing' | 'pending' | 'same';

/**
 * Whether [id] may be moved under [newParentId] (null = to the top level):
 * not under itself or one of its own descendants (that would make a cycle),
 * not under a category awaiting deletion, and it must actually change place.
 */
export function moveProblem(
  index: CategoryIndex,
  id: string,
  newParentId: string | null,
): MoveProblem | null {
  const category = index.byId.get(id);
  if (!category) return 'missing';
  if (newParentId === id) return 'self';
  if (newParentId === (category.parentId ?? null)) return 'same';
  if (newParentId === null) return null;
  const parent = index.byId.get(newParentId);
  if (!parent) return 'missing';
  if (descendantIds(index, id).includes(newParentId)) return 'descendant';
  if (parent.deletionPending) return 'pending';
  return null;
}

/** Categories whose stored `ancestorIds` differ from what their `parentId` chain says. */
export function findChainMismatches(all: readonly Category[]): Category[] {
  const index = buildIndex(all);
  return all.filter((c) => {
    const expected = chainForChildOf(index, c.parentId && index.byId.has(c.parentId) ? c.parentId : null);
    return (
      expected.length !== c.ancestorIds.length || expected.some((id, i) => id !== c.ancestorIds[i])
    );
  });
}

/** Top-most categories of an interrupted deletion (marked, parent not marked). */
export function interruptedDeletions(all: readonly Category[]): Category[] {
  const index = buildIndex(all);
  return all.filter(
    (c) => c.deletionPending && !(c.parentId && index.byId.get(c.parentId)?.deletionPending),
  );
}

/** Active itself and under active ancestors only: what customers and companies see. */
export function isEffectivelyActive(index: CategoryIndex, id: string): boolean {
  const path = pathOf(index, id);
  return path.length > 0 && path.every((c) => c.isActive && !c.deletionPending);
}

/** The position a new child of [parentId] takes: after every sibling. */
export function nextSortOrderAmong(
  index: CategoryIndex,
  parentId: string | null,
): number {
  return childrenOf(index, parentId).reduce(
    (max, c) => Math.max(max, (c.sortOrder ?? -1) + 1),
    childrenOf(index, parentId).length,
  );
}

export interface TreeRow {
  category: Category;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  /** True when the row matches the search text itself (not only its descendants). */
  matched: boolean;
}

function matches(category: Category, query: string): boolean {
  return matchesQuery(query, category.name, category.nameAr, category.nameEn);
}

/**
 * The rows to show for the tree: every expanded branch, or, when [query] is
 * given, only the categories whose Arabic or English name matches together with
 * their ancestors (all opened, so the match is visible in place).
 */
export function visibleRows(
  all: readonly Category[],
  expanded: ReadonlySet<string>,
  query: string,
): TreeRow[] {
  const index = buildIndex(all);
  const searching = query.trim().length > 0;

  const keep = new Set<string>();
  const direct = new Set<string>();
  if (searching) {
    for (const category of index.byId.values()) {
      if (!matches(category, query)) continue;
      direct.add(category.id);
      for (const ancestor of pathOf(index, category.id)) keep.add(ancestor.id);
    }
  }

  const rows: TreeRow[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    for (const category of childrenOf(index, parentId)) {
      if (seen.has(category.id)) continue;
      seen.add(category.id);
      if (searching && !keep.has(category.id)) continue;
      const kids = childrenOf(index, category.id).filter((k) => !searching || keep.has(k.id));
      const open = searching ? kids.length > 0 : expanded.has(category.id);
      rows.push({
        category,
        depth,
        hasChildren: childrenOf(index, category.id).length > 0,
        expanded: open,
        matched: direct.has(category.id),
      });
      if (open) walk(category.id, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
}
