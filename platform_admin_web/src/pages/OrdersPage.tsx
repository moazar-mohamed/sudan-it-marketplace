import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { OrderStatusBadge, PaymentBadge } from '../components/StatusBadges';
import { Chips, DataGate, EmptyState, PageHeader, SearchInput, Text } from '../components/ui';
import { useOrders } from '../data/hooks';
import { ORDER_STATUSES, type OrderStatus } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import { customerLabel, matchesQuery, shortId } from '../utils';

export function OrdersPage() {
  const { t, number, money, dateTime } = useI18n();
  const orders = useOrders();
  // Company and status filters live in the URL so dashboard cards can link
  // straight to the list they counted (?status=processing).
  const [params, setParams] = useSearchParams();
  const companyId = params.get('company') ?? '';
  const statusParam = params.get('status');
  const status: OrderStatus | 'all' = ORDER_STATUSES.find((s) => s === statusParam) ?? 'all';
  const updateFilters = (next: { company?: string; status?: OrderStatus | 'all' }) => {
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
  const setStatus = (next: OrderStatus | 'all') => updateFilters({ status: next });
  const [query, setQuery] = useState('');

  const companyOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const o of orders.data) {
      if (o.companyId && !byId.has(o.companyId)) byId.set(o.companyId, o.companyName || o.companyId);
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [orders.data]);

  const inCompany = orders.data.filter((o) => !companyId || o.companyId === companyId);
  const visible = inCompany.filter(
    (o) =>
      (status === 'all' || o.orderStatus === status) &&
      matchesQuery(query, o.id, customerLabel(o), o.companyName, o.productName),
  );

  return (
    <>
      <PageHeader title={t('orders.title')} subtitle={t('orders.subtitle')} />
      <DataGate gates={[orders]}>
        <div className="toolbar">
          <Chips
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: t('common.all'), count: inCompany.length },
              ...ORDER_STATUSES.map((s) => ({
                value: s,
                label: t(`order.status.${s}`),
                count: inCompany.filter((o) => o.orderStatus === s).length,
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
            <SearchInput value={query} onChange={setQuery} placeholder={t('orders.search')} />
          </div>
        </div>

        {orders.data.length === 0 ? (
          <EmptyState message={t('orders.empty')} />
        ) : visible.length === 0 ? (
          <EmptyState message={t('common.noResults')} />
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('col.orderId')}</th>
                    <th>{t('col.customer')}</th>
                    <th>{t('col.company')}</th>
                    <th>{t('col.product')}</th>
                    <th>{t('col.quantity')}</th>
                    <th>{t('col.total')}</th>
                    <th>{t('col.payment')}</th>
                    <th>{t('col.orderStatus')}</th>
                    <th>{t('col.date')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/orders/${o.id}`} className="mono" dir="ltr">
                          #{shortId(o.id)}
                        </Link>
                      </td>
                      <td>
                        <Text>{customerLabel(o)}</Text>
                      </td>
                      <td>
                        <Text>{o.companyName || '—'}</Text>
                      </td>
                      <td>
                        <Text>{o.productName || '—'}</Text>
                      </td>
                      <td>{number(o.quantity)}</td>
                      <td className="nowrap">{money(o.totalAmount)}</td>
                      <td>
                        <PaymentBadge status={o.paymentStatus} />
                      </td>
                      <td>
                        <OrderStatusBadge status={o.orderStatus} />
                      </td>
                      <td className="nowrap">{dateTime(o.createdAt)}</td>
                      <td>
                        <Link to={`/orders/${o.id}`} className="btn btn--sm">
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
