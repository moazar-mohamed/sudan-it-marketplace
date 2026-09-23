import { useState, type MouseEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CompanyCreateModal } from '../components/CompanyCreateModal';
import { CompanyStatusActions } from '../components/CompanyStatusActions';
import { CompanyStatusBadge } from '../components/StatusBadges';
import {
  Chips,
  DataGate,
  EmptyState,
  PageHeader,
  SearchInput,
  Text,
  Thumb,
} from '../components/ui';
import { useCompanies } from '../data/hooks';
import { COMPANY_FILTER_STATUSES, type CompanyFilterStatus } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import { joinLocation, matchesQuery } from '../utils';

export function CompaniesPage() {
  const { t, number, date } = useI18n();
  const companies = useCompanies();
  const navigate = useNavigate();
  // The filter lives in the URL (?status=active) so a dashboard card can link
  // straight to the list it counted.
  const [params, setParams] = useSearchParams();
  const statusParam = params.get('status');
  const status: CompanyFilterStatus | 'all' =
    COMPANY_FILTER_STATUSES.find((s) => s === statusParam) ?? 'all';
  const setStatus = (next: CompanyFilterStatus | 'all') =>
    setParams(next === 'all' ? {} : { status: next }, { replace: true });
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  // The whole row opens the company. Clicks that belong to a link or a button
  // inside it (the name link, Deactivate, Delete...) are theirs, not the row's.
  const openCompany = (id: string) => (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    navigate(`/companies/${id}`);
  };

  const visible = companies.data.filter(
    (c) =>
      (status === 'all' || c.status === status) &&
      matchesQuery(query, c.name, c.city, c.address, c.email),
  );

  return (
    <>
      <PageHeader
        title={t('companies.title')}
        subtitle={t('companies.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
        actions={
          <button className="btn btn--primary" onClick={() => setAdding(true)}>
            + {t('companies.add')}
          </button>
        }
      />
      {adding && <CompanyCreateModal onClose={() => setAdding(false)} />}
      <DataGate gates={[companies]}>
        <div className="toolbar">
          <Chips
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: t('common.all'), count: companies.data.length },
              ...COMPANY_FILTER_STATUSES.map((s) => ({
                value: s,
                label: t(`company.status.${s}`),
                count: companies.data.filter((c) => c.status === s).length,
              })),
            ]}
          />
          <SearchInput value={query} onChange={setQuery} placeholder={t('companies.search')} />
        </div>
        <p className="note">{t('companies.statusNote')}</p>

        {companies.data.length === 0 ? (
          <EmptyState message={t('companies.empty')} />
        ) : visible.length === 0 ? (
          <EmptyState message={t('common.noResults')} />
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('col.logo')}</th>
                    <th>{t('col.name')}</th>
                    <th>{t('col.location')}</th>
                    <th>{t('col.rating')}</th>
                    <th>{t('col.reviews')}</th>
                    <th>{t('col.status')}</th>
                    <th>{t('col.created')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr key={c.id} className="row--clickable" onClick={openCompany(c.id)}>
                      <td>
                        <Thumb src={c.logoUrl} />
                      </td>
                      <td>
                        <Link to={`/companies/${c.id}`} className="strong">
                          <Text>{c.name || '—'}</Text>
                        </Link>
                      </td>
                      <td>
                        <Text>{joinLocation(c.city, c.address)}</Text>
                      </td>
                      <td className="nowrap">{number(c.rating)} ★</td>
                      <td>{number(c.reviewCount)}</td>
                      <td>
                        <CompanyStatusBadge status={c.status} />
                      </td>
                      <td className="nowrap">{date(c.createdAt)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <CompanyStatusActions company={c} />
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
