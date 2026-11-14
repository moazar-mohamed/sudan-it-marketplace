import { retryLoads } from '../data/retry';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { servesCity } from '../data/browse';
import { cityNamesText } from '../data/cities';
import { useCatalog } from '../data/DataProvider';
import { averageOf, countText, formatPrice, hasActiveOffer, offerLabel, salePrice } from '../data/format';
import { searchQueryTokens, searchWordHit } from '../data/searchRanking';
import type { Priced } from '../data/types';
import { language, t } from '../i18n';

/** The arrow between the steps of a path: it points the way the text reads. */
export const PATH_SEPARATOR = language === 'en' ? '›' : '‹';

/** "(12 تقييم)": the plural forms the app's reviewsCount uses. */
export const reviewsCountText = (count: number): string =>
  countText(count, t('تقييم واحد'), t('تقييمان'), t('تقييمات'), t('تقييم'));

/**
 * Five stars filled to [value] (0 to 5), so 4.5 shows four and a half. The
 * gold copy sits on the grey one from the side the text starts, so in Arabic
 * the stars fill from the right.
 */
export function Stars({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(5, value));
  return (
    <span className="stars-meter" role="img" aria-label={t('{0} من 5', clamped.toFixed(1))}>
      <span className="stars-base" aria-hidden="true">★★★★★</span>
      <span className="stars-fill" aria-hidden="true" style={{ width: `${(clamped / 5) * 100}%` }}>★★★★★</span>
    </span>
  );
}

/** Stars, the average and the count; "جديد" until someone rates (nothing with [showNew] false). */
export function RatingLine({
  ratingsFor,
  fallbackAverage = 0,
  fallbackCount = 0,
  showCount = true,
  showNew = true,
}: {
  ratingsFor: string;
  fallbackAverage?: number;
  fallbackCount?: number;
  showCount?: boolean;
  showNew?: boolean;
}) {
  const { ratings } = useCatalog();
  const stats = ratings.get(ratingsFor);
  const live = !!stats && stats.count > 0;
  const average = live ? averageOf(stats) : fallbackAverage;
  const count = live ? stats.count : fallbackCount;
  if (count === 0) return showNew ? <span className="new-rating">{t('جديد')}</span> : null;
  return (
    <span className="rating">
      <Stars value={average} />
      <span className="rating-value">{average.toFixed(1)}</span>
      {showCount && <span className="pmeta">({reviewsCountText(count)})</span>}
    </span>
  );
}

/** The price to pay, with the struck-through normal price while an offer runs. */
export function PriceText({ item, currency = 'SDG', big }: { item: Priced; currency?: string; big?: boolean }) {
  const sale = salePrice(item);
  if (sale === null) return <span className="on-request">{t('تواصل لمعرفة السعر')}</span>;
  return (
    <span className="price-line">
      <span className={big ? 'price big' : 'price'}>{formatPrice(sale, currency)}</span>
      {hasActiveOffer(item) && item.price !== null && (
        <span className="old">{formatPrice(item.price, currency)}</span>
      )}
    </span>
  );
}

export const OfferPill = ({ item }: { item: Priced }) => <span className="badge offer">{offerLabel(item)}</span>;

/** "تخدم: بورتسودان، كسلا" on a company that does not serve the customer's city. */
export function CityTag({ companyId }: { companyId: string }) {
  const { companies, cityId, cities } = useCatalog();
  const company = companies.find((c) => c.id === companyId);
  if (!company || cityId === null || servesCity(company, cityId)) return null;
  const names = cityNamesText(company.serviceCityIds, cities);
  return <span className="city-tag">{names ? t('تخدم: {0}', names) : t('الشركة لا تخدم مدينتك')}</span>;
}

/** [text] with the words the query matched marked (same rules as the search). */
export function Highlighted({ text, query }: { text: string; query?: string }) {
  const tokens = useMemo(() => (query ? searchQueryTokens(query) : []), [query]);
  if (tokens.length === 0) return <>{text}</>;
  return (
    <>
      {text.split(/(\s+)/).map((part, i) =>
        part.trim() !== '' && searchWordHit(part, tokens) ? <mark key={i}>{part}</mark> : part,
      )}
    </>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="crumbs" aria-label={t('مسار الصفحة')}>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="crumb">
          {i > 0 && <span aria-hidden="true">{PATH_SEPARATOR}</span>}
          {item.to ? <Link to={item.to}>{item.label}</Link> : <strong aria-current="page">{item.label}</strong>}
        </span>
      ))}
    </nav>
  );
}

export function EmptyState({ title, message, children }: { title?: string; message?: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      {title && <h2>{title}</h2>}
      {message && <p>{message}</p>}
      {children}
    </div>
  );
}

export function ErrorState() {
  return (
    <EmptyState title={t('تعذر تحميل البيانات')} message={t('تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى.')}>
      <button className="pill" onClick={retryLoads}>{t('إعادة المحاولة')}</button>
    </EmptyState>
  );
}

export const Skeleton = ({ height = 240 }: { height?: number }) => (
  <div className="skeleton" style={{ minHeight: height }} aria-hidden="true" />
);
