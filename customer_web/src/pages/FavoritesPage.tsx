import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, Skeleton } from '../components/Bits';
import { FavoriteButton } from '../components/FavoriteButton';
import { ProductCard } from '../components/ProductCard';
import { ServiceCard } from '../components/ServiceCard';
import { PageTitle } from '../components/PageTitle';
import { useCatalog } from '../data/DataProvider';
import { favoriteKey, useTargetExists } from '../data/favorites';
import type { Favorite } from '../data/types';
import { t } from '../i18n';

/** No longer offered: it stays, marked. Removed from the catalogue: it is no longer listed. */
function Unavailable({ favorite }: { favorite: Favorite }) {
  const exists = useTargetExists(favorite.kind, favorite.targetId);
  if (!exists) return null;
  return (
    <div className="scard fav-off">
      <span className="grow">
        <span className="pname" style={{ display: 'block' }}>{favorite.name}</span>
        <span className="pmeta">{t('غير متاح حاليًا')}</span>
      </span>
      <FavoriteButton kind={favorite.kind} targetId={favorite.targetId} name={favorite.name} />
    </div>
  );
}

export function FavoritesPage() {
  const { favorites, products, services, loading, error } = useCatalog();

  if (error) return <main className="stack"><ErrorState /></main>;
  if (loading || favorites === null) return <main className="stack"><Skeleton height={320} /></main>;

  const savedProducts = favorites.filter((f) => f.kind === 'product' && products.some((p) => p.id === f.targetId));
  const savedServices = favorites.filter((f) => f.kind === 'service' && services.some((s) => s.id === f.targetId));
  const unavailable = favorites.filter((f) => !savedProducts.includes(f) && !savedServices.includes(f));

  return (
    <main className="stack">
      <PageTitle title={t('المفضلة')} />
      <h1 className="page-title">{t('المفضلة')}</h1>
      {favorites.length === 0 ? (
        <EmptyState title={t('لا توجد عناصر في المفضلة')} message={t('اضغط على القلب في أي منتج أو خدمة لتحفظه هنا.')}>
          <Link to="/browse" className="pill">{t('تصفّح المنتجات والخدمات')}</Link>
        </EmptyState>
      ) : (
        <>
          {savedProducts.length > 0 && (
            <div className="pcards">
              {savedProducts.map((f) => <ProductCard key={favoriteKey(f.kind, f.targetId)} product={products.find((p) => p.id === f.targetId)!} />)}
            </div>
          )}
          {savedServices.length > 0 && (
            <div className="service-list">
              {savedServices.map((f) => <ServiceCard key={favoriteKey(f.kind, f.targetId)} service={services.find((s) => s.id === f.targetId)!} />)}
            </div>
          )}
          {unavailable.map((f) => <Unavailable key={favoriteKey(f.kind, f.targetId)} favorite={f} />)}
        </>
      )}
    </main>
  );
}
