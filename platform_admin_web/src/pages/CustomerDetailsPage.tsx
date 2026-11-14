import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminNotes } from '../components/AdminNotes';
import { CustomerEditModal, useToggleCustomerActive } from '../components/CustomerActions';
import { CustomerConvertModal } from '../components/CustomerConvertModal';
import { CustomerDeleteModal } from '../components/CustomerDeleteModal';
import { ActiveBadge, OrderStatusBadge, PaymentBadge } from '../components/StatusBadges';
import { Card, DataGate, EmptyState, KeyValue, PageHeader, Text } from '../components/ui';
import { ActionGroup } from '../components/v2';
import { cityNames, useCities } from '../data/cities';
import { isOpenOrderStatus, isOpenRequestStatus } from '../data/convertCustomer';
import { useCustomers, useServiceRequests } from '../data/hooks';
import { useOrdersOf } from '../data/orderHooks';
import { displayPhone } from '../data/phone';
import { useI18n } from '../i18n/I18nProvider';
import { shortId } from '../utils';

export function CustomerDetailsPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const customer = useCustomers().data.find((c) => c.id === id);
  return (
    <CustomerDetails id={id} header={(actions) => <PageHeader title={customer?.fullName || t('customer.details')} back={{ to: '/customers', label: t('customers.title') }} actions={actions} />} />
  );
}

/**
 * Everything about one customer and what can be done to the account. It is the body of
 * the full page and of the side panel beside the customer list. The actions are grouped in
 * the body: the everyday ones, then a quiet red group for converting and deleting.
 */
export function CustomerDetails({ id, header }: { id: string; header?: (actions: React.ReactNode) => React.ReactNode }) {
  useCities();
  const { t, money, date, dateTime, locale } = useI18n();
  const customers = useCustomers();
  const serviceRequests = useServiceRequests();
  // Only this customer's orders are read, not every order there is.
  const orders = useOrdersOf('customerId', id);
  const { toggle, busyId } = useToggleCustomerActive();
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const customer = customers.data.find((c) => c.id === id);
  const history = orders.orders;
  // What still keeps the account a customer's: it is converted once these end.
  const openOrders = history.filter((o) => isOpenOrderStatus(o.orderStatus));
  const openRequests = serviceRequests.data.filter((r) => r.customerId === id && isOpenRequestStatus(r.status));

  const activityLink = customer ? (
    <Link to={`/activity?target=${customer.id}`} className="btn">
      {t('activity.onRecord')}
    </Link>
  ) : null;
  const editButton = (
    <button className="btn" onClick={() => setEditing(true)}>
      {t('common.edit')}
    </button>
  );
  const convertButton = (
    <button className="btn" onClick={() => setConverting(true)}>
      {t('customer.convert')}
    </button>
  );
  const deleteButton = (
    <button className="btn btn--danger-ghost" onClick={() => setDeleting(true)}>
      {t('customer.delete')}
    </button>
  );
  const toggleButton = customer ? (
    <button
      className={customer.isActive ? 'btn btn--danger-ghost' : 'btn btn--primary'}
      disabled={busyId === customer.id}
      onClick={() => void toggle(customer)}
    >
      {customer.isActive ? t('customer.deactivate') : t('customer.activate')}
    </button>
  ) : null;

  return (
    <>
      {header?.(undefined)}
      {editing && customer && <CustomerEditModal customer={customer} onClose={() => setEditing(false)} />}
      {converting && customer && (
        <CustomerConvertModal customer={customer} openOrders={openOrders} openRequests={openRequests} onClose={() => setConverting(false)} />
      )}
      {deleting && customer && (
        <CustomerDeleteModal
          customer={customer}
          openOrders={openOrders}
          openRequests={openRequests}
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate('/customers')}
        />
      )}
      <DataGate gates={[customers, orders]}>
        {!customer ? (
          <EmptyState message={t('common.notFound')} />
        ) : (
          <>
            <ActionGroup title={t('customer.section.profile')}>
              <div className="btn-group">
                {editButton}
                {activityLink}
                {toggleButton}
              </div>
            </ActionGroup>
            <ActionGroup title={t('common.actions')} danger>
              <div className="btn-group">
                {convertButton}
                {deleteButton}
              </div>
            </ActionGroup>
            <Card title={t('customer.section.profile')}>
              <dl className="kv-list">
                <KeyValue label={t('col.name')}>
                  <Text>{customer.fullName || '—'}</Text>
                </KeyValue>
                <KeyValue label={t('col.email')}>
                  <bdi dir="ltr">{customer.email || '—'}</bdi>
                </KeyValue>
                <KeyValue label={t('col.phone')}>
                  <bdi dir="ltr">{displayPhone(customer.phone) || '—'}</bdi>
                </KeyValue>
                <KeyValue label={t('customer.city')}>
                  {customer.cityId ? cityNames([customer.cityId], locale === 'ar' ? 'ar' : 'en') : t('customer.cityNone')}
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
                            <PaymentBadge status={o.paymentStatus} orderStatus={o.orderStatus} />
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

            <AdminNotes targetType="customer" targetId={customer.id} />
          </>
        )}
      </DataGate>
    </>
  );
}
