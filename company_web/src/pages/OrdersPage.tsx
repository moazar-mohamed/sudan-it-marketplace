import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { useCompanyData } from '../data/CompanyData';
import { downloadCsv } from '../data/csv';
import { db } from '../firebase';
import {
  dayTime,
  digitsOnly,
  leftLabel,
  money,
  ordersText,
  paymentTimeLeft,
  shortId,
  urgencyOf,
} from '../data/format';
import { mapOrder } from '../data/mappers';
import {
  advanceAndNotify,
  awaitsRefund,
  cancelWithMessage,
  countOrders,
  nextStatusLabel,
  nextStatusOf,
  orderProblemText,
} from '../data/orders';
import type { Order } from '../data/types';
import { Icon } from '../ui/Icon';
import {
  Banner,
  Chip,
  ConfirmDialog,
  Empty,
  KindCell,
  Loading,
  Modal,
  OrderStatusChip,
  PageHeader,
  PaymentChip,
  Spinner,
  useNow,
  orderKind,
} from '../ui/kit';
import { useToast } from '../ui/toast';
import { t } from '../i18n';

type Tab = 'all' | 'awaiting' | 'preparing' | 'ofd' | 'done' | 'cancelled';
type Kind = 'all' | 'delivery' | 'pickup' | 'install';

const PAGE = 50;

const inTab = (o: Order, tab: Tab): boolean =>
  tab === 'all' ? true
  : tab === 'awaiting' ? o.orderStatus === 'processing' && o.paymentStatus === 'pending_verification'
  : tab === 'preparing' ? o.orderStatus === 'processing' && o.paymentStatus === 'confirmed'
  : tab === 'ofd' ? o.orderStatus === 'out_for_delivery'
  : tab === 'done' ? o.orderStatus === 'completed'
  : o.orderStatus === 'cancelled';

