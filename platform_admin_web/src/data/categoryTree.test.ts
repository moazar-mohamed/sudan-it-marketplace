import { describe, expect, it } from 'vitest';
import {
  buildIndex,
  chainForChildOf,
  childrenOf,
  compareSiblings,
  depthOf,
  descendantIds,
  findChainMismatches,
  interruptedDeletions,
  isEffectivelyActive,
  moveProblem,
  nextSortOrderAmong,
  pathLabel,
  pathOf,
  subtreeIds,
  visibleRows,
} from './categoryTree';
import type { Category } from './types';

const category = (id: string, parentId: string | null, extra: Partial<Category> = {}): Category => ({
  id,
  name: id,
  nameAr: '',
  nameEn: '',
  parentId,
  ancestorIds: [],
  deletionPending: false,
  sortOrder: null,
  description: '',
  iconName: '',
  isActive: true,
  createdAt: null,
  ...extra,
});

/** Builds categories from [id, parentId] pairs, parents first, with correct chains. */
function tree(edges: [string, string | null][], extra: Partial<Category> = {}) {
  const chains = new Map<string, string[]>();
  return edges.map(([id, parent]) => {
    const chain = parent ? [...(chains.get(parent) ?? []), parent] : [];
    chains.set(id, chain);
    return category(id, parent, { ancestorIds: chain, ...extra });
  });
}

const sample = tree([
  ['r', null], ['a', 'r'], ['b', 'r'], ['a1', 'a'], ['a2', 'a'], ['a1a', 'a1'], ['z', null],
]);

describe('walking a tree', () => {
  const index = buildIndex(sample);

  it('orders siblings by position, then name', () => {
    const list = [
      category('b', null, { sortOrder: 1 }),
      category('a', null, { sortOrder: 0 }),
      category('c', null),
      category('d', null, { name: 'Alpha' }),
    ];
    expect([...list].sort(compareSiblings).map((c) => c.id)).toEqual(['a', 'b', 'd', 'c']);
  });

  it('lists children and every descendant at any depth', () => {
    expect(childrenOf(index, 'r').map((c) => c.id)).toEqual(['a', 'b']);
    expect(childrenOf(index, null).map((c) => c.id)).toEqual(['r', 'z']);
    expect(descendantIds(index, 'r').sort()).toEqual(['a', 'a1', 'a1a', 'a2', 'b']);
    expect(subtreeIds(index, 'a1')).toEqual(['a1', 'a1a']);
    expect(descendantIds(index, 'z')).toEqual([]);
  });

  it('gives the path from the top and its depth', () => {
    expect(pathOf(index, 'a1a').map((c) => c.id)).toEqual(['r', 'a', 'a1', 'a1a']);
    expect(depthOf(index, 'a1a')).toBe(3);
    expect(depthOf(index, 'r')).toBe(0);
  });

  it('shows the whole path in the language shown, falling back to the single name', () => {
    const named = buildIndex([
      category('n', null, { name: 'Networking', nameAr: 'شبكات', nameEn: 'Networking' }),
      category('r', 'n', { name: 'Routers', nameAr: 'راوترات', nameEn: 'Routers' }),
      category('w', 'r', { name: 'Wi-Fi 6' }),
    ]);
    expect(pathLabel(named, 'w', 'en')).toBe('Networking › Routers › Wi-Fi 6');
    expect(pathLabel(named, 'w', 'ar')).toBe('شبكات › راوترات › Wi-Fi 6');
    expect(pathLabel(named, 'w', 'en', ' / ')).toBe('Networking / Routers / Wi-Fi 6');
  });

  it('handles a chain of 2,000 levels without a fixed limit or a stack overflow', () => {
    const edges: [string, string | null][] = [];
    for (let i = 0; i < 2000; i++) edges.push([`c${i}`, i === 0 ? null : `c${i - 1}`]);
    const deep = buildIndex(tree(edges));
    expect(descendantIds(deep, 'c0')).toHaveLength(1999);
    expect(pathOf(deep, 'c1999')).toHaveLength(2000);
    expect(chainForChildOf(deep, 'c1999')).toHaveLength(2000);
  });

  it('never loops on bad data with a cycle', () => {
    const broken = buildIndex([category('a', 'b'), category('b', 'a'), category('c', 'c')]);
    expect(descendantIds(broken, 'a').sort()).toEqual(['b']);
    expect(pathOf(broken, 'a').map((c) => c.id).sort()).toEqual(['a', 'b']);
    expect(pathOf(broken, 'c').map((c) => c.id)).toEqual(['c']);
  });

  it('treats a category whose parent is missing as top-level, so nothing disappears', () => {
    const orphaned = buildIndex([category('x', 'gone')]);
    expect(childrenOf(orphaned, null).map((c) => c.id)).toEqual(['x']);
  });
});

