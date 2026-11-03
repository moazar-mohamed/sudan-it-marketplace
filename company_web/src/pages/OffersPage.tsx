import { useMemo, useState } from 'react';
import { useCompanyData } from '../data/CompanyData';
import { discountPercent, hasActiveOffer, hasEndedOffer, hasOffer, lowLevelOf, money, parseNumber, longDate } from '../data/format';
import { setProductOffer } from '../data/products';
import { setServiceOffer, useCatalogServices, useCompanyServices } from '../data/services';
import type { OfferBadge } from '../data/types';
import { Banner, Chip, ConfirmDialog, Empty, Loading, PageHeader, Spinner } from '../ui/kit';
import { useToast } from '../ui/toast';

interface Item {
  key: string;
  kind: 'product' | 'service';
  id: string;
  name: string;
  price: number | null;
  offerPrice: number | null;
  offerEndsAt: Date | null;
  offerBadge: OfferBadge | null;
  stock: number | null;
  /** The stock level the company wants a warning at (a product's own, or the default). */
  low: number;
}

const BADGES: { value: OfferBadge; label: string }[] = [
  { value: 'discount', label: 'خصم' },
  { value: 'special', label: 'مميز' },
  { value: 'limited', label: 'كمية محدودة' },
];

const endOfDay = (yyyyMmDd: string): Date => new Date(`${yyyyMmDd}T23:59:59`);
const toDateInput = (d: Date | null): string => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '');

