import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, Skeleton } from '../components/Bits';
import { CompanyCard } from '../components/CompanyCard';
import { Icon, PATHS } from '../components/Icon';
import { ProductCard } from '../components/ProductCard';
import { ServiceCard } from '../components/ServiceCard';
import { arrangeResults } from '../data/browse';
import type { SearchSort } from '../data/browse';
import { useCatalog } from '../data/DataProvider';
import { categoryName } from '../data/format';
import { marketplaceSearch } from '../data/marketplaceSearch';
import { addRecentSearch, clearRecentSearches, readRecentSearches, removeRecentSearch } from '../data/recentSearches';
import { suggestCorrection } from '../data/searchRanking';

type Scope = 'all' | 'products' | 'services' | 'companies';

/** How many of each kind "All" shows before "See all". */
const PREVIEW = 3;

const SORTS: { value: SearchSort; label: string }[] = [
  { value: 'relevance', label: 'الأنسب' },
  { value: 'priceLow', label: 'الأقل سعراً' },
  { value: 'priceHigh', label: 'الأعلى سعراً' },
];

function CategoryChips() {
  const { tree } = useCatalog();
  const categories = tree.activeChildrenOf(null);
  if (categories.length === 0) return null;
  return (
    <div>
      <h2 className="sub-title">تصفح الأقسام</h2>
      <div className="chips">
        {categories.map((c) => <Link key={c.id} to={`/category/${c.id}`} className="chip-link">{categoryName(c)}</Link>)}
      </div>
    </div>
  );
}

export function SearchPage() {
  const catalog = useCatalog();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [recent, setRecent] = useState(readRecentSearches);
  const [scope, setScope] = useState<Scope>('all');
  const [sort, setSort] = useState<SearchSort>('relevance');
  const [inStockOnly, setInStockOnly] = useState(false);

  const matched = useMemo(() => marketplaceSearch(q, catalog), [q, catalog]);
  const products = useMemo(() => arrangeResults(matched.products, sort, inStockOnly), [matched, sort, inStockOnly]);
  const total = products.length + matched.services.length + matched.companies.length;
  const empty = matched.products.length + matched.services.length + matched.companies.length === 0;

  function setQuery(text: string) {
    setScope('all');
    setParams(text ? { q: text } : {}, { replace: true });
  }
  function search(text: string) {
    setQuery(text);
    setRecent(addRecentSearch(text));
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    search(q.trim());
  }

  function group(title: string, count: number, target: Scope, children: (shown: number) => React.ReactNode) {
    if (count === 0 || (scope !== 'all' && scope !== target)) return null;
    const shown = scope === 'all' && count > PREVIEW ? PREVIEW : count;
    return (
      <section>
        {scope === 'all' && (
          <div className="section-title">
            <h2>{title}</h2>
            {count > PREVIEW && <button className="link-btn" onClick={() => setScope(target)}>عرض الكل ({count})</button>}
          </div>
        )}
        {children(shown)}
      </section>
    );
  }

  const guess = empty && q.trim() ? suggestCorrection(q, catalog.vocabulary) : null;
  const scopes: { value: Scope; label: string }[] = [
    { value: 'all', label: `الكل (${total})` },
    { value: 'products', label: `منتجات (${products.length})` },
    { value: 'services', label: `خدمات (${matched.services.length})` },
    { value: 'companies', label: `شركات (${matched.companies.length})` },
  ];

  return (
    <main className="stack">
      <form className="tile search-box" onSubmit={submit} role="search">
        <Icon d={PATHS.search} />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن منتجات وخدمات وشركات"
          aria-label="بحث"
        />
        {q && <button type="button" className="link-btn" onClick={() => setQuery('')}>مسح</button>}
      </form>

      {catalog.error ? (
        <ErrorState />
      ) : catalog.loading ? (
        <Skeleton height={320} />
      ) : !q.trim() ? (
        <section className="tile">
          {recent.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div className="tile-head">
                <h2>عمليات البحث الأخيرة</h2>
                <button className="link-btn" onClick={() => setRecent(clearRecentSearches())}>مسح</button>
              </div>
              {recent.map((text) => (
                <div key={text} className="recent-row">
                  <button className="recent" onClick={() => search(text)}>{text}</button>
                  <button className="link-btn" aria-label={`إزالة ${text}`} onClick={() => setRecent(removeRecentSearch(text))}>✕</button>
                </div>
              ))}
            </div>
          )}
          <CategoryChips />
        </section>
      ) : empty ? (
        <EmptyState title={`لا توجد نتائج لـ «${q.trim()}»`} message="تأكد من الإملاء، أو جرّب كلمة أقصر، أو تصفح أحد الأقسام.">
          {guess && <button className="pill" onClick={() => search(guess)}>هل تقصد «{guess}»؟</button>}
          <CategoryChips />
        </EmptyState>
      ) : (
        <>
          <div className="chips" role="tablist">
            {scopes.map((s) => (
              <button key={s.value} role="tab" aria-selected={scope === s.value} className={`chip-link${scope === s.value ? ' on' : ''}`} onClick={() => setScope(s.value)}>
                {s.label}
              </button>
            ))}
          </div>
          {matched.products.length > 0 && (scope === 'all' || scope === 'products') && (
            <div className="chips">
              {SORTS.map((s) => (
                <button key={s.value} className={`chip-link small${sort === s.value ? ' on' : ''}`} onClick={() => setSort(s.value)}>{s.label}</button>
              ))}
              <button className={`chip-link small${inStockOnly ? ' on' : ''}`} aria-pressed={inStockOnly} onClick={() => setInStockOnly((v) => !v)}>المتوفر فقط</button>
            </div>
          )}
          {group('المنتجات', products.length, 'products', (shown) => (
            <div className="pcards">
              {products.slice(0, shown).map((p) => <ProductCard key={p.id} product={p} highlight={q} />)}
            </div>
          ))}
          {group('الخدمات', matched.services.length, 'services', (shown) => (
            <div className="service-list">
              {matched.services.slice(0, shown).map((s) => <ServiceCard key={s.id} service={s} highlight={q} />)}
            </div>
          ))}
          {group('الشركات', matched.companies.length, 'companies', (shown) => (
            <div className="ccards">
              {matched.companies.slice(0, shown).map((c) => <CompanyCard key={c.id} company={c} highlight={q} />)}
            </div>
          ))}
          {scope !== 'all' &&
            (scope === 'products' ? products.length : scope === 'services' ? matched.services.length : matched.companies.length) === 0 && (
              <EmptyState title={`لا توجد نتائج لـ «${q.trim()}»`} />
            )}
        </>
      )}
    </main>
  );
}
