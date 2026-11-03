import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompanyData } from '../data/CompanyData';
import { useCategoryLookup } from '../data/categories';
import { downloadCsv } from '../data/csv';
import { hasActiveOffer, hasEndedOffer, discountPercent, isLowStock, money, ordersText, parseNumber, productsText } from '../data/format';
import {
  deleteProduct,
  openOrdersOfProduct,
  PriceBelowOffer,
  ProductHasOpenOrders,
  setPrice,
  setProductsStatus,
  updateProductFields,
} from '../data/products';
import type { Order, Product, ProductStatus } from '../data/types';
import { shortId } from '../data/format';
import { Icon } from '../ui/Icon';
import { Banner, Chip, ConfirmDialog, Empty, Loading, Modal, PageHeader, Spinner } from '../ui/kit';
import { StockDialog } from '../ui/StockDialog';
import { useToast } from '../ui/toast';

type Tab = 'all' | 'published' | 'draft' | 'archived' | 'hidden';
type Pill = 'low' | 'out' | 'noPrice' | 'noImage' | 'offer';
type Sort = 'newest' | 'name' | 'stockAsc' | 'priceDesc';

const PAGE = 50;

export function ProductsPage() {
  const { products, pendingPayment, categories, companyId } = useCompanyData();
  const toast = useToast();
  const lookup = useCategoryLookup(categories);

  const [tab, setTab] = useState<Tab>('all');
  const [pills, setPills] = useState<Set<Pill>>(new Set());
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stockFor, setStockFor] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [bulkPrice, setBulkPrice] = useState(false);

  // Units waiting in orders whose payment is not confirmed yet (they take no stock until it is).
  const demand = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of pendingPayment) if (!o.stockReserved) m.set(o.productId, (m.get(o.productId) ?? 0) + o.quantity);
    return m;
  }, [pendingPayment]);

  const counts = useMemo(() => {
    const list = products ?? [];
    return {
      all: list.length,
      published: list.filter((p) => p.status === 'published').length,
      draft: list.filter((p) => p.status === 'draft').length,
      archived: list.filter((p) => p.status === 'archived').length,
      hidden: list.filter((p) => p.hidden).length,
      low: list.filter((p) => p.stockCount > 0 && isLowStock(p)).length,
      out: list.filter((p) => p.stockCount === 0).length,
      noPrice: list.filter((p) => p.price === null).length,
      noImage: list.filter((p) => !p.imageUrl).length,
      offer: list.filter((p) => hasActiveOffer(p)).length,
    };
  }, [products]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = (products ?? []).filter((p) => {
      if ((tab === 'published' || tab === 'draft' || tab === 'archived') && p.status !== tab) return false;
      if (tab === 'hidden' && !p.hidden) return false;
      if (category && p.categoryId !== category) return false;
      if (pills.has('low') && !(p.stockCount > 0 && isLowStock(p))) return false;
      if (pills.has('out') && p.stockCount !== 0) return false;
      if (pills.has('noPrice') && p.price !== null) return false;
      if (pills.has('noImage') && p.imageUrl) return false;
      if (pills.has('offer') && !hasActiveOffer(p)) return false;
      if (!needle) return true;
      return [p.name, p.brand, lookup.label(p.categoryId), p.id].some((t) => t.toLowerCase().includes(needle));
    });
    const by: Record<Sort, (a: Product, b: Product) => number> = {
      newest: () => 0,
      name: (a, b) => a.name.localeCompare(b.name, 'ar'),
      stockAsc: (a, b) => a.stockCount - b.stockCount,
      priceDesc: (a, b) => (b.price ?? -1) - (a.price ?? -1),
    };
    return sort === 'newest' ? list : [...list].sort(by[sort]);
  }, [products, tab, pills, query, category, sort, lookup]);

  if (products === null) return <main className="page"><Loading /></main>;

  const usedCategories = [...new Set(products.map((p) => p.categoryId).filter((x): x is string => !!x))];
  const visible = rows.slice(0, shown);
  const allShownSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));
  const togglePill = (p: Pill) => setPills((now) => { const n = new Set(now); if (n.has(p)) n.delete(p); else n.add(p); return n; });
  const toggleRow = (id: string) => setSelected((now) => { const n = new Set(now); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectedProducts = products.filter((p) => selected.has(p.id));

  const exportCsv = () => {
    downloadCsv('products.csv', [
      ['الاسم', 'العلامة', 'التصنيف', 'السعر', 'سعر العرض', 'المخزون', 'متاح للبيع', 'توصيل', 'تركيب', 'سعر التركيب'],
      ...rows.map((p) => [
        p.name, p.brand, lookup.label(p.categoryId), p.price, hasActiveOffer(p) ? p.offerPrice : '', p.stockCount,
        p.inStock ? 'نعم' : 'لا', p.isDeliveryAvailable ? 'نعم' : 'لا', p.isInstallationAvailable ? 'نعم' : 'لا', p.installationPrice,
      ]),
    ]);
  };

  const moveTo = async (status: ProductStatus) => {
    const { ok, failed } = await setProductsStatus(selectedProducts.map((p) => p.id), status);
    toast(failed ? `تم تحديث ${ok} وتعذّر ${failed}` : `تم تحديث ${ok} منتج`, failed ? 'err' : 'ok');
    setSelected(new Set());
  };

  return (
    <main className="page">
      <PageHeader
        title="المنتجات"
        subtitle={`${productsText(counts.all)} · ${counts.low + counts.out} تحتاج تعبئة · عدّل السعر والمخزون من الجدول مباشرة`}
        actions={
          <>
            <button type="button" className="btn" onClick={exportCsv} disabled={rows.length === 0}>
              <Icon name="download" />
              تصدير CSV
            </button>
            <Link to="/products/new" className="btn p">
              <Icon name="plus" />
              منتج جديد
            </Link>
          </>
        }
      />

      <section className="card" aria-label="جدول المنتجات">
        <div className="tabs" role="tablist">
          {([['all', 'الكل'], ['published', 'منشور'], ['draft', 'مسودة'], ['archived', 'مؤرشف'], ['hidden', 'مخفي من المنصة']] as const).map(([t, label]) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => { setTab(t); setShown(PAGE); }}>
              {label}
              <span className={`n${t === 'hidden' && counts.hidden ? ' hot' : ''}`}>{counts[t]}</span>
            </button>
          ))}
        </div>
        <div className="tools">
          <div className="pills" role="group" aria-label="مرشحات سريعة">
            {([['low', 'مخزون منخفض'], ['out', 'نفد'], ['noPrice', 'السعر عند الطلب'], ['noImage', 'بلا صورة'], ['offer', 'عليه عرض']] as const).map(([p, label]) => (
              <button key={p} type="button" className={`pill${pills.has(p) ? ' on' : ''}`} aria-pressed={pills.has(p)} onClick={() => { togglePill(p); setShown(PAGE); }}>
                {label} <span className="n">{counts[p]}</span>
              </button>
            ))}
          </div>
          <span className="grow" />
          <label className="search" style={{ flex: '0 1 240px', height: 38 }}>
            <Icon name="search" />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} placeholder="اسم المنتج أو العلامة" aria-label="بحث في المنتجات" />
          </label>
          <select className="inp sm" style={{ width: 'auto' }} value={category} onChange={(e) => { setCategory(e.target.value); setShown(PAGE); }} aria-label="التصنيف">
            <option value="">كل التصنيفات</option>
            {usedCategories.map((id) => <option key={id} value={id}>{lookup.label(id)}</option>)}
          </select>
          <select className="inp sm" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="الترتيب">
            <option value="newest">الأحدث</option>
            <option value="name">الاسم</option>
            <option value="stockAsc">الأقل مخزونًا</option>
            <option value="priceDesc">الأعلى سعرًا</option>
          </select>
        </div>

        {selected.size > 0 && (
          <div className="bulk" role="status">
            <b>محدد {selected.size}</b>
            <span className="grow" />
            <button type="button" className="btn" onClick={() => setBulkPrice(true)}>تعديل السعر بنسبة</button>
            <button type="button" className="btn" onClick={() => void moveTo('published')}>نشر</button>
            <button type="button" className="btn" onClick={() => void moveTo('draft')}>نقل إلى مسودة</button>
            <button type="button" className="btn" onClick={() => void moveTo('archived')}>أرشفة</button>
            <button type="button" className="btn" onClick={() => setSelected(new Set())}>إلغاء التحديد</button>
          </div>
        )}

        {products.length === 0 ? (
          <Empty icon="box" text="لا توجد منتجات بعد. أضف أول منتج لتبدأ البيع." action={<Link to="/products/new" className="btn p"><Icon name="plus" />منتج جديد</Link>} />
        ) : rows.length === 0 ? (
          <Empty icon="search" text="لا منتجات مطابقة لهذا البحث." />
        ) : (
          <div className="scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>
                    <input type="checkbox" aria-label="تحديد الكل" checked={allShownSelected} onChange={(e) => setSelected((now) => { const n = new Set(now); for (const p of visible) e.target.checked ? n.add(p.id) : n.delete(p.id); return n; })} />
                  </th>
                  <th>المنتج</th>
                  <th>السعر (SDG)</th>
                  <th>المخزون</th>
                  <th>الحالة</th>
                  <th>التوصيل والتركيب</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <ProductRow
                    key={p.id}
                    p={p}
                    categoryLabel={lookup.label(p.categoryId)}
                    demand={demand.get(p.id) ?? 0}
                    selected={selected.has(p.id)}
                    onToggle={() => toggleRow(p.id)}
                    onStock={() => setStockFor(p)}
                    onDelete={() => setDeleting(p)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="foot">
          <span className="sub">عرض {Math.min(shown, rows.length)} من {rows.length}</span>
          {rows.length > shown && <button type="button" className="btn sm" onClick={() => setShown((s) => s + PAGE)}>عرض {PAGE} أخرى</button>}
        </div>
      </section>

      {stockFor && <StockDialog product={products.find((p) => p.id === stockFor.id) ?? stockFor} demand={demand.get(stockFor.id) ?? 0} onClose={() => setStockFor(null)} />}
      {deleting && <DeleteDialog companyId={companyId} product={deleting} onClose={() => setDeleting(null)} />}
      {bulkPrice && <BulkPriceDialog items={selectedProducts} onClose={(done) => { setBulkPrice(false); if (done) setSelected(new Set()); }} />}
    </main>
  );
}

function ProductRow({
  p, categoryLabel, demand, selected, onToggle, onStock, onDelete,
}: {
  p: Product; categoryLabel: string; demand: number; selected: boolean;
  onToggle: () => void; onStock: () => void; onDelete: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const active = hasActiveOffer(p);
  const out = p.stockCount === 0;
  const low = !out && isLowStock(p);
  const short = demand > p.stockCount;

  const startEdit = () => { setText(p.price === null ? '' : String(p.price)); setEditing(true); };
  const savePrice = async () => {
    const value = parseNumber(text);
    if (value === null || value <= 0) { toast('اكتب سعرًا أكبر من صفر.', 'err'); return; }
    if (value === p.price) { setEditing(false); return; }
    setBusy(true);
    try {
      await setPrice(p, value);
      toast('تم تحديث السعر', 'ok');
      setEditing(false);
    } catch (e) {
      toast(e instanceof PriceBelowOffer ? `السعر يجب أن يبقى أعلى من سعر العرض الجاري (${money(e.offerPrice)}). أنهِ العرض أولًا.` : 'تعذّر حفظ السعر.', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className={selected ? 'sel' : ''}>
      <td><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`تحديد ${p.name}`} /></td>
      <td>
        <div className="row">
          <div className="thumb">{p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" /> : <Icon name="image" />}</div>
          <div style={{ minWidth: 0 }}>
            <Link to={`/products/${p.id}`} className="b">{p.name}</Link>
            <div className="sub">{[p.brand, categoryLabel].filter(Boolean).join(' · ') || <span style={{ color: 'var(--warn)', fontWeight: 700 }}>بلا تصنيف</span>}</div>
          </div>
        </div>
      </td>
      <td>
        {p.price === null && !editing ? (
          <button type="button" className="edit" onClick={startEdit}><Chip tone="info" dot={false}>السعر عند الطلب</Chip></button>
        ) : editing ? (
          <span className="row" style={{ gap: 6 }}>
            <input className="inp sm ltr" style={{ width: 120 }} autoFocus inputMode="decimal" value={text} aria-label="السعر الجديد" disabled={busy}
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void savePrice(); if (e.key === 'Escape') setEditing(false); }} />
            <button type="button" className="icon-btn flat" aria-label="حفظ السعر" disabled={busy} onClick={() => void savePrice()}>{busy ? <Spinner /> : <Icon name="check" />}</button>
            <button type="button" className="icon-btn flat" aria-label="إلغاء" disabled={busy} onClick={() => setEditing(false)}><Icon name="x" /></button>
          </span>
        ) : (
          <>
            <button type="button" className="edit" onClick={startEdit} aria-label={`تعديل سعر ${p.name}`}>
              <span className="num">{money(active ? p.offerPrice : p.price)}</span><Icon name="edit" size="sm" />
            </button>
            {active && <div className="sub"><s className="num">{money(p.price)}</s> · <span style={{ color: 'var(--ok)', fontWeight: 700 }}>عرض {discountPercent(p)}%</span></div>}
            {hasEndedOffer(p) && <div className="sub" style={{ color: 'var(--warn)' }}>عرض منتهٍ</div>}
          </>
        )}
      </td>
      <td>
        <button type="button" className="edit" onClick={onStock} aria-label={`تعديل مخزون ${p.name}`}>
          <b style={{ color: out ? 'var(--bad)' : low ? 'var(--warn)' : undefined }}>{p.stockCount}</b><Icon name="edit" size="sm" />
        </button>
        {low && <div className="sub" style={{ color: 'var(--warn)', fontWeight: 700 }}>منخفض</div>}
        {demand > 0 && <div className="sub" style={{ color: short ? 'var(--bad)' : 'var(--warn)', fontWeight: 700 }}>مطلوب {demand} في طلبات معلقة</div>}
      </td>
      <td>
        {p.hidden ? (
          <><Chip tone="bad">مخفي من المنصة</Chip><div className="sub">السبب: {p.hiddenReason || 'غير مذكور'}</div></>
        ) : p.status === 'draft' ? (
          <><Chip tone="n">مسودة</Chip><div className="sub">لا يراه العملاء</div></>
        ) : p.status === 'archived' ? (
          <><Chip tone="n">مؤرشف</Chip><div className="sub">مخفي، ويمكن إرجاعه</div></>
        ) : out ? (
          <><Chip tone="bad">نفد</Chip><div className="sub">لا يظهر للعملاء</div></>
        ) : p.inStock ? (
          <Chip tone="ok">متاح للشراء</Chip>
        ) : (
          <><Chip tone="n">غير متاح</Chip><div className="sub">يظهر ولا يُشترى</div></>
        )}
      </td>
      <td>
        <div className="row wrap" style={{ gap: 6 }}>
          {p.isDeliveryAvailable ? <Chip tone="n" dot={false}>توصيل</Chip> : <Chip tone="info" dot={false}>استلام فقط</Chip>}
          {p.isInstallationAvailable && <Chip tone="n" dot={false}>تركيب {money(p.installationPrice)}</Chip>}
        </div>
      </td>
      <td>
        <div className="row" style={{ gap: 2 }}>
          <Link to={`/products/${p.id}`} className="icon-btn flat" aria-label={`تعديل ${p.name}`}><Icon name="edit" /></Link>
          <button type="button" className="icon-btn flat" aria-label={`حذف ${p.name}`} onClick={onDelete}><Icon name="trash" /></button>
        </div>
      </td>
    </tr>
  );
}

/** Delete: refused while orders are open on the product (they could no longer be confirmed); else typed confirmation. */
function DeleteDialog({ companyId, product, onClose }: { companyId: string; product: Product; onClose: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState<Order[] | null>(null);
  const [checked, setChecked] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  // Look once when the dialog opens.
  useEffect(() => {
    let live = true;
    openOrdersOfProduct(companyId, product.id)
      .then((o) => { if (live) { setOpen(o); setChecked(true); } })
      .catch(() => { if (live) { setOpen([]); setChecked(true); } });
    return () => { live = false; };
  }, [companyId, product.id]);

  const archive = async () => {
    setBusy(true);
    try { await updateProductFields(product.id, { status: 'archived' }); toast('أُرشف المنتج واختفى عن العملاء', 'ok'); onClose(); }
    catch { toast('تعذّر التحديث.', 'err'); setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await deleteProduct(companyId, product.id); toast('تم حذف المنتج', 'ok'); onClose(); }
    catch (e) {
      if (e instanceof ProductHasOpenOrders) setOpen(e.orders); else toast('تعذّر حذف المنتج.', 'err');
      setBusy(false);
    }
  };

  if (!checked) {
    return <Modal title="حذف المنتج" onClose={onClose} footer={<button type="button" className="btn" onClick={onClose}>إغلاق</button>}><Loading text="نتحقق من الطلبات المفتوحة…" /></Modal>;
  }
  if (open && open.length > 0) {
    return (
      <Modal
        title={<>لا يمكن حذف «{product.name}» الآن</>}
        onClose={onClose}
        busy={busy}
        footer={<>
          <Link to="/orders" className="btn p" onClick={onClose}>عرض الطلبات</Link>
          <button type="button" className="btn" disabled={busy} onClick={() => void archive()}>أرشفة بدلًا من الحذف</button>
          <button type="button" className="btn g" onClick={onClose}>إغلاق</button>
        </>}
      >
        <p className="muted">عليه {open.length >= 20 ? 'أكثر من 20 طلبًا' : ordersText(open.length)} مفتوح{open.length === 1 ? '' : 'ة'}. لو حُذف لن تستطيع تأكيدها، وقد يكون أصحابها حوّلوا المبلغ بالفعل.</p>
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
          {open.slice(0, 5).map((o) => (
            <Link key={o.id} to={`/orders/${o.id}`} className="lr" onClick={onClose}>
              <span className="b num">#{shortId(o.id)}</span><span className="grow">{o.customerName || 'عميل'}</span>
              <Chip tone={o.paymentStatus === 'confirmed' ? 'info' : 'warn'} dot={false}>{o.paymentStatus !== 'confirmed' ? 'بانتظار الدفع' : o.orderStatus === 'out_for_delivery' ? 'في الطريق' : 'قيد التجهيز'}</Chip>
            </Link>
          ))}
        </div>
        <p className="sub">الأرشفة تُخفي المنتج عن العملاء فورًا وتُبقي هذه الطلبات سليمة، ويمكنك إرجاعه لاحقًا.</p>
      </Modal>
    );
  }
  return (
    <ConfirmDialog
      title={<>حذف «{product.name}» نهائيًا؟</>}
      confirmLabel="حذف نهائي"
      danger
      busy={busy}
      disabled={typed.trim() !== product.name.trim()}
      onConfirm={() => void remove()}
      onClose={onClose}
    >
      <ul style={{ margin: 0, paddingInlineStart: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <li>يُحذف من الكتالوج ولا يمكن استرجاعه.</li>
        <li>يختفي عرضه الجاري إن وُجد، ويُزال من مفضلات العملاء.</li>
        <li>الطلبات السابقة تحتفظ ببياناتها كما هي.</li>
      </ul>
      <div className="fld">
        <label htmlFor="del-name">اكتب اسم المنتج للتأكيد</label>
        <input id="del-name" className="inp" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={product.name} autoFocus />
      </div>
    </ConfirmDialog>
  );
}

function BulkPriceDialog({ items, onClose }: { items: Product[]; onClose: (done: boolean) => void }) {
  const toast = useToast();
  const [text, setText] = useState('10');
  const [dir, setDir] = useState<'up' | 'down'>('up');
  const [busy, setBusy] = useState(false);
  const percent = parseNumber(text);
  const ok = percent !== null && percent > 0 && percent <= 90;
  const priced = items.filter((p) => p.price !== null);
  const next = (p: Product) => Math.max(1, Math.round((p.price as number) * (1 + (dir === 'up' ? 1 : -1) * ((percent ?? 0) / 100))));

  const apply = async () => {
    if (!ok) return;
    setBusy(true);
    const results = await Promise.allSettled(priced.map((p) => setPrice(p, next(p))));
    const failed = results.filter((r) => r.status === 'rejected').length;
    toast(failed ? `تم تعديل ${results.length - failed} وتعذّر ${failed} (عليها عرض جارٍ أو رُفض الحفظ)` : `تم تعديل سعر ${results.length} منتج`, failed ? 'err' : 'ok');
    onClose(true);
  };

  return (
    <Modal title="تعديل السعر بنسبة" onClose={() => onClose(false)} busy={busy}
      footer={<><button type="button" className="btn p" disabled={!ok || busy || priced.length === 0} onClick={() => void apply()}>{busy && <Spinner />}تطبيق</button><button type="button" className="btn" disabled={busy} onClick={() => onClose(false)}>إلغاء</button></>}>
      <div className="seg full" role="group"><button type="button" className={dir === 'up' ? 'on' : ''} onClick={() => setDir('up')}>زيادة</button><button type="button" className={dir === 'down' ? 'on' : ''} onClick={() => setDir('down')}>تخفيض</button></div>
      <div className="fld"><label htmlFor="pct">النسبة</label><div className="sfx"><input id="pct" className="inp ltr" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} autoFocus /><span>%</span></div></div>
      {priced.length < items.length && <Banner tone="info" tight>{items.length - priced.length} منتج سعره «عند الطلب» ولن يتغير.</Banner>}
      {ok && priced.slice(0, 3).map((p) => (
        <div key={p.id} className="kv"><span className="ellipsis">{p.name}</span><span><span className="num">{money(p.price)} ← <b>{money(next(p))}</b></span></span></div>
      ))}
      <p className="hint">المنتج الذي عليه عرض جارٍ لا يُعدَّل سعره قبل إنهاء العرض.</p>
    </Modal>
  );
}
