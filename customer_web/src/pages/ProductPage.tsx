import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Breadcrumbs, CityTag, EmptyState, ErrorState, OfferPill, PriceText, RatingLine, Skeleton } from '../components/Bits';
import { CompanyLogo } from '../components/CompanyCard';
import { Icon, PATHS } from '../components/Icon';
import { ReviewsSection } from '../components/ReviewsSection';
import { useCatalog } from '../data/DataProvider';
import {
  categoryColor,
  categoryName,
  formatDate,
  formatPrice,
  hasActiveOffer,
  iconPath,
  isAvailable,
  maxOrderQuantity,
  ratingKey,
  salePrice,
} from '../data/format';
import { useProductDoc } from '../data/hooks';
import { recordProductView } from '../data/usage';

export function ProductPage() {
  const { id = '' } = useParams();
  const { products, companies, tree, profile, loading, error } = useCatalog();
  const listed = products.find((p) => p.id === id);
  // A link can name a product that left the marketplace (sold out, its company
  // went inactive): it reads as out of stock, so it cannot be bought from here.
  const snapshot = useProductDoc(id, loading || !!listed);
  const product = listed ?? (snapshot && !snapshot.hidden ? { ...snapshot, stockCount: 0 } : undefined);
  const [quantity, setQuantity] = useState(1);

  const isCustomer = profile?.role === 'customer';
  useEffect(() => {
    if (listed && isCustomer) void recordProductView(listed.id);
  }, [listed?.id, isCustomer]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <main className="stack"><ErrorState /></main>;
  if (loading || (!listed && snapshot === undefined)) {
    return <main className="stack"><Skeleton height={520} /></main>;
  }
  if (!product) {
    return (
      <main className="stack">
        <EmptyState title="هذا المنتج لم يعد متاحًا">
          <Link to="/browse" className="pill">تصفح المنتجات</Link>
        </EmptyState>
      </main>
    );
  }

  const company = companies.find((c) => c.id === product.companyId);
  const category = tree.byId(product.categoryId);
  const path = category ? tree.pathOf(category.id) : [];
  const available = isAvailable(product);
  const max = maxOrderQuantity(product);
  const qty = max < 1 ? 1 : Math.min(quantity, max);
  const unit = salePrice(product);
  const total = unit === null ? null : unit * qty;
  const canBuy = available && product.price !== null;
  const specs = Object.entries(product.specifications);
  const description = product.description.trim();
  const companyName = product.companyName || company?.name || '';
  const color = categoryColor(category, product.id);

  return (
    <main className="stack">
      <Breadcrumbs
        items={[
          { label: 'كل التصنيفات', to: '/browse' },
          ...path.map((c) => ({ label: categoryName(c), to: `/category/${c.id}` })),
          { label: product.name },
        ]}
      />
      <div className="product-grid">
        <div className="product-media" style={product.imageUrl ? undefined : { background: `${color}1f`, color }}>
          {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <Icon d={category ? iconPath(category.iconName) : PATHS.box} size={120} />}
          {hasActiveOffer(product) && <OfferPill item={product} />}
        </div>

        <div className="product-info">
          <span className={available ? 'status ok' : 'status off'}>
            {available ? `متوفر (${product.stockCount})` : 'غير متوفر في المخزون'}
          </span>
          <h1>{product.name}</h1>
          <RatingLine ratingsFor={ratingKey('product', product.id)} />
          {(product.brand || path.length > 0) && (
            <div className="ptags">
              {product.brand && <span>{product.brand}</span>}
              {path.length > 0 && <span>{path.map(categoryName).join(' › ')}</span>}
            </div>
          )}
          <PriceText item={product} currency={product.currency} big />
          {hasActiveOffer(product) && product.offerEndsAt && (
            <span className="offer-ends">ينتهي في {formatDate(product.offerEndsAt)}</span>
          )}

          {company ? (
            <Link to={`/company/${company.id}`} className="company-box">
              <CompanyLogo company={company} size={48} />
              <span className="grow">
                <strong style={{ display: 'block' }}>{companyName}</strong>
                <RatingLine
                  ratingsFor={ratingKey('company', company.id)}
                  fallbackAverage={company.rating}
                  fallbackCount={company.reviewCount}
                />
              </span>
              <Icon d={PATHS.arrow} size={18} />
            </Link>
          ) : (
            companyName && (
              <div className="company-box">
                <span className="avatar">{companyName.slice(0, 1)}</span>
                <strong className="grow">{companyName}</strong>
              </div>
            )
          )}
          <CityTag companyId={product.companyId} />

          {product.isInstallationAvailable && (
            <div className="note">
              <Icon d={PATHS.wrench} />
              <span>
                <strong style={{ display: 'block' }}>خدمة التركيب الاحترافي متاحة</strong>
                سعر التركيب: {formatPrice(product.installationPrice ?? 0, product.currency)}. يتم اختيار خيار التركيب أثناء إتمام الطلب.
              </span>
            </div>
          )}

          <div className="buy-box">
            <div className="buy-row">
              <div className="stepper" role="group" aria-label="الكمية">
                <button aria-label="زيادة الكمية" disabled={qty >= max} onClick={() => setQuantity(qty + 1)}>+</button>
                <output aria-live="polite">{qty}</output>
                <button aria-label="تقليل الكمية" disabled={qty <= 1} onClick={() => setQuantity(qty - 1)}>−</button>
              </div>
              <span className="total">
                {total !== null && <span className="pmeta">الإجمالي</span>}
                <strong>{total === null ? 'السعر عند التواصل' : formatPrice(total, product.currency)}</strong>
              </span>
            </div>
            <div className="buy-row">
              {product.companyId && (
                <Link to={`/chats?product=${product.id}`} className={canBuy ? 'btn-line' : 'btn-solid'}>تواصل</Link>
              )}
              {canBuy ? (
                <Link to={`/checkout/${product.id}?qty=${qty}`} className="btn-solid">اشترِ الآن</Link>
              ) : (
                <button className="btn-solid" disabled>اشترِ الآن</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {description && (
        <section className="tile">
          <h2>الوصف</h2>
          <p className="prose">{description}</p>
        </section>
      )}
      {specs.length > 0 && (
        <section className="tile">
          <h2>المواصفات</h2>
          <dl className="specs">
            {specs.map(([key, value]) => (
              <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </section>
      )}
      <ReviewsSection field="targetId" id={product.id} />
    </main>
  );
}
