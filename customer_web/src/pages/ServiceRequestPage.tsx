import { lazy, Suspense, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, PriceText, Skeleton } from '../components/Bits';
import { Icon, PATHS } from '../components/Icon';
import type { GeoPoint } from '../components/MapPicker';
import { PhoneInput, phoneError } from '../components/PhoneInput';
import { Select } from '../components/Select';
import { PageTitle } from '../components/PageTitle';
import { servesCity } from '../data/browse';
import { useAccount, useCatalog } from '../data/DataProvider';
import { salePrice } from '../data/format';
import { parsePhone, toE164 } from '../data/phone';
import {
  ADDRESS_MAX,
  DETAILS_MAX,
  loadFormDraft,
  newRequestId,
  RequestRefused,
  saveFormDraft,
  sendRequest,
} from '../data/serviceRequests';
import type { CatalogService, Company, CompanyService } from '../data/types';
import { cityName } from '../data/cities';
import { t } from '../i18n';

// The map (and Leaflet) loads only when someone opens it.
const MapPicker = lazy(() => import('../components/MapPicker'));

function RequestForm({ offer, service, company }: { offer: CompanyService; service: CatalogService; company: Company }) {
  const navigate = useNavigate();
  const { cities } = useCatalog();
  const profile = useAccount();
  const saved = loadFormDraft(offer.id);
  const [details, setDetails] = useState(saved.details);
  const [address, setAddress] = useState(saved.address);
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [phone, setPhone] = useState(parsePhone(profile.phone));
  const [requestId] = useState(newRequestId);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // The city the service is wanted in: the customer's own unless they choose another.
  const cityChoices = cities.filter((c) => c.active && servesCity(company, c.id));
  const ownServed = cityChoices.some((c) => c.id === profile.cityId);
  const [cityId, setCityId] = useState(ownServed ? profile.cityId ?? '' : '');

  useEffect(() => saveFormDraft(offer.id, { details, address }), [offer.id, details, address]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (details.trim() === '') return setError(t('يرجى وصف ما تحتاجه.'));
    const phoneProblem = phoneError(phone, true);
    if (phoneProblem) return setError(phoneProblem);
    if (cityId === '' || !servesCity(company, cityId)) return setError(t('اختر مدينة تخدمها الشركة.'));
    setSending(true);
    setError('');
    try {
      await sendRequest({
        id: requestId,
        customerId: profile.id,
        customerName: profile.fullName,
        companyId: company.id,
        companyName: company.name,
        companyServiceId: offer.id,
        serviceId: service.id,
        serviceName: service.name,
        // The company's price as it is now (the offer price while an offer runs), or none.
        price: salePrice(offer),
        details,
        address,
        latitude: point?.latitude ?? null,
        longitude: point?.longitude ?? null,
        cityId,
        contactPhone: toE164(phone),
      });
      saveFormDraft(offer.id, { details: '', address: '' });
      navigate(`/chats/${requestId}`, { replace: true, state: { note: t('تم إرسال طلبك. يمكنك الآن التحدث مع الشركة.') } });
    } catch (err) {
      setError(err instanceof RequestRefused ? err.message : t('تعذر إرسال الطلب. يرجى المحاولة مرة أخرى.'));
      setSending(false);
    }
  }

  return (
    <form className="stack narrow" onSubmit={submit} noValidate>
      <PageTitle title={t('طلب خدمة')} />
      <h1 className="page-title">{t('طلب خدمة')}</h1>

      <section className="tile">
        <h2>{service.name}</h2>
        <div className="pmeta">{company.name}</div>
        {offer.price !== null && <PriceText item={offer} />}
      </section>

      <section className="tile">
        <label className="field">
          {t('ماذا تحتاج؟')}
          <textarea
            rows={5}
            value={details}
            maxLength={DETAILS_MAX}
            placeholder={t('صف العمل المطلوب والجهاز أو النظام، وأي شيء يجب أن تعرفه الشركة.')}
            onChange={(e) => setDetails(e.target.value)}
          />
          <span className="pmeta">{t('نحفظ ما تكتبه على هذا الجهاز إلى أن ترسل الطلب.')}</span>
        </label>
      </section>

      <section className="tile">
        <h2>{t('المدينة والموقع')}</h2>
        <label className="field">
          {t('المدينة')}
          <Select
            ariaLabel={t('المدينة')}
            value={cityId}
            onChange={setCityId}
            options={[{ value: '', label: t('اختر مدينة') }, ...cityChoices.map((c) => ({ value: c.id, label: cityName(c) }))]}
          />
          <span className="pmeta">{t('الطلب لشخص آخر؟ اختر مدينته. مدينة حسابك لا تتغير.')}</span>
        </label>
        <label className="field">
          {t('العنوان (اختياري)')}
          <textarea rows={2} value={address} maxLength={ADDRESS_MAX} placeholder={t('أين يجب تنفيذ الخدمة؟')} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <div className="location-row">
          <button type="button" className="mini-btn" onClick={() => setMapOpen(true)}>
            <Icon d={PATHS.pin} size={16} />
            {point ? t('تغيير الموقع') : t('تحديد من الخريطة')}
          </button>
          {point && (
            <>
              <span className="ok-text">{t('تم تحديد الموقع')}</span>
              <button type="button" className="link-btn" onClick={() => setPoint(null)}>{t('إزالة موقع الخريطة')}</button>
            </>
          )}
        </div>
        <PhoneInput label={t('رقم هاتف التواصل')} value={phone} onChange={setPhone} />
      </section>

      {error && <div className="error" role="alert">{error}</div>}
      <button type="submit" className="btn" disabled={sending}>{sending ? t('جارٍ الإرسال…') : t('إرسال الطلب')}</button>

      {mapOpen && (
        <Suspense fallback={null}>
          <MapPicker
            initial={point}
            onConfirm={(p) => {
              setPoint(p);
              setMapOpen(false);
            }}
            onClose={() => setMapOpen(false)}
          />
        </Suspense>
      )}
    </form>
  );
}

export function ServiceRequestPage() {
  const [params] = useSearchParams();
  const { links, services, companies, loading, error } = useCatalog();
  const offer = links.find((l) => l.id === params.get('offer') && l.isActive);
  const service = services.find((s) => s.id === offer?.serviceId);
  const company = companies.find((c) => c.id === offer?.companyId);

  if (error) return <main className="stack"><ErrorState /></main>;
  if (loading) return <main className="stack narrow"><Skeleton height={420} /></main>;
  if (!offer || !service || !company) {
    return (
      <main className="stack">
        <EmptyState title={t('هذه الخدمة غير متاحة حاليًا')}>
          <Link to="/browse?kind=services" className="pill">{t('كل الخدمات')}</Link>
        </EmptyState>
      </main>
    );
  }
  return <RequestForm key={offer.id} offer={offer} service={service} company={company} />;
}
