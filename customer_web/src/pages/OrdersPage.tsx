import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, Skeleton } from '../components/Bits';
import { Icon, PATHS } from '../components/Icon';
import { PageTitle } from '../components/PageTitle';
import { useAccount } from '../data/DataProvider';
import { formatDate, formatPrice } from '../data/format';
import { useMyOrders } from '../data/hooks';
import { isAwaitingVerification, ORDER_STATUS, shortOrderId } from '../data/orders';
import { narrowOrders, narrowRequests } from '../data/pageSearch';
import { isFinished, REQUEST_STATUS, useMyRequests } from '../data/serviceRequests';
import { t } from '../i18n';

type Filter = 'all' | 'active' | 'done';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: t('الكل') },
  { value: 'active', label: t('جارية') },
  { value: 'done', label: t('منتهية') },
];

export function OrdersPage() {
  const profile = useAccount();
  const { items, error } = useMyOrders(profile.id);
  const requests = useMyRequests(profile.id);
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('all');
  // The page's own search box: product, service, company or order number.
  const [query, setQuery] = useState('');
  const services = params.get('kind') === 'services';

  const wanted = (finished: boolean) => filter === 'all' || (filter === 'done') === finished;
  const shownOrders = narrowOrders(
    (items ?? []).filter((o) => wanted(o.orderStatus === 'completed' || o.orderStatus === 'cancelled')),
    query,
  );
  const shownRequests = narrowRequests((requests.items ?? []).filter((r) => wanted(isFinished(r))), query);
  const loading = items === null || requests.items === null;
  const nothing = !loading && items.length === 0 && requests.items?.length === 0;

  return (
    <main className="stack narrow">
      <PageTitle title={t('طلباتي')} />
      <h1 className="page-title">{t('طلباتي')}</h1>
      {error || requests.error ? (
        <ErrorState />
      ) : loading ? (
        <Skeleton height={240} />
      ) : nothing ? (
        <EmptyState title={t('لا توجد طلبات بعد')} message={t('عند شرائك أجهزة أو منتجات تقنية من السوق، ستظهر طلباتك وحالتها المباشرة هنا.')}>
          <Link to="/browse" className="pill">{t('تصفّح المنتجات والخدمات')}</Link>
        </EmptyState>
      ) : (
        <>
          <div className="segment" role="tablist" aria-label={t('نوع الطلبات')}>
            <button role="tab" aria-selected={!services} className={services ? '' : 'on'} onClick={() => setParams({}, { replace: true })}>{t('المنتجات (')}{items.length})</button>
            <button role="tab" aria-selected={services} className={services ? 'on' : ''} onClick={() => setParams({ kind: 'services' }, { replace: true })}>{t('الخدمات (')}{requests.items?.length ?? 0})</button>
          </div>
          <label className="page-search">
            <Icon d={PATHS.search} size={18} />
            <span className="sr-only">{t('بحث')}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('ابحث في طلباتك')}
              autoComplete="off"
              enterKeyHint="search"
            />
          </label>
          <div className="chips">
            {FILTERS.map((f) => (
              <button key={f.value} className={`chip-link${filter === f.value ? ' on' : ''}`} onClick={() => setFilter(f.value)}>{f.label}</button>
            ))}
          </div>
          {(services ? shownRequests.length : shownOrders.length) === 0 && (
            <EmptyState title={query.trim() ? t('لا نتائج لـ«{0}» هنا.', query.trim()) : t('لا طلبات هنا.')} />
          )}
          {services
            ? shownRequests.map((request) => {
                const status = REQUEST_STATUS[request.status];
                return (
                  <Link key={request.id} to={`/requests/${request.id}`} className="tile order-card">
                    <header>
                      <strong className="grow">{t('طلب خدمة #')}<span dir="ltr">{shortOrderId(request.id)}</span></strong>
                      <span className={`status ${status.tone}`}>{status.label}</span>
                    </header>
                    <div className="pname">{request.serviceName}</div>
                    <div className="pmeta">{request.companyName}</div>
                    <div className="prow">
                      <span className="pmeta">{formatDate(request.createdAt)}</span>
                      {request.price !== null && <span className="price">{formatPrice(request.price)}</span>}
                    </div>
                  </Link>
                );
              })
            : shownOrders.map((order) => {
                const status = ORDER_STATUS[order.orderStatus];
                return (
                  <Link key={order.id} to={`/orders/${order.id}`} className="tile order-card">
                    <header>
                      <strong className="grow">{t('طلب #')}<span dir="ltr">{shortOrderId(order.id)}</span></strong>
                      <span className={`status ${status.tone}`}>{status.label}</span>
                    </header>
                    <div className="pname">{order.productName}</div>
                    <div className="pmeta">{order.companyName}</div>
                    {isAwaitingVerification(order) && <div className="await">{t('بانتظار تأكيد الشركة لدفعك')}</div>}
                    <div className="prow">
                      <span className="pmeta">{t('المبلغ الإجمالي')}</span>
                      <span className="price">{formatPrice(order.totalAmount)}</span>
                    </div>
                  </Link>
                );
              })}
        </>
      )}
    </main>
  );
}
