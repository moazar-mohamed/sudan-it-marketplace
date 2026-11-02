import { useEffect, useMemo, useState } from 'react';
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
import { categoryColor, categoryName, iconPath, productsCount, servicesCount } from '../data/format';
import type { Product, ServiceListing } from '../data/types';
import { t } from '../i18n';

const PAGE = 24;

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: t('الأحدث') },
  { value: 'priceLow', label: t('السعر: من الأقل') },
  { value: 'priceHigh', label: t('السعر: من الأعلى') },
  { value: 'topRated', label: t('الأعلى تقييمًا') },
];

const KINDS: { value: BrowseKind; label: string }[] = [
  { value: 'all', label: t('الكل') },
  { value: 'products', label: t('المنتجات') },
  { value: 'services', label: t('الخدمات') },
];

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
    minPrice: null,
    maxPrice: null,
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

export function BrowsePage() {
  const { id } = useParams();
  const { tree, products: allProducts, listings: allListings, ratings, counts, servingIds, loading, error } = useCatalog();
  const [params, setParams] = useSearchParams();
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
        <EmptyState title={t('القسم غير متاح')} message={t('هذا التصنيف لم يعد متاحاً. اختر تصنيفاً آخر.')}>
          <Link to="/browse" className="pill">{t('تصفح الكل')}</Link>
        </EmptyState>
      </main>
    );
  }

  function update(change: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params);
    change(next);
    setParams(next, { replace: true });
  }
  const setValue = (key: string, value: string) => update((n) => (value ? n.set(key, value) : n.delete(key)));
  const clearFilters = () =>
    update((n) => ['offers', 'stock', 'delivery', 'install', 'rated', 'brand', 'company'].forEach((k) => n.delete(k)));

  const hasBoth = products.length > 0 && listings.length > 0;
  const nothingHere = products.length === 0 && listings.length === 0;
  const nothingMatches = shownProducts.length === 0 && shownListings.length === 0;

  const shownChildren = (parent: string | null) =>
    tree.activeChildrenOf(parent).filter((c) => counts === null || countTotal(counts.get(c.id)) > 0);
  const roots = shownChildren(null);
  const path = current ? tree.pathOf(current.id) : [];
  // A category with sub-categories lists them; a last-level one its siblings.
  const children = id ? shownChildren(id) : [];
  const chipParent = children.length > 0 ? (id ?? null) : (current?.parentId ?? null);
  const chips = children.length > 0 ? children : current?.parentId ? shownChildren(current.parentId) : [];
  const title = current
    ? categoryName(current)
    : filters.kind === 'services' ? t('الخدمات') : filters.offers ? t('العروض') : t('كل المنتجات');

  const crumbs = [
    { label: t('كل التصنيفات'), to: '/browse' },
    ...path.map((c) => ({
      label: categoryName(c),
      to: c.id === current?.id ? undefined : `/category/${c.id}`,
    })),
  ];

  const toggles = [
    { key: 'offers', label: t('عروض'), on: filters.offers, shown: true },
    { key: 'stock', label: t('متوفر'), on: filters.inStock, shown: products.length > 0 },
    { key: 'delivery', label: t('توصيل'), on: filters.delivery, shown: true },
    { key: 'install', label: t('تركيب'), on: filters.installation, shown: true },
    { key: 'rated', label: t('الأعلى تقييمًا'), on: filters.topRated, shown: true },
  ];
  const companyName = companies.find((c) => c.id === filters.companyId)?.name ?? filters.companyId;
  const tags = [
    ...toggles.filter((t) => t.on),
    ...(filters.brand ? [{ key: 'brand', label: filters.brand }] : []),
    ...(filters.companyId ? [{ key: 'company', label: companyName ?? '' }] : []),
  ];

  return (
    <main className="stack">
      <h1 className="sr-only">{title}</h1>

      <nav className="cat-strip" aria-label={t('الأقسام')}>
        <Link to="/browse" className={`cat${id ? '' : ' on'}`}>
          <Icon d={PATHS.grid} size={24} />
          <span>{t('الكل')}</span>
        </Link>
        {roots.map((c) => {
          const on = path[0]?.id === c.id;
          const color = categoryColor(c);
          return (
            <Link key={c.id} to={`/category/${c.id}`} className={`cat${on ? ' on' : ''}`} style={on ? undefined : { background: `${color}1f` }}>
              <span style={{ color }}><Icon d={iconPath(c.iconName)} size={24} /></span>
              <span>{categoryName(c)}</span>
            </Link>
          );
        })}
      </nav>

      {path.length > 2 && <Breadcrumbs items={crumbs} />}

      {chips.length > 0 && (
        <div className="scroll-row">
          <Link to={`/category/${chipParent}`} className={`chip-link small${chipParent === id ? ' on' : ''}`}>
            {t('الكل')}{chipParent && counts ? ` (${countTotal(counts.get(chipParent))})` : ''}
          </Link>
          {chips.map((c) => (
            <Link key={c.id} to={`/category/${c.id}`} className={`chip-link small${c.id === id ? ' on' : ''}`}>
              {categoryName(c)}{counts ? ` (${countTotal(counts.get(c.id))})` : ''}
            </Link>
          ))}
        </div>
      )}

      {nothingHere ? (
        <EmptyState title={t('لا يوجد شيء هنا بعد.')} />
      ) : (
        <section className="results" aria-label={t('النتائج')}>
          <div className="scroll-row filter-row" role="group" aria-label={t('الفلاتر')}>
            {hasBoth && KINDS.map((k) => (
              <button
                key={k.value}
                className={`filter-pill${filters.kind === k.value ? ' on' : ''}`}
                aria-pressed={filters.kind === k.value}
                onClick={() => setValue('kind', k.value === 'all' ? '' : k.value)}
              >
                {k.label}
              </button>
            ))}
            {hasBoth && <span className="filter-gap" />}
            {toggles.filter((t) => t.shown).map((t) => (
              <button key={t.key} className={`filter-pill${t.on ? ' on' : ''}`} aria-pressed={t.on} onClick={() => setValue(t.key, t.on ? '' : '1')}>
                {t.label}
              </button>
            ))}
            {brands.length > 0 && (
              <select className={`filter-pill${filters.brand ? ' on' : ''}`} aria-label={t('الماركة')} value={filters.brand ?? ''} onChange={(e) => setValue('brand', e.target.value)}>
                <option value="">{t('الماركة')}</option>
                {brands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
            {(companies.length > 1 || filters.companyId !== null) && (
              <select className={`filter-pill${filters.companyId ? ' on' : ''}`} aria-label={t('الشركة')} value={filters.companyId ?? ''} onChange={(e) => setValue('company', e.target.value)}>
                <option value="">{t('الشركة')}</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {products.length > 0 && (
              <select className="filter-pill filter-sort" aria-label={t('ترتيب')} value={sort} onChange={(e) => setValue('sort', e.target.value === 'newest' ? '' : e.target.value)}>
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            )}
          </div>

          <div className="filter-tags">
            {tags.map((tag) => (
              <button key={tag.key} className="filter-tag" aria-label={t('إزالة {0}', tag.label)} onClick={() => setValue(tag.key, '')}>
                {tag.label} ✕
              </button>
            ))}
            {filtersActive(filters) && <button className="link-btn" onClick={clearFilters}>{t('مسح الكل')}</button>}
            <span className="grow" />
            <span className="pmeta">
              {shownProducts.length > 0 && productsCount(shownProducts.length)}
              {shownProducts.length > 0 && shownListings.length > 0 && ' · '}
              {shownListings.length > 0 && servicesCount(shownListings.length)}
            </span>
          </div>

          {nothingMatches ? (
            <EmptyState title={t('لا شيء يطابق هذه الفلاتر.')}>
              <button className="pill" onClick={clearFilters}>{t('مسح الفلاتر')}</button>
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
                      <button className="pill" onClick={() => setLimit((n) => n + PAGE)}>{t('عرض المزيد')}</button>
                    </div>
                  )}
                </>
              )}
              {shownListings.length > 0 && (
                <div className="service-list">
                  {shownProducts.length > 0 && <h2>{t('الخدمات (')}{shownListings.length})</h2>}
                  {shownListings.map((l) => <ServiceCard key={l.service.id} service={l.service} />)}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
