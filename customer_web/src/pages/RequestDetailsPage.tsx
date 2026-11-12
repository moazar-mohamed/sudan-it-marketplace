import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, Skeleton } from '../components/Bits';
import { Icon, PATHS } from '../components/Icon';
import { ReviewCard } from '../components/ReviewCard';
import { PageTitle } from '../components/PageTitle';
import { useCatalog } from '../data/DataProvider';
import { formatDateTime, formatPrice } from '../data/format';
import { shortOrderId } from '../data/orders';
import { displayPhone } from '../data/phone';
import { requestReviewSubject } from '../data/reviews';
import { cancelRequest, REQUEST_STATUS, REQUEST_STEPS, RequestRefused, useServiceRequest } from '../data/serviceRequests';
import type { ServiceRequest } from '../data/types';
import { cityName } from '../data/cities';
import { t } from '../i18n';
import { BusyLabel } from '../components/BusyLabel';

function Steps({ request }: { request: ServiceRequest }) {
  const current = REQUEST_STEPS.indexOf(request.status);
  const done = request.status === 'completed';
  return (
    <ol className="steps four">
      {REQUEST_STEPS.map((step, i) => (
        <li key={step} className={i < current || done ? 'done' : i === current ? 'now' : ''} aria-current={i === current ? 'step' : undefined}>
          <span className="step-dot">{i < current || done ? '✓' : i + 1}</span>
          <span>{REQUEST_STATUS[step].label}</span>
        </li>
      ))}
    </ol>
  );
}

function CancelButton({ request }: { request: ServiceRequest }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function cancel() {
    setBusy(true);
    setError('');
    try {
      await cancelRequest(request);
      setAsking(false);
    } catch (e) {
      setError(e instanceof RequestRefused ? e.message : t('تعذر تحديث الطلب. يرجى المحاولة مرة أخرى.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn ghost" onClick={() => setAsking(true)}>{t('إلغاء الطلب')}</button>
      {asking && (
        <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && !busy && setAsking(false)}>
          <div className="palette review-panel" role="dialog" aria-modal="true" aria-label={t('إلغاء هذا الطلب؟')}>
            <h2>{t('إلغاء هذا الطلب؟')}</h2>
            <p className="prose">{t('سترى الشركة أنك ألغيت الطلب. لا يمكن التراجع عن ذلك.')}</p>
            {error && <div className="error" role="alert">{error}</div>}
            <button className="btn" disabled={busy} aria-busy={busy} onClick={cancel}><BusyLabel busy={busy} busyText={t('جارٍ الإلغاء…')}>{t('إلغاء الطلب')}</BusyLabel></button>
            <button className="btn ghost" disabled={busy} onClick={() => setAsking(false)}>{t('رجوع')}</button>
          </div>
        </div>
      )}
    </>
  );
}

export function RequestDetailsPage() {
  const { id = '' } = useParams();
  const { cities } = useCatalog();
  const { request, loaded } = useServiceRequest(id);

  if (!loaded) return <main className="stack narrow"><Skeleton height={420} /></main>;
  if (!request) {
    return (
      <main className="stack">
        <EmptyState title={t('لم يتم العثور على طلب الخدمة هذا.')}>
          <Link to="/orders?kind=services" className="pill">{t('طلباتي')}</Link>
        </EmptyState>
      </main>
    );
  }

  const status = REQUEST_STATUS[request.status];
  const onPath = REQUEST_STEPS.includes(request.status);
  const city = cities.find((c) => c.id === request.cityId);
  const address = request.address.trim();
  const hasPoint = request.latitude !== null && request.longitude !== null;
  const mapLink = hasPoint
    ? `https://www.openstreetmap.org/?mlat=${request.latitude}&mlon=${request.longitude}#map=16/${request.latitude}/${request.longitude}`
    : address
      ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`
      : null;

  return (
    <main className="stack narrow">
      <PageTitle title={`${t('طلب خدمة #')}${shortOrderId(request.id)}`} />
      <h1 className="page-title">{t('طلب خدمة #')}<span dir="ltr">{shortOrderId(request.id)}</span></h1>

      <section className="tile">
        <div className="tile-head">
          <h2>{request.serviceName}</h2>
          <span className={`status ${status.tone}`}>{status.label}</span>
        </div>
        {onPath && <Steps request={request} />}
        <dl className="specs">
          <div><dt>{t('الشركة')}</dt><dd><Link to={`/company/${request.companyId}`}>{request.companyName}</Link></dd></div>
          {request.price !== null && <div><dt>{t('السعر')}</dt><dd>{formatPrice(request.price)}</dd></div>}
          <div><dt>{t('تاريخ الإرسال')}</dt><dd dir="ltr">{formatDateTime(request.createdAt)}</dd></div>
        </dl>
      </section>

      {request.status === 'completed' && <ReviewCard subject={requestReviewSubject(request)} />}

      <section className="tile">
        <h2>{t('تفاصيل الطلب')}</h2>
        <p className="prose">{request.details}</p>
      </section>

      <section className="tile">
        <h2>{t('التواصل والموقع')}</h2>
        <dl className="specs">
          <div><dt>{t('هاتف التواصل')}</dt><dd dir="ltr">{displayPhone(request.contactPhone)}</dd></div>
          {city && <div><dt>{t('المدينة')}</dt><dd>{cityName(city)}</dd></div>}
          {address && <div><dt>{t('العنوان')}</dt><dd>{address}</dd></div>}
        </dl>
        {mapLink && <a className="more" href={mapLink} target="_blank" rel="noreferrer">{t('عرض على الخريطة')}</a>}
      </section>

      <Link to={`/chats/${request.id}`} className="btn-line contact">
        <Icon d={PATHS.chat} size={18} />
        {t('فتح المحادثة')}
      </Link>
      {request.status === 'pending' && <CancelButton request={request} />}
    </main>
  );
}
