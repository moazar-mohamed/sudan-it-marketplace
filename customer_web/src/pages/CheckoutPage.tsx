import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, Skeleton } from '../components/Bits';
import { CompanyLogo } from '../components/CompanyCard';
import { Icon, PATHS } from '../components/Icon';
import type { GeoPoint } from '../components/MapPicker';
import { PhoneInput, phoneError } from '../components/PhoneInput';
import { Select } from '../components/Select';
import { servesCity } from '../data/browse';
import { useAccount, useCatalog } from '../data/DataProvider';
import { formatPrice, isAvailable, maxOrderQuantity, salePrice } from '../data/format';
import {
  clip,
  CUSTOMER_NAME_MAX,
  DELIVERY_ADDRESS_MAX,
  effectivePickupPoints,
  newOrderId,
  OrderRefused,
  pickupLabel,
  placeOrder,
  STANDARD_DELIVERY_FEE,
} from '../data/orders';
import { displayPhone, parsePhone, toE164 } from '../data/phone';
import { prepareReceipt, ReceiptProblem } from '../data/receiptImage';
import type { Company, OrderDraft, Product, ReceiptImage } from '../data/types';
import { cityName } from '../data/cities';
import { t } from '../i18n';

// The map (and Leaflet) loads only when someone opens it.
const MapPicker = lazy(() => import('../components/MapPicker'));

const PICKUP_FALLBACK = t('موقع استلام الشركة (ستؤكده الشركة عبر الهاتف)');

/** Where a pickup is collected: the chosen point, else the company's own address. */
function pickupText(company: Company, index: number, stored: boolean): string {
  const points = effectivePickupPoints(company);
  const point = points.length > 0 ? points[Math.min(index, points.length - 1)] : null;
  const label = point ? pickupLabel(point) : '';
  if (label) return label;
  return company.address.trim() || (stored ? 'Company pickup location (the company will confirm by phone)' : PICKUP_FALLBACK);
}

