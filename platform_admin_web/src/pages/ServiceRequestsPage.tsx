import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ServiceRequestStatusBadge } from '../components/StatusBadges';
import { Chips, DataGate, EmptyState, PageHeader, SearchInput, Text } from '../components/ui';
import { useServiceRequests } from '../data/hooks';
import { SERVICE_REQUEST_STATUSES, type ServiceRequestStatus } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import { customerLabel, matchesQuery, shortId } from '../utils';

/** Every service request across the marketplace, read-only (like orders). */
export function ServiceRequestsPage() {
  const { t, money, dateTime } = useI18n();
  const requests = useServiceRequests();
  // Company and status filters live in the URL, as on the orders list.
  const [params, setParams] = useSearchParams();
  const companyId = params.get('company') ?? '';
  const statusParam = params.get('status');
  const status: ServiceRequestStatus | 'all' =
    SERVICE_REQUEST_STATUSES.find((s) => s === statusParam) ?? 'all';
  const updateFilters = (next: { company?: string; status?: ServiceRequestStatus | 'all' }) => {
    const company = next.company ?? companyId;
    const nextStatus = next.status ?? status;
    setParams(
      {
        ...(company ? { company } : {}),
        ...(nextStatus !== 'all' ? { status: nextStatus } : {}),
      },
      { replace: true },
    );
  };
  const [query, setQuery] = useState('');

  const companyOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const r of requests.data) {
      if (r.companyId && !byId.has(r.companyId)) byId.set(r.companyId, r.companyName || r.companyId);
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [requests.data]);

  const inCompany = requests.data.filter((r) => !companyId || r.companyId === companyId);
  const visible = inCompany.filter(
    (r) =>
      (status === 'all' || r.status === status) &&
      matchesQuery(query, r.id, customerLabel(r), r.companyName, r.serviceName),
  );

  return (
    <>
      <PageHeader
        title={t('serviceRequests.title')}
        subtitle={t('serviceRequests.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
      />
      <DataGate gates={[requests]}>
        <div className="toolbar">
          <Chips
            value={status}
            onChange={(next) => updateFilters({ status: next })}
            options={[
              { value: 'all', label: t('common.all'), count: inCompany.length },
              ...SERVICE_REQUEST_STATUSES.map((s) => ({
                value: s,
                label: t(`serviceRequest.status.${s}`),
                count: inCompany.filter((r) => r.status === s).length,
              })),
            ]}
          />
          <div className="toolbar__end">
            <select
              className="select"
              value={companyId}
              aria-label={t('col.company')}
              onChange={(e) => updateFilters({ company: e.target.value })}
            >
              <option value="">{t('products.allCompanies')}</option>
              {companyOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={t('serviceRequests.search')}
            />
          </div>
        </div>

        {requests.data.length === 0 ? (
          <EmptyState message={t('serviceRequests.empty')} />
        ) : visible.length === 0 ? (
          <EmptyState message={t('common.noResults')} />
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('serviceRequest.id')}</th>
                    <th>{t('col.customer')}</th>
                    <th>{t('col.company')}</th>
                    <th>{t('serviceRequest.service')}</th>
                    <th>{t('col.price')}</th>
                    <th>{t('col.status')}</th>
                    <th>{t('col.date')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link to={`/service-requests/${r.id}`} className="mono" dir="ltr">
                          #{shortId(r.id)}
                        </Link>
                      </td>
                      <td>
                        <Text>{customerLabel(r)}</Text>
                      </td>
                      <td>
                        <Text>{r.companyName || '—'}</Text>
                      </td>
                      <td>
                        <Text>{r.serviceName || '—'}</Text>
                      </td>
                      <td className="nowrap">{r.price !== null ? money(r.price) : '—'}</td>
                      <td>
                        <ServiceRequestStatusBadge status={r.status} />
                      </td>
                      <td className="nowrap">{dateTime(r.createdAt)}</td>
                      <td>
                        <Link to={`/service-requests/${r.id}`} className="btn btn--sm">
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
