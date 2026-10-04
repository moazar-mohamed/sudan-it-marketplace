import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CustomerCreateModal,
  CustomerEditModal,
  useToggleCustomerActive,
} from '../components/CustomerActions';
import { SortTh, useSortedRows } from '../components/sort';
import { ActiveBadge } from '../components/StatusBadges';
import { Chips, DataGate, EmptyState, PageHeader, SearchInput, Text } from '../components/ui';
import { csvFilename, customersToCsv, downloadCsv } from '../data/csv';
import { useCustomers } from '../data/hooks';
import { useCustomerOrderCounts } from '../data/orderHooks';
import { displayPhone, phoneSearchForms } from '../data/phone';
import type { Customer } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import { matchesQuery } from '../utils';

/** How many customers one page shows (and so how many order counts are read at a time). */
export const CUSTOMERS_PER_PAGE = 25;

const SORTS = {
  name: (c: Customer) => c.fullName,
  email: (c: Customer) => c.email,
  phone: (c: Customer) => displayPhone(c.phone),
  status: (c: Customer) => (c.isActive ? 1 : 0),
  registered: (c: Customer) => c.createdAt,
};

export function CustomersPage() {
  const { t, number, date } = useI18n();
  const customers = useCustomers();
  const { toggle, busyId } = useToggleCustomerActive();
  const [filter, setFilter] = useState<'active' | 'inactive' | 'all'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const visible = customers.data.filter(
    (c) =>
      (filter === 'all' || (filter === 'active') === c.isActive) &&
      matchesQuery(query, c.fullName, c.email, ...phoneSearchForms(c.phone)),
  );
  const { rows: sortedRows, sort, toggle: toggleSort } = useSortedRows(visible, SORTS);

  // One page at a time; only the customers on screen have their orders counted (a server count each).
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / CUSTOMERS_PER_PAGE));
  const current = Math.min(page, pageCount - 1);
  const shown = sortedRows.slice(current * CUSTOMERS_PER_PAGE, (current + 1) * CUSTOMERS_PER_PAGE);
  const orderCounts = useCustomerOrderCounts(shown.map((c) => c.id));
  const first = current * CUSTOMERS_PER_PAGE + 1;

  return (
    <>
      <PageHeader
        title={t('customers.title')}
        subtitle={t('customers.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
        actions={
          <>
            <button
              className="btn btn--sm"
              disabled={visible.length === 0}
              onClick={() => downloadCsv(csvFilename('customers', Date.now()), customersToCsv(visible))}
            >
              {t('common.exportCsv')}
            </button>
            <button className="btn btn--primary" onClick={() => setAdding(true)}>
              + {t('customers.add')}
            </button>
          </>
        }
      />
      {adding && <CustomerCreateModal onClose={() => setAdding(false)} />}
      {editing && <CustomerEditModal customer={editing} onClose={() => setEditing(null)} />}
      <DataGate gates={[customers]}>
        <div className="toolbar">
          <Chips
            value={filter}
            onChange={(next) => {
              setFilter(next);
              setPage(0);
            }}
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
          <SearchInput
            value={query}
            onChange={(next) => {
              setQuery(next);
              setPage(0);
            }}
            placeholder={t('customers.search')}
          />
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
                    <SortTh label={t('col.name')} sortKey="name" sort={sort} onSort={toggleSort} />
                    <SortTh label={t('col.email')} sortKey="email" sort={sort} onSort={toggleSort} />
                    <SortTh label={t('col.phone')} sortKey="phone" sort={sort} onSort={toggleSort} />
                    <SortTh label={t('col.status')} sortKey="status" sort={sort} onSort={toggleSort} />
                    <SortTh label={t('col.registered')} sortKey="registered" sort={sort} onSort={toggleSort} />
                    <th>{t('col.orders')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => (
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
                        <bdi dir="ltr">{displayPhone(c.phone) || '—'}</bdi>
                      </td>
                      <td>
                        <ActiveBadge active={c.isActive} />
                      </td>
                      <td className="nowrap">{date(c.createdAt)}</td>
                      <td>{orderCounts.has(c.id) ? number(orderCounts.get(c.id) ?? 0) : '…'}</td>
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
            <div className="card__foot card__foot--between">
              <span className="muted">
                {t('common.pageRange', {
                  from: number(first),
                  to: number(first + shown.length - 1),
                  total: number(sortedRows.length),
                })}
              </span>
              {pageCount > 1 && (
                <div className="btn-group">
                  <button className="btn btn--sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
                    {t('common.previous')}
                  </button>
                  <button className="btn btn--sm" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>
                    {t('common.next')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </DataGate>
    </>
  );
}
