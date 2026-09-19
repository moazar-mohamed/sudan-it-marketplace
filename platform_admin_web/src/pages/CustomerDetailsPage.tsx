import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CustomerEditModal, useToggleCustomerActive } from '../components/CustomerActions';
import { ActiveBadge, OrderStatusBadge, PaymentBadge } from '../components/StatusBadges';
import { Card, DataGate, EmptyState, KeyValue, PageHeader, Text } from '../components/ui';
import { useCustomers, useOrders } from '../data/hooks';
import { useI18n } from '../i18n/I18nProvider';
import { shortId } from '../utils';

export function CustomerDetailsPage() {
  const { id = '' } = useParams();
  const { t, money, date, dateTime } = useI18n();
  const customers = useCustomers();
  const orders = useOrders();
  const { toggle, busyId } = useToggleCustomerActive();
  const [editing, setEditing] = useState(false);

  const customer = customers.data.find((c) => c.id === id);
  const history = orders.data.filter((o) => o.customerId === id);

  return (
    <>
      <PageHeader
        title={customer?.fullName || t('customer.details')}
        back={{ to: '/customers', label: t('customers.title') }}
        actions={
          customer ? (
            <>
              <button className="btn" onClick={() => setEditing(true)}>
                {t('common.edit')}
              </button>
              <button
                className={customer.isActive ? 'btn btn--danger-ghost' : 'btn btn--primary'}
                disabled={busyId === customer.id}
                onClick={() => void toggle(customer)}
              >
                {customer.isActive ? t('customer.deactivate') : t('customer.activate')}
              </button>
            </>
          ) : undefined
        }
      />
      {editing && customer && (
        <CustomerEditModal customer={customer} onClose={() => setEditing(false)} />
      )}
      <DataGate gates={[customers, orders]}>
        {!customer ? (
          <EmptyState message={t('common.notFound')} />
        ) : (
          <>
            <Card title={t('customer.section.profile')}>
              <dl className="kv-list">
                <KeyValue label={t('col.name')}>
                  <Text>{customer.fullName || '—'}</Text>
                </KeyValue>
                <KeyValue label={t('col.email')}>
                  <bdi dir="ltr">{customer.email || '—'}</bdi>
                </KeyValue>
                <KeyValue label={t('col.phone')}>
                  <bdi dir="ltr">{customer.phone || '—'}</bdi>
                </KeyValue>
                <KeyValue label={t('col.status')}>
                  <ActiveBadge active={customer.isActive} />
                </KeyValue>
                <KeyValue label={t('col.registered')}>{date(customer.createdAt)}</KeyValue>
              </dl>
              <p className="note">{t('customer.note')}</p>
            </Card>

            <Card title={`${t('customer.orderHistory')} (${history.length})`} flush>
              {history.length === 0 ? (
                <EmptyState message={t('customer.noOrders')} />
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t('col.orderId')}</th>
                        <th>{t('col.company')}</th>
                        <th>{t('col.product')}</th>
                        <th>{t('col.total')}</th>
                        <th>{t('col.payment')}</th>
                        <th>{t('col.orderStatus')}</th>
                        <th>{t('col.date')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <Link to={`/orders/${o.id}`} className="mono" dir="ltr">
                              #{shortId(o.id)}
                            </Link>
                          </td>
                          <td>
                            <Text>{o.companyName || '—'}</Text>
                          </td>
                          <td>
                            <Text>{o.productName}</Text>
                          </td>
                          <td className="nowrap">{money(o.totalAmount)}</td>
                          <td>
                            <PaymentBadge status={o.paymentStatus} />
                          </td>
                          <td>
                            <OrderStatusBadge status={o.orderStatus} />
                          </td>
                          <td className="nowrap">{dateTime(o.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </DataGate>
    </>
  );
}
