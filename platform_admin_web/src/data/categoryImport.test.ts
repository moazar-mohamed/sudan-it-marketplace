import { describe, expect, it } from 'vitest';
import { planCategoryImport } from './categoryImport';
import { DEFAULT_CATEGORY_TREE } from './defaultCategoryTree';
import { CATEGORY_COLORS, CATEGORY_ICONS } from './categoryIcons';
import type { Category } from './types';

const category = (id: string, parentId: string | null, nameAr: string, extra: Partial<Category> = {}): Category => ({
  id,
  name: nameAr,
  nameAr,
  nameEn: '',
  parentId,
  ancestorIds: parentId ? [parentId] : [],
  deletionPending: false,
  sortOrder: null,
  description: '',
  iconName: '',
  color: '',
  isActive: true,
  createdAt: null,
  ...extra,
});

const nodes = (tree: readonly { children?: readonly unknown[] }[]): number =>
  tree.reduce((n, node) => n + 1 + nodes((node.children ?? []) as never), 0);

describe('the ready-made category tree', () => {
  it('has 12 main categories and 42 sub-categories, each named in both languages', () => {
    expect(DEFAULT_CATEGORY_TREE).toHaveLength(12);
    expect(nodes(DEFAULT_CATEGORY_TREE)).toBe(54);
    const walk = (list: typeof DEFAULT_CATEGORY_TREE) => {
      for (const n of list) {
        expect(n.ar.trim().length, n.en).toBeGreaterThan(0);
        expect(n.en.trim().length, n.ar).toBeGreaterThan(0);
        walk(n.children ?? []);
      }
    };
    walk(DEFAULT_CATEGORY_TREE);
  });

  it('uses only icons and colours the app knows', () => {
    const icons = new Set<string>(CATEGORY_ICONS.map((i) => i.key));
    const colors = new Set<string>(CATEGORY_COLORS.map((c) => c.key));
    const walk = (list: typeof DEFAULT_CATEGORY_TREE) => {
      for (const n of list) {
        if (n.icon) expect(icons.has(n.icon), `${n.en} icon ${n.icon}`).toBe(true);
        if (n.color) expect(colors.has(n.color), `${n.en} colour ${n.color}`).toBe(true);
        walk(n.children ?? []);
      }
    };
    walk(DEFAULT_CATEGORY_TREE);
  });

  it('keeps names unique among siblings', () => {
    const walk = (list: typeof DEFAULT_CATEGORY_TREE) => {
      expect(new Set(list.map((n) => n.ar)).size).toBe(list.length);
      for (const n of list) walk(n.children ?? []);
    };
    walk(DEFAULT_CATEGORY_TREE);
  });
});

describe('planning the import', () => {
  it('adds everything to an empty marketplace', () => {
    const plan = planCategoryImport([], DEFAULT_CATEGORY_TREE);
    expect(plan).toEqual({ toCreate: 54, existing: 0, others: [] });
  });

  it('keeps what is already there, matched by name under the same parent', () => {
    const all = [
      category('net', null, 'الشبكات والبنية التحتية'),
      category('wifi', 'net', 'شبكات لاسلكية'),
      category('elsewhere', null, 'شبكات لاسلكية'), // same name, different parent: not a match for the child
    ];
    const plan = planCategoryImport(all, DEFAULT_CATEGORY_TREE);
    expect(plan.existing).toBe(2);
    expect(plan.toCreate).toBe(52);
    expect(plan.others.map((c) => c.id)).toEqual(['elsewhere']);
  });

  it('matches by the English name too', () => {
    const all = [category('cloud', null, '', { nameEn: 'Cloud & Data Centers', name: 'Cloud & Data Centers' })];
    expect(planCategoryImport(all, DEFAULT_CATEGORY_TREE).existing).toBe(1);
  });

  it('lists the other live main categories, and ignores trashed ones and their children', () => {
    const all = [
      category('printers', null, 'الطابعات والمستلزمات'),
      category('laser', 'printers', 'طابعات الليزر'),
      category('old', null, 'قديم', { trashedAt: new Date(), isActive: false }),
      category('busy', null, 'يُحذف', { deletionPending: true }),
    ];
    const plan = planCategoryImport(all, DEFAULT_CATEGORY_TREE);
    expect(plan.others.map((c) => c.id)).toEqual(['printers']);
    expect(plan.toCreate).toBe(54);
  });

  it('is finished once everything exists', () => {
    const all: Category[] = [];
    const walk = (list: typeof DEFAULT_CATEGORY_TREE, parent: string | null, prefix: string) => {
      list.forEach((n, i) => {
        const id = `${prefix}${i}`;
        all.push(category(id, parent, n.ar));
        walk(n.children ?? [], id, `${id}_`);
      });
    };
    walk(DEFAULT_CATEGORY_TREE, null, 'c');
    expect(planCategoryImport(all, DEFAULT_CATEGORY_TREE)).toEqual({ toCreate: 0, existing: 54, others: [] });
  });
});
