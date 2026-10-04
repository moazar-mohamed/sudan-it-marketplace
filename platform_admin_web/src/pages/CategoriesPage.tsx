import { useMemo, useState } from 'react';
import { useConfirm, useRunner } from '../components/feedback';
import { RowMenu } from '../components/RowMenu';
import { Chips, DataGate, EmptyState, PageHeader, SearchInput, Text } from '../components/ui';
import { repairCategoryChains, saveSiblingOrder, setCategoryActive } from '../data/actions';
import { categoryDisplayName, findCategoryIcon, moveId } from '../data/categoryIcons';
import {
  buildIndex,
  childrenOf,
  findChainMismatches,
  interruptedDeletions,
  visibleRows,
  type StatusFilter,
} from '../data/categoryTree';
import { useCategories, useProducts, useServices } from '../data/hooks';
import type { Category } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import {
  CategoryForm,
  DeleteDialog,
  MoveDialog,
  type FormTarget,
} from './CategoryDialogs';

/** The tint of a main category's tile, picked from its id so it never changes. */
const TONES = ['primary', 'success', 'warning', 'info'] as const;
const hashOf = (id: string) => [...id].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7);

type Dialog =
  | { kind: 'form'; target: FormTarget }
  | { kind: 'move'; category: Category }
  | { kind: 'delete'; category: Category };

/**
 * Category management: ONE tree, any depth, shared by products and services.
 * Platform Admin adds top-level and sub-categories anywhere, edits, moves,
 * orders, deactivates and deletes them (with everything filed under a deleted
 * one). Companies only ever pick from these trees.
 */
