import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CustomerCreateModal,
  CustomerEditModal,
  useToggleCustomerActive,
} from '../components/CustomerActions';
import { ActiveBadge } from '../components/StatusBadges';
import { Chips, DataGate, EmptyState, PageHeader, SearchInput, Text } from '../components/ui';
import { useCustomers, useOrders } from '../data/hooks';
import type { Customer } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import { matchesQuery } from '../utils';

export function CustomersPage() {
  const { t, number, date } = useI18n();
  const customers = useCustomers();
  const orders = useOrders();
  const { toggle, busyId } = useToggleCustomerActive();
  const [filter, setFilter] = useState<'active' | 'inactive' | 'all'>('all');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const orderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of orders.data) counts.set(o.customerId, (counts.get(o.customerId) ?? 0) + 1);
    return counts;
  }, [orders.data]);

  const visible = customers.data.filter(
    (c) =>
      (filter === 'all' || (filter === 'active') === c.isActive) &&
      matchesQuery(query, c.fullName, c.email, c.phone),
  );

  return (
    <>
      <PageHeader
        title={t('customers.title')}
        subtitle={t('customers.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
        actions={
          <button className="btn btn--primary" onClick={() => setAdding(true)}>
            + {t('customers.add')}
          </button>
        }
      />
      {adding && <CustomerCreateModal onClose={() => setAdding(false)} />}
      {editing && <CustomerEditModal customer={editing} onClose={() => setEditing(null)} />}
      <DataGate gates={[customers, orders]}>
        <div className="toolbar">
          <Chips
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('common.all'), count: customers.data.length },
              {
                value: 'active',
                label: t('user.active'),
                count: customers.data.filter((c) => c.isActive).length,
              },
              {
                value: 'inactive',
                label: t('user.inactive'),
                count: customers.data.filter((c) => !c.isActive).length,
              },
            ]}
          />
          <SearchInput value={query} onChange={setQuery} placeholder={t('customers.search')} />
        </div>
        <p className="note">{t('customers.deleteNote')}</p>

        {customers.data.length === 0 ? (
          <EmptyState message={t('customers.empty')} />
        ) : visible.length === 0 ? (
          <EmptyState message={t('common.noResults')} />
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('col.name')}</th>
                    <th>{t('col.email')}</th>
                    <th>{t('col.phone')}</th>
                    <th>{t('col.status')}</th>
                    <th>{t('col.registered')}</th>
                    <th>{t('col.orders')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/customers/${c.id}`} className="strong">
                          <Text>{c.fullName || '—'}</Text>
                        </Link>
                      </td>
                      <td>
                        <bdi dir="ltr">{c.email || '—'}</bdi>
                      </td>
                      <td>
                        <bdi dir="ltr">{c.phone || '—'}</bdi>
                      </td>
                      <td>
                        <ActiveBadge active={c.isActive} />
                      </td>
                      <td className="nowrap">{date(c.createdAt)}</td>
                      <td>{number(orderCounts.get(c.id) ?? 0)}</td>
                      <td>
                        <div className="btn-group">
                          <Link to={`/customers/${c.id}`} className="btn btn--sm">
                            {t('common.view')}
                          </Link>
                          <button className="btn btn--sm" onClick={() => setEditing(c)}>
                            {t('common.edit')}
                          </button>
                          <button
                            className={c.isActive ? 'btn btn--danger-ghost btn--sm' : 'btn btn--sm'}
                            disabled={busyId === c.id}
                            onClick={() => void toggle(c)}
                          >
                            {c.isActive ? t('customer.deactivateShort') : t('customer.activateShort')}
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
