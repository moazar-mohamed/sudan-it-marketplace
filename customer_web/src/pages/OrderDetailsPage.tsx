import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EmptyState, Skeleton } from '../components/Bits';
import { Icon, PATHS } from '../components/Icon';
import { ReviewCard } from '../components/ReviewCard';
import { PageTitle } from '../components/PageTitle';
import { openOrderChat } from '../data/chats';
import { useAccount, useCatalog } from '../data/DataProvider';
import { formatDateTime, formatPrice } from '../data/format';
import { useOrder } from '../data/hooks';
import { cancelledLines, isAwaitingVerification, loadReceipt, ORDER_STATUS, paymentLabel, shortOrderId } from '../data/orders';
import { displayPhone } from '../data/phone';
import { orderReviewSubject } from '../data/reviews';
import type { Order, OrderStatus } from '../data/types';
import { cityName } from '../data/cities';
import { t } from '../i18n';
import { BusyLabel } from '../components/BusyLabel';

const STEPS: OrderStatus[] = ['processing', 'out_for_delivery', 'completed'];

function StepTracker({ status }: { status: OrderStatus }) {
  const current = STEPS.indexOf(status);
  const done = status === 'completed';
  return (
    <ol className="steps">
      {STEPS.map((step, i) => (
        <li key={step} className={i < current || done ? 'done' : i === current ? 'now' : ''} aria-current={i === current ? 'step' : undefined}>
          <span className="step-dot">{i < current || done ? '✓' : i + 1}</span>
          <span>{ORDER_STATUS[step].label}</span>
        </li>
      ))}
    </ol>
  );
}

/** Read on demand: every read spends part of the free daily quota, so a failure is retried by hand. */
function ReceiptButton({ orderId }: { orderId: string }) {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'none' | 'failed'>('idle');
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  async function open() {
    setState('loading');
    try {
      const blob = await loadReceipt(orderId);
      if (blob) {
        setUrl(URL.createObjectURL(blob));
        setState('idle');
      } else setState('none');
    } catch {
      setState('failed');
    }
  }

  return (
    <>
      <button className="mini-btn" disabled={state === 'loading'} aria-busy={state === 'loading'} onClick={open}><BusyLabel busy={state === 'loading'} busyText={t('جارٍ تحميل الإيصال…')}>{t('عرض الإيصال')}</BusyLabel></button>
      {state === 'none' && <span className="pmeta">{t('لا توجد صورة إيصال لهذا الطلب.')}</span>}
      {state === 'failed' && <span className="error" style={{ marginTop: 0 }}>{t('تعذّر تحميل الإيصال. تحقق من اتصالك وحاول مرة أخرى.')}</span>}
      {url && (
        <div className="scrim" onMouseDown={() => setUrl('')}>
          <div className="palette receipt-panel" role="dialog" aria-modal="true" aria-label={t('إيصال الدفع')} onMouseDown={(e) => e.stopPropagation()}>
            <h2>{t('إيصال الدفع')}</h2>
            <img src={url} alt={t('إيصال الدفع')} />
            <button className="btn ghost" onClick={() => setUrl('')}>{t('إغلاق')}</button>
          </div>
        </div>
      )}
    </>
  );
}

function pickupText(order: Order): string {
  return order.deliveryAddress.replace(/^Pickup:\s*/, '').replace(/^Company pickup location.*$/, t('موقع استلام الشركة (ستؤكده الشركة عبر الهاتف)'));
}

function DeliveryCard({ order }: { order: Order }) {
  const { cities, companies } = useCatalog();
  const pickup = order.deliveryMethod === 'pickup';
  const hasPoint = order.deliveryLatitude !== null && order.deliveryLongitude !== null;
  const city = cities.find((c) => c.id === order.deliveryCityId);
  const company = companies.find((c) => c.id === order.companyId);
  const text = pickup ? pickupText(order) : order.deliveryAddress.trim();
  const mapLink = hasPoint
    ? `https://www.openstreetmap.org/?mlat=${order.deliveryLatitude}&mlon=${order.deliveryLongitude}#map=16/${order.deliveryLatitude}/${order.deliveryLongitude}`
    : !pickup && text
      ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(text)}`
      : pickup && company?.latitude != null
        ? `https://www.openstreetmap.org/?mlat=${company.latitude}&mlon=${company.longitude}#map=16/${company.latitude}/${company.longitude}`
        : null;
  return (
    <section className="tile">
      <h2>{pickup ? t('تفاصيل الاستلام') : t('تفاصيل التوصيل')}</h2>
      <dl className="specs">
        <div><dt>{t('العنوان')}</dt><dd>{text || (hasPoint ? t('محدد على الخريطة') : '—')}</dd></div>
        {!pickup && city && <div><dt>{t('مدينة التوصيل')}</dt><dd>{cityName(city)}</dd></div>}
        <div><dt>{t('هاتف التواصل')}</dt><dd dir="ltr">{displayPhone(order.contactPhone)}</dd></div>
        {order.installationSelected && <div><dt>{t('نوع الطلب')}</dt><dd>{t('منتج + تركيب (+')}{formatPrice(order.installationFee)})</dd></div>}
        <div><dt>{t('تاريخ الطلب')}</dt><dd dir="ltr">{formatDateTime(order.createdAt)}</dd></div>
      </dl>
      {mapLink && (
        <a className="more" href={mapLink} target="_blank" rel="noreferrer">
          {pickup ? t('عرض موقع الشركة') : hasPoint ? t('فتح موقع التوصيل') : t('البحث عن العنوان في الخريطة')}
        </a>
      )}
    </section>
  );
}

