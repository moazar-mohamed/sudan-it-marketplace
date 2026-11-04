import type { Firestore } from 'firebase/firestore';
import { createCategory, trashCategoryTree, type RunOptions } from './categoryOps';
import { buildIndex, chainForChildOf, childrenOf, nextSortOrderAmong } from './categoryTree';
import type { CategoryTemplate } from './defaultCategoryTree';
import type { Category } from './types';

/*
 * Adds a ready-made category tree (defaultCategoryTree.ts) next to what exists.
 * Nothing is deleted: a category that is already there (same name under the same
 * parent) is kept as it is, missing ones are created in the tree's order, and the
 * other top-level categories can be moved to the trash, which a restore brings
 * back with everything filed in them. Running it again finishes what stopped
 * part-way, because what exists is matched by name each time.
 */

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** Whether [category] carries [template]'s name, in either language or as its old single name. */
function sameName(category: Category, template: CategoryTemplate): boolean {
  const names = [category.nameAr, category.nameEn, category.name].map(norm).filter(Boolean);
  return names.includes(norm(template.ar)) || names.includes(norm(template.en));
}

/** A live (not trashed) child of [parentId] that carries [template]'s name. */
function findExisting(all: readonly Category[], parentId: string | null, template: CategoryTemplate): Category | undefined {
  return childrenOf(buildIndex(all), parentId).find((c) => !c.trashedAt && !c.deletionPending && sameName(c, template));
}

export interface ImportPlan {
  /** Categories the import would create. */
  toCreate: number;
  /** Categories of the tree that already exist and stay as they are. */
  existing: number;
  /** Live top-level categories that are not part of the tree (they can be sent to the trash). */
  others: Category[];
}

/** What importing [tree] into [all] would do, without writing anything. */
export function planCategoryImport(all: readonly Category[], tree: readonly CategoryTemplate[]): ImportPlan {
  let toCreate = 0;
  let existing = 0;
  const matchedRoots = new Set<string>();
  const walk = (templates: readonly CategoryTemplate[], parent: Category | null, parentExists: boolean) => {
    for (const template of templates) {
      const found = parentExists ? findExisting(all, parent?.id ?? null, template) : undefined;
      if (found) {
        existing++;
        if (!parent) matchedRoots.add(found.id);
      } else {
        toCreate++;
      }
      walk(template.children ?? [], found ?? null, found !== undefined);
    }
  };
  walk(tree, null, true);
  const index = buildIndex(all);
  const others = childrenOf(index, null).filter((c) => !c.trashedAt && !c.deletionPending && !matchedRoots.has(c.id));
  return { toCreate, existing, others };
}

export interface ImportOptions extends RunOptions {
  /** Send the live top-level categories that are not part of the tree to the trash afterwards. */
  trashOthers: boolean;
  onStep?: (done: number, total: number) => void;
}

export interface ImportResult {
  created: number;
  existing: number;
  trashed: number;
}

/** The category as the tree helpers see it right after it was written. */
function justCreated(
  all: readonly Category[],
  id: string,
  parentId: string | null,
  template: CategoryTemplate,
): Category {
  const index = buildIndex(all);
  return {
    id,
    name: template.en || template.ar,
    nameAr: template.ar,
    nameEn: template.en,
    parentId,
    ancestorIds: chainForChildOf(index, parentId),
    deletionPending: false,
    sortOrder: nextSortOrderAmong(index, parentId),
    description: '',
    iconName: template.icon,
    color: template.color ?? '',
    isActive: true,
    createdAt: null,
  };
}

/** Adds [tree] to the categories in [all] (the current ones), parents before children. */
export async function importCategoryTree(
  db: Firestore,
  all: readonly Category[],
  tree: readonly CategoryTemplate[],
  options: ImportOptions,
): Promise<ImportResult> {
  const plan = planCategoryImport(all, tree);
  const total = plan.toCreate;
  let current: Category[] = [...all];
  let created = 0;
  let existing = 0;
  const matchedRoots = new Set<string>();

  const walk = async (templates: readonly CategoryTemplate[], parent: Category | null) => {
    for (const template of templates) {
      let node = findExisting(current, parent?.id ?? null, template);
      if (node) {
        existing++;
      } else {
        const id = await createCategory(
          db,
          {
            parentId: parent?.id ?? null,
            nameAr: template.ar,
            nameEn: template.en,
            description: '',
            iconName: template.icon,
            color: template.color ?? '',
          },
          current,
        );
        node = justCreated(current, id, parent?.id ?? null, template);
        current = [...current, node];
        created++;
        options.onStep?.(created, total);
      }
      if (!parent) matchedRoots.add(node.id);
      await walk(template.children ?? [], node);
    }
  };
  await walk(tree, null);

  let trashed = 0;
  if (options.trashOthers) {
    for (const other of plan.others) {
      if (matchedRoots.has(other.id)) continue;
      trashed += await trashCategoryTree(db, current, other.id, options);
    }
  }
  return { created, existing, trashed };
}
