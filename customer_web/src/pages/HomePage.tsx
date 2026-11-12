import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState, ErrorState, Skeleton } from '../components/Bits';
import { CategoryGlyph } from '../components/CategoryGlyph';
import { CompanyCard } from '../components/CompanyCard';
import { Icon, PATHS } from '../components/Icon';
import { ProductCard } from '../components/ProductCard';
import { ServiceCard } from '../components/ServiceCard';
import { companyRating, countTotal, sortProducts } from '../data/browse';
import { useCatalog } from '../data/DataProvider';
import { featuredServices } from '../data/featuredServices';
import { categoryName, hasActiveOffer, itemsCount } from '../data/format';
import { siteStats } from '../data/homeStats';
import type { StatKey } from '../data/homeStats';
import type { Product } from '../data/types';
import { t } from '../i18n';

const STAT_LABELS: Record<StatKey, () => string> = {
  companies: () => t('شركات'),
  items: () => t('منتجات وخدمات'),
  cities: () => t('مدن'),
  reviews: () => t('تقييمات العملاء'),
};

/** What the hero offers to search for in one press. */
const quickWords = (): string[] => ['Cisco', t('راوتر'), t('كاميرات'), 'UPS', t('سيرفر')];

const searchPath = (q: string): string => (q.trim() === '' ? '/search' : `/search?q=${encodeURIComponent(q.trim())}`);

export function HomePage() {
  const { tree, products, listings, companies, ratings, counts, servingIds, loading, error } = useCatalog();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  if (error) return <main className="stack"><ErrorState /></main>;

  // Every active category is shown, an empty one too.
  const roots = tree.activeChildrenOf(null);
  const offers = products.filter((p) => hasActiveOffer(p)).slice(0, 4);
  const serves = servingIds ? (p: Product) => p.companyId === '' || servingIds.has(p.companyId) : undefined;
  const shownOffers = new Set(offers.map((p) => p.id));
  const fresh = sortProducts(products, 'newest', ratings, serves).filter((p) => !shownOffers.has(p.id)).slice(0, 8);
  const topCompanies = [...companies]
    .sort((a, b) => {
      const ra = companyRating(a, ratings);
      const rb = companyRating(b, ratings);
      return rb.average - ra.average || rb.count - ra.count;
    })
    .slice(0, 6);
  const stats = loading ? [] : siteStats(companies, products.length + listings.length, ratings);
  const featured = loading ? [] : featuredServices(listings);

  function submit(e: FormEvent) {
    e.preventDefault();
    navigate(searchPath(query));
  }

  return (
    <main className="home">
      <section className="home-hero">
        <div className="hero-inner">
          <h1>{t('كل التقنية')}<br />{t('في مكان واحد')}</h1>
          <p>{t('منتجات وشركات وخدمات في مدينتك. اطلب مباشرة وتواصل مع الشركة.')}</p>
          <form className="hero-search" role="search" onSubmit={submit}>
            <Icon d={PATHS.search} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('ابحث عن منتجات وخدمات وشركات')}
              aria-label={t('بحث')}
              autoComplete="off"
              enterKeyHint="search"
            />
            <button type="submit" className="hero-search-btn">{t('بحث')}</button>
          </form>
          <div className="hero-chips">
            {quickWords().map((w) => (
              <Link key={w} to={searchPath(w)} className="chip chip-quick">{w}</Link>
            ))}
          </div>
        </div>
      </section>

      {stats.length > 0 && (
        <section className="stat-band" aria-label={t('أرقام السوق')}>
          {stats.map((s) => (
            <div key={s.key}>
              <b>{s.value}</b>
              <span>{STAT_LABELS[s.key]()}</span>
            </div>
          ))}
        </section>
      )}

      {(loading || roots.length > 0) && (
        <section>
          <div className="section-title">
            <h2>{t('الأقسام الرئيسية')}</h2>
            <Link to="/browse" className="more">{t('عرض الكل ←')}</Link>
          </div>
          {loading ? (
            <Skeleton height={120} />
          ) : (
            <div className="cat-grid">
              {roots.map((c) => {
                const count = counts ? countTotal(counts.get(c.id)) : 0;
                return (
                  <Link key={c.id} to={`/category/${c.id}`} className="cat cat-card">
                    <span className="cat-ico"><CategoryGlyph category={c} size={30} /></span>
                    <span>{categoryName(c)}</span>
                    {count > 0 && <span className="pmeta">{itemsCount(count)}</span>}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      <Link to="/browse?kind=services" className="promo">
        <span className="promo-icon"><Icon d={PATHS.wrench} size={26} /></span>
        <span className="grow">
          <span className="promo-kicker">{t('خدمات')}</span>
          <span className="promo-title">{t('اطلب فنيًا')} {t('لخدمتك')}</span>
        </span>
        <span className="icon-btn promo-go"><Icon d={PATHS.arrow} /></span>
      </Link>

      {offers.length > 0 && (
        <section>
          <div className="section-title">
            <h2>{t('عروض مميزة')}</h2>
            <Link to="/browse?offers=1" className="more">{t('عرض الكل ←')}</Link>
          </div>
          <div className="pcards">
            {offers.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {(loading || fresh.length > 0 || offers.length === 0) && (
        <section>
          <div className="section-title">
            <h2>{t('أحدث المنتجات')}</h2>
            <Link to="/browse" className="more">{t('عرض الكل ←')}</Link>
          </div>
          {loading ? (
            <Skeleton height={260} />
          ) : fresh.length === 0 ? (
            <EmptyState title={t('لا منتجات بعد')} />
          ) : (
            <div className="pcards">
              {fresh.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </section>
      )}

      {featured.length > 0 && (
        <section>
          <div className="section-title">
            <h2>{t('خدمات مميزة')}</h2>
            <Link to="/browse?kind=services" className="more">{t('عرض الكل ←')}</Link>
          </div>
          <div className="service-list">
            {featured.map((l) => <ServiceCard key={l.service.id} service={l.service} />)}
          </div>
        </section>
      )}

      <section>
        <div className="section-title">
          <h2>{t('أفضل الشركات')}</h2>
          <Link to="/companies" className="more">{t('عرض الكل ←')}</Link>
        </div>
        {loading ? (
          <Skeleton height={120} />
        ) : topCompanies.length === 0 ? (
          <div className="empty">{t('لا شركات بعد')}</div>
        ) : (
          <div className="ccards">
            {topCompanies.map((co) => <CompanyCard key={co.id} company={co} />)}
          </div>
        )}
      </section>
    </main>
  );
}
