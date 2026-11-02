import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, Skeleton } from '../components/Bits';
import { CompanyCard } from '../components/CompanyCard';
import { companyTopCategories, viewCompanies } from '../data/browse';
import type { CompanySort } from '../data/browse';
import { useCatalog } from '../data/DataProvider';
import { categoryName, companiesCount } from '../data/format';
import { t } from '../i18n';

const SORTS: { value: CompanySort; label: string }[] = [
  { value: 'topRated', label: t('الأعلى تقييمًا') },
  { value: 'mostReviewed', label: t('الأكثر تقييمًا') },
  { value: 'name', label: t('الاسم') },
];

export function CompaniesPage() {
  const { companies, tree, products, links, services, ratings, cityId, loading, error } = useCatalog();
  const [params, setParams] = useSearchParams();
  const sort = SORTS.find((s) => s.value === params.get('sort'))?.value ?? 'topRated';
  const categoryId = params.get('cat');

  const topCategories = useMemo(
    () => companyTopCategories(tree, products, links, services),
    [tree, products, links, services],
  );
  const shown = useMemo(
    () => viewCompanies([...companies], sort, ratings, topCategories, categoryId, cityId),
    [companies, sort, ratings, topCategories, categoryId, cityId],
  );
  const chips = tree.childrenOf(null).filter((c) => [...topCategories.values()].some((ids) => ids.includes(c.id)));

  function set(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  if (error) return <main className="stack"><ErrorState /></main>;

  return (
    <main className="stack">
      <section className="tile browse-head">
        <h1>{t('الشركات')}</h1>
        {chips.length > 0 && (
          <div className="chips">
            <button className={`chip-link${categoryId === null ? ' on' : ''}`} onClick={() => set('cat', null)}>{t('الكل')}</button>
            {chips.map((c) => (
              <button key={c.id} className={`chip-link${categoryId === c.id ? ' on' : ''}`} onClick={() => set('cat', c.id)}>
                {categoryName(c)}
              </button>
            ))}
          </div>
        )}
      </section>
      <div className="results-bar">
        <span className="grow pmeta">{companiesCount(shown.length)}</span>
        <label className="sort">
          <span className="pmeta">{t('ترتيب:')}</span>
          <select value={sort} onChange={(e) => set('sort', e.target.value === 'topRated' ? null : e.target.value)}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </div>
      {loading ? (
        <Skeleton height={320} />
      ) : shown.length === 0 ? (
        <EmptyState title={t('لا شركات هنا بعد.')} />
      ) : (
        <div className="ccards">
          {shown.map((c) => <CompanyCard key={c.id} company={c} />)}
        </div>
      )}
    </main>
  );
}