function CheckoutForm({
  product,
  company,
  quantity,
  initial,
  onReady,
}: {
  product: Product;
  company: Company;
  quantity: number;
  initial: OrderDraft | null;
  onReady: (draft: OrderDraft) => void;
}) {
  const { cities } = useCatalog();
  const profile = useAccount();
  const [useDelivery, setUseDelivery] = useState(initial ? initial.deliveryMethod === 'delivery' : product.isDeliveryAvailable);
  const [address, setAddress] = useState(initial?.deliveryMethod === 'delivery' ? initial.deliveryAddress : '');
  const [point, setPoint] = useState<GeoPoint | null>(
    initial?.deliveryLatitude != null && initial.deliveryLongitude != null
      ? { latitude: initial.deliveryLatitude, longitude: initial.deliveryLongitude }
      : null,
  );
  const [mapOpen, setMapOpen] = useState(false);
  const [phone, setPhone] = useState(parsePhone(initial?.contactPhone ?? profile.phone));
  const [installation, setInstallation] = useState(initial?.installationSelected ?? false);
  const [pickupIndex, setPickupIndex] = useState(0);
  const [error, setError] = useState('');

  // The city this order goes to: the customer's own unless they choose another.
  const cityChoices = cities.filter((c) => c.active && servesCity(company, c.id));
  const ownServed = cityChoices.some((c) => c.id === profile.cityId);
  const [cityId, setCityId] = useState(initial?.deliveryCityId ?? (ownServed ? profile.cityId ?? '' : ''));

  const unitPrice = salePrice(product)!;
  const subtotal = unitPrice * quantity;
  const deliveryFee = useDelivery ? STANDARD_DELIVERY_FEE : 0;
  const installationEligible = useDelivery && product.isInstallationAvailable;
  const installationPrice = product.installationPrice ?? 0;
  const installationFee = installationEligible && installation ? installationPrice : 0;
  const total = subtotal + installationFee + deliveryFee;
  const points = effectivePickupPoints(company);
  const money = (n: number) => formatPrice(n, product.currency);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (useDelivery && address.trim() === '' && point === null) return setError(t('أدخل العنوان أو حدد الموقع من الخريطة.'));
    const phoneProblem = phoneError(phone, true);
    if (phoneProblem) return setError(phoneProblem === t('رقم الهاتف مطلوب.') ? t('يرجى إدخال رقم هاتف للتواصل') : phoneProblem);
    // Stop here with a clear reason, not a refusal after the customer has paid.
    // A pickup is collected in person, so it is not tied to a city.
    if (useDelivery && (cityId === '' || !servesCity(company, cityId))) return setError(t('اختر مدينة توصيل تخدمها الشركة.'));
    onReady({
      id: initial?.id ?? newOrderId(),
      customerId: profile.id,
      customerName: clip(profile.fullName, CUSTOMER_NAME_MAX),
      companyId: product.companyId,
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice,
      productSubtotal: subtotal,
      installationSelected: installationEligible && installation,
      installationFee,
      deliveryFee,
      totalAmount: total,
      deliveryAddress: clip(useDelivery ? address.trim() : `Pickup: ${pickupText(company, pickupIndex, true)}`, DELIVERY_ADDRESS_MAX),
      // Pickup uses the company's own location, so no delivery point is saved.
      deliveryLatitude: useDelivery ? point?.latitude ?? null : null,
      deliveryLongitude: useDelivery ? point?.longitude ?? null : null,
      deliveryCityId: useDelivery ? cityId : null,
      contactPhone: toE164(phone),
      deliveryMethod: useDelivery ? 'delivery' : 'pickup',
    });
  }

  return (
    <form className="stack narrow" onSubmit={submit} noValidate>
      <h1 className="page-title">{t('إتمام الطلب')}</h1>

      <section className="tile line-item">
        <span className="thumb-lg">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <Icon d={PATHS.box} size={32} />}</span>
        <span className="grow">
          <strong className="pname" style={{ display: 'block' }}>{product.name}</strong>
          <span className="pmeta" style={{ display: 'block' }}>{t('سعر الوحدة:')}{' '}{money(unitPrice)}{' '}{t('· الكمية:')}{' '}{quantity}</span>
          <strong className="price">{t('المجموع الفرعي:')}{' '}{money(subtotal)}</strong>
        </span>
      </section>

      <section className="tile">
        <h2>{product.isDeliveryAvailable ? t('التوصيل والتواصل') : t('الاستلام والتواصل')}</h2>
        {product.isDeliveryAvailable && (
          <div className="segment" role="radiogroup" aria-label={t('طريقة الاستلام')}>
            <label className={useDelivery ? 'on' : ''}>
              <input className="sr-only" type="radio" name="method" checked={useDelivery} onChange={() => setUseDelivery(true)} />
              {t('توصيل')}
            </label>
            <label className={useDelivery ? '' : 'on'}>
              <input className="sr-only" type="radio" name="method" checked={!useDelivery} onChange={() => { setUseDelivery(false); setInstallation(false); }} />
              {t('استلام')}
            </label>
          </div>
        )}

        {useDelivery ? (
          <>
            <label className="field">
              {t('مدينة التوصيل')}
              <Select
                ariaLabel={t('مدينة التوصيل')}
                value={cityId}
                onChange={setCityId}
                options={[{ value: '', label: t('اختر مدينة') }, ...cityChoices.map((c) => ({ value: c.id, label: cityName(c) }))]}
              />
              <span className="pmeta">{t('الطلب لشخص آخر؟ اختر مدينته. مدينة حسابك لا تتغير.')}</span>
            </label>
            <label className="field">
              {t('العنوان')}
              <textarea
                rows={2}
                value={address}
                maxLength={DELIVERY_ADDRESS_MAX}
                placeholder={t('اسم الشارع، رقم المبنى/المنزل، الحي، المدينة')}
                onChange={(e) => setAddress(e.target.value)}
              />
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
          </>
        ) : (
          <>
            {points.length > 1 && (
              <fieldset className="plain">
                <legend>{t('اختر مكان استلام طلبك')}</legend>
                {points.map((p, i) => (
                  <label key={`${p.name}-${i}`} className="check">
                    <input type="radio" name="pickup" checked={i === Math.min(pickupIndex, points.length - 1)} onChange={() => setPickupIndex(i)} />
                    {p.name || p.address}
                  </label>
                ))}
              </fieldset>
            )}
            <div className="note" style={{ marginTop: 14 }}>
              <Icon d={PATHS.pin} />
              <span>
                <strong style={{ display: 'block' }}>{t('موقع الاستلام')}</strong>
                {pickupText(company, pickupIndex, false)}
              </span>
            </div>
          </>
        )}

        <PhoneInput label={t('رقم هاتف التواصل')} value={phone} onChange={setPhone} />
        <span className="pmeta">{t('ستتصل الشركة بهذا الرقم لتنسيق التوصيل')}</span>
      </section>

      {installationEligible && (
        <section className="tile">
          <h2>{t('خيار التركيب')}</h2>
          <p className="prose" style={{ marginTop: 6 }}>{t('تركيب بواسطة فني معتمد متاح مقابل')}{' '}{money(installationPrice)}.</p>
          <div className="segment two-line" role="radiogroup" aria-label={t('خيار التركيب')} style={{ marginTop: 12 }}>
            <label className={installation ? '' : 'on'}>
              <input className="sr-only" type="radio" name="install" checked={!installation} onChange={() => setInstallation(false)} />
              <strong>{t('المنتج فقط')}</strong>
              <span>{money(0)}</span>
            </label>
            <label className={installation ? 'on' : ''}>
              <input className="sr-only" type="radio" name="install" checked={installation} onChange={() => setInstallation(true)} />
              <strong>{t('المنتج + التركيب')}</strong>
              <span>+{money(installationPrice)}</span>
            </label>
          </div>
        </section>
      )}

      <section className="tile">
        <h2>{t('ملخص السعر')}</h2>
        <dl className="specs">
          <div><dt>{t('إجمالي المنتج (')}{quantity}{' '}{t('قطعة)')}</dt><dd>{money(subtotal)}</dd></div>
          {installationEligible && <div><dt>{t('خدمة التركيب')}</dt><dd>{installation ? `+${money(installationPrice)}` : t('غير مشمول')}</dd></div>}
          {useDelivery && <div><dt>{t('رسوم التوصيل')}</dt><dd>{money(deliveryFee)}</dd></div>}
          <div className="total-row"><dt>{t('الإجمالي النهائي')}</dt><dd>{money(total)}</dd></div>
        </dl>
      </section>

      <div className="note">
        <Icon d={PATHS.box} />
        <span>{t('بعدها تحوّل المبلغ وترفع الإيصال. ثم تؤكد الشركة الدفع، وعندها فقط يُحجز المنتج لك.')}</span>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="btn" type="submit" style={{ marginTop: 0 }}>{t('تأكيد الطلب •')}{' '}{money(total)}</button>

      {mapOpen && (
        <Suspense fallback={null}>
          <MapPicker
            initial={point}
            onClose={() => setMapOpen(false)}
            onConfirm={(p) => {
              setPoint(p);
              setMapOpen(false);
            }}
          />
        </Suspense>
      )}
    </form>
  );
}

