import { useMemo, useState, type MouseEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AttentionBanner } from '../components/AttentionBanner';
import { CompanyCreateModal } from '../components/CompanyCreateModal';
import { CompanyStatusActions } from '../components/CompanyStatusActions';
import { CompanyStatusBadge } from '../components/StatusBadges';
import { SortTh, useSortedRows } from '../components/sort';
import {
  Chips,
  DataGate,
  EmptyState,
  PageHeader,
  SearchInput,
  Text,
  Thumb,
} from '../components/ui';
import { companiesToCsv, csvFilename, downloadCsv } from '../data/csv';
import { cityChoices, useCities } from '../data/cities';
import { useCompanies, useProducts } from '../data/hooks';
import { isStalledCompany, NO_PRODUCTS_GRACE_DAYS } from '../data/stats';
import { COMPANY_FILTER_STATUSES, type Company, type CompanyFilterStatus } from '../data/types';
import { useNow } from '../data/useNow';
import { useI18n } from '../i18n/I18nProvider';
import { joinLocation, matchesQuery } from '../utils';

/** The city select's value for companies that have not set their cities. */
const NO_CITIES = '__none';

const SORTS = {
  name: (c: Company) => c.name,
  location: (c: Company) => joinLocation(c.city, c.address),
  rating: (c: Company) => c.rating,
  reviews: (c: Company) => c.reviewCount,
  status: (c: Company) => c.status,
  created: (c: Company) => c.createdAt,
};

export function CompaniesPage() {
  const { t, number, date, locale } = useI18n();
  const companies = useCompanies();
  const navigate = useNavigate();
  // The filter lives in the URL (?status=active) so a dashboard card can link
  // straight to the list it counted.
  const [params, setParams] = useSearchParams();
  const statusParam = params.get('status');
  const status: CompanyFilterStatus | 'all' =
    COMPANY_FILTER_STATUSES.find((s) => s === statusParam) ?? 'all';
  // ?attention=noProducts narrows the list to active companies that listed nothing yet.
  const noProducts = params.get('attention') === 'noProducts';
  const products = useProducts(noProducts);
  const now = useNow();
  const setStatus = (next: CompanyFilterStatus | 'all') =>
    setParams(
      { ...(next === 'all' ? {} : { status: next }), ...(noProducts ? { attention: 'noProducts' } : {}) },
      { replace: true },
    );
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  // A company serves a city when it lists it, or lists none (every city).
  const cities = useCities();
  const [cityId, setCityId] = useState(params.get('cities') === 'none' ? NO_CITIES : '');

  // The whole row opens the company. Clicks that belong to a link or a button
  // inside it (the name link, Deactivate, Delete...) are theirs, not the row's.
  const openCompany = (id: string) => (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    navigate(`/companies/${id}`);
  };

  // The ones in the trash live on the Trash page.
  const live = useMemo(() => companies.data.filter((c) => !c.trashedAt), [companies.data]);
  const withProducts = new Set(products.data.map((p) => p.companyId));
  const inScope = noProducts ? live.filter((c) => isStalledCompany(c, withProducts.has(c.id), now)) : live;
  const visible = inScope.filter(
    (c) =>
      (status === 'all' || c.status === status) &&
      (!cityId ||
        (cityId === NO_CITIES ? !c.serviceCityIds?.length : !c.serviceCityIds?.length || c.serviceCityIds.includes(cityId))) &&
      matchesQuery(query, c.name, c.city, c.address, c.email),
  );
  const { rows: sortedRows, sort, toggle } = useSortedRows(visible, SORTS);

  return (
    <>
      <PageHeader
        title={t('companies.title')}
        subtitle={t('companies.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
        actions={
          <>
            <button
              className="btn btn--sm"
              disabled={visible.length === 0}
              onClick={() => downloadCsv(csvFilename('companies', now), companiesToCsv(visible))}
            >
              {t('common.exportCsv')}
            </button>
            <button className="btn btn--primary" onClick={() => setAdding(true)}>
              + {t('companies.add')}
            </button>
          </>
        }
      />
      {adding && <CompanyCreateModal onClose={() => setAdding(false)} />}
      <DataGate gates={noProducts ? [companies, products] : [companies]}>
        {noProducts && (
          <AttentionBanner
            label={t('attention.noProducts', { days: NO_PRODUCTS_GRACE_DAYS })}
            onClear={() => setParams(status === 'all' ? {} : { status }, { replace: true })}
          />
        )}
        <div className="toolbar">
          <Chips
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: t('common.all'), count: inScope.length },
              ...COMPANY_FILTER_STATUSES.map((s) => ({
                value: s,
                label: t(`company.status.${s}`),
                count: inScope.filter((c) => c.status === s).length,
              })),
            ]}
          />
          <select
            aria-label={t('companies.cityFilter')}
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
          >
            <option value="">
              {t('companies.cityFilter')}: {t('company.allCities')}
            </option>
            <option value={NO_CITIES}>{t('companies.cityNone')}</option>
            {cityChoices(cities, cityId ? [cityId] : []).map((city) => (
              <option key={city.id} value={city.id}>
                {locale === 'ar' ? city.ar : city.en}
              </option>
            ))}
          </select>
          <SearchInput value={query} onChange={setQuery} placeholder={t('companies.search')} />
        </div>
        <p className="note">{t('companies.statusNote')}</p>

        {live.length === 0 ? (
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
                    <SortTh label={t('col.name')} sortKey="name" sort={sort} onSort={toggle} />
                    <SortTh label={t('col.location')} sortKey="location" sort={sort} onSort={toggle} />
                    <SortTh label={t('col.rating')} sortKey="rating" sort={sort} onSort={toggle} />
                    <SortTh label={t('col.reviews')} sortKey="reviews" sort={sort} onSort={toggle} />
                    <SortTh label={t('col.status')} sortKey="status" sort={sort} onSort={toggle} />
                    <SortTh label={t('col.created')} sortKey="created" sort={sort} onSort={toggle} />
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((c) => (
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
