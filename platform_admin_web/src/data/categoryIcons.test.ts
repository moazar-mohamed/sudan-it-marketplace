import { describe, expect, it } from 'vitest';
import {
  CATEGORY_ICONS,
  categoryDisplayName,
  findCategoryIcon,
  moveId,
  nextSortOrder,
  sortCategories,
} from './categoryIcons';
import type { Category } from './types';

const category = (id: string, extra: Partial<Category> = {}): Category => ({
  id,
  name: id,
  nameAr: '',
  nameEn: '',
  parentId: null,
  ancestorIds: [],
  deletionPending: false,
  sortOrder: null,
  description: '',
  iconName: '',
  isActive: true,
  createdAt: null,
  ...extra,
});

describe('category names', () => {
  it('shows the name in the requested language', () => {
    const c = category('k', { name: 'Laptops', nameAr: 'لابتوب', nameEn: 'Laptops' });
    expect(categoryDisplayName(c, 'ar')).toBe('لابتوب');
    expect(categoryDisplayName(c, 'en')).toBe('Laptops');
  });

  it('falls back to the single old name when a language is missing', () => {
    const legacy = category('k', { name: 'Printers' });
    expect(categoryDisplayName(legacy, 'ar')).toBe('Printers');
    expect(categoryDisplayName(legacy, 'en')).toBe('Printers');
    const half = category('k2', { name: 'Cables', nameEn: 'Cables' });
    expect(categoryDisplayName(half, 'ar')).toBe('Cables');
  });
});

describe('category order', () => {
  it('puts positioned categories first, then the rest by name', () => {
    const list = [
      category('c', { name: 'Zeta' }),
      category('b', { name: 'Beta', sortOrder: 1 }),
      category('a', { name: 'Alpha' }),
      category('d', { name: 'Delta', sortOrder: 0 }),
    ];
    expect(sortCategories(list).map((c) => c.id)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('does not change the list it is given', () => {
    const list = [category('b', { sortOrder: 1 }), category('a', { sortOrder: 0 })];
    sortCategories(list);
    expect(list.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('moves one place up or down and stops at the ends', () => {
    expect(moveId(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveId(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moveId(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveId(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });

  it('gives a new category the position after every existing one', () => {
    expect(nextSortOrder([])).toBe(0);
    expect(nextSortOrder([category('a'), category('b')])).toBe(2);
    expect(nextSortOrder([category('a', { sortOrder: 7 })])).toBe(8);
  });
});

describe('category icons', () => {
  it('finds an icon by key, ignoring case and spaces', () => {
    expect(findCategoryIcon(' Router ')?.key).toBe('router');
    expect(findCategoryIcon('nope')).toBeUndefined();
  });

  it('has a unique key, an English and an Arabic label for every icon', () => {
    const keys = CATEGORY_ICONS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const icon of CATEGORY_ICONS) {
      expect(icon.en.length).toBeGreaterThan(0);
      expect(icon.ar.length).toBeGreaterThan(0);
    }
  });

  it('matches the icon names the app knows (category_grid.dart)', () => {
    // If you add an icon here, add the same key to _iconsByName in the app.
    expect(CATEGORY_ICONS.map((i) => i.key).sort()).toEqual(
      [
        'laptop', 'computer', 'phone', 'tablet', 'router', 'network', 'wifi', 'camera',
        'cctv', 'printer', 'server', 'storage', 'monitor', 'keyboard', 'mouse', 'headset',
        'battery', 'ups', 'cable', 'security', 'software', 'cloud', 'service', 'tools',
        'game', 'accessory',
      ].sort(),
    );
  });
});
