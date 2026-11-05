import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MAX_COMPARE, useCompare } from '../data/compare';
import { useCatalog } from '../data/DataProvider';
import { Icon, PATHS } from './Icon';
import { t } from '../i18n';

/** The scales button on a product card or page: adds the product to the comparison, or takes it out. */
export function CompareButton({ productId, label, className = '' }: { productId: string; label?: boolean; className?: string }) {
  const { has, toggle } = useCompare();
  const on = has(productId);
  const text = on ? t('إزالة من المقارنة') : t('أضف للمقارنة');
  return (
    <button
      type="button"
      className={`compare-btn${on ? ' on' : ''} ${className}`.trim()}
      aria-pressed={on}
      aria-label={text}
      title={text}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!toggle(productId)) window.alert(t('تقارن حتى {0} منتجات في المرة. أزل منتجًا أولًا.', MAX_COMPARE));
      }}
    >
      <Icon d={PATHS.compare} size={18} />
      {label && <span>{text}</span>}
    </button>
  );
}

/** The bar at the bottom of the screen while products are picked for comparison. */
export function CompareBar() {
  const { ids, clear, remove } = useCompare();
  const { products, loading } = useCatalog();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // A product that is no longer on sale leaves the comparison.
  useEffect(() => {
    if (loading) return;
    for (const id of ids) if (!products.some((p) => p.id === id)) remove(id);
  }, [loading, ids, products, remove]);

  if (ids.length === 0 || pathname === '/compare' || pathname.startsWith('/chats')) return null;
  const names = ids.map((id) => products.find((p) => p.id === id)?.name).filter(Boolean);
  return (
    <div className="compare-bar" role="region" aria-label={t('مقارنة المنتجات')}>
      <div className="compare-bar-inner">
        <span className="compare-count"><Icon d={PATHS.compare} size={18} /> {ids.length}/{MAX_COMPARE}</span>
        <span className="compare-names">{names.join(' · ')}</span>
        <button type="button" className="btn-solid compare-go" disabled={ids.length < 2} onClick={() => navigate('/compare')}>
          {ids.length < 2 ? t('اختر منتجًا آخر') : t('قارن الآن')}
        </button>
        <button type="button" className="icon-btn" aria-label={t('مسح المقارنة')} title={t('مسح المقارنة')} onClick={clear}>✕</button>
      </div>
    </div>
  );
}

export const ComparePageLink = ({ children }: { children: string }) => <Link to="/compare" className="more">{children}</Link>;
