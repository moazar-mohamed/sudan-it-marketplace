import { useMemo, useState } from 'react';
import { useConfirm, useRunner } from '../components/feedback';
import { ActiveBadge } from '../components/StatusBadges';
import { DataGate, EmptyState, PageHeader, SearchInput, Text } from '../components/ui';
import { repairCategoryChains, saveSiblingOrder, setCategoryActive } from '../data/actions';
import { categoryDisplayName, findCategoryIcon, moveId } from '../data/categoryIcons';
import {
  buildIndex,
  childrenOf,
  findChainMismatches,
  interruptedDeletions,
  visibleRows,
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
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const all = categories.data;
  const index = useMemo(() => buildIndex(all), [all]);
  const rows = useMemo(() => visibleRows(all, expanded, query), [all, expanded, query]);
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
    await run(c.id, () => setCategoryActive(c.id, !c.isActive), t('categories.updated'));
  };

  const repair = () =>
    run('repair', () => repairCategoryChains(all), (fixed) => t('categories.repaired', { n: fixed }));

  const parentIdOf = (c: Category) => (c.parentId && index.byId.has(c.parentId) ? c.parentId : null);

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
          <div className="card">
            <div className="table-wrap">
              <table className="data category-tree">
                <thead>
                  <tr>
                    <th>{t('col.name')}</th>
                    <th>{t('col.icon')}</th>
                    <th>{t('col.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ category: c, depth, hasChildren, expanded: isOpen, matched }) => {
                    const siblings = childrenOf(index, parentIdOf(c));
                    const position = siblings.findIndex((s) => s.id === c.id);
                    const icon = findCategoryIcon(c.iconName);
                    const name = categoryDisplayName(c, locale) || '—';
                    const own = itemsIn.get(c.id) ?? 0;
                    const subCount = childrenOf(index, c.id).length;
                    return (
                      <tr key={c.id} className={matched ? 'row--match' : undefined}>
                        <td className="strong">
                          <div className="tree-name" style={{ paddingInlineStart: depth * 22 }}>
                            {hasChildren ? (
                              <button
                                type="button"
                                className="tree-toggle"
                                aria-expanded={isOpen}
                                aria-label={t(isOpen ? 'categories.collapse' : 'categories.expand', {
                                  name,
                                })}
                                onClick={() => toggleOpen(c.id)}
                              >
                                {isOpen ? '▾' : locale === 'ar' ? '◂' : '▸'}
                              </button>
                            ) : (
                              <span className="tree-toggle tree-toggle--leaf" aria-hidden="true">
                                •
                              </span>
                            )}
                            <span>
                              <Text>{c.nameAr || c.name || '—'}</Text>
                              {c.nameEn && c.nameEn !== c.nameAr && (
                                <span className="muted" dir="ltr">
                                  {' '}
                                  · {c.nameEn}
                                </span>
                              )}
                              <span className="muted tree-meta">
                                {subCount > 0 && ` · ${t('categories.subCount', { n: subCount })}`}
                                {own > 0 && ` · ${t('categories.inThisOne', { n: own })}`}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td>
                          {icon ? (
                            <span>{icon.emoji}</span>
                          ) : c.iconName ? (
                            <bdi className="mono" dir="ltr">
                              {c.iconName}
                            </bdi>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <ActiveBadge active={c.isActive} />
                        </td>
                        <td>
                          <div className="btn-group">
                            <button
                              className="btn btn--sm"
                              aria-label={t('categories.moveUp')}
                              title={t('categories.moveUp')}
                              disabled={position <= 0 || busy === 'order' || query.trim() !== ''}
                              onClick={() => void reorder(parentIdOf(c), position, -1)}
                            >
                              ▲
                            </button>
                            <button
                              className="btn btn--sm"
                              aria-label={t('categories.moveDown')}
                              title={t('categories.moveDown')}
                              disabled={
                                position === siblings.length - 1 ||
                                busy === 'order' ||
                                query.trim() !== ''
                              }
                              onClick={() => void reorder(parentIdOf(c), position, 1)}
                            >
                              ▼
                            </button>
                            <button
                              className="btn btn--sm"
                              onClick={() =>
                                setDialog({
                                  kind: 'form',
                                  target: { kind: 'create', parent: c },
                                })
                              }
                            >
                              {t('categories.addChild')}
                            </button>
                            <button
                              className="btn btn--sm"
                              onClick={() => setDialog({ kind: 'form', target: { kind: 'edit', category: c } })}
                            >
                              {t('common.edit')}
                            </button>
                            <button
                              className="btn btn--sm"
                              onClick={() => setDialog({ kind: 'move', category: c })}
                            >
                              {t('categories.move')}
                            </button>
                            <button
                              className={c.isActive ? 'btn btn--danger-ghost btn--sm' : 'btn btn--sm'}
                              disabled={busy === c.id}
                              onClick={() => void toggleActive(c)}
                            >
                              {c.isActive ? t('categories.deactivate') : t('categories.activate')}
                            </button>
                            <button
                              className="btn btn--danger-ghost btn--sm"
                              onClick={() => setDialog({ kind: 'delete', category: c })}
                            >
                              {t('categories.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
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
