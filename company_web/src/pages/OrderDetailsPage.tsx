import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { useCompanyData } from '../data/CompanyData';
import { cityName, useCities } from '../data/cities';
import { dateTime, dayTime, displayPhone, leftLabel, money, paymentTimeLeft, shortId, unitsText, urgencyOf } from '../data/format';
import { mapOrder } from '../data/mappers';
import {
  advanceAndNotify,
  assignTechnician,
  cancelWithMessage,
  confirmPayment,
  markRefunded,
  nextStatusLabel,
  nextStatusOf,
  notifyPaymentConfirmed,
  OrderError,
  orderProblemText,
} from '../data/orders';
import { useReceipt } from '../data/receipts';
import { useTechnicians } from '../data/technicians';
import type { CancelReason, Order } from '../data/types';
import { db } from '../firebase';
import { ChatPanel } from '../ui/ChatPanel';
import { Icon } from '../ui/Icon';
import {
  Banner,
  CANCEL_REASON_LABEL,
  Chip,
  ConfirmDialog,
  Empty,
  KindCell,
  Loading,
  OrderStatusChip,
  PageHeader,
  PaymentChip,
  Spinner,
  useNow,
} from '../ui/kit';
import { useToast } from '../ui/toast';
import { t } from '../i18n';

function useOrder(id: string): Order | null | undefined {
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  useEffect(() => {
    setOrder(undefined);
    return onSnapshot(doc(db, 'orders', id), (s) => setOrder(s.exists() ? mapOrder(s.id, s.data()) : null), () => setOrder(null));
  }, [id]);
  return order;
}

const REJECT_REASONS: { key: string; label: string; cancel: CancelReason; message: (o: Order) => string }[] = [
  { key: 'amount', label: t('المبلغ المحوَّل لا يطابق قيمة الطلب'), cancel: 'company', message: (o) => t('عميلنا العزيز، المبلغ الظاهر في الإيصال لا يطابق قيمة الطلب #{0} وهي {1} SDG، فتعذّر تأكيده. يمكنك إعادة الطلب أو التواصل معنا هنا.', shortId(o.id), money(o.totalAmount)) },
  { key: 'unclear', label: t('الإيصال غير واضح'), cancel: 'company', message: (o) => t('عميلنا العزيز، لم نتمكن من قراءة إيصال الطلب #{0} لعدم وضوحه، فتعذّر تأكيده. يمكنك إعادة الطلب مع صورة أوضح.', shortId(o.id)) },
  { key: 'notreceived', label: t('لم يصلنا التحويل'), cancel: 'company', message: (o) => t('عميلنا العزيز، لم يصلنا تحويل الطلب #{0} في حسابنا، فتعذّر تأكيده. إن كنت قد حوّلت المبلغ فتواصل معنا هنا.', shortId(o.id)) },
  { key: 'stock', label: t('نفد المخزون'), cancel: 'out_of_stock', message: (o) => t('تم إلغاء طلبك #{0} لأن المنتج نفد من المخزون. إن كنت قد حوّلت المبلغ فسنعيده إليك. نعتذر عن الإزعاج.', shortId(o.id)) },
];

export function OrderDetailsPage() {
  const { id = '' } = useParams();
  const order = useOrder(id);
  if (order === undefined) return <main className="page"><Loading /></main>;
  if (order === null) return <main className="page"><Empty icon="receipt" text={t('الطلب غير موجود.')} action={<Link to="/orders" className="btn">{t('العودة إلى الطلبات')}</Link>} /></main>;
  return <Details order={order} />;
}

