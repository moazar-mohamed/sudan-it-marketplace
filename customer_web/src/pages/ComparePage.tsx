import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, RatingLine, Skeleton } from '../components/Bits';
import { Icon, PATHS } from '../components/Icon';
import { PageTitle } from '../components/PageTitle';
import { useCompare } from '../data/compare';
import { cheapestPrice, specNames } from '../data/compareTable';
import { useCatalog } from '../data/DataProvider';
import { categoryName, formatPrice, ratingKey, salePrice } from '../data/format';
import type { Product } from '../data/types';
import { t } from '../i18n';

const yes = (v: boolean) => (v ? t('نعم') : t('لا'));

/** Up to three products side by side: price, seller, availability and every specification. */
export function ComparePage() {
  const { ids, remove, clear } = useCompare();
  const { products, tree, loading } = useCatalog();
  const picked = ids.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => p !== undefined);

  if (loading) return <main className="stack"><Skeleton height={260} /></main>;
  if (picked.length < 2) {
    return (
      <main className="stack">
        <PageTitle title={t('المقارنة')} />
        <EmptyState title={t('المقارنة')} message={t('اختر منتجين على الأقل من القائمة بزر المقارنة ثم عد إلى هنا.')}>
          <Link to="/browse" className="pill">{t('تصفّح المنتجات والخدمات')}</Link>
        </EmptyState>
      </main>
    );
  }

  const prices = picked.map((p) => salePrice(p));
  const cheapest = cheapestPrice(prices);
  const specs = specNames(picked);

  const rows: { label: string; cell: (p: Product, i: number) => ReactNode }[] = [
    { label: t('السعر'), cell: (p, i) => (prices[i] === null ? t('السعر عند التواصل') : <strong className={prices[i] === cheapest ? 'best' : undefined}>{formatPrice(prices[i] as number, p.currency)}</strong>) },
    { label: t('الشركة'), cell: (p) => (p.companyId ? <Link to={`/company/${p.companyId}`} className="link-btn">{p.companyName}</Link> : '—') },
    { label: t('الماركة'), cell: (p) => p.brand || '—' },
    { label: t('القسم'), cell: (p) => { const c = tree.byId(p.categoryId); return c ? categoryName(c) : '—'; } },
    { label: t('التقييم'), cell: (p) => <RatingLine ratingsFor={ratingKey('product', p.id)} showCount={false} /> },
    { label: t('التوفر'), cell: (p) => (p.stockCount > 0 ? t('متوفر ({0})', p.stockCount) : t('غير متوفر')) },
    { label: t('التوصيل'), cell: (p) => yes(p.isDeliveryAvailable) },
    { label: t('التركيب'), cell: (p) => (p.isInstallationAvailable ? (p.installationPrice ? formatPrice(p.installationPrice, p.currency) : t('نعم')) : t('لا')) },
    ...specs.map((name) => ({ label: name, cell: (p: Product) => p.specifications[name] ?? '—' })),
  ];

  return (
    <main className="stack">
      <div className="section-title" style={{ margin: '8px 4px 0' }}>
        <PageTitle title={t('مقارنة المنتجات')} />
        <h1 className="page-title" style={{ margin: 0 }}>{t('مقارنة المنتجات')}</h1>
        <button type="button" className="link-btn" onClick={clear}>{t('مسح المقارنة')}</button>
      </div>
      <div className="tile compare-card">
        <div className="compare-scroll">
          <table className="compare-table">
            <thead>
              <tr>
                <th aria-hidden="true" />
                {picked.map((p) => (
                  <th key={p.id} scope="col">
                    <Link to={`/product/${p.id}`} className="compare-head">
                      <span className="compare-thumb">
                        {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <Icon d={PATHS.box} size={34} />}
                      </span>
                      <span className="pname">{p.name}</span>
                    </Link>
                    <button type="button" className="link-btn" onClick={() => remove(p.id)}>{t('إزالة')}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {picked.map((p, i) => <td key={p.id}>{row.cell(p, i)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="pmeta">{t('الأخضر هو الأقل سعرًا. الأسعار والمخزون كما هي الآن في المتجر.')}</p>
    </main>
  );
}
