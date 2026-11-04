import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCompanyData } from '../data/CompanyData';
import { useCategoryLookup } from '../data/categories';
import { discountPercent, hasActiveOffer, hasEndedOffer, LOW_STOCK_THRESHOLD, money, parseNumber, unitsText } from '../data/format';
import { createProduct, productImageFolder, updateProductFields, type ProductDraft } from '../data/products';
import type { Product, ProductStatus } from '../data/types';
import { CategorySelect } from '../ui/CategorySelect';
import { GalleryField } from '../ui/GalleryField';
import { Icon } from '../ui/Icon';
import { Banner, Chip, Empty, Loading, PageHeader, Spinner, Switch } from '../ui/kit';
import { StockDialog } from '../ui/StockDialog';
import { useToast } from '../ui/toast';

interface SpecRow {
  id: number;
  key: string;
  value: string;
}

interface FormState {
  name: string;
  brand: string;
  imageUrls: string[];
  status: ProductStatus;
  sku: string;
  threshold: string;
  categoryId: string | null;
  priceMode: 'fixed' | 'onRequest';
  price: string;
  description: string;
  specs: SpecRow[];
  delivery: boolean;
  installation: boolean;
  installationPrice: string;
  inStock: boolean;
  stock: string; // only when creating
}

let rowId = 0;
const numText = (n: number | null) => (n === null ? '' : String(n));

function toForm(p?: Product): FormState {
  return {
    name: p?.name ?? '',
    brand: p?.brand ?? '',
    imageUrls: p?.imageUrls ?? [],
    status: p?.status ?? 'published',
    sku: p?.sku ?? '',
    threshold: numText(p?.lowStockThreshold ?? null),
    categoryId: p?.categoryId ?? null,
    priceMode: p && p.price === null ? 'onRequest' : 'fixed',
    price: numText(p?.price ?? null),
    description: p?.description ?? '',
    specs: Object.entries(p?.specifications ?? {}).map(([key, value]) => ({ id: ++rowId, key, value })),
    delivery: p?.isDeliveryAvailable ?? true,
    installation: p?.isInstallationAvailable ?? false,
    installationPrice: numText(p?.installationPrice ?? null),
    inStock: p?.inStock ?? true,
    stock: '',
  };
}

function toDraft(f: FormState): ProductDraft {
  const specifications: Record<string, string> = {};
  for (const r of f.specs) if (r.key.trim() && r.value.trim()) specifications[r.key.trim()] = r.value.trim();
  return {
    name: f.name.trim(),
    brand: f.brand.trim(),
    imageUrl: f.imageUrls[0] ?? '',
    imageUrls: f.imageUrls,
    categoryId: f.categoryId,
    price: f.priceMode === 'onRequest' ? null : parseNumber(f.price),
    description: f.description.trim(),
    specifications,
    isDeliveryAvailable: f.delivery,
    isInstallationAvailable: f.installation,
    installationPrice: f.installation ? parseNumber(f.installationPrice) : null,
    inStock: f.inStock,
    status: f.status,
    sku: f.sku.trim(),
    lowStockThreshold: f.threshold.trim() === '' ? null : parseNumber(f.threshold),
  };
}

