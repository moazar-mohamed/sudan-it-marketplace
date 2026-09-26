import { useState, type FormEvent } from 'react';
import { useConfirm, useRunner } from '../components/feedback';
import { ActiveBadge } from '../components/StatusBadges';
import { DataGate, EmptyState, Modal, PageHeader, Text } from '../components/ui';
import {
  createService,
  setServiceActive,
  updateService,
  type ServiceInput,
} from '../data/actions';
import { buildIndex, isEffectivelyActive, pathLabel } from '../data/categoryTree';
import { useCategories, useServices } from '../data/hooks';
import type { CatalogService, Category } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';

function ServiceForm({
  service,
  categories,
  onClose,
}: {
  service: CatalogService | null;
  categories: Category[];
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { busy, run } = useRunner();
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [categoryId, setCategoryId] = useState(service?.categoryId ?? '');
  const [showError, setShowError] = useState(false);

  // Categories that are shown to customers (active, under active parents),
  // each with its full path, plus the service's current one even if it was
  // deactivated since, so editing never silently changes it.
  const index = buildIndex(categories);
  const options = categories
    .filter((c) => isEffectivelyActive(index, c.id) || c.id === service?.categoryId)
    .map((c) => ({ id: c.id, label: pathLabel(index, c.id, locale) || c.id }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const nameMissing = !name.trim();
  const categoryMissing = !categoryId;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (nameMissing || categoryMissing) {
      setShowError(true);
      return;
    }
    const input: ServiceInput = { categoryId, name, description };
    const ok = await run(
      'save',
      () => (service ? updateService(service.id, input) : createService(input)),
      t(service ? 'services.updated' : 'services.saved'),
    );
    if (ok) onClose();
  };

  return (
    <Modal title={t(service ? 'services.editTitle' : 'services.addTitle')} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>{t('services.nameLabel')}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            dir="auto"
            aria-invalid={showError && nameMissing}
          />
          {showError && nameMissing && (
            <small className="field__error">{t('services.nameRequired')}</small>
          )}
        </label>
        <label className="field">
          <span>{t('services.categoryLabel')}</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-invalid={showError && categoryMissing}
          >
            <option value="">{t('services.categoryPlaceholder')}</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {showError && categoryMissing ? (
            <small className="field__error">{t('services.categoryRequired')}</small>
          ) : options.length === 0 ? (
            <small className="muted">{t('services.noCategories')}</small>
          ) : null}
        </label>
        <label className="field">
          <span>{t('services.descriptionLabel')}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            dir="auto"
          />
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

export function ServicesPage() {
  const { t, date, locale } = useI18n();
  const services = useServices();
  const categories = useCategories();
  const confirm = useConfirm();
  const { busy, run } = useRunner();
  // `undefined` = closed, `null` = adding a new service.
  const [editing, setEditing] = useState<CatalogService | null | undefined>(undefined);

  const categoryIndex = buildIndex(categories.data);
  const categoryName = (id: string) => pathLabel(categoryIndex, id, locale) || '—';

  const toggle = async (s: CatalogService) => {
    if (s.isActive) {
      const ok = await confirm({
        title: t('services.confirmDeactivate.title'),
        body: t('services.confirmDeactivate.body', { name: s.name }),
        confirmLabel: t('services.deactivate'),
        danger: true,
      });
      if (!ok) return;
    }
    await run(s.id, () => setServiceActive(s.id, !s.isActive), t('services.updated'));
  };

  return (
    <>
      <PageHeader
        title={t('services.title')}
        subtitle={t('services.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
        actions={
          <button className="btn btn--primary" onClick={() => setEditing(null)}>
            + {t('services.add')}
          </button>
        }
      />
      <DataGate gates={[services, categories]}>
        {services.data.length === 0 ? (
          <EmptyState message={t('services.empty')} />
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('col.name')}</th>
                    <th>{t('col.category')}</th>
                    <th>{t('col.description')}</th>
                    <th>{t('col.status')}</th>
                    <th>{t('col.created')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {services.data.map((s) => (
                    <tr key={s.id}>
                      <td className="strong">
                        <Text>{s.name || '—'}</Text>
                      </td>
                      <td>
                        <Text>{categoryName(s.categoryId)}</Text>
                      </td>
                      <td className="cell-wrap">
                        {s.description ? <Text>{s.description}</Text> : '—'}
                      </td>
                      <td>
                        <ActiveBadge active={s.isActive} />
                      </td>
                      <td className="nowrap">{date(s.createdAt)}</td>
                      <td>
                        <div className="btn-group">
                          <button className="btn btn--sm" onClick={() => setEditing(s)}>
                            {t('common.edit')}
                          </button>
                          <button
                            className={s.isActive ? 'btn btn--danger-ghost btn--sm' : 'btn btn--sm'}
                            disabled={busy === s.id}
                            onClick={() => void toggle(s)}
                          >
                            {s.isActive ? t('services.deactivate') : t('services.activate')}
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
        <ServiceForm
          service={editing}
          categories={categories.data}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