describe('moving is only allowed where it cannot make a cycle', () => {
  const index = buildIndex(sample);

  it('refuses itself, its own descendants, no change and missing categories', () => {
    expect(moveProblem(index, 'a', 'a')).toBe('self');
    expect(moveProblem(index, 'a', 'a1')).toBe('descendant');
    expect(moveProblem(index, 'r', 'a1a')).toBe('descendant');
    expect(moveProblem(index, 'a', 'r')).toBe('same');
    expect(moveProblem(index, 'r', null)).toBe('same');
    expect(moveProblem(index, 'a', 'ghost')).toBe('missing');
    expect(moveProblem(index, 'ghost', 'r')).toBe('missing');
  });

  it('allows a sibling, a cousin, an ancestor and the top level', () => {
    expect(moveProblem(index, 'a1', 'b')).toBeNull();
    expect(moveProblem(index, 'a1a', 'z')).toBeNull();
    expect(moveProblem(index, 'a1a', 'r')).toBeNull();
    expect(moveProblem(index, 'a1', null)).toBeNull();
  });

  it('refuses a parent that is awaiting deletion', () => {
    const marked = buildIndex([...sample, category('dying', null, { deletionPending: true })]);
    expect(moveProblem(marked, 'a', 'dying')).toBe('pending');
  });
});

describe('keeping the stored chains right', () => {
  it('a consistent tree has no mismatch', () => {
    expect(findChainMismatches(sample)).toEqual([]);
  });

  it('finds the categories whose chain does not match their parent links', () => {
    const wrong = sample.map((c) => (c.id === 'a1a' ? { ...c, ancestorIds: ['r'] } : c));
    expect(findChainMismatches(wrong).map((c) => c.id)).toEqual(['a1a']);
    const moved = sample.map((c) => (c.id === 'a' ? { ...c, parentId: 'z' } : c));
    // a's own chain and all its descendants' chains are now stale
    expect(findChainMismatches(moved).map((c) => c.id).sort()).toEqual(['a', 'a1', 'a1a', 'a2']);
  });

  it('gives the chain a child of a category must store', () => {
    const index = buildIndex(sample);
    expect(chainForChildOf(index, null)).toEqual([]);
    expect(chainForChildOf(index, 'a1')).toEqual(['r', 'a', 'a1']);
  });

  it('numbers a new category after its siblings', () => {
    const list = tree([['r', null], ['a', 'r'], ['b', 'r']]).map((c, i) => ({
      ...c,
      sortOrder: i === 2 ? 7 : null,
    }));
    const index = buildIndex(list);
    expect(nextSortOrderAmong(index, 'r')).toBe(8);
    expect(nextSortOrderAmong(index, 'a')).toBe(0);
  });
});

describe('what customers and companies see', () => {
  it('a category is only shown when it and every ancestor is active', () => {
    const list = tree([['r', null], ['a', 'r'], ['b', 'a']]).map((c) =>
      c.id === 'a' ? { ...c, isActive: false } : c,
    );
    const index = buildIndex(list);
    expect(isEffectivelyActive(index, 'r')).toBe(true);
    expect(isEffectivelyActive(index, 'a')).toBe(false);
    expect(isEffectivelyActive(index, 'b')).toBe(false); // hidden with its parent
    expect(isEffectivelyActive(index, 'ghost')).toBe(false);
  });

  it('a category awaiting deletion is not shown', () => {
    const index = buildIndex([category('x', null, { deletionPending: true })]);
    expect(isEffectivelyActive(index, 'x')).toBe(false);
  });

  it('finds the top-most category of each interrupted deletion', () => {
    const list = tree([['r', null], ['a', 'r'], ['b', 'a'], ['s', null]]).map((c) =>
      ['r', 'a', 'b'].includes(c.id) ? { ...c, deletionPending: true } : c,
    );
    expect(interruptedDeletions(list).map((c) => c.id)).toEqual(['r']);
  });
});

describe('the rows of the tree page', () => {
  const list = tree([['r', null], ['a', 'r'], ['a1', 'a']]).map((c) => ({
    ...c,
    nameAr: c.id === 'r' ? 'شبكات' : c.id === 'a' ? 'راوترات' : 'واي فاي',
    nameEn: c.id === 'r' ? 'Networking' : c.id === 'a' ? 'Routers' : 'Wi-Fi 6',
  }));

  it('shows only top-level rows until a branch is expanded', () => {
    const rows = visibleRows(list, new Set(), '');
    expect(rows.map((r) => [r.category.id, r.depth, r.hasChildren, r.expanded])).toEqual([
      ['r', 0, true, false],
    ]);
  });

  it('shows expanded branches at their depth', () => {
    const rows = visibleRows(list, new Set(['r', 'a']), '');
    expect(rows.map((r) => [r.category.id, r.depth])).toEqual([['r', 0], ['a', 1], ['a1', 2]]);
  });

  it('searches by Arabic or English name and opens the way to a match', () => {
    const en = visibleRows(list, new Set(), 'wi-fi');
    expect(en.map((r) => [r.category.id, r.matched, r.expanded])).toEqual([
      ['r', false, true],
      ['a', false, true],
      ['a1', true, false],
    ]);
    const ar = visibleRows(list, new Set(), 'واي فاي');
    expect(ar.map((r) => r.category.id)).toEqual(['r', 'a', 'a1']);
    expect(visibleRows(list, new Set(), 'راوترات').map((r) => r.category.id)).toEqual(['r', 'a']);
    expect(visibleRows(list, new Set(), 'nothing here')).toEqual([]);
  });

  it('lists older categories (no parent, no chain) as top-level ones', () => {
    const withOld = [...list, category('old', null)];
    expect(visibleRows(withOld, new Set(), '').map((r) => r.category.id)).toEqual(['old', 'r']);
    expect(findChainMismatches(withOld)).toEqual([]);
  });
});
