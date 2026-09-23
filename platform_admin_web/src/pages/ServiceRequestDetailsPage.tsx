import { Link, useParams } from 'react-router-dom';
import { ServiceRequestStatusBadge } from '../components/StatusBadges';
import { Card, DataGate, EmptyState, KeyValue, PageHeader, Text } from '../components/ui';
import { useCompanies, useServiceRequests } from '../data/hooks';
import { formatCoordinate, osmViewUrl, toGeoPoint } from '../data/location';
import { useI18n } from '../i18n/I18nProvider';
import { customerLabel, shortId } from '../utils';

/**
 * One service request, read-only. Its conversation is private to the
 * customer and the company and is deliberately never loaded here.
 */
export function ServiceRequestDetailsPage() {
  const { id = '' } = useParams();
  const { t, money, dateTime } = useI18n();
  const requests = useServiceRequests();
  const companies = useCompanies();

  const request = requests.data.find((r) => r.id === id);
  // The request keeps its own copy of the names; link only to a company that
  // still exists.
  const company = request ? companies.data.find((c) => c.id === request.companyId) : undefined;
  const dash = (v: string) => (v.trim() ? <Text>{v}</Text> : '—');
  const point = request ? toGeoPoint(request.latitude, request.longitude) : null;

  return (
    <>
      <PageHeader
        title={
          request
            ? `${t('serviceRequest.details')} #${shortId(request.id)}`
            : t('serviceRequest.details')
        }
        back={{ to: '/service-requests', label: t('serviceRequests.title') }}
      />
      <DataGate gates={[requests]}>
        {!request ? (
          <EmptyState message={t('common.notFound')} />
        ) : (
          <>
            <p className="note note--top">{t('serviceRequest.readOnlyNote')}</p>

            <div className="grid-2">
              <Card title={t('serviceRequest.section.request')}>
                <dl className="kv-list">
                  <KeyValue label={t('serviceRequest.id')}>
                    <bdi className="mono" dir="ltr">
                      {request.id}
                    </bdi>
                  </KeyValue>
                  <KeyValue label={t('serviceRequest.service')}>
                    {dash(request.serviceName)}
                  </KeyValue>
                  <KeyValue label={t('serviceRequest.price')}>
                    {request.price !== null ? money(request.price) : t('serviceRequest.noPrice')}
                  </KeyValue>
                  <KeyValue label={t('col.status')}>
                    <ServiceRequestStatusBadge status={request.status} />
                  </KeyValue>
                  <KeyValue label={t('order.created')}>{dateTime(request.createdAt)}</KeyValue>
                  <KeyValue label={t('order.updated')}>{dateTime(request.updatedAt)}</KeyValue>
                </dl>
              </Card>

              <Card title={t('serviceRequest.section.customer')}>
                <dl className="kv-list">
                  <KeyValue label={t('col.name')}>
                    {request.customerId ? (
                      <Link to={`/customers/${request.customerId}`} className="strong">
                        <Text>{customerLabel(request)}</Text>
                      </Link>
                    ) : (
                      <Text>{customerLabel(request)}</Text>
                    )}
                  </KeyValue>
                  <KeyValue label={t('col.phone')}>
                    {request.contactPhone ? <bdi dir="ltr">{request.contactPhone}</bdi> : '—'}
                  </KeyValue>
                  <KeyValue label={t('serviceRequest.address')}>{dash(request.address)}</KeyValue>
                  {point ? (
                    <KeyValue label={t('serviceRequest.location')}>
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
                    </KeyValue>
                  ) : null}
                </dl>
              </Card>

              <Card title={t('serviceRequest.section.company')}>
                <dl className="kv-list">
                  <KeyValue label={t('col.name')}>
                    {company ? (
                      <Link to={`/companies/${company.id}`} className="strong">
                        <Text>{request.companyName || company.name}</Text>
                      </Link>
                    ) : (
                      dash(request.companyName)
                    )}
                  </KeyValue>
                </dl>
              </Card>

              <Card title={t('serviceRequest.section.details')}>
                <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                  <Text>{request.details || '—'}</Text>
                </p>
              </Card>
            </div>
          </>
        )}
      </DataGate>
    </>
  );
}
