import { Link, useParams } from 'react-router-dom';
import { AvailabilityBadge } from '../components/StatusBadges';
import { Card, DataGate, EmptyState, KeyValue, PageHeader, Text, Thumb } from '../components/ui';
import { useProducts } from '../data/hooks';
import { useI18n } from '../i18n/I18nProvider';

export function ProductDetailsPage() {
  const { id = '' } = useParams();
  const { t, number, money, dateTime } = useI18n();
  const products = useProducts();

  const product = products.data.find((p) => p.id === id);
  const specs = product ? Object.entries(product.specifications) : [];

  return (
    <>
      <PageHeader
        title={product?.name || t('product.details')}
        back={{ to: '/products', label: t('products.title') }}
      />
      <DataGate gates={[products]}>
        {!product ? (
          <EmptyState message={t('common.notFound')} />
        ) : (
          <>
            <p className="note note--top">{t('product.note')}</p>

            <div className="hero">
              <Thumb src={product.imageUrl} size={96} />
              <div>
                <h2>
                  <Text>{product.name}</Text>
                </h2>
                <AvailabilityBadge available={product.inStock && product.stockCount > 0} />
              </div>
            </div>

            <div className="grid-2">
              <Card title={t('product.section.info')}>
                <dl className="kv-list">
                  <KeyValue label={t('col.company')}>
                    <Text>{product.companyName || '—'}</Text>{' '}
                    {product.companyId && (
                      <Link to={`/companies/${product.companyId}`} className="link-sm">
                        {t('product.viewCompany')}
                      </Link>
                    )}
                  </KeyValue>
                  <KeyValue label={t('col.description')}>
                    {product.description ? <Text>{product.description}</Text> : '—'}
                  </KeyValue>
                  <KeyValue label={t('col.created')}>{dateTime(product.createdAt)}</KeyValue>
                </dl>
              </Card>
              <Card title={t('product.section.pricing')}>
                <dl className="kv-list">
                  <KeyValue label={t('col.price')}>{product.price === null ? t('product.priceOnRequest') : money(product.price, product.currency)}</KeyValue>
                  <KeyValue label={t('product.stockCount')}>{number(product.stockCount)}</KeyValue>
                  <KeyValue label={t('col.delivery')}>
                    {product.isDeliveryAvailable ? t('common.available') : t('common.pickupOnly')}
                  </KeyValue>
                  <KeyValue label={t('col.installation')}>
                    {product.isInstallationAvailable
                      ? `${t('common.available')}${
                          product.installationPrice !== null
                            ? ` (${money(product.installationPrice, product.currency)})`
                            : ''
                        }`
                      : t('common.notOffered')}
                  </KeyValue>
                </dl>
              </Card>
            </div>

            {specs.length > 0 && (
              <Card title={t('product.specifications')}>
                <dl className="kv-list">
                  {specs.map(([k, v]) => (
                    <KeyValue key={k} label={k}>
                      <Text>{v}</Text>
                    </KeyValue>
                  ))}
                </dl>
              </Card>
            )}
          </>
        )}
      </DataGate>
    </>
  );
}
