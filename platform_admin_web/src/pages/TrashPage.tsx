import { useMemo, useState } from 'react';
import { useConfirm, useRunner } from '../components/feedback';
import { CompanyStatusBadge } from '../components/StatusBadges';
import { Badge, Chips, DataGate, EmptyState, PageHeader, SearchInput, Text } from '../components/ui';
import { deleteCompany, restoreCategory, restoreCompany } from '../data/actions';
import { categoryDisplayName } from '../data/categoryIcons';
import type { CompanyDeletionSummary } from '../data/deleteCompany';
import { useAllCategories, useCompanies, useProducts } from '../data/hooks';
import type { Category, Company } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import { matchesQuery } from '../utils';
import { DeleteDialog } from './CategoryDialogs';

type Kind = 'company' | 'category';

type Entry =
  | { key: string; kind: 'company'; at: number; company: Company }
  | { key: string; kind: 'category'; at: number; category: Category; subCount: number; parentTrashed: boolean };

const time = (d: Date | null | undefined) => (d ? d.getTime() : 0);

/**
 * What Platform Admin moved to the trash: companies, and categories with
 * everything below them. Nothing is deleted until "Delete forever", which runs
 * the same full deletion the old Delete buttons did.
 */
export function TrashPage() {
  const { t, date, locale } = useI18n();
  const companies = useCompanies();
  const categories = useAllCategories();
  const products = useProducts();
  const confirm = useConfirm();
  const { busy, run } = useRunner();
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [purging, setPurging] = useState<Category | null>(null);

  const entries = useMemo<Entry[]>(() => {
    const byId = new Map(categories.data.map((c) => [c.id, c]));
    const trashedCategories = categories.data.filter((c) => c.trashedAt);
    const list: Entry[] = [];
    for (const company of companies.data) {
      if (company.trashedAt) list.push({ key: `company:${company.id}`, kind: 'company', at: time(company.trashedAt), company });
    }
    for (const category of trashedCategories) {
      // One entry per trash action: the category that was chosen, which carries its subtree.
      if (category.trashRootId && category.trashRootId !== category.id) continue;
      const parent = category.parentId ? byId.get(category.parentId) : undefined;
      list.push({
        key: `category:${category.id}`,
        kind: 'category',
        at: time(category.trashedAt),
        category,
        subCount: trashedCategories.filter((c) => c.trashRootId === category.id && c.id !== category.id).length,
        parentTrashed: !!parent?.trashedAt,
      });
    }
    return list.sort((a, b) => b.at - a.at);
  }, [companies.data, categories.data]);

  const nameOf = (e: Entry) => (e.kind === 'company' ? e.company.name : categoryDisplayName(e.category, locale));
  const visible = entries.filter((e) => (kind === 'all' || e.kind === kind) && matchesQuery(query, nameOf(e)));

  const restore = (e: Entry) =>
    run(
      e.key,
      async () => {
        if (e.kind === 'company') await restoreCompany(e.company);
        else await restoreCategory(categories.data, e.category.id);
      },
      t('trash.restored'),
    );

  const purgeCompany = async (company: Company, key: string) => {
    const count = products.data.filter((p) => p.companyId === company.id).length;
    const ok = await confirm({
      title: t('companies.confirmDelete.title'),
      body: t('companies.confirmDelete.body', { name: company.name, count }),
      confirmLabel: t('trash.deleteForever'),
      danger: true,
    });
    if (!ok) return;
    await run(key, () => deleteCompany(company.id, company.name), (r: CompanyDeletionSummary) =>
      t('companies.deletedCascade', {
        admins: r.admins,
        technicians: r.technicians,
        products: r.products,
        other: r.other + r.invites,
        orders: r.ordersKept === null ? t('companies.ordersKeptUnknown') : t('companies.ordersKept', { count: r.ordersKept }),
      }),
    );
  };

  return (
    <>
      <PageHeader title={t('trash.title')} subtitle={t('trash.subtitle')} back={{ to: '/', label: t('nav.dashboard') }} />
      {purging && <DeleteDialog category={purging} all={categories.data} onClose={() => setPurging(null)} />}
      <DataGate gates={[companies, categories]}>
        <div className="toolbar">
          <Chips
            value={kind}
            onChange={setKind}
            options={[
              { value: 'all', label: t('common.all'), count: entries.length },
              { value: 'company', label: t('trash.type.company'), count: entries.filter((e) => e.kind === 'company').length },
              { value: 'category', label: t('trash.type.category'), count: entries.filter((e) => e.kind === 'category').length },
            ]}
          />
          <SearchInput value={query} onChange={setQuery} placeholder={t('trash.search')} />
        </div>
        {entries.length === 0 ? (
          <EmptyState message={t('trash.empty')} />
        ) : visible.length === 0 ? (
          <EmptyState message={t('common.noResults')} />
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('trash.col.item')}</th>
                    <th>{t('trash.col.type')}</th>
                    <th>{t('trash.col.details')}</th>
                    <th>{t('trash.col.trashed')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => (
                    <tr key={e.key}>
                      <td>
                        <Text>{nameOf(e) || '—'}</Text>
                      </td>
                      <td>
                        <Badge tone={e.kind === 'company' ? 'info' : 'progress'}>{t(`trash.type.${e.kind}`)}</Badge>
                      </td>
                      <td>
                        {e.kind === 'company' ? (
                          <span className="trash-was">
                            {t('trash.wasStatus', { status: '' })}
                            <CompanyStatusBadge status={e.company.statusBeforeTrash ?? 'inactive'} />
                          </span>
                        ) : e.subCount > 0 ? (
                          t('trash.subCategories', { n: e.subCount })
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="nowrap">
                        {date(e.kind === 'company' ? (e.company.trashedAt ?? null) : (e.category.trashedAt ?? null))}
                      </td>
                      <td>
                        <div className="btn-group">
                          <button
                            className="btn btn--sm"
                            disabled={busy === e.key || (e.kind === 'category' && e.parentTrashed)}
                            title={e.kind === 'category' && e.parentTrashed ? t('trash.parentTrashed') : undefined}
                            onClick={() => void restore(e)}
                          >
                            {t('trash.restore')}
                          </button>
                          <button
                            className="btn btn--danger btn--sm"
                            disabled={busy === e.key}
                            onClick={() => (e.kind === 'company' ? void purgeCompany(e.company, e.key) : setPurging(e.category))}
                          >
                            {t('trash.deleteForever')}
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
    </>
  );
}
