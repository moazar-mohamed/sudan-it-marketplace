import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query, where, limit, Timestamp } from 'firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { useCompanyData } from '../data/CompanyData';
import { isLowStock, leftLabel, longDate, lowLevelOf, money, ordersText, paymentTimeLeft, shortId, urgencyOf, unitsText } from '../data/format';
import { mapOrder } from '../data/mappers';
import type { Order, Product } from '../data/types';
import { db } from '../firebase';
import { Icon } from '../ui/Icon';
import { Banner, Chip, Empty, Loading, PageHeader, useNow } from '../ui/kit';
import { StockDialog } from '../ui/StockDialog';

const DAY = 86_400_000;

/** The company's orders of the last 14 days (for the sales figures). */
function useRecentOrders(companyId: string): Order[] | null {
  const [list, setList] = useState<Order[] | null>(null);
  useEffect(() => {
    const since = Timestamp.fromMillis(Date.now() - 14 * DAY);
    return onSnapshot(
      query(collection(db, 'orders'), where('companyId', '==', companyId), where('createdAt', '>=', since), orderBy('createdAt', 'desc'), limit(500)),
      (s) => setList(s.docs.map((d) => mapOrder(d.id, d.data()))),
      () => setList([]),
    );
  }, [companyId]);
  return list;
}

/** A sale is an order whose payment was confirmed and that was not cancelled. */
const isSale = (o: Order) => o.paymentStatus === 'confirmed' && o.orderStatus !== 'cancelled';

