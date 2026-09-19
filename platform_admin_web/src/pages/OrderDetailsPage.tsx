import { Link, useParams } from 'react-router-dom';
import { OrderStatusBadge, PaymentBadge } from '../components/StatusBadges';
import { Card, DataGate, EmptyState, KeyValue, PageHeader, Text } from '../components/ui';
import { useCompanies, useOrders, useProducts } from '../data/hooks';
import { formatCoordinate, osmViewUrl, toGeoPoint } from '../data/location';
import { useI18n } from '../i18n/I18nProvider';
import { customerLabel, shortId } from '../utils';

export function OrderDetailsPage() {
  const { id = '' } = useParams();
  const { t, number, money, dateTime } = useI18n();
  const orders = useOrders();
  const companies = useCompanies();
  const products = useProducts();

  const order = orders.data.find((o) => o.id === id);
  // The order stores no pickup location of its own; for pickup orders it is
  // the company's pickup address. The company or product may since have been
  // deleted: the order keeps its own copy of their names, and only links to
  // records that still exist.
  const company = order ? companies.data.find((c) => c.id === order.companyId) : undefined;
  const productExists = order ? products.data.some((p) => p.id === order.productId) : false;
  const dash = (v: string) => (v.trim() ? <Text>{v}</Text> : '—');
  // The customer's delivery point saved with the order (never the company's).
  const deliveryPoint = order ? toGeoPoint(order.deliveryLatitude, order.deliveryLongitude) : null;

  return (
    <>
      <PageHeader
        title={order ? `${t('order.details')} #${shortId(order.id)}` : t('order.details')}
        back={{ to: '/orders', label: t('orders.title') }}
      />
      <DataGate gates={[orders]}>
        {!order ? (
          <EmptyState message={t('common.notFound')} />
        ) : (
          <>
            <p className="note note--top">{t('order.readOnlyNote')}</p>

            <div className="grid-2">
              <Card title={t('order.section.order')}>
                <dl className="kv-list">
                  <KeyValue label={t('order.id')}>
                    <bdi className="mono" dir="ltr">
                      {order.id}
                    </bdi>
                  </KeyValue>
                  <KeyValue label={t('col.orderStatus')}>
                    <OrderStatusBadge status={order.orderStatus} />
                  </KeyValue>
                  <KeyValue label={t('order.created')}>{dateTime(order.createdAt)}</KeyValue>
                  <KeyValue label={t('order.updated')}>{dateTime(order.updatedAt)}</KeyValue>
                </dl>
              </Card>

              <Card title={t('order.section.payment')}>
                <dl className="kv-list">
                  <KeyValue label={t('col.payment')}>
                    <PaymentBadge status={order.paymentStatus} />
                  </KeyValue>
                  <KeyValue label={t('order.unitPrice')}>{money(order.unitPrice)}</KeyValue>
                  <KeyValue label={t('col.quantity')}>{number(order.quantity)}</KeyValue>
                  <KeyValue label={t('order.subtotal')}>{money(order.productSubtotal)}</KeyValue>
                  <KeyValue label={t('order.deliveryFee')}>{money(order.deliveryFee)}</KeyValue>
                  <KeyValue label={t('order.installationFee')}>
                    {money(order.installationFee)}
                  </KeyValue>
                  <KeyValue label={t('order.total')}>
                    <strong>{money(order.totalAmount)}</strong>
                  </KeyValue>
                  <KeyValue label={t('order.receipt')}>
                    {order.receiptFileName ? (
                      <bdi dir="ltr">{order.receiptFileName}</bdi>
                    ) : (
                      t('order.notProvided')
                    )}
                  </KeyValue>
                </dl>
              </Card>

              <Card title={t('order.section.customer')}>
                <dl className="kv-list">
                  <KeyValue label={t('col.name')}>
                    {order.customerId ? (
                      <Link to={`/customers/${order.customerId}`} className="strong">
                        <Text>{customerLabel(order)}</Text>
                      </Link>
                    ) : (
                      <Text>{customerLabel(order)}</Text>
                    )}
                  </KeyValue>
                  <KeyValue label={t('col.phone')}>
                    {order.contactPhone ? <bdi dir="ltr">{order.contactPhone}</bdi> : '—'}
                  </KeyValue>
                </dl>
              </Card>

              <Card title={t('order.section.company')}>
                <dl className="kv-list">
                  <KeyValue label={t('col.name')}>
                    {company ? (
                      <Link to={`/companies/${company.id}`} className="strong">
                        <Text>{order.companyName || company.name}</Text>
                      </Link>
                    ) : (
                      dash(order.companyName)
                    )}
                  </KeyValue>
                </dl>
              </Card>

              <Card title={t('order.section.product')}>
                <dl className="kv-list">
                  <KeyValue label={t('col.product')}>
                    {productExists ? (
                      <Link to={`/products/${order.productId}`} className="strong">
                        <Text>{order.productName || order.productId}</Text>
                      </Link>
                    ) : (
                      dash(order.productName)
                    )}
                  </KeyValue>
                  <KeyValue label={t('col.quantity')}>{number(order.quantity)}</KeyValue>
                </dl>
              </Card>

              <Card title={t('order.section.delivery')}>
                <dl className="kv-list">
                  <KeyValue label={t('order.method')}>
                    {t(`delivery.${order.deliveryMethod}`)}
                  </KeyValue>
                  <KeyValue
                    label={
                      order.deliveryMethod === 'pickup'
                        ? t('order.pickupLocation')
                        : t('order.address')
                    }
                  >
                    {dash(
                      order.deliveryMethod === 'pickup'
                        ? company?.pickupAddress || order.deliveryAddress
                        : order.deliveryAddress,
                    )}
                  </KeyValue>
                  {order.deliveryMethod === 'delivery' && deliveryPoint ? (
                    <KeyValue label={t('location.deliveryPoint')}>
                      <bdi dir="ltr">
                        {formatCoordinate(deliveryPoint.latitude)},{' '}
                        {formatCoordinate(deliveryPoint.longitude)}
                      </bdi>{' '}
                      <a
                        href={osmViewUrl(deliveryPoint)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-sm"
                      >
                        {t('location.viewOnMap')}
                      </a>
                    </KeyValue>
                  ) : null}
                </dl>
              </Card>

              <Card title={t('order.section.installation')}>
                <dl className="kv-list">
                  <KeyValue label={t('order.installationOption')}>
                    {order.installationSelected
                      ? t('order.withInstallation')
                      : t('order.productOnly')}
                  </KeyValue>
                  <KeyValue label={t('order.technician')}>
                    {order.installationSelected
                      ? order.technicianName
                        ? <Text>{order.technicianName}</Text>
                        : t('order.notAssigned')
                      : '—'}
                  </KeyValue>
                </dl>
              </Card>
            </div>
          </>
        )}
      </DataGate>
    </>
  );
}
