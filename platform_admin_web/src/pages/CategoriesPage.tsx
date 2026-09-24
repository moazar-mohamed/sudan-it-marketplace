import { useState, type FormEvent } from 'react';
import { useConfirm, useRunner } from '../components/feedback';
import { ActiveBadge } from '../components/StatusBadges';
import { DataGate, EmptyState, Modal, PageHeader, Text } from '../components/ui';
import {
  createCategory,
  deleteCategory,
  saveCategoryOrder,
  setCategoryActive,
  updateCategory,
  type CategoryInput,
} from '../data/actions';
import {
  CATEGORY_ICONS,
  categoryDisplayName,
  findCategoryIcon,
  moveId,
  nextSortOrder,
  sortCategories,
} from '../data/categoryIcons';
import { useCategories, useProducts, useServices } from '../data/hooks';
import type { Category } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';

const ARABIC_LETTER = /[؀-ۿ]/;

/** Fills the two name fields of a category that only has the single old name. */
function initialNames(category: Category | null): { ar: string; en: string } {
  if (!category) return { ar: '', en: '' };
  const legacy = category.name;
  return {
    ar: category.nameAr || (ARABIC_LETTER.test(legacy) ? legacy : ''),
    en: category.nameEn || (ARABIC_LETTER.test(legacy) ? '' : legacy),
  };
}