function AccountCard({ account }: { account: Company['paymentAccounts'][number] }) {
  const [copied, setCopied] = useState('');
  function copy(text: string, label: string) {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    });
  }
  return (
    <article className="tile account">
      <strong>{account.bankName}</strong>
      {account.accountName && <div className="kv"><span className="pmeta">{t('اسم الحساب')}</span><span>{account.accountName}</span></div>}
      <div className="kv">
        <span className="pmeta">{t('رقم الحساب / MBAN')}</span>
        <span dir="ltr">{account.accountNumber}</span>
        <button type="button" className="link-btn" onClick={() => copy(account.accountNumber, t('رقم الحساب'))}>{t('نسخ')}</button>
      </div>
      {account.phoneNumber && (
        <div className="kv">
          <span className="pmeta">{t('رقم الهاتف المعرّف')}</span>
          <span dir="ltr">{displayPhone(account.phoneNumber)}</span>
          <button type="button" className="link-btn" onClick={() => copy(account.phoneNumber, t('رقم الهاتف'))}>{t('نسخ')}</button>
        </div>
      )}
      {copied && <div className="ok-text" role="status">{t('تم نسخ')}{' '}{copied}</div>}
    </article>
  );
}

function PaymentStep({ draft, company, onBack }: { draft: OrderDraft; company: Company; onBack: () => void }) {
  const nav = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [receipt, setReceipt] = useState<ReceiptImage | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const preview = useMemo(
    () => (receipt ? URL.createObjectURL(new Blob([new Uint8Array(receipt.bytes)], { type: 'image/jpeg' })) : ''),
    [receipt],
  );
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPreparing(true);
    setError('');
    try {
      setReceipt(await prepareReceipt(file));
    } catch (err) {
      setError(err instanceof ReceiptProblem ? err.message : t('تعذّرت قراءة هذا الملف كصورة. اختر صورة أو لقطة شاشة للإيصال.'));
    } finally {
      setPreparing(false);
    }
  }

  async function submit() {
    if (!receipt) return setError(t('يرجى رفع صورة إيصال التحويل أو اختيارها قبل الإرسال.'));
    setSending(true);
    setError('');
    try {
      const order = await placeOrder(draft, receipt);
      nav(`/orders/${order.id}?placed=1`, { replace: true });
    } catch (err) {
      setError(err instanceof OrderRefused ? err.message : t('تعذر إرسال الإيصال. يرجى المحاولة مرة أخرى.'));
      setSending(false);
    }
  }

  const accounts = company.paymentAccounts;
  return (
    <div className="stack narrow">
      <h1 className="page-title">{t('الدفع اليدوي')}</h1>
      <section className="tile amount">
        <span className="pmeta">{t('المبلغ المطلوب تحويله')}</span>
        <strong className="price big">{formatPrice(draft.totalAmount)}</strong>
        <span className="pmeta">{t('سيتم إنشاء طلبك بعد إرسال الإيصال.')}</span>
      </section>
      <div className="note">
        <Icon d={PATHS.box} />
        <span>{t('يرجى تحويل المبلغ المطلوب بدقة خارج الموقع باستخدام تطبيق البنك (بنكك، فوري، وغيرها) أو التحويل النقدي. بعد إتمام الدفع، ارفع لقطة شاشة لإيصال التحويل أدناه.')}</span>
      </div>

      <h2 className="group-title">{t('حسابات الدفع')}</h2>
      {accounts.length === 0 ? (
        <div className="error" role="alert" style={{ marginTop: 0 }}>{t('لم تضف هذه الشركة حسابات دفع بعد، لذلك لا تستطيع استلام دفعة الآن. يرجى التواصل مع الشركة.')}</div>
      ) : (
        accounts.map((account, i) => <AccountCard key={`${account.accountNumber}-${i}`} account={account} />)
      )}

      <section className="tile">
        <h2>{t('رفع إيصال التحويل')}</h2>
        <p className="prose" style={{ marginTop: 6 }}>{t('ارفع لقطة شاشة أو صورة واضحة لإشعار التحويل.')}</p>
        <input ref={fileInput} className="sr-only" type="file" accept="image/*" aria-label={t('رفع الإيصال')} onChange={pick} />
        {receipt ? (
          <div className="receipt-preview">
            <div className="kv">
              <span className="ok-text grow">{t('تم اختيار الإيصال')}</span>
              <button type="button" className="link-btn" onClick={() => setReceipt(null)}>{t('إزالة')}</button>
            </div>
            <img src={preview} alt={t('الإيصال')} />
            <div className="kv">
              <span className="pmeta grow" dir="ltr">{receipt.fileName} ({Math.round(receipt.bytes.length / 1024)} KB)</span>
              <button type="button" className="link-btn" disabled={preparing} onClick={() => fileInput.current?.click()}>{t('استبدال')}</button>
            </div>
          </div>
        ) : (
          <button type="button" className="upload" disabled={preparing} onClick={() => fileInput.current?.click()}>
            <strong>{preparing ? t('جارٍ تجهيز الصورة…') : t('اضغط لرفع الإيصال / لقطة الشاشة')}</strong>
            <span className="pmeta">{t('يدعم JPG و PNG أو لقطة شاشة من بنكك/فوري')}</span>
          </button>
        )}
      </section>

      <div className="warn-note">{t('يُرسل طلبك مع هذا الإيصال. الإيصال ليس تأكيداً للدفع: تتحقق الشركة من التحويل ثم تؤكده، وعندها فقط يُحجز المنتج لك.')}</div>
      {error && <div className="error" role="alert" style={{ marginTop: 0 }}>{error}</div>}
      <button className="btn" style={{ marginTop: 0 }} disabled={accounts.length === 0 || preparing || sending} onClick={submit}>
        {sending ? t('جارٍ الإرسال...') : t('إرسال الإيصال للتحقق')}
      </button>
      <button className="btn ghost" style={{ marginTop: 0 }} disabled={sending} onClick={onBack}>{t('تعديل بيانات الطلب')}</button>
    </div>
  );
}

