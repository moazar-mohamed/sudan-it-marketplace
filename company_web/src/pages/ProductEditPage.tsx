import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCompanyData } from '../data/CompanyData';
import { useCategoryLookup } from '../data/categories';
import { discountPercent, hasActiveOffer, hasEndedOffer, LOW_STOCK_THRESHOLD, money, parseNumber, unitsText } from '../data/format';
import { createProduct, productImageFolder, updateProductFields, type ProductDraft } from '../data/products';
import type { Product, ProductStatus } from '../data/types';
import { usdPrice, usdText } from '../data/usdPricing';
import { CategorySelect } from '../ui/CategorySelect';
import { GalleryField } from '../ui/GalleryField';
import { Icon } from '../ui/Icon';
import { Banner, Chip, Empty, Loading, PageHeader, Spinner, Switch } from '../ui/kit';
import { StockDialog } from '../ui/StockDialog';
import { useToast } from '../ui/toast';
import { t } from '../i18n';

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
  /** In pounds, in dollars (worked out from the company's rate), or on request. */
  priceMode: 'fixed' | 'usd' | 'onRequest';
  price: string;
  usd: string;
  description: string;
  specs: SpecRow[];
  delivery: boolean;
  installation: boolean;
  installationPrice: string;
  installationUsd: string;
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
    priceMode: p?.priceUsd != null ? 'usd' : p && p.price === null ? 'onRequest' : 'fixed',
    price: numText(p?.price ?? null),
    usd: numText(p?.priceUsd ?? null),
    description: p?.description ?? '',
    specs: Object.entries(p?.specifications ?? {}).map(([key, value]) => ({ id: ++rowId, key, value })),
    delivery: p?.isDeliveryAvailable ?? true,
    installation: p?.isInstallationAvailable ?? false,
    installationPrice: numText(p?.installationPrice ?? null),
    installationUsd: numText(p?.installationPriceUsd ?? null),
    inStock: p?.inStock ?? true,
    stock: '',
  };
}

/** [rate] is the company's dollar rate: in dollars the pounds are worked out from it. */
function toDraft(f: FormState, rate: number | null): ProductDraft {
  const specifications: Record<string, string> = {};
  for (const r of f.specs) if (r.key.trim() && r.value.trim()) specifications[r.key.trim()] = r.value.trim();
  const inUsd = f.priceMode === 'usd' && rate !== null;
  const usd = inUsd ? parseNumber(f.usd) : null;
  const installationUsd = inUsd && f.installation ? parseNumber(f.installationUsd) : null;
  return {
    name: f.name.trim(),
    brand: f.brand.trim(),
    imageUrl: f.imageUrls[0] ?? '',
    imageUrls: f.imageUrls,
    categoryId: f.categoryId,
    price: f.priceMode === 'onRequest' ? null : inUsd ? (usd === null ? null : usdPrice(usd, rate)) : parseNumber(f.price),
    description: f.description.trim(),
    specifications,
    isDeliveryAvailable: f.delivery,
    isInstallationAvailable: f.installation,
    installationPrice: !f.installation
      ? null
      : inUsd
        ? (installationUsd === null ? null : usdPrice(installationUsd, rate))
        : parseNumber(f.installationPrice),
    priceUsd: usd,
    installationPriceUsd: installationUsd,
    usdRateApplied: inUsd ? rate : null,
    inStock: f.inStock,
    status: f.status,
    sku: f.sku.trim(),
    lowStockThreshold: f.threshold.trim() === '' ? null : parseNumber(f.threshold),
  };
}

