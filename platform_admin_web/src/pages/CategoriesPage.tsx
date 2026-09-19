import { useState, type FormEvent } from 'react';
import { useConfirm, useRunner } from '../components/feedback';
import { ActiveBadge } from '../components/StatusBadges';
import { DataGate, EmptyState, Modal, PageHeader, Text } from '../components/ui';
import {
  createCategory,
  setCategoryActive,
  updateCategory,
  type CategoryInput,
} from '../data/actions';
import { useCategories } from '../data/hooks';
import type { Category } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';

function CategoryForm({
  category,
  onClose,
}: {
  category: Category | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [iconName, setIconName] = useState(category?.iconName ?? '');
  const [showError, setShowError] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setShowError(true);
      return;
    }
    const input: CategoryInput = { name, description, iconName };
    const ok = await run(
      'save',
      () => (category ? updateCategory(category.id, input) : createCategory(input)),
      t(category ? 'categories.updated' : 'categories.saved'),
    );
    if (ok) onClose();
  };

  return (
    <Modal
      title={t(category ? 'categories.editTitle' : 'categories.addTitle')}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>{t('categories.nameLabel')}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            dir="auto"
            aria-invalid={showError && !name.trim()}
          />
          {showError && !name.trim() ? (
            <small className="field__error">{t('categories.nameRequired')}</small>
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
          <input value={iconName} onChange={(e) => setIconName(e.target.value)} dir="ltr" />
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
  const { t, date } = useI18n();
  const categories = useCategories();
  const confirm = useConfirm();
  const { busy, run } = useRunner();
  // `undefined` = closed, `null` = adding a new category.
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);

  const toggle = async (c: Category) => {
    if (c.isActive) {
      const ok = await confirm({
        title: t('categories.confirmDeactivate.title'),
        body: t('categories.confirmDeactivate.body', { name: c.name }),
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
        actions={
          <button className="btn btn--primary" onClick={() => setEditing(null)}>
            + {t('categories.add')}
          </button>
        }
      />
      <DataGate gates={[categories]}>
        {categories.data.length === 0 ? (
          <EmptyState message={t('categories.empty')} />
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('col.name')}</th>
                    <th>{t('col.description')}</th>
                    <th>{t('col.icon')}</th>
                    <th>{t('col.status')}</th>
                    <th>{t('col.created')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.data.map((c) => (
                    <tr key={c.id}>
                      <td className="strong">
                        <Text>{c.name || '—'}</Text>
                      </td>
                      <td className="cell-wrap">
                        {c.description ? <Text>{c.description}</Text> : '—'}
                      </td>
                      <td>{c.iconName ? <bdi className="mono" dir="ltr">{c.iconName}</bdi> : '—'}</td>
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
                            className={c.isActive ? 'btn btn--danger-ghost btn--sm' : 'btn btn--sm'}
                            disabled={busy === c.id}
                            onClick={() => void toggle(c)}
                          >
                            {c.isActive ? t('categories.deactivate') : t('categories.activate')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DataGate>
      {editing !== undefined && (
        <CategoryForm category={editing} onClose={() => setEditing(undefined)} />
      )}
    </>
  );
}
