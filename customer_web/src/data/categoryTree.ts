import { compareCategories } from './format';
import type { Category } from './types';

/**
 * The category tree shared by products and services, built from the flat list.
 * Any depth works: every walk is iterative and guards against a cycle in bad data.
 */
export class CategoryTree {
  private readonly byIdMap = new Map<string, Category>();
  private readonly children = new Map<string | null, Category[]>();

  constructor(categories: Iterable<Category>) {
    for (const category of categories) this.byIdMap.set(category.id, category);
    for (const category of this.byIdMap.values()) {
      // A category whose parent is missing is treated as top-level.
      const parent = category.parentId;
      const key = parent !== null && this.byIdMap.has(parent) ? parent : null;
      const list = this.children.get(key);
      if (list) list.push(category);
      else this.children.set(key, [category]);
    }
    for (const list of this.children.values()) list.sort(compareCategories);
  }

  get all(): Category[] {
    return [...this.byIdMap.values()];
  }

  byId(id: string | null | undefined): Category | undefined {
    return id ? this.byIdMap.get(id) : undefined;
  }

  has(id: string | null | undefined): boolean {
    return !!id && this.byIdMap.has(id);
  }

  childrenOf(parentId: string | null): Category[] {
    return this.children.get(parentId) ?? [];
  }

  /** The categories from the top of the tree down to [id], inclusive. */
  pathOf(id: string): Category[] {
    const path: Category[] = [];
    const seen = new Set<string>();
    let current = this.byIdMap.get(id);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      path.unshift(current);
      current = current.parentId === null ? undefined : this.byIdMap.get(current.parentId);
    }
    return path;
  }

  /** [id] and every category below it, at any depth. */
  subtreeIds(id: string): Set<string> {
    const result = new Set<string>();
    if (!this.byIdMap.has(id)) return result;
    const queue = [id];
    while (queue.length > 0) {
      const next = queue.pop()!;
      if (result.has(next)) continue;
      result.add(next);
      for (const child of this.childrenOf(next)) queue.push(child.id);
    }
    return result;
  }

  /** Active itself and under active ancestors only: what customers are shown. */
  isEffectivelyActive(id: string): boolean {
    const path = this.pathOf(id);
    return path.length > 0 && path.every((c) => c.isActive && !c.deletionPending);
  }

  activeChildrenOf(parentId: string | null): Category[] {
    return this.childrenOf(parentId).filter((child) => this.isEffectivelyActive(child.id));
  }
}