const LABELS: Record<keyof ProductDraft, string> = {
  name: t('الاسم'),
  brand: t('العلامة التجارية'),
  imageUrl: t('الصورة'),
  imageUrls: t('الصور'),
  status: t('الحالة'),
  sku: t('رمز المنتج'),
  lowStockThreshold: t('حد التنبيه'),
  categoryId: t('التصنيف'),
  price: t('السعر'),
  description: t('الوصف'),
  specifications: t('المواصفات'),
  isDeliveryAvailable: t('التوصيل'),
  isInstallationAvailable: t('التركيب'),
  installationPrice: t('سعر التركيب'),
  inStock: t('متاح للشراء'),
  priceUsd: t('السعر بالدولار'),
  installationPriceUsd: t('سعر التركيب بالدولار'),
  usdRateApplied: t('سعر الدولار'),
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

function validate(
  f: FormState,
  creating: boolean,
  offerPrice: number | null,
  offerActive: boolean,
  rate: number | null,
  offerPriceUsd: number | null,
): Errors {
  const e: Errors = { specs: {} };
  if (!f.name.trim()) e.name = t('اكتب اسم المنتج.');
  else if (f.name.trim().length > 200) e.name = t('الاسم أطول من 200 حرف.');
  if (f.brand.trim().length > 60) e.brand = t('العلامة التجارية أطول من 60 حرفًا.');
  if (!f.categoryId) e.category = t('اختر تصنيف المنتج.');
  if (f.sku.trim().length > 60) e.sku = t('رمز المنتج أطول من 60 حرفًا.');
  if (f.threshold.trim() !== '') {
    const limit = parseNumber(f.threshold);
    if (limit === null || !Number.isInteger(limit) || limit < 0 || limit > 100000) e.threshold = t('اكتب عددًا صحيحًا من 0 إلى 100000، أو اتركه فارغًا لاستعمال الحد العام.');
  }
  if (f.priceMode === 'usd') {
    const usd = parseNumber(f.usd);
    if (rate === null) e.price = t('حدّد سعر الدولار أولًا من بطاقة «سعر الدولار» في صفحة اليوم.');
    else if (usd === null || usd <= 0) e.price = t('اكتب السعر بالدولار (أكبر من صفر).');
    else if (offerPrice !== null && offerActive && ((offerPriceUsd !== null && usd <= offerPriceUsd) || usdPrice(usd, rate) <= offerPrice)) {
      e.price = t('السعر يجب أن يبقى أعلى من سعر العرض الجاري ({0}). أنهِ العرض أولًا.', money(offerPrice));
    }
  } else if (f.priceMode === 'fixed') {
    const price = parseNumber(f.price);
    if (price === null || price <= 0) e.price = t('اكتب سعرًا أكبر من صفر، أو اختر «السعر عند الطلب».');
    else if (offerPrice !== null && offerActive && price <= offerPrice) e.price = t('السعر يجب أن يبقى أعلى من سعر العرض الجاري ({0}). أنهِ العرض أولًا.', money(offerPrice));
  } else if (offerPrice !== null && offerActive) {
    e.price = t('لا يمكن جعل السعر «عند الطلب» والمنتج عليه عرض جارٍ. أنهِ العرض أولًا.');
  }
  if (f.installation) {
    const ip = parseNumber(f.priceMode === 'usd' ? f.installationUsd : f.installationPrice);
    if (ip === null || ip <= 0) e.installationPrice = t('اكتب سعر التركيب (أكبر من صفر).');
  }
  if (creating) {
    const s = parseNumber(f.stock);
    if (s === null || !Number.isInteger(s) || s < 0) e.stock = t('اكتب كمية المخزون (عددًا صحيحًا، صفر أو أكثر).');
  }
  const seen = new Map<string, number>();
  for (const r of f.specs) {
    const k = r.key.trim().toLowerCase();
    if (!k && !r.value.trim()) continue;
    if (!k) e.specs[r.id] = t('اكتب اسم المواصفة.');
    else if (!r.value.trim()) e.specs[r.id] = t('اكتب قيمة المواصفة.');
    else if (seen.has(k)) e.specs[r.id] = t('اسم المواصفة مكرر، ادمجهما أو غيّر الاسم.');
    seen.set(k, r.id);
  }
  return e;
}

const hasErrors = (e: Errors) => !!(e.name || e.brand || e.category || e.price || e.installationPrice || e.stock || e.sku || e.threshold || Object.keys(e.specs).length);

export function ProductEditPage() {
  const { id } = useParams();
  const creating = id === undefined;
  const { products, company, companyId, categories, pendingPayment } = useCompanyData();
  const usdRate = company?.usdRate ?? null;
  const lookup = useCategoryLookup(categories);
  const product = creating ? undefined : products?.find((p) => p.id === id);

  if (products === null) return <main className="page"><Loading /></main>;
  if (!creating && !product) {
    return <main className="page"><Empty icon="box" text={t('المنتج غير موجود.')} action={<Link to="/products" className="btn">{t('العودة إلى المنتجات')}</Link>} /></main>;
  }
  return (
    <Editor
      key={product?.id ?? 'new'}
      product={product}
      companyId={companyId}
      companyName={company?.name ?? ''}
      usdRate={usdRate}
      lookup={lookup}
      brands={[...new Set(products.map((p) => p.brand).filter(Boolean))]}
      demand={pendingPayment.filter((o) => o.productId === product?.id && !o.stockReserved).reduce((n, o) => n + o.quantity, 0)}
    />
  );
}

function Editor({
  product, companyId, companyName, usdRate, lookup, brands, demand,
}: {
  product: Product | undefined;
  companyId: string;
  companyName: string;
  /** The company's dollar rate; null until it sets one (on Today). */
  usdRate: number | null;
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
  const errors = useMemo(
    () => validate(form, creating, product?.offerPrice ?? null, offerActive, usdRate, product?.offerPriceUsd ?? null),
    [form, creating, product?.offerPrice, product?.offerPriceUsd, offerActive, usdRate],
  );
  const baseDraft = useMemo(() => toDraft(base, usdRate), [base, usdRate]);
  const draft = useMemo(() => toDraft(form, usdRate), [form, usdRate]);
  const changes = creating ? [] : changedKeys(draft, baseDraft);
  const dirty = creating ? form.name.trim() !== '' || form.imageUrls.length > 0 : changes.length > 0;

  useEffect(() => {
    if (!dirty || saved.current) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const leave = (e: React.MouseEvent) => {
    if (dirty && !saved.current && !window.confirm(t('لديك تغييرات غير محفوظة. هل تريد تركها؟'))) e.preventDefault();
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
        toast(t('تمت إضافة المنتج'), 'ok');
        navigate('/products');
      } else {
        // A dollar offer must also stay below the dollar price (the rules check both).
        const offerStays =
          product.offerPrice !== null && draft.price !== null && draft.price > product.offerPrice &&
          (draft.priceUsd == null || product.offerPriceUsd === null || draft.priceUsd > product.offerPriceUsd);
        const clearOffer = (changes.includes('price') || changes.includes('priceUsd')) && product.offerPrice !== null && !offerStays;
        const patch: Partial<ProductDraft> = {};
        for (const k of changes) Object.assign(patch, { [k]: draft[k] });
        await updateProductFields(product.id, patch, { clearOffer });
        setBase(form);
        toast(t('تم حفظ التغييرات'), 'ok');
      }
    } catch {
      setSaveError(t('تعذّر حفظ المنتج. تأكد من الاتصال وحاول مرة أخرى.'));
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
          crumbs={[{ label: t('المنتجات') }, { label: creating ? t('منتج جديد') : t('تعديل') }]}
          title={creating ? t('منتج جديد') : product.name}
          actions={
            <>
              {!creating && product.hidden && <Chip tone="bad">{t('مخفي من المنصة')}</Chip>}
              {!creating && <span className="sub">{t('مفتاح المنتج:')}{' '}<span className="num">{product.id}</span></span>}
              <Link to="/products" className="btn" onClick={leave}>{t('رجوع')}</Link>
            </>
          }
        />
        {!creating && product.hidden && (
          <div style={{ marginBottom: 20 }}>
            <Banner tone="bad" icon="alert">
              <b>{t('أخفت المنصة هذا المنتج عن العملاء.')}</b>
              <div>{t('السبب: {0}. عالج السبب ثم راسل إدارة المنصة لإظهاره. تعديلاتك هنا تُحفظ.', product.hiddenReason || t('غير مذكور'))}</div>
            </Banner>
          </div>
        )}

        <div className="g2">
          <div className="stack">
            <section className="card" aria-label={t('المعلومات الأساسية')}>
              <div className="card-h"><h2>{t('المعلومات الأساسية')}</h2></div>
              <div className="card-b stack" style={{ gap: 16 }}>
                <div className="fld">
                  <label htmlFor="p-name">{t('اسم المنتج')}</label>
                  <input id="p-name" className={`inp${showErr(errors.name) ? ' err' : ''}`} value={form.name} maxLength={200} onChange={(e) => set('name', e.target.value)} />
                  {showErr(errors.name) && <span className="errt">{errors.name}</span>}
                </div>
                <div className="row wrap" style={{ alignItems: 'flex-start' }}>
                  <div className="fld grow">
                    <label htmlFor="p-brand">{t('العلامة التجارية')}{' '}<span className="muted">{t('(اختياري)')}</span></label>
                    <input id="p-brand" className={`inp${errors.brand ? ' err' : ''}`} value={form.brand} maxLength={60} onChange={(e) => set('brand', e.target.value)} />
                    {brandHints.length > 0 && (
                      <div className="pills" aria-label={t('علامات استخدمتها من قبل')}>
                        {brandHints.map((b) => <button key={b} type="button" className="pill" style={{ height: 30 }} onClick={() => set('brand', b)}>{b}</button>)}
                      </div>
                    )}
                    {errors.brand && <span className="errt">{errors.brand}</span>}
                  </div>
                  <div className="fld grow">
                    <label htmlFor="p-sku">{t('رمز المنتج SKU')}{' '}<span className="muted">{t('(اختياري)')}</span></label>
                    <input id="p-sku" className={`inp ltr${errors.sku ? ' err' : ''}`} value={form.sku} maxLength={60} onChange={(e) => set('sku', e.target.value)} />
                    <span className="hint">{t('لربط المنتج بنظام المخزن عندك.')}</span>
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
                  <label htmlFor="p-desc">{t('الوصف')}{' '}<span className="muted">{t('(اختياري)')}</span></label>
                  <textarea id="p-desc" className="inp" rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} />
                </div>
              </div>
            </section>

            <section className="card" aria-label={t('الصور')}>
              <div className="card-h"><h2>{t('الصور')}</h2><span className="sub">{t('الأولى هي الرئيسية')}</span></div>
              <div className="card-b">
                <GalleryField urls={form.imageUrls} onChange={(u) => set('imageUrls', u)} folder={productImageFolder(companyId)} />
              </div>
            </section>

            <section className="card" aria-label={t('السعر')}>
              <div className="card-h"><h2>{t('السعر')}</h2></div>
              <div className="card-b stack" style={{ gap: 16 }}>
                <div className="row wrap">
                  <div className="seg" role="group" aria-label={t('طريقة التسعير')}>
                    <button type="button" className={form.priceMode === 'fixed' ? 'on' : ''} onClick={() => set('priceMode', 'fixed')}>{t('سعر بالجنيه')}</button>
                    <button type="button" className={form.priceMode === 'usd' ? 'on' : ''} onClick={() => set('priceMode', 'usd')}>{t('سعر بالدولار')}</button>
                    <button type="button" className={form.priceMode === 'onRequest' ? 'on' : ''} onClick={() => set('priceMode', 'onRequest')}>{t('السعر عند الطلب')}</button>
                  </div>
                  <span className="hint">{t('«عند الطلب»: يتواصل العميل معك بدل الشراء المباشر.')}</span>
                </div>
                {form.priceMode === 'usd' && usdRate === null && (
                  <Banner tone="warn" icon="alert" tight action={<Link to="/" className="btn sm">{t('إلى صفحة اليوم')}</Link>}>
                    {t('حدّد سعر الدولار أولًا من بطاقة «سعر الدولار» في صفحة اليوم.')}
                  </Banner>
                )}
                {form.priceMode === 'usd' && usdRate !== null && (
                  <div className="fld" style={{ maxWidth: 320 }}>
                    <label htmlFor="p-usd">{t('السعر بالدولار')}</label>
                    <div className="sfx"><input id="p-usd" className={`inp ltr${showErr(errors.price) ? ' err' : ''}`} inputMode="decimal" value={form.usd} onChange={(e) => set('usd', e.target.value)} /><span>$</span></div>
                    {draft.price !== null && <span className="hint num">{t('= {0} SDG بسعر 1$ = {1}', money(draft.price), usdText(usdRate))}</span>}
                  </div>
                )}
                {form.priceMode === 'fixed' && (
                  <div className="fld" style={{ maxWidth: 320 }}>
                    <label htmlFor="p-price">{t('السعر')}</label>
                    <div className="sfx"><input id="p-price" className={`inp ltr${showErr(errors.price) ? ' err' : ''}`} inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value)} /><span>SDG</span></div>
                  </div>
                )}
                {showErr(errors.price) && <span className="errt">{errors.price}</span>}
                {product && (offerActive || hasEndedOffer(product)) && (
                  <Banner tone={offerActive ? 'info' : 'warn'} icon="tag" tight action={<Link to="/offers" className="btn sm">{t('إدارة العروض')}</Link>}>
                    {offerActive
                      ? <>{t('عليه عرض جارٍ:')}{' '}<b className="num">{money(product.offerPrice)}</b>{' '}{t('(خصم {0}%).', discountPercent(product))}</>
                      : <>{t('انتهى عرضه. إن غيّرت السعر إلى ما يساوي سعر العرض أو أقل أُزيل العرض المنتهي.')}</>}
                  </Banner>
                )}
              </div>
            </section>

            <section className="card" aria-label={t('التوصيل والتركيب')}>
              <div className="card-h"><h2>{t('التوصيل والتركيب')}</h2></div>
              <div className="card-b stack" style={{ gap: 14 }}>
                <div className="row">
                  <Switch on={form.delivery} onChange={(v) => set('delivery', v)} label={t('التوصيل متاح')} />
                  <div className="grow"><div className="b">{t('التوصيل متاح')}</div><div className="sub">{t('إن أُطفئ يستلم العميل من نقاط الاستلام فقط')}</div></div>
                </div>
                <div className="row wrap">
                  <Switch on={form.installation} onChange={(v) => set('installation', v)} label={t('التركيب متاح')} />
                  <div className="grow"><div className="b">{t('التركيب متاح')}</div><div className="sub">{t('يظهر خيار التركيب للعميل ويحتاج فنيًا بعد تأكيد الدفع')}</div></div>
                  {form.installation && form.priceMode === 'usd' && (
                    <div className="fld" style={{ width: 200 }}>
                      <div className="sfx"><input className={`inp ltr${showErr(errors.installationPrice) ? ' err' : ''}`} inputMode="decimal" aria-label={t('سعر التركيب بالدولار')} value={form.installationUsd} onChange={(e) => set('installationUsd', e.target.value)} /><span>$</span></div>
                      {draft.installationPrice !== null && usdRate !== null && <span className="hint num">{t('= {0} SDG', money(draft.installationPrice))}</span>}
                    </div>
                  )}
                  {form.installation && form.priceMode !== 'usd' && (
                    <div className="fld" style={{ width: 200 }}>
                      <div className="sfx"><input className={`inp ltr${showErr(errors.installationPrice) ? ' err' : ''}`} inputMode="decimal" aria-label={t('سعر التركيب')} value={form.installationPrice} onChange={(e) => set('installationPrice', e.target.value)} /><span>SDG</span></div>
                    </div>
                  )}
                </div>
                {showErr(errors.installationPrice) && <span className="errt">{errors.installationPrice}</span>}
              </div>
            </section>

            <section className="card" aria-label={t('المواصفات')}>
              <div className="card-h"><h2>{t('المواصفات')}</h2><span className="sub">{t('اسم وقيمة لكل سطر')}</span></div>
              <div className="card-b stack t">
                {form.specs.length === 0 && <p className="muted">{t('لا مواصفات بعد.')}</p>}
                {form.specs.map((r, i) => (
                  <div key={r.id}>
                    <div className="row">
                      <span className="row" style={{ gap: 0 }}>
                        <button type="button" className="icon-btn flat" style={{ width: 28 }} aria-label={t('تقديم المواصفة')} disabled={i === 0} onClick={() => moveSpec(i, -1)}><Icon name="arrowUp" size="sm" /></button>
                        <button type="button" className="icon-btn flat" style={{ width: 28 }} aria-label={t('تأخير المواصفة')} disabled={i === form.specs.length - 1} onClick={() => moveSpec(i, 1)}><span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Icon name="arrowUp" size="sm" /></span></button>
                      </span>
                      <input className={`inp${errors.specs[r.id] ? ' err' : ''}`} style={{ maxWidth: 220 }} aria-label={t('اسم المواصفة')} placeholder={t('المعالج')} value={r.key} onChange={(e) => specPatch(r.id, { key: e.target.value })} />
                      <input className={`inp${errors.specs[r.id] ? ' err' : ''}`} aria-label={t('قيمة المواصفة')} placeholder="Intel Core i5" value={r.value} onChange={(e) => specPatch(r.id, { value: e.target.value })} />
                      <button type="button" className="icon-btn flat" aria-label={t('حذف المواصفة')} onClick={() => setForm((f) => ({ ...f, specs: f.specs.filter((x) => x.id !== r.id) }))}><Icon name="trash" /></button>
                    </div>
                    {errors.specs[r.id] && <span className="errt" style={{ marginTop: 4 }}><Icon name="alert" size="sm" />{errors.specs[r.id]}</span>}
                  </div>
                ))}
                <div><button type="button" className="btn sm" onClick={addSpec}><Icon name="plus" size="sm" />{t('إضافة مواصفة')}</button></div>
              </div>
            </section>
          </div>

          <div className="stack">
            <section className="card" aria-label={t('الحالة والظهور')}>
              <div className="card-h"><h3>{t('الحالة والظهور')}</h3></div>
              <div className="card-b stack" style={{ gap: 14 }}>
                <div className="seg full" role="group" aria-label={t('حالة المنتج')}>
                  {([['draft', t('مسودة')], ['published', t('منشور')], ['archived', t('مؤرشف')]] as const).map(([s, label]) => (
                    <button key={s} type="button" className={form.status === s ? 'on' : ''} aria-pressed={form.status === s} onClick={() => set('status', s)}>{label}</button>
                  ))}
                </div>
                <p className="hint">
                  {form.status === 'published' ? t('المنشور يظهر للعملاء ما دام مخزونه أكبر من صفر.') : form.status === 'draft' ? t('المسودة لا يراها العملاء ولا يطلبونها، وتبقى هنا حتى تنشرها.') : t('المؤرشف يختفي عن العملاء وتبقى طلباته السابقة، ويمكنك إرجاعه في أي وقت.')}
                </p>
                <div className="row">
                  <Switch on={form.inStock} onChange={(v) => set('inStock', v)} label={t('متاح للشراء')} />
                  <div className="grow"><div className="b">{t('متاح للشراء')}</div><div className="sub">{t('إن أُطفئ يظهر المنتج (إن كان منشورًا) ولا يُطلب')}</div></div>
                </div>
              </div>
            </section>

            <section className="card" aria-label={t('المخزون')}>
              <div className="card-h"><h3>{t('المخزون')}</h3></div>
              <div className="card-b stack" style={{ gap: 12 }}>
                {creating ? (
                  <div className="fld">
                    <label htmlFor="p-stock">{t('الكمية المتوفرة الآن')}</label>
                    <input id="p-stock" className={`inp ltr${showErr(errors.stock) ? ' err' : ''}`} inputMode="numeric" value={form.stock} onChange={(e) => set('stock', e.target.value)} />
                    {showErr(errors.stock) && <span className="errt">{errors.stock}</span>}
                  </div>
                ) : (
                  <>
                    <div className="row">
                      <div className="grow"><div className="sub">{t('المتوفر الآن')}</div><div className="b" style={{ fontSize: 34, lineHeight: 1.1 }}>{product.stockCount}</div></div>
                      <button type="button" className="btn" onClick={() => setStockOpen(true)}>{t('تعديل الكمية…')}</button>
                    </div>
                    {demand > 0 && <Banner tone="warn" icon="alert" tight><b>{t('{0} مطلوبة', unitsText(demand))}</b>{' '}{t('في طلبات تنتظر تأكيد الدفع.')}</Banner>}
                    <p className="hint">{t('الحفظ هنا لا يلمس رقم المخزون أبدًا. كل تعديل للكمية يتم من الزر أعلاه ويُحسب على الرقم الحالي.')}</p>
                  </>
                )}
                <div className="fld">
                  <label htmlFor="p-low">{t('نبّهني عندما يصل المخزون إلى')}{' '}<span className="muted">{t('(اختياري)')}</span></label>
                  <div className="sfx"><input id="p-low" className={`inp ltr${errors.threshold ? ' err' : ''}`} inputMode="numeric" placeholder={t('{0} (الحد العام)', LOW_STOCK_THRESHOLD)} value={form.threshold} onChange={(e) => set('threshold', e.target.value)} /><span>{t('وحدات')}</span></div>
                  {errors.threshold && <span className="errt">{errors.threshold}</span>}
                </div>
              </div>
            </section>

            <section className="card" aria-label={t('كما يراه العميل')}>
              <div className="card-h"><h3>{t('كما يراه العميل')}</h3></div>
              <div className="card-b">
                <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ height: 170, background: 'var(--neutral-bg)', display: 'grid', placeItems: 'center', color: 'var(--muted)', position: 'relative' }}>
                    {form.imageUrls[0] ? <img src={form.imageUrls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="image" size="lg" />}
                    {offerActive && product && <span className="chip c-bad nd" style={{ position: 'absolute', top: 10, insetInlineStart: 10, background: 'var(--bad-solid)', color: '#fff' }}>{t('خصم {0}%', discountPercent(product))}</span>}
                  </div>
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div className="b">{form.name || t('اسم المنتج')}</div>
                    <div className="sub">{companyName}</div>
                    <div className="row">
                      {sale === null ? <b className="muted">{t('السعر عند الطلب')}</b> : <b style={{ fontSize: 17, color: 'var(--brand-ink)' }}><span className="num">{money(sale)}</span> SDG</b>}
                      {offerActive && draft.price !== null && <s className="sub num">{money(draft.price)}</s>}
                    </div>
                    <div className="row wrap" style={{ gap: 6 }}>
                      {form.status !== 'published' ? <Chip tone="n" dot={false}>{form.status === 'draft' ? t('لا يراه العملاء (مسودة)') : t('لا يراه العملاء (مؤرشف)')}</Chip> : form.inStock ? <Chip tone="ok" dot={false}>{t('متاح')}</Chip> : <Chip tone="n" dot={false}>{t('غير متاح')}</Chip>}
                      {form.delivery ? <Chip tone="n" dot={false}>{t('توصيل')}</Chip> : <Chip tone="info" dot={false}>{t('استلام فقط')}</Chip>}
                      {form.installation && <Chip tone="n" dot={false}>{t('تركيب')}</Chip>}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
        {saveError && <div style={{ marginTop: 16 }}><Banner tone="bad" icon="alert">{saveError}</Banner></div>}
      </main>

      <div className="sticky-bar" role="region" aria-label={t('شريط الحفظ')}>
        <Icon name={dirty ? 'alert' : 'check'} />
        <div className="grow">
          {creating
            ? <span className="muted">{form.status === 'published' ? t('سيظهر المنتج للعملاء ما دام مخزونه أكبر من صفر.') : form.status === 'draft' ? t('سيُحفظ كمسودة ولن يراه العملاء حتى تنشره.') : t('سيُحفظ مؤرشفًا ولن يراه العملاء.')}</span>
            : dirty
              ? <><b>{changes.length} {changes.length === 1 ? t('حقل تغيّر') : t('حقول تغيّرت')}:</b> {[...new Set(changes.filter((k) => !(k === 'imageUrl' && changes.includes('imageUrls'))).map((k) => LABELS[k]))].join(' · ')} <span className="muted">{t('· المخزون لا يتأثر بالحفظ')}</span></>
              : <span className="muted">{t('لا تغييرات غير محفوظة.')}</span>}
          {tried && hasErrors(errors) && <span className="errt" style={{ marginTop: 2 }}>{t('راجع الحقول المظلّلة بالأحمر أولًا.')}</span>}
        </div>
        {!creating && <button type="button" className="btn" disabled={!dirty || busy} onClick={() => { setForm(base); setTried(false); }}>{t('تجاهل التغييرات')}</button>}
        <button type="button" className="btn p" disabled={busy || (!creating && !dirty)} onClick={() => void save()}>
          {busy && <Spinner />}
          {creating ? t('إضافة المنتج') : t('حفظ التغييرات')}
        </button>
      </div>
      {stockOpen && product && <StockDialog product={product} demand={demand} onClose={() => setStockOpen(false)} />}
    </>
  );
}
