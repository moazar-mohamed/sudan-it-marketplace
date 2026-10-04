import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SortTh, useSortedRows } from '../components/sort';
import { AvailabilityBadge } from '../components/StatusBadges';
import { Badge } from '../components/ui';
import { Chips, DataGate, EmptyState, PageHeader, SearchInput, Text, Thumb } from '../components/ui';
import { csvFilename, downloadCsv, productsToCsv } from '../data/csv';
import { useProducts } from '../data/hooks';
import type { Product } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import { matchesQuery } from '../utils';

const SORTS = {
  name: (p: Product) => p.name,
  company: (p: Product) => p.companyName,
  price: (p: Product) => p.price,
  stock: (p: Product) => p.stockCount,
  delivery: (p: Product) => (p.isDeliveryAvailable ? 1 : 0),
  installation: (p: Product) => (p.isInstallationAvailable ? 1 : 0),
  availability: (p: Product) => (p.inStock && p.stockCount > 0 ? 1 : 0),
};

export function ProductsPage() {
  const { t, number, money } = useI18n();
  const products = useProducts();
  const [params, setParams] = useSearchParams();
  const companyId = params.get('company') ?? '';
  const [availability, setAvailability] = useState<'available' | 'unavailable' | 'hidden' | 'all'>('all');
  const [query, setQuery] = useState('');

  const companyOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const p of products.data) {
      if (p.companyId && !byId.has(p.companyId)) byId.set(p.companyId, p.companyName || p.companyId);
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [products.data]);

  const isAvailable = (p: { inStock: boolean; stockCount: number }) => p.inStock && p.stockCount > 0;
  const inCompany = products.data.filter((p) => !companyId || p.companyId === companyId);
  const visible = inCompany.filter(
    (p) =>
      (availability === 'all' ||
        (availability === 'hidden' ? p.hidden : availability === 'available' ? isAvailable(p) : !isAvailable(p))) &&
      matchesQuery(query, p.name, p.companyName, p.description),
  );
  const { rows: sortedRows, sort, toggle: toggleSort } = useSortedRows(visible, SORTS);

  return (
    <>
      <PageHeader
        title={t('products.title')}
        subtitle={t('products.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
        actions={
          <button
            className="btn btn--sm"
            disabled={visible.length === 0}
            onClick={() => downloadCsv(csvFilename('products', Date.now()), productsToCsv(sortedRows))}
          >
            {t('common.exportCsv')}
          </button>
        }
      />
      <DataGate gates={[products]}>
        <div className="toolbar">
          <Chips
            value={availability}
            onChange={setAvailability}
            options={[
              { value: 'all', label: t('common.all'), count: inCompany.length },
              {
                value: 'available',
                label: t('product.available'),
                count: inCompany.filter(isAvailable).length,
              },
              {
                value: 'unavailable',
                label: t('product.unavailable'),
                count: inCompany.filter((p) => !isAvailable(p)).length,
              },
              {
                value: 'hidden',
                label: t('products.filterHidden'),
                count: inCompany.filter((p) => p.hidden).length,
              },
            ]}
          />
          <div className="toolbar__end">
            <select
              className="select"
              value={companyId}
              aria-label={t('col.company')}
              onChange={(e) => setParams(e.target.value ? { company: e.target.value } : {})}
            >
              <option value="">{t('products.allCompanies')}</option>
              {companyOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <SearchInput value={query} onChange={setQuery} placeholder={t('products.search')} />
          </div>
        </div>

        {products.data.length === 0 ? (
          <EmptyState message={t('products.empty')} />
        ) : visible.length === 0 ? (
          <EmptyState message={t('common.noResults')} />
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('col.image')}</th>
                    <SortTh label={t('col.product')} sortKey="name" sort={sort} onSort={toggleSort} />
                    <SortTh label={t('col.company')} sortKey="company" sort={sort} onSort={toggleSort} />
                    <SortTh label={t('col.price')} sortKey="price" sort={sort} onSort={toggleSort} />
                    <SortTh label={t('col.stock')} sortKey="stock" sort={sort} onSort={toggleSort} />
                    <SortTh label={t('col.delivery')} sortKey="delivery" sort={sort} onSort={toggleSort} />
                    <SortTh label={t('col.installation')} sortKey="installation" sort={sort} onSort={toggleSort} />
                    <SortTh label={t('col.availability')} sortKey="availability" sort={sort} onSort={toggleSort} />
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Thumb src={p.imageUrl} />
                      </td>
                      <td>
                        <Link to={`/products/${p.id}`} className="strong">
                          <Text>{p.name || '—'}</Text>
                        </Link>
                      </td>
                      <td>
                        <Text>{p.companyName || '—'}</Text>
                      </td>
                      <td className="nowrap">{p.price === null ? t('product.priceOnRequest') : money(p.price, p.currency)}</td>
                      <td>{number(p.stockCount)}</td>
                      <td>{p.isDeliveryAvailable ? t('common.available') : t('common.pickupOnly')}</td>
                      <td>
                        {p.isInstallationAvailable ? t('common.available') : t('common.notOffered')}
                      </td>
                      <td>
                        <AvailabilityBadge available={isAvailable(p)} />
                        {p.hidden && <Badge tone="warning">{t('product.hiddenBadge')}</Badge>}
                      </td>
                      <td>
                        <Link to={`/products/${p.id}`} className="btn btn--sm">
                          {t('common.view')}
                        </Link>
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