function Details({ order }: { order: Order }) {
  const { state } = useAuth();
  const { companyId, products, pendingPayment } = useCompanyData();
  const toast = useToast();
  const now = useNow();
  const cities = useCities();
  const technicians = useTechnicians(companyId);
  const senderName = state.status === 'authorized' ? state.profile.fullName || t('الشركة') : t('الشركة');

  const awaiting = order.orderStatus === 'processing' && order.paymentStatus === 'pending_verification';
  const confirmedOpen = order.orderStatus !== 'cancelled' && order.orderStatus !== 'completed' && order.paymentStatus === 'confirmed';
  const next = nextStatusOf(order);
  const left = paymentTimeLeft(order, now);
  const urg = urgencyOf(left);

  const product = products?.find((p) => p.id === order.productId);
  const stock = product?.stockCount ?? 0;
  // Orders on the same product still waiting for their payment, oldest first (they take stock only when confirmed).
  const competing = useMemo(
    () => pendingPayment.filter((o) => o.productId === order.productId && !o.stockReserved).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    [pendingPayment, order.productId],
  );
  const demand = competing.reduce((n, o) => n + o.quantity, 0);

  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reasonKey, setReasonKey] = useState(REJECT_REASONS[0].key);
  const reason = REJECT_REASONS.find((r) => r.key === reasonKey) ?? REJECT_REASONS[0];
  const [message, setMessage] = useState(() => REJECT_REASONS[0].message(order));
  const [error, setError] = useState('');
  const [advancing, setAdvancing] = useState(false);
  const [cancelAfterPay, setCancelAfterPay] = useState(false);
  const [refundNote, setRefundNote] = useState('');

  const doConfirm = async () => {
    setBusy(true);
    setError('');
    try {
      const fresh = await confirmPayment(order.id);
      const notified = await notifyPaymentConfirmed(fresh);
      toast(notified ? t('تم تأكيد الدفع وخصم المخزون وأُبلغ العميل') : t('تم تأكيد الدفع وخصم المخزون، لكن تعذّر إرسال الإشعار للعميل'), notified ? 'ok' : 'info');
      setConfirming(false);
    } catch (e) {
      setError(orderProblemText(e));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const doReject = async () => {
    setBusy(true);
    setError('');
    try {
      const { messaged } = await cancelWithMessage(order, reason.cancel, message, senderName, reason.label);
      toast(messaged ? t('أُلغي الطلب وأُرسلت الرسالة للعميل في المحادثة') : t('أُلغي الطلب، لكن تعذّر إرسال الرسالة (لا توجد محادثة لهذا الطلب)'), messaged ? 'ok' : 'info');
      setCancelling(false);
    } catch (e) {
      setError(orderProblemText(e));
      setCancelling(false);
    } finally {
      setBusy(false);
    }
  };

  const doCancelConfirmed = async () => {
    setBusy(true);
    setError('');
    try {
      const text = refundNote.trim() || t('تم إلغاء طلبك #{0}. سنتواصل معك لإعادة المبلغ الذي حوّلته.', shortId(order.id));
      const { messaged } = await cancelWithMessage(order, 'company', text, senderName, refundNote);
      toast(messaged ? t('أُلغي الطلب وأُبلغ العميل في المحادثة. أعد المبلغ للعميل خارج النظام.') : t('أُلغي الطلب. أعد المبلغ للعميل خارج النظام.'), 'ok');
      setCancelAfterPay(false);
    } catch (e) {
      setError(orderProblemText(e));
      setCancelAfterPay(false);
    } finally {
      setBusy(false);
    }
  };

  const doAdvance = async () => {
    setBusy(true);
    setError('');
    try {
      const { notified } = await advanceAndNotify(order);
      toast(notified ? t('تم تحديث الحالة وأُبلغ العميل') : t('تم تحديث الحالة، لكن تعذّر إرسال الإشعار للعميل'), notified ? 'ok' : 'info');
      setAdvancing(false);
    } catch (e) {
      setError(orderProblemText(e));
      setAdvancing(false);
    } finally {
      setBusy(false);
    }
  };

  const mapLink = order.deliveryLatitude !== null && order.deliveryLongitude !== null
    ? `https://www.openstreetmap.org/?mlat=${order.deliveryLatitude}&mlon=${order.deliveryLongitude}#map=17/${order.deliveryLatitude}/${order.deliveryLongitude}`
    : null;

  return (
    <main className="page">
      <PageHeader
        crumbs={[{ to: '/orders', label: t('الطلبات') }, { label: `#${shortId(order.id)}` }]}
        title={<>{t('طلب')}{' '}<span className="num">#{shortId(order.id)}</span></>}
        actions={<><OrderStatusChip order={order} /><PaymentChip order={order} /></>}
      />
      {error && <div style={{ marginBottom: 16 }}><Banner tone="bad" icon="alert">{error}</Banner></div>}

      <div className="g2r">
        <div className="stack">
          {awaiting && (
            <section className="card" aria-label={t('القرار')}>
              <div className="card-h"><h2>{t('القرار')}</h2></div>
              <div className="card-b stack" style={{ gap: 16 }}>
                <Banner tone={left <= 0 ? 'bad' : urg === 'n' ? 'info' : urg} icon="clock" tight>
                  {left <= 0
                    ? <b>{t('انتهت مهلة التحقق، وسيُلغى الطلب تلقائيًا.')}</b>
                    : <><b>{t('تنتهي المهلة بعد')}{' '}<span className="num">{leftLabel(left)}</span></b><div style={{ fontSize: 13 }}>{t('بعدها يُلغى الطلب تلقائيًا.')}</div></>}
                </Banner>

                <div>
                  <div className="b" style={{ marginBottom: 8 }}>{t('أثر التأكيد على المخزون')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, textAlign: 'center' }}>
                    <div style={{ background: 'var(--neutral-bg)', borderRadius: 10, padding: '10px 4px' }}><div className="sub">{t('المتوفر الآن')}</div><div className="b" style={{ fontSize: 24 }}>{stock}</div></div>
                    <div style={{ background: 'var(--neutral-bg)', borderRadius: 10, padding: '10px 4px' }}><div className="sub">{t('هذا الطلب')}</div><div className="b" style={{ fontSize: 24 }}>{order.quantity}</div></div>
                    <div style={{ background: stock - order.quantity < 0 ? 'var(--bad-bg)' : 'var(--brand-tint)', borderRadius: 10, padding: '10px 4px' }}><div className="sub" style={{ color: stock - order.quantity < 0 ? 'var(--bad)' : 'var(--brand-ink)' }}>{t('بعد التأكيد')}</div><div className="b" style={{ fontSize: 24, color: stock - order.quantity < 0 ? 'var(--bad)' : 'var(--brand-ink)' }}>{product ? stock - order.quantity : '—'}</div></div>
                  </div>
                </div>
                {!product && <Banner tone="bad" icon="alert" tight>{t('المنتج لم يعد في كتالوجك، فلا يمكن تأكيد الطلب. ألغه بسبب «نفد المخزون».')}</Banner>}
                {product && stock < order.quantity && <Banner tone="bad" icon="alert" tight>{t('المخزون لا يغطي هذا الطلب. زد المخزون من')}{' '}<Link to={`/products/${product.id}`} className="b">{t('صفحة المنتج')}</Link>{' '}{t('ثم أكّد، أو ألغه بسبب «نفد المخزون».')}</Banner>}
                {competing.length > 1 && demand > stock && (
                  <Banner tone="warn" icon="alert" tight>
                    <b>{t('المخزون لا يغطي كل الطلبات المعلقة.')}</b>{' '}{t('على هذا المنتج {0} طلبات تحتاج {1} والمتوفر {2}. أكِّد الأقدم أولًا:', competing.length, unitsText(demand), stock)}<div style={{ marginTop: 6 }}>
                      {competing.map((o, i) => (
                        <div key={o.id} className="row" style={{ justifyContent: 'space-between' }}>
                          <Link to={`/orders/${o.id}`} className="num b">#{shortId(o.id)}{o.id === order.id ? t(' (هذا)') : ''}</Link>
                          <span>{i + 1} · {unitsText(o.quantity)} · {dayTime(o.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </Banner>
                )}

                <button type="button" className="btn p lg" disabled={busy} onClick={() => setConfirming(true)}>
                  <Icon name="check" />{t('تأكيد الدفع وخصم {0}', unitsText(order.quantity))}</button>
                <p className="sub" style={{ textAlign: 'center' }}>{t('يصل العميل إشعار، ويُنقص المخزون في الخطوة نفسها.')}</p>

                <div className="row"><span className="hr grow" /><span className="sub">{t('أو')}</span><span className="hr grow" /></div>

                <div style={{ border: '1px solid var(--bad-line)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="b" style={{ color: 'var(--bad)' }}>{t('رفض الإيصال وإلغاء الطلب')}</div>
                  <div className="fld">
                    <label htmlFor="why">{t('السبب')}</label>
                    <select id="why" className="inp" value={reasonKey} onChange={(e) => { const r = REJECT_REASONS.find((x) => x.key === e.target.value)!; setReasonKey(r.key); setMessage(r.message(order)); }}>
                      {REJECT_REASONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className="fld">
                    <label htmlFor="msg">{t('رسالة للعميل')}</label>
                    <textarea id="msg" className="inp" rows={4} value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} />
                    <span className="hint">{t('تُضاف إلى محادثة الطلب ليراها العميل.')}</span>
                  </div>
                  <button type="button" className="btn d blk" disabled={busy || !message.trim()} onClick={() => setCancelling(true)}>
                    <Icon name="x" />{t('إلغاء الطلب وإبلاغ العميل')}</button>
                </div>
              </div>
            </section>
          )}

          {confirmedOpen && (
            <section className="card" aria-label={t('إدارة الطلب')}>
              <div className="card-h"><h2>{t('إدارة الطلب')}</h2></div>
              <div className="card-b stack" style={{ gap: 14 }}>
                <Banner tone="ok" icon="check" tight>{t('تم تأكيد الدفع وخُصم المخزون.')}</Banner>
                {order.installationSelected && !order.technicianId && <Banner tone="warn" icon="alert" tight>{t('هذا الطلب فيه تركيب ولم يُعيَّن له فني بعد.')}</Banner>}
                {next && <button type="button" className="btn p lg" disabled={busy} onClick={() => setAdvancing(true)}><Icon name="chevron" />{nextStatusLabel(order)}</button>}
                {order.orderStatus === 'processing' && (
                  <button type="button" className="btn d blk" disabled={busy} onClick={() => setCancelAfterPay(true)}><Icon name="x" />{t('إلغاء الطلب')}</button>
                )}
              </div>
            </section>
          )}

          {(order.orderStatus === 'completed' || order.orderStatus === 'cancelled') && (
            <section className="card" aria-label={t('حالة الطلب')}>
              <div className="card-b">
                {order.orderStatus === 'completed'
                  ? <Banner tone="ok" icon="check" tight>{t('اكتمل هذا الطلب.')}</Banner>
                  : <CancelledNote order={order} />}
              </div>
            </section>
          )}

          <section className="card" aria-label={t('ملخص الطلب')}>
            <div className="card-h"><h3>{t('ملخص الطلب')}</h3></div>
            <div className="card-b">
              <div className="row">
                <div className="thumb lg">{product?.imageUrl ? <img src={product.imageUrl} alt="" /> : <Icon name="image" size="lg" />}</div>
                <div className="grow"><div className="b">{order.productName}</div><div className="sub">{t('الكمية {0} ·', order.quantity)}{' '}<span className="num">{money(order.unitPrice)}</span>{' '}{t('للوحدة')}</div></div>
              </div>
              <hr className="hr" style={{ margin: '14px 0 6px' }} />
              <div className="kv"><span>{t('المنتج')}</span><span className="num">{money(order.productSubtotal)}</span></div>
              <div className="kv"><span>{t('التوصيل')}</span><span className="num">{money(order.deliveryFee)}</span></div>
              <div className="kv"><span>{t('التركيب')}</span><span className="num">{order.installationSelected ? money(order.installationFee) : t('لا')}</span></div>
              <hr className="hr" />
              <div className="kv b" style={{ fontSize: 16 }}><span style={{ color: 'var(--ink)' }}>{t('الإجمالي')}</span><span><span className="num">{money(order.totalAmount)}</span> SDG</span></div>
            </div>
          </section>

          <section className="card" aria-label={t('العميل والتوصيل')}>
            <div className="card-h"><h3>{t('العميل والتوصيل')}</h3></div>
            <div className="card-b">
              <div className="kv"><span>{t('العميل')}</span><span>{order.customerName || t('عميل')}</span></div>
              <div className="kv"><span>{t('الهاتف')}</span><a href={`tel:${order.contactPhone}`} className="num">{displayPhone(order.contactPhone)}</a></div>
              <div className="kv"><span>{t('النوع')}</span><KindCell order={order} /></div>
              {order.deliveryMethod === 'delivery' && order.deliveryCityId && <div className="kv"><span>{t('المدينة')}</span><span>{cityName(cities, order.deliveryCityId)}</span></div>}
              <div className="kv"><span>{order.deliveryMethod === 'pickup' ? t('الاستلام') : t('العنوان')}</span><span style={{ textAlign: 'end' }}>{order.deliveryAddress || (order.deliveryMethod === 'pickup' ? t('من موقع الشركة') : '—')}</span></div>
              {mapLink && <a href={mapLink} target="_blank" rel="noreferrer" className="btn sm blk" style={{ marginTop: 8 }}><Icon name="pin" size="sm" />{t('فتح الموقع على الخريطة')}</a>}
            </div>
          </section>

          {order.installationSelected && order.orderStatus !== 'cancelled' && (
            <TechnicianCard order={order} technicians={technicians} />
          )}

          <section className="card" aria-label={t('سجل الطلب')}>
            <div className="card-h"><h3>{t('سجل الطلب')}</h3></div>
            <div className="card-b">
              <ul className="tl">
                <li><div><div className="b">{t('تم الطلب')}</div><div className="sub">{dateTime(order.createdAt)}</div></div></li>
                <li className={order.receiptFileName ? '' : 'todo'}><div><div className="b">{order.receiptFileName ? t('رُفع الإيصال') : t('لا إيصال')}</div><div className="sub num">{order.receiptFileName}</div></div></li>
                <li className={order.paymentStatus === 'confirmed' ? '' : 'todo'}><div><div className="b">{order.paymentStatus === 'confirmed' ? t('تم تأكيد الدفع') : t('تأكيد الدفع')}</div></div></li>
                <li className={order.orderStatus === 'out_for_delivery' || order.orderStatus === 'completed' ? '' : 'todo'}><div><div className="b">{order.deliveryMethod === 'pickup' ? t('جاهز للتسليم') : t('في الطريق')}</div></div></li>
                <li className={order.orderStatus === 'completed' ? '' : 'todo'}><div><div className="b">{t('مكتمل')}</div></div></li>
              </ul>
            </div>
          </section>
        </div>

        <div className="stack">
          <ReceiptCard orderId={order.id} />
          {awaiting && <Checklist order={order} />}
          <ChatPanel chatId={order.id} senderName={senderName} />
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title={t('تأكيد الدفع')}
          body={t('سيُؤكَّد دفع الطلب #{0} ويُخصم {1} من المخزون ويصل العميل إشعار. تأكد أن المبلغ وصل فعلًا إلى حسابك.', shortId(order.id), unitsText(order.quantity))}
          confirmLabel={t('تأكيد الدفع')}
          busy={busy}
          onConfirm={() => void doConfirm()}
          onClose={() => setConfirming(false)}
        />
      )}
      {cancelling && (
        <ConfirmDialog
          title={t('إلغاء الطلب وإبلاغ العميل؟')}
          body={t('سيُلغى الطلب #{0} ({1}) ولا يمكن التراجع، وتصل العميل رسالتك في المحادثة.', shortId(order.id), reason.label)}
          confirmLabel={t('إلغاء الطلب')}
          danger
          busy={busy}
          onConfirm={() => void doReject()}
          onClose={() => setCancelling(false)}
        />
      )}
      {cancelAfterPay && (
        <ConfirmDialog
          title={t('إلغاء طلب مدفوع؟')}
          body={t('دفع هذا الطلب مؤكد بمبلغ {0} SDG. عند الإلغاء يعود المخزون، وعليك إعادة المبلغ للعميل خارج النظام.', money(order.totalAmount))}
          confirmLabel={t('إلغاء الطلب')}
          danger
          busy={busy}
          onConfirm={() => void doCancelConfirmed()}
          onClose={() => setCancelAfterPay(false)}
        >
          <div className="fld">
            <label htmlFor="refund">{t('رسالة للعميل')}{' '}<span className="muted">{t('(اختياري)')}</span></label>
            <textarea id="refund" className="inp" rows={3} value={refundNote} onChange={(e) => setRefundNote(e.target.value)} placeholder={t('سنعيد إليك المبلغ خلال يومين عمل…')} />
          </div>
        </ConfirmDialog>
      )}
      {advancing && next && (
        <ConfirmDialog
          title={t('تحديث حالة الطلب #{0}', shortId(order.id))}
          body={t('سيصبح الطلب «{0}» ويصل العميل إشعار بذلك.', next === 'completed' ? t('مكتمل') : t('في الطريق'))}
          confirmLabel={t('تأكيد')}
          busy={busy}
          onConfirm={() => void doAdvance()}
          onClose={() => setAdvancing(false)}
        />
      )}
    </main>
  );
}

/** Why and when the order was cancelled, and for a paid one whether the money has been given back. */
function CancelledNote({ order }: { order: Order }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const paid = order.paymentStatus === 'confirmed';
  const markPaidBack = async () => {
    setBusy(true);
    try { await markRefunded(order.id); toast(t('سُجّل ردّ المبلغ للعميل'), 'ok'); } catch { toast(t('تعذّر تسجيل الاسترداد.'), 'err'); } finally { setBusy(false); }
  };
  return (
    <div className="stack t">
      <Banner tone="bad" icon="x" tight>
        <b>{t('أُلغي هذا الطلب')}</b>{order.cancelReason ? ` · ${CANCEL_REASON_LABEL[order.cancelReason]}` : ''}
        <div style={{ fontSize: 13 }}>{order.cancelledAt ? dateTime(order.cancelledAt) : ''}{order.stockReleased ? t(' · أُعيد المخزون المحجوز') : ''}</div>
        {order.cancelNote && <div style={{ fontSize: 13, marginTop: 4 }}>{t('السبب المسجَّل: {0}', order.cancelNote)}</div>}
      </Banner>
      {paid && (order.refundedAt ? (
        <Banner tone="ok" icon="check" tight>{t('رُدّ المبلغ للعميل · {0}', dateTime(order.refundedAt))}</Banner>
      ) : (
        <Banner tone="warn" icon="wallet" tight action={<button type="button" className="btn sm" disabled={busy} onClick={() => void markPaidBack()}>{busy && <Spinner />}{t('سجّلت رد المبلغ')}</button>}>
          <b>{t('بانتظار ردّ المبلغ:')}</b>{' '}{t('دفع هذا الطلب كان مؤكدًا بمبلغ')}{' '}<span className="num">{money(order.totalAmount)}</span>{' '}{t('SDG. أعده للعميل خارج النظام ثم سجّله هنا.')}</Banner>
      ))}
    </div>
  );
}

function ReceiptCard({ orderId }: { orderId: string }) {
  const receipt = useReceipt(orderId);
  const [zoom, setZoom] = useState(1);
  const [turn, setTurn] = useState(0);
  return (
    <section className="card" aria-label={t('الإيصال')}>
      <div className="card-h">
        <h2>{t('إيصال التحويل')}</h2>
        {receipt.status === 'ready' && <span className="sub num">{receipt.fileName}</span>}
        <span className="grow" />
        {receipt.status === 'ready' && (
          <>
            <button type="button" className="icon-btn flat" aria-label={t('تكبير')} onClick={() => setZoom((z) => Math.min(4, z + 0.5))}><Icon name="zoom" /></button>
            <button type="button" className="icon-btn flat" aria-label={t('تصغير')} onClick={() => setZoom((z) => Math.max(0.5, z - 0.5))}><Icon name="minus" /></button>
            <button type="button" className="icon-btn flat" aria-label={t('تدوير')} onClick={() => setTurn((t) => (t + 90) % 360)}><Icon name="rotate" /></button>
            <a className="icon-btn flat" aria-label={t('تنزيل')} href={receipt.url} download={receipt.fileName || 'receipt.jpg'}><Icon name="download" /></a>
          </>
        )}
      </div>
      <div className="card-b">
        <div className="rcpt">
          {receipt.status === 'loading' && <Spinner />}
          {receipt.status === 'none' && <Empty icon="image" text={t('لا يوجد إيصال محفوظ لهذا الطلب.')} />}
          {receipt.status === 'error' && <Empty icon="alert" text={t('تعذّر تحميل الإيصال.')} />}
          {receipt.status === 'ready' && (
            <img src={receipt.url} alt={t('إيصال التحويل الذي رفعه العميل')} style={{ transform: `scale(${zoom}) rotate(${turn}deg)`, imageRendering: 'auto', minWidth: 120 }} />
          )}
        </div>
      </div>
    </section>
  );
}

function Checklist({ order }: { order: Order }) {
  const { company } = useCompanyData();
  const account = company?.paymentAccounts[0];
  return (
    <section className="card" aria-label={t('قائمة التحقق')}>
      <div className="card-h"><h3>{t('قائمة التحقق قبل التأكيد')}</h3><span className="sub">{t('للمساعدة فقط، لا تُحفظ')}</span></div>
      <div className="card-b stack t">
        <label className="row"><input type="checkbox" className="chk" /><span>{t('المبلغ في الإيصال يساوي')}{' '}<b className="num">{money(order.totalAmount)}</b> SDG</span></label>
        <label className="row"><input type="checkbox" className="chk" /><span>{t('الحساب المستلم هو حسابنا')}{account ? <> · {account.bankName} · <span className="num">{account.accountNumber}</span></> : ''}</span></label>
        <label className="row"><input type="checkbox" className="chk" /><span>{t('وصل المبلغ فعلًا إلى حسابنا (راجع كشف الحساب)')}</span></label>
        <label className="row"><input type="checkbox" className="chk" /><span>{t('رقم العملية غير مستخدم في طلب آخر')}</span></label>
      </div>
    </section>
  );
}

function TechnicianCard({ order, technicians }: { order: Order; technicians: ReturnType<typeof useTechnicians> }) {
  const toast = useToast();
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const active = (technicians ?? []).filter((tech) => tech.isActive);
  const assign = async () => {
    const tech = active.find((x) => x.id === choice);
    if (!tech) return;
    setBusy(true);
    try { await assignTechnician(order, tech.id, tech.fullName); toast(t('عُيّن {0} لهذا الطلب', tech.fullName), 'ok'); setChoice(''); }
    catch (e) { toast(e instanceof OrderError ? orderProblemText(e) : t('تعذّر تعيين الفني.'), 'err'); }
    finally { setBusy(false); }
  };
  return (
    <section className="card" aria-label={t('الفني')}>
      <div className="card-h"><h3>{t('فني التركيب')}</h3>{order.technicianId ? <Chip tone="ok">{order.technicianName}</Chip> : <Chip tone="warn">{t('غير معيّن')}</Chip>}</div>
      <div className="card-b stack tech">
        {technicians === null ? <Spinner /> : active.length === 0 ? <p className="muted">{t('لا فنيين نشطين. أضف فنيًا من «الفريق والتقييمات».')}</p> : (
          <div className="row">
            <select className="inp" value={choice} onChange={(e) => setChoice(e.target.value)} aria-label={t('اختر الفني')}>
              <option value="">{order.technicianId ? t('تغيير الفني…') : t('اختر الفني…')}</option>
              {active.filter((tech) => tech.id !== order.technicianId).map((tech) => <option key={tech.id} value={tech.id}>{tech.fullName}{tech.isAvailable ? '' : t(' (غير متاح)')}</option>)}
            </select>
            <button type="button" className="btn p" disabled={!choice || busy} onClick={() => void assign()}>{busy && <Spinner />}{t('تعيين')}</button>
          </div>
        )}
      </div>
    </section>
  );
}