const LABELS: Record<keyof ProductDraft, string> = {
  name: 'الاسم',
  brand: 'العلامة التجارية',
  imageUrl: 'الصورة',
  imageUrls: 'الصور',
  status: 'الحالة',
  sku: 'رمز المنتج',
  lowStockThreshold: 'حد التنبيه',
  categoryId: 'التصنيف',
  price: 'السعر',
  description: 'الوصف',
  specifications: 'المواصفات',
  isDeliveryAvailable: 'التوصيل',
  isInstallationAvailable: 'التركيب',
  installationPrice: 'سعر التركيب',
  inStock: 'متاح للشراء',
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function changedKeys(next: ProductDraft, base: ProductDraft): (keyof ProductDraft)[] {
  return (Object.keys(next) as (keyof ProductDraft)[]).filter((k) => !same(next[k], base[k]));
}

interface Errors {
  name?: string;
  brand?: string;
  category?: string;
  price?: string;
  installationPrice?: string;
  stock?: string;
  sku?: string;
  threshold?: string;
  specs: Record<number, string>;
}

function validate(f: FormState, creating: boolean, offerPrice: number | null, offerActive: boolean): Errors {
  const e: Errors = { specs: {} };
  if (!f.name.trim()) e.name = 'اكتب اسم المنتج.';
  else if (f.name.trim().length > 200) e.name = 'الاسم أطول من 200 حرف.';
  if (f.brand.trim().length > 60) e.brand = 'العلامة التجارية أطول من 60 حرفًا.';
  if (!f.categoryId) e.category = 'اختر تصنيف المنتج.';
  if (f.sku.trim().length > 60) e.sku = 'رمز المنتج أطول من 60 حرفًا.';
  if (f.threshold.trim() !== '') {
    const t = parseNumber(f.threshold);
    if (t === null || !Number.isInteger(t) || t < 0 || t > 100000) e.threshold = 'اكتب عددًا صحيحًا من 0 إلى 100000، أو اتركه فارغًا لاستعمال الحد العام.';
  }
  if (f.priceMode === 'fixed') {
    const price = parseNumber(f.price);
    if (price === null || price <= 0) e.price = 'اكتب سعرًا أكبر من صفر، أو اختر «السعر عند الطلب».';
    else if (offerPrice !== null && offerActive && price <= offerPrice) e.price = `السعر يجب أن يبقى أعلى من سعر العرض الجاري (${money(offerPrice)}). أنهِ العرض أولًا.`;
  } else if (offerPrice !== null && offerActive) {
    e.price = 'لا يمكن جعل السعر «عند الطلب» والمنتج عليه عرض جارٍ. أنهِ العرض أولًا.';
  }
  if (f.installation) {
    const ip = parseNumber(f.installationPrice);
    if (ip === null || ip <= 0) e.installationPrice = 'اكتب سعر التركيب (أكبر من صفر).';
  }
  if (creating) {
    const s = parseNumber(f.stock);
    if (s === null || !Number.isInteger(s) || s < 0) e.stock = 'اكتب كمية المخزون (عددًا صحيحًا، صفر أو أكثر).';
  }
  const seen = new Map<string, number>();
  for (const r of f.specs) {
    const k = r.key.trim().toLowerCase();
    if (!k && !r.value.trim()) continue;
    if (!k) e.specs[r.id] = 'اكتب اسم المواصفة.';
    else if (!r.value.trim()) e.specs[r.id] = 'اكتب قيمة المواصفة.';
    else if (seen.has(k)) e.specs[r.id] = 'اسم المواصفة مكرر، ادمجهما أو غيّر الاسم.';
    seen.set(k, r.id);
  }
  return e;
}

const hasErrors = (e: Errors) => !!(e.name || e.brand || e.category || e.price || e.installationPrice || e.stock || e.sku || e.threshold || Object.keys(e.specs).length);

export function ProductEditPage() {
  const { id } = useParams();
  const creating = id === undefined;
  const { products, company, companyId, categories, pendingPayment } = useCompanyData();
  const lookup = useCategoryLookup(categories);
  const product = creating ? undefined : products?.find((p) => p.id === id);

  if (products === null) return <main className="page"><Loading /></main>;
  if (!creating && !product) {
    return <main className="page"><Empty icon="box" text="المنتج غير موجود." action={<Link to="/products" className="btn">العودة إلى المنتجات</Link>} /></main>;
  }
  return (
    <Editor
      key={product?.id ?? 'new'}
      product={product}
      companyId={companyId}
      companyName={company?.name ?? ''}
      lookup={lookup}
      brands={[...new Set(products.map((p) => p.brand).filter(Boolean))]}
      demand={pendingPayment.filter((o) => o.productId === product?.id && !o.stockReserved).reduce((n, o) => n + o.quantity, 0)}
    />
  );
}

function Editor({
  product, companyId, companyName, lookup, brands, demand,
}: {
  product: Product | undefined;
  companyId: string;
  companyName: string;
  lookup: ReturnType<typeof useCategoryLookup>;
  brands: string[];
  demand: number;
}) {
  const creating = !product;
  const navigate = useNavigate();
  const toast = useToast();
  const [base, setBase] = useState<FormState>(() => toForm(product));
  const [form, setForm] = useState<FormState>(() => toForm(product));
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [stockOpen, setStockOpen] = useState(false);
  const [tried, setTried] = useState(false);
  const saved = useRef(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const offerActive = !!product && hasActiveOffer(product);
  const errors = useMemo(() => validate(form, creating, product?.offerPrice ?? null, offerActive), [form, creating, product?.offerPrice, offerActive]);
  const baseDraft = useMemo(() => toDraft(base), [base]);
  const draft = useMemo(() => toDraft(form), [form]);
  const changes = creating ? [] : changedKeys(draft, baseDraft);
  const dirty = creating ? form.name.trim() !== '' || form.imageUrls.length > 0 : changes.length > 0;

  useEffect(() => {
    if (!dirty || saved.current) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const leave = (e: React.MouseEvent) => {
    if (dirty && !saved.current && !window.confirm('لديك تغييرات غير محفوظة. هل تريد تركها؟')) e.preventDefault();
  };

  const save = async () => {
    setTried(true);
    if (busy || hasErrors(errors)) return;
    setBusy(true);
    setSaveError('');
    try {
      if (creating) {
        const stock = parseNumber(form.stock) as number;
        await createProduct(companyId, companyName, draft, stock);
        saved.current = true;
        toast('تمت إضافة المنتج', 'ok');
        navigate('/products');
      } else {
        const offerStays = product.offerPrice !== null && draft.price !== null && draft.price > product.offerPrice;
        const clearOffer = changes.includes('price') && product.offerPrice !== null && !offerStays;
        const patch: Partial<ProductDraft> = {};
        for (const k of changes) Object.assign(patch, { [k]: draft[k] });
        await updateProductFields(product.id, patch, { clearOffer });
        setBase(form);
        toast('تم حفظ التغييرات', 'ok');
      }
    } catch {
      setSaveError('تعذّر حفظ المنتج. تأكد من الاتصال وحاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };

  const sale = draft.price !== null ? (offerActive && product?.offerPrice ? product.offerPrice : draft.price) : null;
  const addSpec = () => setForm((f) => ({ ...f, specs: [...f.specs, { id: ++rowId, key: '', value: '' }] }));
  const moveSpec = (index: number, by: -1 | 1) =>
    setForm((f) => {
      const specs = [...f.specs];
      const [row] = specs.splice(index, 1);
      specs.splice(index + by, 0, row);
      return { ...f, specs };
    });
  const specPatch = (rid: number, patch: Partial<SpecRow>) => setForm((f) => ({ ...f, specs: f.specs.map((r) => (r.id === rid ? { ...r, ...patch } : r)) }));
  const brandHints = brands.filter((b) => b.toLowerCase() !== form.brand.trim().toLowerCase() && b.toLowerCase().includes(form.brand.trim().toLowerCase())).slice(0, 6);
  const showErr = <T,>(msg: T | undefined) => (tried ? msg : undefined);

  return (
    <>
      <main className="page">
        <PageHeader
          crumbs={[{ label: 'المنتجات' }, { label: creating ? 'منتج جديد' : 'تعديل' }]}
          title={creating ? 'منتج جديد' : product.name}
          actions={
            <>
              {!creating && product.hidden && <Chip tone="bad">مخفي من المنصة</Chip>}
              {!creating && <span className="sub">مفتاح المنتج: <span className="num">{product.id}</span></span>}
              <Link to="/products" className="btn" onClick={leave}>رجوع</Link>
            </>
          }
        />
        {!creating && product.hidden && (
          <div style={{ marginBottom: 20 }}>
            <Banner tone="bad" icon="alert">
              <b>أخفت المنصة هذا المنتج عن العملاء.</b>
              <div>السبب: {product.hiddenReason || 'غير مذكور'}. عالج السبب ثم راسل إدارة المنصة لإظهاره. تعديلاتك هنا تُحفظ.</div>
            </Banner>
          </div>
        )}

        <div className="g2">
          <div className="stack">
            <section className="card" aria-label="المعلومات الأساسية">
              <div className="card-h"><h2>المعلومات الأساسية</h2></div>
              <div className="card-b stack" style={{ gap: 16 }}>
                <div className="fld">
                  <label htmlFor="p-name">اسم المنتج</label>
                  <input id="p-name" className={`inp${showErr(errors.name) ? ' err' : ''}`} value={form.name} maxLength={200} onChange={(e) => set('name', e.target.value)} />
                  {showErr(errors.name) && <span className="errt">{errors.name}</span>}
                </div>
                <div className="row wrap" style={{ alignItems: 'flex-start' }}>
                  <div className="fld grow">
                    <label htmlFor="p-brand">العلامة التجارية <span className="muted">(اختياري)</span></label>
                    <input id="p-brand" className={`inp${errors.brand ? ' err' : ''}`} value={form.brand} maxLength={60} onChange={(e) => set('brand', e.target.value)} />
                    {brandHints.length > 0 && (
                      <div className="pills" aria-label="علامات استخدمتها من قبل">
                        {brandHints.map((b) => <button key={b} type="button" className="pill" style={{ height: 30 }} onClick={() => set('brand', b)}>{b}</button>)}
                      </div>
                    )}
                    {errors.brand && <span className="errt">{errors.brand}</span>}
                  </div>
                  <div className="fld grow">
                    <label htmlFor="p-sku">رمز المنتج SKU <span className="muted">(اختياري)</span></label>
                    <input id="p-sku" className={`inp ltr${errors.sku ? ' err' : ''}`} value={form.sku} maxLength={60} onChange={(e) => set('sku', e.target.value)} />
                    <span className="hint">لربط المنتج بنظام المخزن عندك.</span>
                    {errors.sku && <span className="errt">{errors.sku}</span>}
                  </div>
                </div>
                <CategorySelect
                  choices={lookup.choices}
                  value={form.categoryId}
                  currentLabel={lookup.label(form.categoryId)}
                  onChange={(cid) => set('categoryId', cid)}
                  error={showErr(errors.category)}
                />
                <div className="fld">
                  <label htmlFor="p-desc">الوصف <span className="muted">(اختياري)</span></label>
                  <textarea id="p-desc" className="inp" rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} />
                </div>
              </div>
            </section>

            <section className="card" aria-label="الصور">
              <div className="card-h"><h2>الصور</h2><span className="sub">الأولى هي الرئيسية</span></div>
              <div className="card-b">
                <GalleryField urls={form.imageUrls} onChange={(u) => set('imageUrls', u)} folder={productImageFolder(companyId)} />
              </div>
            </section>

            <section className="card" aria-label="السعر">
              <div className="card-h"><h2>السعر</h2></div>
              <div className="card-b stack" style={{ gap: 16 }}>
                <div className="row wrap">
                  <div className="seg" role="group" aria-label="طريقة التسعير">
                    <button type="button" className={form.priceMode === 'fixed' ? 'on' : ''} onClick={() => set('priceMode', 'fixed')}>سعر ثابت</button>
                    <button type="button" className={form.priceMode === 'onRequest' ? 'on' : ''} onClick={() => set('priceMode', 'onRequest')}>السعر عند الطلب</button>
                  </div>
                  <span className="hint">«عند الطلب»: يتواصل العميل معك بدل الشراء المباشر.</span>
                </div>
                {form.priceMode === 'fixed' && (
                  <div className="fld" style={{ maxWidth: 320 }}>
                    <label htmlFor="p-price">السعر</label>
                    <div className="sfx"><input id="p-price" className={`inp ltr${showErr(errors.price) ? ' err' : ''}`} inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value)} /><span>SDG</span></div>
                  </div>
                )}
                {showErr(errors.price) && <span className="errt">{errors.price}</span>}
                {product && (offerActive || hasEndedOffer(product)) && (
                  <Banner tone={offerActive ? 'info' : 'warn'} icon="tag" tight action={<Link to="/offers" className="btn sm">إدارة العروض</Link>}>
                    {offerActive
                      ? <>عليه عرض جارٍ: <b className="num">{money(product.offerPrice)}</b> (خصم {discountPercent(product)}%).</>
                      : <>انتهى عرضه. إن غيّرت السعر إلى ما يساوي سعر العرض أو أقل أُزيل العرض المنتهي.</>}
                  </Banner>
                )}
              </div>
            </section>

            <section className="card" aria-label="التوصيل والتركيب">
              <div className="card-h"><h2>التوصيل والتركيب</h2></div>
              <div className="card-b stack" style={{ gap: 14 }}>
                <div className="row">
                  <Switch on={form.delivery} onChange={(v) => set('delivery', v)} label="التوصيل متاح" />
                  <div className="grow"><div className="b">التوصيل متاح</div><div className="sub">إن أُطفئ يستلم العميل من نقاط الاستلام فقط</div></div>
                </div>
                <div className="row wrap">
                  <Switch on={form.installation} onChange={(v) => set('installation', v)} label="التركيب متاح" />
                  <div className="grow"><div className="b">التركيب متاح</div><div className="sub">يظهر خيار التركيب للعميل ويحتاج فنيًا بعد تأكيد الدفع</div></div>
                  {form.installation && (
                    <div className="fld" style={{ width: 200 }}>
                      <div className="sfx"><input className={`inp ltr${showErr(errors.installationPrice) ? ' err' : ''}`} inputMode="decimal" aria-label="سعر التركيب" value={form.installationPrice} onChange={(e) => set('installationPrice', e.target.value)} /><span>SDG</span></div>
                    </div>
                  )}
                </div>
                {showErr(errors.installationPrice) && <span className="errt">{errors.installationPrice}</span>}
              </div>
            </section>

            <section className="card" aria-label="المواصفات">
              <div className="card-h"><h2>المواصفات</h2><span className="sub">اسم وقيمة لكل سطر</span></div>
              <div className="card-b stack t">
                {form.specs.length === 0 && <p className="muted">لا مواصفات بعد.</p>}
                {form.specs.map((r, i) => (
                  <div key={r.id}>
                    <div className="row">
                      <span className="row" style={{ gap: 0 }}>
                        <button type="button" className="icon-btn flat" style={{ width: 28 }} aria-label="تقديم المواصفة" disabled={i === 0} onClick={() => moveSpec(i, -1)}><Icon name="arrowUp" size="sm" /></button>
                        <button type="button" className="icon-btn flat" style={{ width: 28 }} aria-label="تأخير المواصفة" disabled={i === form.specs.length - 1} onClick={() => moveSpec(i, 1)}><span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Icon name="arrowUp" size="sm" /></span></button>
                      </span>
                      <input className={`inp${errors.specs[r.id] ? ' err' : ''}`} style={{ maxWidth: 220 }} aria-label="اسم المواصفة" placeholder="المعالج" value={r.key} onChange={(e) => specPatch(r.id, { key: e.target.value })} />
                      <input className={`inp${errors.specs[r.id] ? ' err' : ''}`} aria-label="قيمة المواصفة" placeholder="Intel Core i5" value={r.value} onChange={(e) => specPatch(r.id, { value: e.target.value })} />
                      <button type="button" className="icon-btn flat" aria-label="حذف المواصفة" onClick={() => setForm((f) => ({ ...f, specs: f.specs.filter((x) => x.id !== r.id) }))}><Icon name="trash" /></button>
                    </div>
                    {errors.specs[r.id] && <span className="errt" style={{ marginTop: 4 }}><Icon name="alert" size="sm" />{errors.specs[r.id]}</span>}
                  </div>
                ))}
                <div><button type="button" className="btn sm" onClick={addSpec}><Icon name="plus" size="sm" />إضافة مواصفة</button></div>
              </div>
            </section>
          </div>

          <div className="stack">
            <section className="card" aria-label="الحالة والظهور">
              <div className="card-h"><h3>الحالة والظهور</h3></div>
              <div className="card-b stack" style={{ gap: 14 }}>
                <div className="seg full" role="group" aria-label="حالة المنتج">
                  {([['draft', 'مسودة'], ['published', 'منشور'], ['archived', 'مؤرشف']] as const).map(([s, label]) => (
                    <button key={s} type="button" className={form.status === s ? 'on' : ''} aria-pressed={form.status === s} onClick={() => set('status', s)}>{label}</button>
                  ))}
                </div>
                <p className="hint">
                  {form.status === 'published' ? 'المنشور يظهر للعملاء ما دام مخزونه أكبر من صفر.' : form.status === 'draft' ? 'المسودة لا يراها العملاء ولا يطلبونها، وتبقى هنا حتى تنشرها.' : 'المؤرشف يختفي عن العملاء وتبقى طلباته السابقة، ويمكنك إرجاعه في أي وقت.'}
                </p>
                <div className="row">
                  <Switch on={form.inStock} onChange={(v) => set('inStock', v)} label="متاح للشراء" />
                  <div className="grow"><div className="b">متاح للشراء</div><div className="sub">إن أُطفئ يظهر المنتج (إن كان منشورًا) ولا يُطلب</div></div>
                </div>
              </div>
            </section>

            <section className="card" aria-label="المخزون">
              <div className="card-h"><h3>المخزون</h3></div>
              <div className="card-b stack" style={{ gap: 12 }}>
                {creating ? (
                  <div className="fld">
                    <label htmlFor="p-stock">الكمية المتوفرة الآن</label>
                    <input id="p-stock" className={`inp ltr${showErr(errors.stock) ? ' err' : ''}`} inputMode="numeric" value={form.stock} onChange={(e) => set('stock', e.target.value)} />
                    {showErr(errors.stock) && <span className="errt">{errors.stock}</span>}
                  </div>
                ) : (
                  <>
                    <div className="row">
                      <div className="grow"><div className="sub">المتوفر الآن</div><div className="b" style={{ fontSize: 34, lineHeight: 1.1 }}>{product.stockCount}</div></div>
                      <button type="button" className="btn" onClick={() => setStockOpen(true)}>تعديل الكمية…</button>
                    </div>
                    {demand > 0 && <Banner tone="warn" icon="alert" tight><b>{unitsText(demand)} مطلوبة</b> في طلبات تنتظر تأكيد الدفع.</Banner>}
                    <p className="hint">الحفظ هنا لا يلمس رقم المخزون أبدًا. كل تعديل للكمية يتم من الزر أعلاه ويُحسب على الرقم الحالي.</p>
                  </>
                )}
                <div className="fld">
                  <label htmlFor="p-low">نبّهني عندما يصل المخزون إلى <span className="muted">(اختياري)</span></label>
                  <div className="sfx"><input id="p-low" className={`inp ltr${errors.threshold ? ' err' : ''}`} inputMode="numeric" placeholder={`${LOW_STOCK_THRESHOLD} (الحد العام)`} value={form.threshold} onChange={(e) => set('threshold', e.target.value)} /><span>وحدات</span></div>
                  {errors.threshold && <span className="errt">{errors.threshold}</span>}
                </div>
              </div>
            </section>

            <section className="card" aria-label="كما يراه العميل">
              <div className="card-h"><h3>كما يراه العميل</h3></div>
              <div className="card-b">
                <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ height: 170, background: 'var(--neutral-bg)', display: 'grid', placeItems: 'center', color: 'var(--muted)', position: 'relative' }}>
                    {form.imageUrls[0] ? <img src={form.imageUrls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="image" size="lg" />}
                    {offerActive && product && <span className="chip c-bad nd" style={{ position: 'absolute', top: 10, insetInlineStart: 10, background: 'var(--bad-solid)', color: '#fff' }}>خصم {discountPercent(product)}%</span>}
                  </div>
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div className="b">{form.name || 'اسم المنتج'}</div>
                    <div className="sub">{companyName}</div>
                    <div className="row">
                      {sale === null ? <b className="muted">السعر عند الطلب</b> : <b style={{ fontSize: 17, color: 'var(--brand-ink)' }}><span className="num">{money(sale)}</span> SDG</b>}
                      {offerActive && draft.price !== null && <s className="sub num">{money(draft.price)}</s>}
                    </div>
                    <div className="row wrap" style={{ gap: 6 }}>
                      {form.status !== 'published' ? <Chip tone="n" dot={false}>{form.status === 'draft' ? 'لا يراه العملاء (مسودة)' : 'لا يراه العملاء (مؤرشف)'}</Chip> : form.inStock ? <Chip tone="ok" dot={false}>متاح</Chip> : <Chip tone="n" dot={false}>غير متاح</Chip>}
                      {form.delivery ? <Chip tone="n" dot={false}>توصيل</Chip> : <Chip tone="info" dot={false}>استلام فقط</Chip>}
                      {form.installation && <Chip tone="n" dot={false}>تركيب</Chip>}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
        {saveError && <div style={{ marginTop: 16 }}><Banner tone="bad" icon="alert">{saveError}</Banner></div>}
      </main>

      <div className="sticky-bar" role="region" aria-label="شريط الحفظ">
        <Icon name={dirty ? 'alert' : 'check'} />
        <div className="grow">
          {creating
            ? <span className="muted">{form.status === 'published' ? 'سيظهر المنتج للعملاء ما دام مخزونه أكبر من صفر.' : form.status === 'draft' ? 'سيُحفظ كمسودة ولن يراه العملاء حتى تنشره.' : 'سيُحفظ مؤرشفًا ولن يراه العملاء.'}</span>
            : dirty
              ? <><b>{changes.length} {changes.length === 1 ? 'حقل تغيّر' : 'حقول تغيّرت'}:</b> {[...new Set(changes.filter((k) => !(k === 'imageUrl' && changes.includes('imageUrls'))).map((k) => LABELS[k]))].join(' · ')} <span className="muted">· المخزون لا يتأثر بالحفظ</span></>
              : <span className="muted">لا تغييرات غير محفوظة.</span>}
          {tried && hasErrors(errors) && <span className="errt" style={{ marginTop: 2 }}>راجع الحقول المظلّلة بالأحمر أولًا.</span>}
        </div>
        {!creating && <button type="button" className="btn" disabled={!dirty || busy} onClick={() => { setForm(base); setTried(false); }}>تجاهل التغييرات</button>}
        <button type="button" className="btn p" disabled={busy || (!creating && !dirty)} onClick={() => void save()}>
          {busy && <Spinner />}
          {creating ? 'إضافة المنتج' : 'حفظ التغييرات'}
        </button>
      </div>
      {stockOpen && product && <StockDialog product={product} demand={demand} onClose={() => setStockOpen(false)} />}
    </>
  );
}