export function TodayPage() {
  const { state } = useAuth();
  const { companyId, products, openOrders, pendingPayment, pendingRefunds } = useCompanyData();
  const recent = useRecentOrders(companyId);
  const now = useNow();
  const [stockFor, setStockFor] = useState<Product | null>(null);
  const [tab, setTab] = useState<'pay' | 'ship' | 'install' | 'refund'>('pay');

  const first = (state.status === 'authorized' ? state.profile.fullName : '').split(' ')[0];

  const demand = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of pendingPayment) if (!o.stockReserved) m.set(o.productId, (m.get(o.productId) ?? 0) + o.quantity);
    return m;
  }, [pendingPayment]);

  const week = useMemo(() => {
    const t = Date.now();
    const sales = (recent ?? []).filter(isSale);
    const sum = (from: number, to: number) => sales.filter((o) => o.createdAt.getTime() >= from && o.createdAt.getTime() < to).reduce((n, o) => n + o.totalAmount, 0);
    const thisWeek = sum(t - 7 * DAY, t + DAY);
    const before = sum(t - 14 * DAY, t - 7 * DAY);
    // Seven day buckets ending today (local days).
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, i) => {
      const start = midnight.getTime() - (6 - i) * DAY;
      return { label: new Date(start).getDate(), value: sum(start, start + DAY) };
    });
    return { thisWeek, before, days };
  }, [recent]);

  if (products === null || openOrders === null) return <main className="page"><Loading /></main>;

  const inProgress = openOrders.filter((o) => o.paymentStatus === 'confirmed');
  const outForDelivery = inProgress.filter((o) => o.orderStatus === 'out_for_delivery').length;
  const toShip = inProgress.filter((o) => o.orderStatus === 'processing');
  const needsTech = openOrders.filter((o) => o.installationSelected && !o.technicianId);
  const oldest = [...pendingPayment].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  const soon = pendingPayment.filter((o) => paymentTimeLeft(o, now) < 6 * 3600_000);
  const lowStock = products.filter((p) => p.status === 'published' && isLowStock(p) && !p.hidden).sort((a, b) => a.stockCount - b.stockCount);
  const changePct = week.before > 0 ? Math.round(((week.thisWeek - week.before) / week.before) * 100) : null;
  const maxDay = Math.max(1, ...week.days.map((d) => d.value));

  const list: Order[] = tab === 'pay' ? [...pendingPayment].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()) : tab === 'ship' ? toShip : tab === 'refund' ? pendingRefunds : needsTech;

  return (
    <main className="page">
      <PageHeader
        title={first ? `أهلًا يا ${first}` : 'أهلًا بك'}
        subtitle={`${longDate(new Date())} · ${pendingPayment.length > 0 ? `${ordersText(pendingPayment.length)} ينتظر التحقق من الدفع` : 'لا إيصالات تنتظرك'}`}
        actions={
          <>
            <Link to="/orders" className="btn"><Icon name="receipt" />كل الطلبات</Link>
            <Link to="/products/new" className="btn p"><Icon name="plus" />منتج جديد</Link>
          </>
        }
      />

      {soon.length > 0 && oldest && (
        <div style={{ marginBottom: 20 }}>
          <Banner tone="warn" icon="clock" action={<Link to={`/orders/${oldest.id}`} className="btn sm">راجع الأقدم الآن</Link>}>
            <b>{ordersText(soon.length)} تنتهي مهلة التحقق منه خلال 6 ساعات.</b>
            <div>إذا مرّت 24 ساعة على الطلب دون تأكيد الدفع يُلغى تلقائيًا.</div>
          </Banner>
        </div>
      )}

      <div className="kpis" style={{ marginBottom: 20 }}>
        <Link to="/orders?tab=awaiting" className="card kpi">
          <div className="lbl"><Icon name="receipt" />بانتظار تأكيد الدفع</div>
          <div className="val">{pendingPayment.length}</div>
          <div className="sub">{oldest ? `أقدمها ${paymentAgeLabel(oldest, now)}` : 'لا شيء ينتظر'}</div>
        </Link>
        <Link to="/orders?tab=preparing" className="card kpi">
          <div className="lbl"><Icon name="truck" />قيد التجهيز والتوصيل</div>
          <div className="val">{inProgress.length}</div>
          <div className="sub">منها {outForDelivery} في الطريق · دفعها مؤكد</div>
        </Link>
        <div className="card kpi">
          <div className="lbl"><Icon name="arrowUp" />مبيعات مؤكدة · 7 أيام</div>
          <div className="val">{recent === null ? '…' : <><span className="num">{money(week.thisWeek)}</span> <small>SDG</small></>}</div>
          <div className="sub" style={{ color: changePct !== null && changePct >= 0 ? 'var(--ok)' : changePct !== null ? 'var(--bad)' : undefined, fontWeight: 700 }}>
            {changePct === null ? 'دفع مؤكد فقط · حسب تاريخ الطلب' : `${changePct >= 0 ? 'ارتفاع' : 'انخفاض'} ${Math.abs(changePct)}% عن الأسبوع السابق`}
          </div>
        </div>
        <Link to="/products" className="card kpi">
          <div className="lbl"><Icon name="box" />منتجات تحتاج تعبئة</div>
          <div className="val">{lowStock.length}</div>
          <div className="sub">منها {lowStock.filter((p) => p.stockCount === 0).length} نفدت</div>
        </Link>
      </div>

      <div className="g2">
        <section className="card" aria-label="قائمة العمل">
          <div className="card-h"><h2>قائمة العمل</h2><span className="sub">كل ما يحتاج قرارًا منك، الأقدم أولًا</span></div>
          <div className="tabs" role="tablist">
            {([['pay', 'تحقق الدفع', pendingPayment.length], ['ship', 'جاهزة للشحن أو التسليم', toShip.length], ['install', 'تركيب بلا فني', needsTech.length], ['refund', 'مبالغ تنتظر الرد', pendingRefunds.length]] as const).map(([t, label, n]) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
                {label}<span className={`n${t === 'pay' && n ? ' hot' : ''}`}>{n}</span>
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <Empty icon="check" text="لا شيء هنا الآن." />
          ) : (
            list.slice(0, 8).map((o) => {
              const left = paymentTimeLeft(o, now);
              const short = (products.find((p) => p.id === o.productId)?.stockCount ?? 0) < (demand.get(o.productId) ?? 0);
              return (
                <div key={o.id} className="q">
                  <div>
                    <div className="b">{o.productName} <span className="muted">×{o.quantity}</span></div>
                    <div className="sub"><span className="num">#{shortId(o.id)}</span> · {o.installationSelected ? 'تركيب' : o.deliveryMethod === 'pickup' ? 'استلام' : 'توصيل'}</div>
                    {tab === 'pay' && short && <Chip tone="warn" small dot={false}>المخزون لا يكفي الطلبات المعلقة</Chip>}
                  </div>
                  <div><div>{o.customerName || 'عميل'}</div><div className="sub num">{o.contactPhone}</div></div>
                  <div className="b"><span className="num">{money(o.totalAmount)}</span> <span className="sub">SDG</span></div>
                  {tab === 'pay' ? <Chip tone={urgencyOf(left)}><span className="num">{leftLabel(left)}</span> متبقية</Chip> : <span />}
                  <Link to={`/orders/${o.id}`} className={`btn sm${tab === 'pay' ? ' p' : ''}`}>{tab === 'pay' ? 'راجع الإيصال' : tab === 'install' ? 'تعيين فني' : tab === 'refund' ? 'تسجيل الرد' : 'فتح'}</Link>
                </div>
              );
            })
          )}
          <div className="foot"><span /><Link to="/orders" className="btn sm g">عرض كل الطلبات</Link></div>
        </section>

        <div className="stack">
          <section className="card" aria-label="مخزون يحتاج تعبئة">
            <div className="card-h"><h3>مخزون يحتاج تعبئة</h3><span className="grow" /><Link to="/products" className="sub">كل المنتجات</Link></div>
            {lowStock.length === 0 && <Empty icon="check" text="كل المنتجات بمخزون كافٍ." />}
            {lowStock.slice(0, 5).map((p) => {
              const d = demand.get(p.id) ?? 0;
              return (
                <div key={p.id} className="lr">
                  <div className="grow">
                    <div className="b ellipsis">{p.name}</div>
                    <div className="sub">الحد {lowLevelOf(p)}{d > 0 ? ` · طلبات معلقة تحتاج ${unitsText(d)}` : ''}</div>
                  </div>
                  <div className="b" style={{ fontSize: 22, color: p.stockCount === 0 ? 'var(--bad)' : 'var(--warn)' }}>{p.stockCount}</div>
                  <button type="button" className="btn sm" onClick={() => setStockFor(p)}>تعديل</button>
                </div>
              );
            })}
          </section>

          <section className="card" aria-label="المبيعات المؤكدة">
            <div className="card-h"><h3>مبيعات مؤكدة · 7 أيام</h3></div>
            <div className="card-b">
              <div className="bars" role="img" aria-label={`مبيعات مؤكدة يوميًا، المجموع ${money(week.thisWeek)} جنيه`}>
                {week.days.map((d, i) => <div key={i} className={i === 6 ? 'dim' : ''} style={{ height: `${Math.max(4, (d.value / maxDay) * 100)}%` }} title={`${d.label}: ${money(d.value)}`} />)}
              </div>
              <div className="bl">{week.days.map((d, i) => <span key={i}>{d.label}</span>)}</div>
              <p className="sub" style={{ marginTop: 12 }}>يُحتسب الدفع المؤكد فقط وغير الملغى، بتاريخ إنشاء الطلب. عمود اليوم ما زال جاريًا.</p>
            </div>
          </section>
        </div>
      </div>
      {stockFor && <StockDialog product={products.find((p) => p.id === stockFor.id) ?? stockFor} demand={demand.get(stockFor.id) ?? 0} onClose={() => setStockFor(null)} />}
    </main>
  );
}

function paymentAgeLabel(o: Order, now: number): string {
  const hours = Math.floor((now - o.createdAt.getTime()) / 3_600_000);
  return hours < 1 ? 'منذ أقل من ساعة' : `منذ ${hours} ساعة`;
}