function CategoryForm({
  category,
  nextOrder,
  onClose,
}: {
  category: Category | null;
  nextOrder: number;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { busy, run } = useRunner();
  const initial = initialNames(category);
  const [nameAr, setNameAr] = useState(initial.ar);
  const [nameEn, setNameEn] = useState(initial.en);
  const [description, setDescription] = useState(category?.description ?? '');
  const [iconName, setIconName] = useState(category?.iconName ?? '');
  const [showError, setShowError] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim() || !nameEn.trim()) {
      setShowError(true);
      return;
    }
    const input: CategoryInput = { nameAr, nameEn, description, iconName };
    const ok = await run(
      'save',
      () =>
        category ? updateCategory(category.id, input) : createCategory(input, nextOrder),
      t(category ? 'categories.updated' : 'categories.saved'),
    );
    if (ok) onClose();
  };

  // An icon typed by hand before icons were a list keeps showing as it is.
  const unknownIcon = iconName.trim() && !findCategoryIcon(iconName) ? iconName : null;

  return (
    <Modal
      title={t(category ? 'categories.editTitle' : 'categories.addTitle')}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>{t('categories.nameArLabel')}</span>
          <input
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            autoFocus
            dir="rtl"
            maxLength={100}
            aria-invalid={showError && !nameAr.trim()}
          />
          {showError && !nameAr.trim() && (
            <small className="field__error">{t('categories.nameArRequired')}</small>
          )}
        </label>
        <label className="field">
          <span>{t('categories.nameEnLabel')}</span>
          <input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            dir="ltr"
            maxLength={100}
            aria-invalid={showError && !nameEn.trim()}
          />
          {showError && !nameEn.trim() ? (
            <small className="field__error">{t('categories.nameEnRequired')}</small>
          ) : (
            <small className="muted">{t('categories.nameHint')}</small>
          )}
        </label>
        <label className="field">
          <span>{t('categories.descriptionLabel')}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            dir="auto"
          />
        </label>
        <label className="field">
          <span>{t('categories.iconLabel')}</span>
          <select value={iconName} onChange={(e) => setIconName(e.target.value)}>
            <option value="">{t('categories.iconAuto')}</option>
            {unknownIcon && <option value={unknownIcon}>{unknownIcon}</option>}
            {CATEGORY_ICONS.map((icon) => (
              <option key={icon.key} value={icon.key}>
                {icon.emoji} {locale === 'ar' ? icon.ar : icon.en}
              </option>
            ))}
          </select>
        </label>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy === 'save'}>
            {busy === 'save' ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CategoriesPage() {
  const { t, date, locale } = useI18n();
  const categories = useCategories();
  const products = useProducts();
  const services = useServices();
  const confirm = useConfirm();
  const { busy, run } = useRunner();
  // `undefined` = closed, `null` = adding a new category.
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);

  const sorted = sortCategories(categories.data);

  // How many products and services still use a category; deleting one that is
  // in use would leave them without a category, so it is not offered.
  const usage = (id: string) => ({
    products: products.data.filter((p) => p.categoryId === id).length,
    services: services.data.filter((s) => s.categoryId === id).length,
  });

  const remove = async (c: Category) => {
    const ok = await confirm({
      title: t('categories.confirmDelete.title'),
      body: t('categories.confirmDelete.body', { name: categoryDisplayName(c, locale) }),
      confirmLabel: t('categories.delete'),
      danger: true,
    });
    if (!ok) return;
    await run(c.id, () => deleteCategory(c.id), t('categories.deleted'));
  };

  const move = (index: number, direction: -1 | 1) =>
    run(
      'order',
      () => saveCategoryOrder(moveId(sorted.map((c) => c.id), index, direction)),
      t('categories.updated'),
    );

  const toggle = async (c: Category) => {
    if (c.isActive) {
      const ok = await confirm({
        title: t('categories.confirmDeactivate.title'),
        body: t('categories.confirmDeactivate.body', { name: categoryDisplayName(c, locale) }),
        confirmLabel: t('categories.deactivate'),
        danger: true,
      });
      if (!ok) return;
    }
    await run(c.id, () => setCategoryActive(c.id, !c.isActive), t('categories.updated'));
  };

  return (
    <>
      <PageHeader
        title={t('categories.title')}
        subtitle={t('categories.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
        actions={
          <button className="btn btn--primary" onClick={() => setEditing(null)}>
            + {t('categories.add')}
          </button>
        }
      />
      <DataGate gates={[categories, products, services]}>
        {sorted.length === 0 ? (
          <EmptyState message={t('categories.empty')} />
        ) : (
          <div className="card">
            <p className="muted" style={{ margin: '0 0 12px' }}>
              {t('categories.orderHint')}
            </p>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('categories.position')}</th>
                    <th>{t('col.name')}</th>
                    <th>{t('col.description')}</th>
                    <th>{t('col.icon')}</th>
                    <th>{t('col.status')}</th>
                    <th>{t('col.created')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c, index) => {
                    const icon = findCategoryIcon(c.iconName);
                    const used = usage(c.id);
                    const inUse = used.products + used.services > 0;
                    return (
                      <tr key={c.id}>
                        <td className="nowrap">
                          <div className="btn-group">
                            <button
                              className="btn btn--sm"
                              aria-label={t('categories.moveUp')}
                              title={t('categories.moveUp')}
                              disabled={index === 0 || busy === 'order'}
                              onClick={() => void move(index, -1)}
                            >
                              ▲
                            </button>
                            <button
                              className="btn btn--sm"
                              aria-label={t('categories.moveDown')}
                              title={t('categories.moveDown')}
                              disabled={index === sorted.length - 1 || busy === 'order'}
                              onClick={() => void move(index, 1)}
                            >
                              ▼
                            </button>
                          </div>
                        </td>
                        <td className="strong">
                          <Text>{c.nameAr || c.name || '—'}</Text>
                          {c.nameEn && c.nameEn !== c.nameAr && (
                            <div className="muted" dir="ltr">
                              {c.nameEn}
                            </div>
                          )}
                        </td>
                        <td className="cell-wrap">
                          {c.description ? <Text>{c.description}</Text> : '—'}
                        </td>
                        <td>
                          {icon ? (
                            <span>
                              {icon.emoji} {locale === 'ar' ? icon.ar : icon.en}
                            </span>
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
                        <td className="nowrap">{date(c.createdAt)}</td>
                        <td>
                          <div className="btn-group">
                            <button className="btn btn--sm" onClick={() => setEditing(c)}>
                              {t('common.edit')}
                            </button>
                            <button
                              className={
                                c.isActive ? 'btn btn--danger-ghost btn--sm' : 'btn btn--sm'
                              }
                              disabled={busy === c.id}
                              onClick={() => void toggle(c)}
                            >
                              {c.isActive ? t('categories.deactivate') : t('categories.activate')}
                            </button>
                            <button
                              className="btn btn--danger-ghost btn--sm"
                              disabled={busy === c.id || inUse}
                              title={
                                inUse
                                  ? t('categories.inUse', {
                                      products: used.products,
                                      services: used.services,
                                    })
                                  : undefined
                              }
                              onClick={() => void remove(c)}
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
      {editing !== undefined && (
        <CategoryForm
          category={editing}
          nextOrder={nextSortOrder(categories.data)}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
