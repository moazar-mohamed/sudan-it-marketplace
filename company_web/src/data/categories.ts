import { useMemo } from 'react';
import type { Category } from './types';

export interface CategoryIndex {
  byId: Map<string, Category>;
}

export const buildCategoryIndex = (all: readonly Category[]): CategoryIndex => ({ byId: new Map(all.map((c) => [c.id, c])) });

export const categoryName = (c: Category): string => c.nameAr.trim() || c.name || c.nameEn;

/** The categories from the top of the tree down to [id] (a broken cycle cannot hang this). */
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

/** "حواسيب › لابتوبات › HP". */
export const pathLabel = (index: CategoryIndex, id: string | null): string =>
  id ? pathOf(index, id).map(categoryName).join(' › ') : '';

/** Platform Admin's position first, then by name (as in the app). */
const compare = (a: Category, b: Category): number => {
  if (a.sortOrder !== null && b.sortOrder !== null && a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  if (a.sortOrder !== null && b.sortOrder === null) return -1;
  if (a.sortOrder === null && b.sortOrder !== null) return 1;
  return categoryName(a).localeCompare(categoryName(b), 'ar');
};

export interface CategoryChoice {
  id: string;
  label: string;
}

/** Every category a product may be filed in (active and not being deleted), as flat "path" choices in tree order. */
export function categoryChoices(all: readonly Category[]): CategoryChoice[] {
  const index = buildCategoryIndex(all);
  const children = new Map<string | null, Category[]>();
  for (const c of all) {
    const key = c.parentId && index.byId.has(c.parentId) ? c.parentId : null;
    children.set(key, [...(children.get(key) ?? []), c]);
  }
  const out: CategoryChoice[] = [];
  const walk = (parent: string | null, seen: Set<string>) => {
    for (const c of [...(children.get(parent) ?? [])].sort(compare)) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      if (c.isActive && !c.deletionPending) out.push({ id: c.id, label: pathLabel(index, c.id) });
      walk(c.id, seen);
    }
  };
  walk(null, new Set());
  return out;
}

export function useCategoryLookup(all: readonly Category[]) {
  return useMemo(() => {
    const index = buildCategoryIndex(all);
    return { index, label: (id: string | null) => pathLabel(index, id), choices: categoryChoices(all) };
  }, [all]);
}
