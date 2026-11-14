import { Link } from 'react-router-dom';
import type { Order, ServiceRequest } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import { shortId } from '../utils';

/** The orders and service requests a customer still has in progress, each linked. */
export function OpenWorkList({
  openOrders,
  openRequests,
}: {
  openOrders: Order[];
  openRequests: ServiceRequest[];
}) {
  const { t } = useI18n();
  return (
    <>
      {openOrders.length > 0 && (
        <>
          <h3 className="form-card__title">{t('customer.convert.blocked.orders')}</h3>
          <ul>
            {openOrders.map((o) => (
              <li key={o.id}>
                <Link to={`/orders/${o.id}`} className="mono" dir="ltr">
                  #{shortId(o.id)}
                </Link>{' '}
                <bdi>{o.productName}</bdi>
              </li>
            ))}
          </ul>
        </>
      )}
      {openRequests.length > 0 && (
        <>
          <h3 className="form-card__title">{t('customer.convert.blocked.requests')}</h3>
          <ul>
            {openRequests.map((r) => (
              <li key={r.id}>
                <Link to={`/service-requests/${r.id}`} className="mono" dir="ltr">
                  #{shortId(r.id)}
                </Link>{' '}
                <bdi>{r.serviceName}</bdi>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