/** The newest page live, older pages on demand, and the open orders the provider keeps live. */
function useOrders(companyId: string) {
  const { openOrders } = useCompanyData();
  const [live, setLive] = useState<Order[] | null>(null);
  const [older, setOlder] = useState<Order[]>([]);
  const [more, setMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const cursor = useRef<QueryDocumentSnapshot | null>(null);

  useEffect(() => {
    setLive(null);
    setOlder([]);
    setMore(true);
    cursor.current = null;
    return onSnapshot(
      query(collection(db, 'orders'), where('companyId', '==', companyId), orderBy('createdAt', 'desc'), limit(PAGE)),
      (s) => {
        setFailed(false);
        setLive(s.docs.map((d) => mapOrder(d.id, d.data())));
        if (cursor.current === null) {
          cursor.current = s.docs[s.docs.length - 1] ?? null;
          setMore(s.docs.length === PAGE);
        }
      },
      () => setFailed(true),
    );
  }, [companyId]);

  const loadMore = async () => {
    if (!cursor.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const s = await getDocs(
        query(collection(db, 'orders'), where('companyId', '==', companyId), orderBy('createdAt', 'desc'), startAfter(cursor.current), limit(PAGE)),
      );
      cursor.current = s.docs[s.docs.length - 1] ?? cursor.current;
      setOlder((now) => [...now, ...s.docs.map((d) => mapOrder(d.id, d.data()))]);
      setMore(s.docs.length === PAGE);
    } catch {
      setFailed(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const orders = useMemo(() => {
    const byId = new Map<string, Order>();
    for (const o of older) byId.set(o.id, o);
    for (const o of live ?? []) byId.set(o.id, o);
    for (const o of openOrders ?? []) byId.set(o.id, o);
    return [...byId.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [live, older, openOrders]);

  return { orders, ready: live !== null, more, loadMore, loadingMore, failed };
}

export function OrdersPage() {
  const { state } = useAuth();
  const { companyId, openOrders, products } = useCompanyData();
  const toast = useToast();
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'all';
  const q = params.get('q') ?? '';
  const [kind, setKind] = useState<Kind>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [advancing, setAdvancing] = useState<Order | null>(null);
  const [bulkCancel, setBulkCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const { orders, ready, more, loadMore, loadingMore, failed } = useOrders(companyId);
  const senderName = state.status === 'authorized' ? state.profile.fullName || t('الشركة') : t('الشركة');

  const [totals, setTotals] = useState<{ all: number; done: number; cancelled: number } | null>(null);
  const openSignature = (openOrders ?? []).map((o) => `${o.id}:${o.orderStatus}`).join(',');
  useEffect(() => {
    let live = true;
    void Promise.all([
      countOrders(companyId),
      countOrders(companyId, [['orderStatus', 'completed']]),
      countOrders(companyId, [['orderStatus', 'cancelled']]),
    ]).then(([all, done, cancelled]) => live && setTotals({ all, done, cancelled }));
    return () => { live = false; };
  }, [companyId, openSignature]);

  const setTab = (t: Tab) => { const next = new URLSearchParams(params); if (t === 'all') next.delete('tab'); else next.set('tab', t); setParams(next, { replace: true }); setSelected(new Set()); };
  const setQuery = (text: string) => { const next = new URLSearchParams(params); if (text) next.set('q', text); else next.delete('q'); setParams(next, { replace: true }); };

  const open = openOrders ?? [];
  const tabCount: Record<Tab, number | null> = {
    all: totals?.all ?? null,
    awaiting: open.filter((o) => inTab(o, 'awaiting')).length,
    preparing: open.filter((o) => inTab(o, 'preparing')).length,
    ofd: open.filter((o) => inTab(o, 'ofd')).length,
    done: totals?.done ?? null,
    cancelled: totals?.cancelled ?? null,
  };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = digitsOnly(q);
    return orders.filter((o) => {
      if (!inTab(o, tab)) return false;
      if (kind !== 'all' && orderKind(o) !== kind) return false;
      if (!needle) return true;
      return (
        o.id.toLowerCase().includes(needle) ||
        o.customerName.toLowerCase().includes(needle) ||
        o.productName.toLowerCase().includes(needle) ||
        (digits.length >= 3 && digitsOnly(o.contactPhone).includes(digits))
      );
    });
  }, [orders, tab, kind, q]);

  if (!ready && !failed) return <main className="page"><Loading /></main>;

  const toggle = (id: string) => setSelected((n) => { const s = new Set(n); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  const picked = orders.filter((o) => selected.has(o.id));
  const canBulkCancel = picked.length > 0 && picked.every((o) => inTab(o, 'awaiting'));

  const advance = async () => {
    if (!advancing) return;
    setBusy(true);
    try {
      const { notified } = await advanceAndNotify(advancing);
      toast(notified ? t('تم تحديث حالة الطلب وأُبلغ العميل') : t('تم تحديث حالة الطلب، لكن تعذّر إرسال الإشعار للعميل'), notified ? 'ok' : 'info');
      setAdvancing(null);
    } catch (e) {
      toast(orderProblemText(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () =>
    downloadCsv('orders.csv', [
      [t('رقم الطلب'), t('التاريخ'), t('العميل'), t('الهاتف'), t('المنتج'), t('الكمية'), t('النوع'), t('الإجمالي'), t('الدفع'), t('الحالة')],
      ...rows.map((o) => [shortId(o.id), o.createdAt.toISOString(), o.customerName, o.contactPhone, o.productName, o.quantity, o.installationSelected ? t('تركيب') : o.deliveryMethod === 'pickup' ? t('استلام') : t('توصيل'), o.totalAmount, o.paymentStatus === 'confirmed' ? t('مؤكد') : t('بانتظار التحقق'), o.orderStatus]),
    ]);

  return (
    <main className="page">
      <PageHeader
        title={t('الطلبات')}
        subtitle={t('طلبات المنتجات، الأحدث أولًا')}
      />
      {failed && <div style={{ marginBottom: 16 }}><Banner tone="warn" icon="alert" tight>{t('تعذّر تحميل الطلبات. تأكد من الاتصال.')}</Banner></div>}

      <section className="card" aria-label={t('جدول الطلبات')}>
        <div className="tabs" role="tablist">
          {([['all', t('الكل')], ['awaiting', t('بانتظار تأكيد الدفع')], ['preparing', t('قيد التجهيز')], ['ofd', t('في الطريق')], ['done', t('مكتملة')], ['cancelled', t('ملغاة')]] as const).map(([t, label]) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {label}
              {tabCount[t] !== null && <span className={`n${t === 'awaiting' && tabCount[t] ? ' hot' : ''}`}>{tabCount[t]}</span>}
            </button>
          ))}
        </div>
        <div className="tools">
          <div className="pills" role="group" aria-label={t('نوع الطلب')}>
            {([['all', t('الكل')], ['delivery', t('توصيل')], ['pickup', t('استلام')], ['install', t('تركيب')]] as const).map(([k, label]) => (
              <button key={k} type="button" className={`pill${kind === k ? ' on' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{label}</button>
            ))}
          </div>
          <span className="grow" />
          <label className="search" style={{ flex: '0 1 280px', height: 38 }}>
            <Icon name="search" />
            <input value={q} onChange={(e) => setQuery(e.target.value)} placeholder={t('رقم الطلب أو الاسم أو الهاتف')} aria-label={t('بحث في الطلبات')} />
          </label>
        </div>

        {selected.size > 0 && (
          <div className="bulk" role="status">
            <b>{t('محدد {0}', selected.size)}</b>
            <span className="grow" />
            {canBulkCancel && <button type="button" className="btn" onClick={() => setBulkCancel(true)}>{t('إلغاء كـ«نفد المخزون»')}</button>}
            <button type="button" className="btn" onClick={() => setSelected(new Set())}>{t('إلغاء التحديد')}</button>
          </div>
        )}

        {rows.length === 0 ? (
          <Empty icon="receipt" text={q ? t('لا طلبات مطابقة في الطلبات المحمّلة. جرّب «تحميل المزيد».') : t('لا طلبات هنا.')} />
        ) : (
          <div className="scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 44 }}><span className="sub">{t('اختيار')}</span></th>
                  <th>{t('الطلب')}</th><th>{t('العميل')}</th><th>{t('المنتج')}</th><th>{t('النوع')}</th><th>{t('المبلغ')}</th><th>{t('الدفع')}</th><th>{t('الحالة')}</th><th>{t('الإجراء')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const awaiting = inTab(o, 'awaiting');
                  const left = paymentTimeLeft(o, now);
                  const next = nextStatusOf(o);
                  const needsTech = o.installationSelected && !o.technicianId && o.orderStatus !== 'cancelled' && o.orderStatus !== 'completed';
                  return (
                    <tr key={o.id} className={selected.has(o.id) ? 'sel' : ''}>
                      <td>{awaiting && <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} aria-label={t('تحديد الطلب {0}', shortId(o.id))} />}</td>
                      <td><Link to={`/orders/${o.id}`} className="b num">#{shortId(o.id)}</Link><div className="sub">{dayTime(o.createdAt)}</div></td>
                      <td><div>{o.customerName || t('عميل')}</div><div className="sub num">{o.contactPhone}</div></td>
                      <td><div>{o.productName}</div><div className="sub">{t('الكمية {0}', o.quantity)}</div></td>
                      <td><KindCell order={o} /></td>
                      <td className="b"><span className="num">{money(o.totalAmount)}</span></td>
                      <td>
                        <PaymentChip order={o} />
                        {awaiting && <div className="sub" style={{ color: urgencyOf(left) === 'bad' ? 'var(--bad)' : urgencyOf(left) === 'warn' ? 'var(--warn)' : undefined, fontWeight: 700 }}>{t('تنتهي بعد')}{' '}<span className="num">{leftLabel(left)}</span></div>}
                      </td>
                      <td>
                        <OrderStatusChip order={o} />
                        {o.orderStatus === 'cancelled' && o.cancelReason === 'expired' && <div className="sub">{t('انتهت مهلة الدفع')}</div>}
                        {awaitsRefund(o) && <div className="sub" style={{ color: 'var(--warn)', fontWeight: 700 }}>{t('بانتظار ردّ المبلغ')}</div>}
                        {needsTech && <div className="sub" style={{ color: 'var(--warn)', fontWeight: 700 }}>{t('الفني: غير معيّن')}</div>}
                      </td>
                      <td>
                        {awaiting ? <Link to={`/orders/${o.id}`} className="btn sm p">{t('راجع الإيصال')}</Link>
                          : needsTech ? <Link to={`/orders/${o.id}`} className="btn sm">{t('تعيين فني')}</Link>
                          : next ? <button type="button" className="btn sm" onClick={() => setAdvancing(o)}>{nextStatusLabel(o)}</button>
                          : <Link to={`/orders/${o.id}`} className="btn sm g">{t('عرض')}</Link>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="foot">
          <span className="sub">{t('عرض {0} من المحمّل · تُقرأ {1} طلبًا في كل مرة لتبقى الصفحة سريعة', ordersText(rows.length), PAGE)}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="btn sm g" onClick={exportCsv} disabled={rows.length === 0}><Icon name="download" />{t('تنزيل الجدول كملف CSV')}</button>
            {more && <button type="button" className="btn sm" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore && <Spinner />}{t('تحميل {0} أخرى', PAGE)}</button>}
          </span>
        </div>
      </section>

      {advancing && (
        <ConfirmDialog
          title={t('تحديث حالة الطلب #{0}', shortId(advancing.id))}
          body={t('سيصبح الطلب «{0}» ويصل العميل إشعار بذلك.', nextStatusOf(advancing) === 'completed' ? t('مكتمل') : t('في الطريق'))}
          confirmLabel={t('تأكيد')}
          busy={busy}
          onConfirm={() => void advance()}
          onClose={() => setAdvancing(null)}
        />
      )}
      {bulkCancel && (
        <BulkCancelDialog
          orders={picked}
          products={products ?? []}
          senderName={senderName}
          onClose={(done) => { setBulkCancel(false); if (done) setSelected(new Set()); }}
        />
      )}
    </main>
  );
}

function BulkCancelDialog({
  orders, products, senderName, onClose,
}: { orders: Order[]; products: { id: string; stockCount: number }[]; senderName: string; onClose: (done: boolean) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const message = (o: Order) => t('تم إلغاء طلبك #{0} لأن المنتج نفد من المخزون. إن كنت قد حوّلت المبلغ فسنعيده إليك. نعتذر عن الإزعاج.', shortId(o.id));
  // Out of stock is only a valid reason for an order the product can no longer cover.
  const coverable = orders.filter((o) => (products.find((p) => p.id === o.productId)?.stockCount ?? 0) >= o.quantity);

  const run = async () => {
    setBusy(true);
    let ok = 0;
    let failed = 0;
    for (const o of orders) {
      try { await cancelWithMessage(o, 'out_of_stock', message(o), senderName); ok++; } catch { failed++; }
    }
    toast(failed ? t('أُلغي {0} وتعذّر {1} (المنتج ما زال يغطيها أو تغيّرت حالتها)', ok, failed) : t('أُلغي {0} وأُبلغ العملاء', ordersText(ok)), failed ? 'err' : 'ok');
    onClose(true);
  };

  return (
    <Modal
      title={t('إلغاء {0} لنفاد المخزون', ordersText(orders.length))}
      onClose={() => onClose(false)}
      busy={busy}
      footer={<>
        <button type="button" className="btn dp" disabled={busy} onClick={() => void run()}>{busy && <Spinner />}{t('إلغاء وإبلاغ العملاء')}</button>
        <button type="button" className="btn" disabled={busy} onClick={() => onClose(false)}>{t('تراجع')}</button>
      </>}
    >
      <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {orders.map((o) => <div key={o.id} className="lr"><span className="b num">#{shortId(o.id)}</span><span className="grow ellipsis">{o.customerName || t('عميل')} · {o.productName}</span></div>)}
      </div>
      {coverable.length > 0 && <Banner tone="warn" icon="alert" tight>{t('{0} منها ما زال مخزون منتجه يغطيها، وسيُرفض إلغاؤها بهذا السبب. استخدم «رفض الإيصال» من صفحة الطلب إن أردت إلغاءها لسبب آخر.', ordersText(coverable.length))}</Banner>}
      <div className="fld">
        <span className="lab">{t('ما سيصل كل عميل في محادثة طلبه')}</span>
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 1.7 }}>{orders[0] && message(orders[0])}</div>
      </div>
      <p className="hint">{t('يعود أي مخزون محجوز، وتُرد الأموال خارج النظام.')}</p>
      <Chip tone="n" dot={false}>{t('لا يمكن التراجع بعد الإلغاء')}</Chip>
    </Modal>
  );
}
