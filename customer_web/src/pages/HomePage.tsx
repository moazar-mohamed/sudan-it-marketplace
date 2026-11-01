import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, PriceText, RatingLine, Skeleton } from '../components/Bits';
import { CompanyLogo } from '../components/CompanyCard';
import { Icon, PATHS } from '../components/Icon';
import { ProductCard } from '../components/ProductCard';
import { openPalette } from '../components/Shell';
import { companyRating, countTotal, sortProducts } from '../data/browse';
import { useCatalog } from '../data/DataProvider';
import { categoryColor, categoryName, hasActiveOffer, iconPath, offerLabel, productsCount, ratingKey } from '../data/format';
import type { Product } from '../data/types';

export function HomePage() {
  const { tree, products, companies, ratings, counts, servingIds, loading, error } = useCatalog();
  if (error) return <main className="stack"><ErrorState /></main>;

  const roots = tree.activeChildrenOf(null);
  const offers = products.filter((p) => hasActiveOffer(p));
  const serves = servingIds ? (p: Product) => p.companyId === '' || servingIds.has(p.companyId) : undefined;
  const newest = sortProducts(products, 'newest', ratings, serves);
  const featured = offers[0] ?? newest[0];
  const fresh = newest.filter((p) => p.id !== featured?.id).slice(0, 8);
  const topCompanies = [...companies]
    .sort((a, b) => {
      const ra = companyRating(a, ratings);
      const rb = companyRating(b, ratings);
      return rb.average - ra.average || rb.count - ra.count;
    })
    .slice(0, 4);

  return (
    <main className="bento">
      <section className="tile hero s8 r2">
        <span className="orb" style={{ insetInlineEnd: -80, top: -60, width: 360, height: 360, background: '#1565C0' }} />
        <span className="orb" style={{ insetInlineEnd: 60, bottom: -110, width: 280, height: 280, background: '#00A8E8' }} />
        <div style={{ position: 'relative', maxWidth: 520 }}>
          <span className="chip">سوق السودان للتقنية</span>
          <h1>كل التقنية<br />في مكان واحد</h1>
        </div>
        <div style={{ position: 'relative' }}>
          <p style={{ margin: '0 0 16px', opacity: 0.92, fontSize: 17 }}>منتجات وشركات وخدمات في مدينتك. اطلب مباشرة وتواصل مع الشركة.</p>
          <button className="hero-search" onClick={openPalette}>
            <Icon d={PATHS.search} />
            <span className="grow" style={{ textAlign: 'start' }}>ابحث عن منتجات وخدمات وشركات</span>
            <span className="kbd">Ctrl K</span>
          </button>
        </div>
      </section>

      <Link to="/browse?kind=services" className="tile s4 tile-services">
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#005F80' }}>خدمات</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, lineHeight: 1.3 }}>اطلب فنيًا<br />لخدمتك</div>
        </div>
        <span className="icon-btn" style={{ background: '#101828', color: '#fff', border: 0 }}><Icon d={PATHS.arrow} /></span>
      </Link>

      <Link to="/orders" className="tile s4 tile-orders">
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#7BD3F2' }}>طلباتي</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, lineHeight: 1.3 }}>تابع حالة طلباتك<br />ومحادثاتك</div>
        </div>
        <span className="icon-btn" style={{ background: '#00A8E8', color: '#06263A', border: 0 }}><Icon d={PATHS.arrow} /></span>
      </Link>

      <section className="tile s8">
        <div className="tile-head">
          <h2>الأقسام</h2>
          <Link to="/browse" className="more">الكل ←</Link>
        </div>
        {loading ? (
          <Skeleton height={120} />
        ) : roots.length === 0 ? (
          <div className="empty">لا أقسام بعد</div>
        ) : (
          <div className="cat-grid">
            {roots.map((c) => {
              const color = categoryColor(c);
              const count = counts ? countTotal(counts.get(c.id)) : null;
              return (
                <Link key={c.id} to={`/category/${c.id}`} className="cat" style={{ background: `${color}1f` }}>
                  <span style={{ color }}><Icon d={iconPath(c.iconName)} size={30} /></span>
                  <span>{categoryName(c)}</span>
                  {count !== null && count > 0 && <span className="pmeta">{count} عنصر</span>}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {featured && (
        <Link to={`/product/${featured.id}`} className="tile s4 r2 tile-featured">
          <div className="pimg" style={{ flex: 1, minHeight: 280, borderRadius: 0 }}>
            {featured.imageUrl ? <img src={featured.imageUrl} alt="" /> : <Icon d={PATHS.box} size={110} />}
            <span className="badge">{hasActiveOffer(featured) ? offerLabel(featured) : 'جديد'}</span>
          </div>
          <div style={{ padding: '22px 26px 26px' }}>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{featured.name}</div>
            <div className="pmeta">{featured.companyName}</div>
            <div className="prow">
              <PriceText item={featured} currency={featured.currency} big />
              <span className="pill">عرض</span>
            </div>
          </div>
        </Link>
      )}

      <section className="tile s4">
        <div className="tile-head">
          <h2>شركات موثوقة</h2>
          <Link to="/companies" className="more">الكل ←</Link>
        </div>
        {loading ? (
          <Skeleton height={120} />
        ) : topCompanies.length === 0 ? (
          <div className="empty">لا شركات بعد</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {topCompanies.map((co) => (
              <Link key={co.id} to={`/company/${co.id}`} className="company-row">
                <CompanyLogo company={co} />
                <span className="grow">
                  <span style={{ display: 'block', fontWeight: 700 }}>{co.name}</span>
                  <span className="pmeta">{co.city}</span>
                </span>
                <RatingLine ratingsFor={ratingKey('company', co.id)} fallbackAverage={co.rating} fallbackCount={co.reviewCount} showCount={false} />
              </Link>
            ))}
          </div>
        )}
      </section>

      {offers.length > 0 && (
        <section className="tile s4" style={{ background: 'var(--warn-bg)', border: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn)' }}>عروض الآن</div>
          <div style={{ fontSize: 24, fontWeight: 800, margin: '6px 0 18px', lineHeight: 1.3 }}>{productsCount(offers.length)} بأسعار مخفضة</div>
          <Link to="/browse?offers=1" className="pill">شاهد العروض</Link>
        </section>
      )}

      <section className="s12">
        <div className="section-title">
          <h2>أحدث المنتجات</h2>
          <Link to="/browse" className="more">عرض الكل ←</Link>
        </div>
        {loading ? (
          <Skeleton height={260} />
        ) : fresh.length === 0 ? (
          <EmptyState title="لا منتجات بعد" />
        ) : (
          <div className="pcards">
            {fresh.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>
    </main>
  );
}