export function CategoriesPage() {
  const { t, locale } = useI18n();
  const categories = useCategories();
  const products = useProducts();
  const services = useServices();
  const confirm = useConfirm();
  const { busy, run } = useRunner();

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const all = categories.data;
  const index = useMemo(() => buildIndex(all), [all]);
  const rows = useMemo(() => visibleRows(all, expanded, query, status), [all, expanded, query, status]);
  const interrupted = useMemo(() => interruptedDeletions(all), [all]);
  const mismatched = useMemo(() => findChainMismatches(all), [all]);

  // Products and services filed directly in each category.
  const itemsIn = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of [...products.data, ...services.data]) {
      const id = item.categoryId;
      if (id) map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [products.data, services.data]);

  const toggleOpen = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const expandAll = () =>
    setExpanded(new Set(all.filter((c) => childrenOf(index, c.id).length > 0).map((c) => c.id)));
  const collapseAll = () => setExpanded(new Set());
  const open = (id: string | null) => {
    if (id) setExpanded((prev) => new Set(prev).add(id));
  };

  const reorder = (parentId: string | null, position: number, direction: -1 | 1) =>
    run(
      'order',
      () =>
        saveSiblingOrder(
          moveId(
            childrenOf(index, parentId).map((c) => c.id),
            position,
            direction,
          ),
        ),
      t('categories.updated'),
    );

  const toggleActive = async (c: Category) => {
    if (c.isActive) {
      const ok = await confirm({
        title: t('categories.confirmDeactivate.title'),
        body: `${t('categories.confirmDeactivate.body', { name: categoryDisplayName(c, locale) })} ${t('categories.deactivateHint')}`,
        confirmLabel: t('categories.deactivate'),
        danger: true,
      });
      if (!ok) return;
    }
    await run(c.id, () => setCategoryActive(c.id, !c.isActive, c.nameEn || c.nameAr || c.name), t('categories.updated'));
  };

  const repair = () =>
    run('repair', () => repairCategoryChains(all), (fixed) => t('categories.repaired', { n: fixed }));

  const parentIdOf = (c: Category) => (c.parentId && index.byId.has(c.parentId) ? c.parentId : null);

  // Each main category is one card; whatever is open under it sits inside that card.
  const groups = rows.reduce<(typeof rows)[]>((acc, row) => {
    if (row.depth === 0 || acc.length === 0) acc.push([row]);
    else acc[acc.length - 1].push(row);
    return acc;
  }, []);
  const groupTone = (root: Category) =>
    root.isActive ? TONES[hashOf(root.id) % TONES.length] : 'neutral';

  const renderRow = (
    { category: c, depth, hasChildren, expanded: isOpen, matched }: (typeof rows)[number],
    isRoot: boolean,
    tone: string,
  ) => {
    const siblings = childrenOf(index, parentIdOf(c));
    const position = siblings.findIndex((s) => s.id === c.id);
    const icon = findCategoryIcon(c.iconName);
    const name = categoryDisplayName(c, locale) || '—';
    const own = itemsIn.get(c.id) ?? 0;
    const subCount = childrenOf(index, c.id).length;
    const meta = [
      subCount > 0 ? t('categories.subCount', { n: subCount }) : null,
      own > 0 ? t('categories.inThisOne', { n: own }) : null,
    ].filter(Boolean);
    const ordering = busy === 'order' || query.trim() !== '' || status !== 'all';
    const statusLabel = c.isActive ? t('user.active') : t('user.inactive');
    const classes = [
      'cat-row',
      isRoot ? 'cat-row--root' : 'cat-row--kid',
      matched ? 'row--match' : '',
      c.isActive ? '' : 'cat-row--off',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <div key={c.id} className={classes} style={isRoot ? undefined : { paddingInlineStart: 14 + (depth - 1) * 22 }}>
        {hasChildren ? (
          <button
            type="button"
            className="tree-toggle"
            aria-expanded={isOpen}
            aria-label={t(isOpen ? 'categories.collapse' : 'categories.expand', { name })}
            onClick={() => toggleOpen(c.id)}
          >
            {isOpen ? '▾' : locale === 'ar' ? '◂' : '▸'}
          </button>
        ) : (
          <span className="tree-toggle tree-toggle--leaf" aria-hidden="true" />
        )}
        {isRoot ? (
          <span className={`cat-tile cat-tile--${tone}`} aria-hidden="true">
            {icon ? icon.emoji : (name.trim().charAt(0) || '•').toUpperCase()}
          </span>
        ) : (
          <span className={c.isActive ? 'status-dot status-dot--on' : 'status-dot'} aria-hidden="true" />
        )}
        <div className="cat-main">
          <div className="cat-name">
            <Text>{c.nameAr || c.name || '—'}</Text>
            {c.nameEn && c.nameEn !== c.nameAr && (
              <span className="muted cat-name__en">
                <bdi dir="ltr">{c.nameEn}</bdi>
              </span>
            )}
          </div>
          {meta.length > 0 && <div className="muted cat-meta">{meta.join(' · ')}</div>}
        </div>
        {isRoot && (
          <span className={c.isActive ? 'cat-status cat-status--on' : 'cat-status'}>
            <span className={c.isActive ? 'status-dot status-dot--on' : 'status-dot'} aria-hidden="true" />
            {statusLabel}
          </span>
        )}
        <div className="cat-actions">
          <button
            className="btn btn--sm cat-add"
            onClick={() => setDialog({ kind: 'form', target: { kind: 'create', parent: c } })}
          >
            {t('categories.addChild')}
          </button>
          <RowMenu
            label={t('categories.moreActions', { name })}
            items={[
              {
                key: 'edit',
                label: t('common.edit'),
                onSelect: () => setDialog({ kind: 'form', target: { kind: 'edit', category: c } }),
              },
              { key: 'move', label: t('categories.move'), onSelect: () => setDialog({ kind: 'move', category: c }) },
              {
                key: 'up',
                label: t('categories.moveUp'),
                disabled: position <= 0 || ordering,
                onSelect: () => void reorder(parentIdOf(c), position, -1),
                separated: true,
              },
              {
                key: 'down',
                label: t('categories.moveDown'),
                disabled: position === siblings.length - 1 || ordering,
                onSelect: () => void reorder(parentIdOf(c), position, 1),
              },
              {
                key: 'active',
                label: c.isActive ? t('categories.deactivate') : t('categories.activate'),
                disabled: busy === c.id,
                danger: c.isActive,
                onSelect: () => void toggleActive(c),
                separated: true,
              },
              {
                key: 'delete',
                label: t('categories.delete'),
                danger: true,
                onSelect: () => setDialog({ kind: 'delete', category: c }),
              },
            ]}
          />
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title={t('categories.title')}
        subtitle={t('categories.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
        actions={
          <button
            className="btn btn--primary"
            onClick={() => setDialog({ kind: 'form', target: { kind: 'create', parent: null } })}
          >
            + {t('categories.add')}
          </button>
        }
      />
      <DataGate gates={[categories, products, services]}>
        {interrupted.map((c) => (
          <div key={c.id} className="alert alert--warning" role="status">
            <Text>{t('categories.interrupted', { name: categoryDisplayName(c, locale) })}</Text>{' '}
            <button className="btn btn--sm" onClick={() => setDialog({ kind: 'delete', category: c })}>
              {t('categories.resume')}
            </button>
          </div>
        ))}
        {mismatched.length > 0 && (
          <div className="alert alert--warning" role="status">
            {t('categories.repairNeeded')}{' '}
            <button className="btn btn--sm" disabled={busy === 'repair'} onClick={() => void repair()}>
              {t('categories.repair')}
            </button>
          </div>
        )}

        <div className="toolbar">
          <Chips
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: t('common.all'), count: all.length },
              { value: 'active', label: t('user.active'), count: all.filter((c) => c.isActive).length },
              { value: 'inactive', label: t('user.inactive'), count: all.filter((c) => !c.isActive).length },
            ]}
          />
          <SearchInput value={query} onChange={setQuery} placeholder={t('categories.search')} />
          <div className="btn-group">
            <button className="btn btn--sm" onClick={expandAll}>
              {t('categories.expandAll')}
            </button>
            <button className="btn btn--sm" onClick={collapseAll}>
              {t('categories.collapseAll')}
            </button>
          </div>
        </div>

        {all.length === 0 ? (
          <EmptyState message={t('categories.empty')} />
        ) : rows.length === 0 ? (
          <EmptyState message={t('categories.noMatch')} />
        ) : (
          <ul className="cat-list">
            {groups.map((group) => (
              <li key={group[0].category.id} className="cat-card">
                {group.map((row, i) => renderRow(row, i === 0, groupTone(group[0].category)))}
              </li>
            ))}
          </ul>
        )}
      </DataGate>

      {dialog?.kind === 'form' && (
        <CategoryForm
          target={dialog.target}
          all={all}
          onClose={() => setDialog(null)}
          onCreated={open}
        />
      )}
      {dialog?.kind === 'move' && (
        <MoveDialog category={dialog.category} all={all} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteDialog category={dialog.category} all={all} onClose={() => setDialog(null)} />
      )}
    </>
  );
}