/** An order older than conversations gets its conversation here, on first use. */
function OpenChatButton({ order }: { order: Order }) {
  const navigate = useNavigate();
  const profile = useAccount();
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  function open() {
    // One press opens it; more presses while it opens do nothing.
    if (opening) return;
    setOpening(true);
    setError('');
    openOrderChat(profile.id, order).then(
      (id) => navigate(`/chats/${id}`),
      () => {
        setOpening(false);
        setError(t('تعذر بدء المحادثة. يرجى المحاولة مرة أخرى.'));
      },
    );
  }
  return (
    <>
      <button className="btn-line contact" disabled={opening} aria-busy={opening} onClick={open}>
        <BusyLabel busy={opening} busyText={t('جارٍ فتح المحادثة…')}>
          <Icon d={PATHS.chat} size={18} />
          {t('فتح المحادثة')}
        </BusyLabel>
      </button>
      {error && <div className="error" role="alert">{error}</div>}
    </>
  );
}

export function OrderDetailsPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { order, loaded } = useOrder(id);
  const placed = params.get('placed') === '1';

  if (!loaded) return <main className="stack narrow"><Skeleton height={420} /></main>;
  if (!order) {
    return (
      <main className="stack">
        <EmptyState title={t('تعذر تحميل الطلب')}>
          <Link to="/orders" className="pill">{t('طلباتي')}</Link>
        </EmptyState>
      </main>
    );
  }

  const status = ORDER_STATUS[order.orderStatus];
  const payment = paymentLabel(order);
  const awaiting = isAwaitingVerification(order);
  const cancelled = order.orderStatus === 'cancelled';
  const delivery = order.deliveryMethod === 'delivery';

  return (
    <main className="stack narrow">
      <PageTitle title={`${t('طلب #')}${shortOrderId(order.id)}`} />
      <h1 className="page-title">{t('طلب #')}<span dir="ltr">{shortOrderId(order.id)}</span></h1>

      {placed && awaiting && (
        <section className="tile pending">
          <span className="status warn">{t('بانتظار التحقق')}</span>
          <h2>{t('تم إرسال طلبك: بانتظار الشركة')}</h2>
          <p>{t('أُرسل طلبك وإيصال التحويل إلى الشركة. الإيصال ليس تأكيداً للدفع: تتحقق الشركة من وصول المبلغ ثم تؤكده.')}</p>
          <div className="buy-row">
            <Link to="/orders" className="btn-line">{t('عرض في طلباتي')}</Link>
            <Link to="/" className="btn-solid">{t('العودة إلى السوق')}</Link>
          </div>
        </section>
      )}

      <section className="tile">
        <div className="tile-head">
          <h2>{t('حالة الطلب')}</h2>
          <span className={`status ${status.tone}`}>{status.label}</span>
        </div>
        {cancelled ? (
          <div className="cancelled">
            <strong>{t('أُلغي هذا الطلب')}</strong>
            {cancelledLines(order).map((line) => <p key={line}>{line}</p>)}
          </div>
        ) : (
          <StepTracker status={order.orderStatus} />
        )}
      </section>

      {order.orderStatus === 'completed' && <ReviewCard subject={orderReviewSubject(order)} />}

      <section className="tile">
        <h2>{t('التواصل')}</h2>
        <OpenChatButton order={order} />
      </section>

      <section className="tile">
        <h2>{t('المنتج المطلوب')}</h2>
        <Link to={`/product/${order.productId}`} className="pname" style={{ display: 'block', marginTop: 12 }}>{order.productName}</Link>
        <div className="pmeta">{order.companyName}</div>
        <dl className="specs">
          <div><dt>{t('سعر الوحدة')}</dt><dd>{formatPrice(order.unitPrice)}</dd></div>
          <div><dt>{t('الكمية')}</dt><dd>{order.quantity}</dd></div>
        </dl>
      </section>

      <DeliveryCard order={order} />

      <section className="tile">
        <div className="tile-head">
          <h2>{t('حالة الدفع')}</h2>
          <span className={`status ${payment.tone}`}>{payment.label}</span>
        </div>
        {order.receiptFileName && (
          <div className="location-row">
            <span className="ok-text">{t('الإيصال مرفق')}</span>
            <span className="pmeta" dir="ltr">{order.receiptFileName}</span>
            <ReceiptButton orderId={order.id} />
          </div>
        )}
        {awaiting && <div className="note" style={{ marginTop: 12 }}>{t('المنتج غير محجوز لك بعد: لا يُخصم من المخزون إلا عندما تؤكد الشركة دفعك. وإذا نفد قبل ذلك، قد تلغي الشركة الطلب وتعيد إليك المبلغ المحوّل خارج التطبيق.')}</div>}
        {order.paymentStatus === 'confirmed' && !cancelled && <div className="ok-note">{t('أكدت الشركة دفعك، والمنتج محجوز لطلبك.')}</div>}
      </section>

      <section className="tile">
        <dl className="specs" style={{ marginTop: 0 }}>
          <div><dt>{t('إجمالي المنتج')}</dt><dd>{formatPrice(order.productSubtotal)}</dd></div>
          {order.installationSelected && <div><dt>{t('رسوم التركيب')}</dt><dd>+{formatPrice(order.installationFee)}</dd></div>}
          {delivery && <div><dt>{t('رسوم التوصيل')}</dt><dd>{formatPrice(order.deliveryFee)}</dd></div>}
          <div className="total-row"><dt>{t('الإجمالي')}</dt><dd>{formatPrice(order.totalAmount)}</dd></div>
        </dl>
      </section>
    </main>
  );
}