/**
 * Checkout and payment are one page, so placing the order replaces the only
 * history entry: no Back press can return to a finished checkout and send it again.
 */
export function CheckoutPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { products, companies, loading, error } = useCatalog();
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [paying]);

  if (error) return <main className="stack"><ErrorState /></main>;
  if (loading) return <main className="stack"><Skeleton height={420} /></main>;

  const product = products.find((p) => p.id === id);
  const company = companies.find((c) => c.id === product?.companyId);
  if (!product || !company || !isAvailable(product) || salePrice(product) === null) {
    return (
      <main className="stack">
        <EmptyState title={t('هذا المنتج غير متاح للطلب الآن')}>
          <Link to={`/product/${id}`} className="pill">{t('العودة للمنتج')}</Link>
        </EmptyState>
      </main>
    );
  }

  const quantity = Math.max(1, Math.min(Number(params.get('qty')) || 1, maxOrderQuantity(product)));

  return (
    <main>
      <div className="checkout-company">
        <CompanyLogo company={company} size={36} />
        <span className="pmeta">{t('الطلب من')}{' '}{company.name}</span>
      </div>
      {paying && draft ? (
        <PaymentStep draft={draft} company={company} onBack={() => setPaying(false)} />
      ) : (
        <CheckoutForm
          product={product}
          company={company}
          quantity={quantity}
          initial={draft}
          onReady={(ready) => {
            setDraft(ready);
            setPaying(true);
          }}
        />
      )}
    </main>
  );
}
