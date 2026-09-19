import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AvailabilityBadge } from '../components/StatusBadges';
import { Chips, DataGate, EmptyState, PageHeader, SearchInput, Text, Thumb } from '../components/ui';
import { useProducts } from '../data/hooks';
import { useI18n } from '../i18n/I18nProvider';
import { matchesQuery } from '../utils';

export function ProductsPage() {
  const { t, number, money } = useI18n();
  const products = useProducts();
  const [params, setParams] = useSearchParams();
  const companyId = params.get('company') ?? '';
  const [availability, setAvailability] = useState<'available' | 'unavailable' | 'all'>('all');
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
      (availability === 'all' || (availability === 'available') === isAvailable(p)) &&
      matchesQuery(query, p.name, p.companyName, p.description),
  );

  return (
    <>
      <PageHeader title={t('products.title')} subtitle={t('products.subtitle')} />
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
                    <th>{t('col.product')}</th>
                    <th>{t('col.company')}</th>
                    <th>{t('col.price')}</th>
                    <th>{t('col.stock')}</th>
                    <th>{t('col.delivery')}</th>
                    <th>{t('col.installation')}</th>
                    <th>{t('col.availability')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => (
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
                      <td className="nowrap">{money(p.price, p.currency)}</td>
                      <td>{number(p.stockCount)}</td>
                      <td>{p.isDeliveryAvailable ? t('common.available') : t('common.pickupOnly')}</td>
                      <td>
                        {p.isInstallationAvailable ? t('common.available') : t('common.notOffered')}
                      </td>
                      <td>
                        <AvailabilityBadge available={isAvailable(p)} />
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
