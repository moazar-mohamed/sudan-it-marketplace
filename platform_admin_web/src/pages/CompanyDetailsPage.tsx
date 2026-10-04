import { Link, useNavigate, useParams } from 'react-router-dom';
import { CompanyRegistrationCard } from '../components/CompanyRegistrationCard';
import { CompanyStatusActions } from '../components/CompanyStatusActions';
import { CompanyStatusBadge } from '../components/StatusBadges';
import {
  Card,
  DataGate,
  EmptyState,
  KeyValue,
  PageHeader,
  Text,
  Thumb,
} from '../components/ui';
import { loadCompanyDocument, saveCompanyRegistration } from '../data/actions';
import { useCompanies, useProducts } from '../data/hooks';
import { useOrderCountOf } from '../data/orderHooks';
import { formatCoordinate, osmViewUrl, toGeoPoint } from '../data/location';
import { displayPhone } from '../data/phone';
import { useI18n } from '../i18n/I18nProvider';

export function CompanyDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { t, number, date } = useI18n();
  const companies = useCompanies();
  const products = useProducts();
  // A server count, so a company with many orders does not pull them all in.
  const orderTotal = useOrderCountOf('companyId', id);

  const company = companies.data.find((c) => c.id === id);
  const productCount = products.data.filter((p) => p.companyId === id).length;
  const dash = (v: string) => (v.trim() ? <Text>{v}</Text> : '—');
  const point = company ? toGeoPoint(company.latitude, company.longitude) : null;

  return (
    <>
      <PageHeader
        title={company?.name || t('company.details')}
        back={{ to: '/companies', label: t('companies.title') }}
        actions={
          company ? (
            <>
              <Link to={`/activity?target=${company.id}`} className="btn btn--sm">
                {t('activity.onRecord')}
              </Link>
              <CompanyStatusActions company={company} onDeleted={() => navigate('/companies')} />
            </>
          ) : undefined
        }
      />
      <DataGate gates={[companies, products]}>
        {!company ? (
          <EmptyState message={t('common.notFound')} />
        ) : (
          <>
            <div className="hero">
              <Thumb src={company.logoUrl} size={72} />
              <div>
                <h2>
                  <Text>{company.name}</Text>
                </h2>
                <CompanyStatusBadge status={company.status} />
              </div>
            </div>

            <div className="grid-2">
              <Card title={t('company.section.info')}>
                <dl className="kv-list">
                  <KeyValue label={t('company.description')}>{dash(company.description)}</KeyValue>
                  <KeyValue label={t('company.city')}>{dash(company.city)}</KeyValue>
                  <KeyValue label={t('company.address')}>{dash(company.address)}</KeyValue>
                  <KeyValue label={t('location.mapPoint')}>
                    {point ? (
                      <>
                        <bdi dir="ltr">
                          {formatCoordinate(point.latitude)}, {formatCoordinate(point.longitude)}
                        </bdi>{' '}
                        <a
                          href={osmViewUrl(point)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-sm"
                        >
                          {t('location.viewOnMap')}
                        </a>
                      </>
                    ) : (
                      '—'
                    )}
                  </KeyValue>
                  <KeyValue label={t('company.pickup')}>{dash(company.pickupAddress)}</KeyValue>
                </dl>
              </Card>
              <Card title={t('company.section.contact')}>
                <dl className="kv-list">
                  <KeyValue label={t('company.email')}>
                    {company.email ? <bdi dir="ltr">{company.email}</bdi> : '—'}
                  </KeyValue>
                  <KeyValue label={t('company.phone')}>
                    {company.phone ? <bdi dir="ltr">{displayPhone(company.phone)}</bdi> : '—'}
                  </KeyValue>
                </dl>
              </Card>
            </div>

            <CompanyRegistrationCard
              companyId={company.id}
              load={loadCompanyDocument}
              save={saveCompanyRegistration}
            />

            <Card title={t('company.section.activity')}>
              <dl className="kv-list">
                <KeyValue label={t('col.rating')}>
                  {number(company.rating)} ★ ({number(company.reviewCount)} {t('col.reviews')})
                </KeyValue>
                <KeyValue label={t('company.productsCount')}>
                  {number(productCount)}{' '}
                  <Link to={`/products?company=${company.id}`} className="link-sm">
                    {t('company.viewProducts')}
                  </Link>
                </KeyValue>
                <KeyValue label={t('company.ordersCount')}>
                  {orderTotal === null ? '…' : number(orderTotal)}{' '}
                  <Link to={`/orders?company=${company.id}`} className="link-sm">
                    {t('company.viewOrders')}
                  </Link>
                </KeyValue>
                <KeyValue label={t('col.created')}>{date(company.createdAt)}</KeyValue>
              </dl>
            </Card>
          </>
        )}
      </DataGate>
    </>
  );
}