export function OffersPage() {
  const { products, companyId } = useCompanyData();
  const links = useCompanyServices(companyId);
  const catalog = useCatalogServices(companyId);
  const toast = useToast();
  const [tab, setTab] = useState<'running' | 'ended'>('running');
  const [editing, setEditing] = useState<Item | null>(null);
  const [ending, setEnding] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);

  const items = useMemo<Item[]>(() => {
    const names = new Map((catalog ?? []).map((s) => [s.id, s.name]));
    return [
      ...(products ?? []).map<Item>((p) => ({ key: `p:${p.id}`, kind: 'product', id: p.id, name: p.name, price: p.price, offerPrice: p.offerPrice, offerEndsAt: p.offerEndsAt, offerBadge: p.offerBadge, stock: p.stockCount, low: lowLevelOf(p) })),
      ...(links ?? []).filter((l) => l.isActive).map<Item>((l) => ({ key: `s:${l.id}`, kind: 'service', id: l.id, name: names.get(l.serviceId) ?? 'خدمة', price: l.price, offerPrice: l.offerPrice, offerEndsAt: l.offerEndsAt, offerBadge: l.offerBadge, stock: null, low: 0 })),
    ];
  }, [products, links, catalog]);

  if (products === null || links === null) return <main className="page"><Loading /></main>;

  const running = items.filter((i) => hasActiveOffer(i)).sort((a, b) => discountPercent(b) - discountPercent(a));
  const ended = items.filter((i) => hasEndedOffer(i));
  const shown = tab === 'running' ? running : ended;

  const end = async () => {
    if (!ending) return;
    setBusy(true);
    try {
      const none = { offerPrice: null, offerEndsAt: null, offerBadge: null };
      if (ending.kind === 'product') await setProductOffer(ending.id, none); else await setServiceOffer(ending.id, none);
      toast('انتهى العرض', 'ok');
      setEnding(null);
    } catch { toast('تعذّر إنهاء العرض.', 'err'); } finally { setBusy(false); }
  };

  return (
    <main className="page">
      <PageHeader title="العروض" subtitle="خصومات على المنتجات والخدمات، جارية ومنتهية" />
      <div className="g2">
        <section className="card" aria-label="العروض">
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'running'} className={tab === 'running' ? 'on' : ''} onClick={() => setTab('running')}>جارية<span className="n">{running.length}</span></button>
            <button type="button" role="tab" aria-selected={tab === 'ended'} className={tab === 'ended' ? 'on' : ''} onClick={() => setTab('ended')}>منتهية<span className="n">{ended.length}</span></button>
          </div>
          {shown.length === 0 ? (
            <Empty icon="tag" text={tab === 'running' ? 'لا عروض جارية. أنشئ عرضًا من اللوحة المجاورة.' : 'لا عروض منتهية.'} />
          ) : (
            <div className="scroll">
              <table className="tbl">
                <thead><tr><th>العنصر</th><th>السعر (SDG)</th><th>الفترة</th><th>المخزون</th><th /></tr></thead>
                <tbody>
                  {shown.map((i) => {
                    const left = i.offerEndsAt ? Math.ceil((i.offerEndsAt.getTime() - Date.now()) / 86_400_000) : null;
                    return (
                      <tr key={i.key}>
                        <td><div className="b">{i.name}</div><Chip tone={i.kind === 'product' ? 'n' : 'info'} dot={false} small>{i.kind === 'product' ? 'منتج' : 'خدمة'}</Chip></td>
                        <td><b className="num">{money(i.offerPrice)}</b> <Chip tone="ok" dot={false} small>{discountPercent(i)}%</Chip><div className="sub"><s className="num">{money(i.price)}</s></div></td>
                        <td>{i.offerEndsAt ? <><div className="sub">{tab === 'running' ? `حتى ${longDate(i.offerEndsAt)}` : `انتهى ${longDate(i.offerEndsAt)}`}</div>{tab === 'running' && left !== null && <div className={`prog${left <= 1 ? ' warn' : ''}`} style={{ marginTop: 6, width: 150 }}><i style={{ width: `${Math.max(6, Math.min(100, 100 - left * 8))}%` }} /></div>}{tab === 'running' && left !== null && <div className="sub">{left <= 1 ? 'ينتهي خلال يوم' : `باقٍ ${left} أيام`}</div>}</> : <span className="sub">بلا تاريخ نهاية · حتى تُنهيه</span>}</td>
                        <td>{i.stock === null ? <span className="sub">لا ينطبق</span> : i.stock <= i.low && tab === 'running' ? <Chip tone="warn" dot={false}>{i.stock} فقط</Chip> : i.stock}</td>
                        <td><div className="row"><button type="button" className="btn sm" onClick={() => setEditing(i)}>{tab === 'running' ? 'تعديل' : 'إعادة تشغيل'}</button>{tab === 'running' && <button type="button" className="btn sm d" onClick={() => setEnding(i)}>إنهاء</button>}{tab === 'ended' && <button type="button" className="btn sm d" onClick={() => setEnding(i)}>إزالة</button>}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <OfferForm
          key={editing?.key ?? 'new'}
          items={items}
          initial={editing}
          onDone={() => setEditing(null)}
        />
      </div>
      {ending && (
        <ConfirmDialog
          title={tab === 'running' ? `إنهاء عرض «${ending.name}»؟` : `إزالة العرض المنتهي على «${ending.name}»؟`}
          body={tab === 'running' ? 'يعود المنتج إلى سعره العادي فورًا.' : 'يُمسح العرض المنتهي من القائمة. السعر العادي لا يتغير.'}
          confirmLabel={tab === 'running' ? 'إنهاء العرض' : 'إزالة'}
          danger
          busy={busy}
          onConfirm={() => void end()}
          onClose={() => setEnding(null)}
        />
      )}
    </main>
  );
}

function OfferForm({ items, initial, onDone }: { items: Item[]; initial: Item | null; onDone: () => void }) {
  const toast = useToast();
  const choices = items.filter((i) => i.price !== null && !hasActiveOffer(i) || initial?.key === i.key);
  const [key, setKey] = useState(initial?.key ?? '');
  const item = items.find((i) => i.key === key) ?? null;
  const [mode, setMode] = useState<'percent' | 'price'>('percent');
  const [value, setValue] = useState(initial && hasOffer(initial) ? String(discountPercent(initial)) : '10');
  const [until, setUntil] = useState<'date' | 'manual'>(initial?.offerEndsAt || !initial ? 'date' : 'manual');
  const [date, setDate] = useState(toDateInput(initial?.offerEndsAt ?? null) || toDateInput(new Date(Date.now() + 7 * 86_400_000)));
  const [badge, setBadge] = useState<OfferBadge>(initial?.offerBadge ?? 'discount');
  const [busy, setBusy] = useState(false);

  const num = parseNumber(value);
  const price = item?.price ?? null;
  const offer = price !== null && num !== null ? (mode === 'percent' ? Math.round(price * (1 - num / 100)) : num) : null;
  const offerOk = offer !== null && price !== null && offer > 0 && offer < price;
  const ends = until === 'date' ? endOfDay(date) : null;
  const dateOk = until === 'manual' || (ends !== null && !Number.isNaN(ends.getTime()) && ends.getTime() > Date.now());
  const lowStock = item?.stock !== null && item?.stock !== undefined && item.stock <= item.low;

  const save = async () => {
    if (!item || !offerOk || !dateOk || offer === null) return;
    setBusy(true);
    try {
      const payload = { offerPrice: offer, offerEndsAt: ends, offerBadge: badge };
      if (item.kind === 'product') await setProductOffer(item.id, payload); else await setServiceOffer(item.id, payload);
      toast('تم حفظ العرض', 'ok');
      onDone();
      if (!initial) setKey('');
    } catch { toast('تعذّر حفظ العرض.', 'err'); } finally { setBusy(false); }
  };

  return (
    <section className="card" aria-label="عرض جديد" style={{ position: 'sticky', top: 16 }}>
      <div className="card-h"><h2>{initial ? 'تعديل العرض' : 'عرض جديد'}</h2>{initial && <button type="button" className="btn sm g" onClick={onDone}>عرض جديد بدلًا منه</button>}</div>
      <div className="card-b stack" style={{ gap: 14 }}>
        <div className="fld">
          <label htmlFor="of-item">المنتج أو الخدمة</label>
          <select id="of-item" className="inp" value={key} onChange={(e) => setKey(e.target.value)} disabled={!!initial}>
            <option value="">اختر…</option>
            {choices.map((i) => <option key={i.key} value={i.key}>{i.kind === 'service' ? 'خدمة · ' : ''}{i.name} — {money(i.price)}</option>)}
          </select>
          {choices.length === 0 && <span className="hint">لا عناصر بسعر ثابت بلا عرض جارٍ.</span>}
        </div>
        <div className="fld"><span className="lab">طريقة الخصم</span>
          <div className="seg full" role="group"><button type="button" className={mode === 'percent' ? 'on' : ''} onClick={() => setMode('percent')}>نسبة %</button><button type="button" className={mode === 'price' ? 'on' : ''} onClick={() => setMode('price')}>سعر مباشر</button></div>
        </div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="fld grow"><label htmlFor="of-val">{mode === 'percent' ? 'نسبة الخصم' : 'سعر العرض'}</label><div className="sfx"><input id="of-val" className="inp ltr" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /><span>{mode === 'percent' ? '%' : 'SDG'}</span></div></div>
          <div className="fld grow"><span className="lab">{mode === 'percent' ? 'سعر العرض' : 'نسبة الخصم'}</span><div className="inp row" style={{ background: 'var(--bg)' }}><b className="num">{offer === null || price === null ? '—' : mode === 'percent' ? money(offer) : `${Math.round((1 - offer / price) * 100)}%`}</b></div></div>
        </div>
        {num !== null && item && !offerOk && <span className="errt">سعر العرض يجب أن يكون أكبر من صفر وأقل من السعر العادي ({money(price)}).</span>}
        <div className="fld"><span className="lab">النهاية</span>
          <div className="seg full" role="group"><button type="button" className={until === 'date' ? 'on' : ''} onClick={() => setUntil('date')}>تاريخ</button><button type="button" className={until === 'manual' ? 'on' : ''} onClick={() => setUntil('manual')}>حتى أنهيه</button></div>
          {until === 'date' && <input className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="تاريخ النهاية" />}
          {until === 'date' && !dateOk && <span className="errt">اختر تاريخًا في المستقبل.</span>}
        </div>
        <div className="fld"><label htmlFor="of-badge">الشارة على البطاقة</label><select id="of-badge" className="inp" value={badge} onChange={(e) => setBadge(e.target.value as OfferBadge)}>{BADGES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</select></div>
        {lowStock && <Banner tone="warn" icon="alert" tight>المخزون {item?.stock} فقط. قد ينفد العرض سريعًا.</Banner>}
        <button type="button" className="btn p lg" disabled={!item || !offerOk || !dateOk || busy} onClick={() => void save()}>{busy && <Spinner />}{initial ? 'حفظ العرض' : 'بدء العرض'}</button>
      </div>
    </section>
  );
}
