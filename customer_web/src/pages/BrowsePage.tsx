import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Breadcrumbs, EmptyState, ErrorState, Skeleton } from '../components/Bits';
import { Icon, PATHS } from '../components/Icon';
import { ProductCard } from '../components/ProductCard';
import { ServiceCard } from '../components/ServiceCard';
import {
  brandsOf,
  countTotal,
  filterListings,
  filterProducts,
  filtersActive,
  sortProducts,
} from '../data/browse';
import type { BrowseFilters, BrowseKind, ProductSort } from '../data/browse';
import { useCatalog } from '../data/DataProvider';
import { categoryName, productsCount, servicesCount } from '../data/format';
import type { Product, ServiceListing } from '../data/types';

const PAGE = 24;

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'الأحدث' },
  { value: 'priceLow', label: 'السعر: من الأقل' },
  { value: 'priceHigh', label: 'السعر: من الأعلى' },
  { value: 'topRated', label: 'الأعلى تقييمًا' },
];

function numberParam(value: string | null): number | null {
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** The filters live in the address, so a list can be shared and Back restores it. */
function readFilters(p: URLSearchParams): BrowseFilters {
  const kind = p.get('kind');
  return {
    kind: kind === 'products' || kind === 'services' ? kind : 'all',
    offers: p.get('offers') === '1',
    inStock: p.get('stock') === '1',
    delivery: p.get('delivery') === '1',
    installation: p.get('install') === '1',
    topRated: p.get('rated') === '1',
    brand: p.get('brand'),
    companyId: p.get('company'),
    minPrice: numberParam(p.get('min')),
    maxPrice: numberParam(p.get('max')),
  };
}

function readSort(p: URLSearchParams): ProductSort {
  return SORTS.find((s) => s.value === p.get('sort'))?.value ?? 'newest';
}

/** The companies behind [products] and [listings], A to Z. */
function companiesOf(products: Product[], listings: ServiceListing[]) {
  const names = new Map<string, string>();
  for (const p of products) if (p.companyId && !names.has(p.companyId)) names.set(p.companyId, p.companyName || p.companyId);
  for (const l of listings) for (const [id, c] of l.companies) if (!names.has(id)) names.set(id, c.name);
  return [...names].map(([id, name]) => ({ id, name })).sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
}

function PriceFilter({ filters, onApply }: { filters: BrowseFilters; onApply: (min: number | null, max: number | null) => void }) {
  const [min, setMin] = useState(filters.minPrice?.toString() ?? '');
  const [max, setMax] = useState(filters.maxPrice?.toString() ?? '');
  useEffect(() => {
    setMin(filters.minPrice?.toString() ?? '');
    setMax(filters.maxPrice?.toString() ?? '');
  }, [filters.minPrice, filters.maxPrice]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const a = numberParam(min.trim());
    const b = numberParam(max.trim());
    if (a !== null && b !== null && a > b) onApply(b, a);
    else onApply(a, b);
  }
  return (
    <form className="price-filter" onSubmit={submit}>
      <input inputMode="decimal" placeholder="من" aria-label="السعر من" value={min} onChange={(e) => setMin(e.target.value)} dir="ltr" />
      <input inputMode="decimal" placeholder="إلى" aria-label="السعر إلى" value={max} onChange={(e) => setMax(e.target.value)} dir="ltr" />
      <button type="submit" className="mini-btn">تطبيق</button>
    </form>
  );
}

export function BrowsePage() {
  const { id } = useParams();
  const { tree, products: allProducts, listings: allListings, ratings, counts, servingIds, loading, error } = useCatalog();
  const [params, setParams] = useSearchParams();
  const [panelOpen, setPanelOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const filters = useMemo(() => readFilters(params), [params]);
  const sort = readSort(params);
  const paramsText = params.toString();

  useEffect(() => setLimit(PAGE), [id, paramsText]);

  const current = id ? tree.byId(id) : undefined;
  const scope = useMemo(() => (id ? tree.subtreeIds(id) : null), [id, tree]);
  const products = useMemo(
    () => (scope ? allProducts.filter((p) => p.categoryId !== null && scope.has(p.categoryId)) : allProducts),
    [scope, allProducts],
  );
  const listings = useMemo(
    () => (scope ? allListings.filter((l) => scope.has(l.service.categoryId)) : allListings),
    [scope, allListings],
  );
  const shownProducts = useMemo(() => {
    const serves = servingIds
      ? (p: Product) => p.companyId === '' || servingIds.has(p.companyId)
      : undefined;
    return sortProducts(filterProducts(products, filters, ratings), sort, ratings, serves);
  }, [products, filters, ratings, sort, servingIds]);
  const shownListings = useMemo(() => filterListings(listings, filters), [listings, filters]);
  const brands = useMemo(() => brandsOf(products), [products]);
  const companies = useMemo(() => companiesOf(products, listings), [products, listings]);

  if (error) return <main className="stack"><ErrorState /></main>;
  if (loading) return <main className="stack"><Skeleton height={120} /><Skeleton height={420} /></main>;
  if (id && (!current || !tree.isEffectivelyActive(id))) {
    return (
      <main className="stack">
        <EmptyState title="القسم غير متاح" message="هذا التصنيف لم يعد متاحاً. اختر تصنيفاً آخر.">
          <Link to="/browse" className="pill">تصفح الكل</Link>
        </EmptyState>
      </main>
    );
  }

  function update(change: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params);
    change(next);
    setParams(next, { replace: true });
  }
  const setFlag = (key: string, on: boolean) => update((n) => (on ? n.set(key, '1') : n.delete(key)));
  const setValue = (key: string, value: string) => update((n) => (value ? n.set(key, value) : n.delete(key)));
  const clearFilters = () =>
    update((n) => ['offers', 'stock', 'delivery', 'install', 'rated', 'brand', 'company', 'min', 'max'].forEach((k) => n.delete(k)));

  const hasBoth = products.length > 0 && listings.length > 0;
  const nothingHere = products.length === 0 && listings.length === 0;
  const nothingMatches = shownProducts.length === 0 && shownListings.length === 0;

  // A category with sub-categories lists them; a last-level one its siblings.
  const shownChildren = (parent: string | null) =>
    tree.activeChildrenOf(parent).filter((c) => counts === null || countTotal(counts.get(c.id)) > 0);
  const children = id ? shownChildren(id) : shownChildren(null);
  const chipParent = children.length > 0 ? (id ?? null) : (current?.parentId ?? null);
  const chips = children.length > 0 ? children : current?.parentId ? shownChildren(current.parentId) : [];
  const title = current
    ? categoryName(current)
    : filters.kind === 'services' ? 'الخدمات' : filters.offers ? 'العروض' : 'كل المنتجات';

  const crumbs = [
    { label: 'كل التصنيفات', to: '/browse' },
    ...(current
      ? tree.pathOf(current.id).map((c) => ({
          label: categoryName(c),
          to: c.id === current.id ? undefined : `/category/${c.id}`,
        }))
      : []),
  ];

  return (
    <main className="stack">
      <section className="tile browse-head">
        {id && <Breadcrumbs items={crumbs} />}
        <h1>{title}</h1>
        {chips.length > 0 && (
          <div className="chips">
            <Link to={chipParent ? `/category/${chipParent}` : '/browse'} className={`chip-link${chipParent === (id ?? null) ? ' on' : ''}`}>
              الكل{chipParent && counts ? ` (${countTotal(counts.get(chipParent))})` : ''}
            </Link>
            {chips.map((c) => (
              <Link key={c.id} to={`/category/${c.id}`} className={`chip-link${c.id === id ? ' on' : ''}`}>
                {categoryName(c)}{counts ? ` (${countTotal(counts.get(c.id))})` : ''}
              </Link>
            ))}
          </div>
        )}
      </section>

      {nothingHere ? (
        <EmptyState title="لا يوجد شيء هنا بعد." />
      ) : (
        <div className="browse-grid">
          <aside className={`tile filters${panelOpen ? ' open' : ''}`} aria-label="الفلاتر">
            <div className="filters-head">
              <strong>الفلاتر</strong>
              {filtersActive(filters) && <button className="link-btn" onClick={clearFilters}>مسح الفلاتر</button>}
            </div>
            {hasBoth && (
              <fieldset>
                <legend>النوع</legend>
                {(['all', 'products', 'services'] as BrowseKind[]).map((k) => (
                  <label key={k} className="check">
                    <input type="radio" name="kind" checked={filters.kind === k} onChange={() => setValue('kind', k === 'all' ? '' : k)} />
                    {k === 'all' ? 'الكل' : k === 'products' ? 'المنتجات' : 'الخدمات'}
                  </label>
                ))}
              </fieldset>
            )}
            <fieldset>
              <legend>تضييق النتائج</legend>
              <label className="check"><input type="checkbox" checked={filters.offers} onChange={(e) => setFlag('offers', e.target.checked)} />عروض</label>
              {products.length > 0 && (
                <label className="check"><input type="checkbox" checked={filters.inStock} onChange={(e) => setFlag('stock', e.target.checked)} />متوفر</label>
              )}
              {!id && (
                <>
                  <label className="check"><input type="checkbox" checked={filters.delivery} onChange={(e) => setFlag('delivery', e.target.checked)} />توصيل</label>
                  <label className="check"><input type="checkbox" checked={filters.installation} onChange={(e) => setFlag('install', e.target.checked)} />تركيب</label>
                  <label className="check"><input type="checkbox" checked={filters.topRated} onChange={(e) => setFlag('rated', e.target.checked)} />الأعلى تقييمًا</label>
                </>
              )}
            </fieldset>
            <fieldset>
              <legend>السعر</legend>
              <PriceFilter
                filters={filters}
                onApply={(min, max) =>
                  update((n) => {
                    if (min === null) n.delete('min'); else n.set('min', String(min));
                    if (max === null) n.delete('max'); else n.set('max', String(max));
                  })
                }
              />
            </fieldset>
            {brands.length > 0 && (
              <label className="select-field">
                الماركة
                <select value={filters.brand ?? ''} onChange={(e) => setValue('brand', e.target.value)}>
                  <option value="">كل الماركات</option>
                  {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
            )}
            {(companies.length > 1 || filters.companyId !== null) && (
              <label className="select-field">
                الشركة
                <select value={filters.companyId ?? ''} onChange={(e) => setValue('company', e.target.value)}>
                  <option value="">كل الشركات</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
          </aside>

          <section className="results" aria-label="النتائج">
            <div className="results-bar">
              <button className="mini-btn filters-toggle" onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen}>
                <Icon d={PATHS.grid} size={16} />
                الفلاتر
              </button>
              <span className="grow pmeta">
                {shownProducts.length > 0 && productsCount(shownProducts.length)}
                {shownProducts.length > 0 && shownListings.length > 0 && ' · '}
                {shownListings.length > 0 && servicesCount(shownListings.length)}
              </span>
              {products.length > 0 && (
                <label className="sort">
                  <span className="pmeta">ترتيب:</span>
                  <select value={sort} onChange={(e) => setValue('sort', e.target.value === 'newest' ? '' : e.target.value)}>
                    {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
              )}
            </div>

            {nothingMatches ? (
              <EmptyState title="لا شيء يطابق هذه الفلاتر.">
                <button className="pill" onClick={clearFilters}>مسح الفلاتر</button>
              </EmptyState>
            ) : (
              <>
                {shownProducts.length > 0 && (
                  <>
                    <div className="pcards">
                      {shownProducts.slice(0, limit).map((p) => <ProductCard key={p.id} product={p} />)}
                    </div>
                    {shownProducts.length > limit && (
                      <div className="center">
                        <button className="pill" onClick={() => setLimit((n) => n + PAGE)}>عرض المزيد</button>
                      </div>
                    )}
                  </>
                )}
                {shownListings.length > 0 && (
                  <div className="service-list">
                    {shownProducts.length > 0 && <h2>الخدمات ({shownListings.length})</h2>}
                    {shownListings.map((l) => <ServiceCard key={l.service.id} service={l.service} />)}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
