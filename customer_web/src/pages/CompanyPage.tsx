import { Link, useParams } from 'react-router-dom';
import { CityTag, EmptyState, ErrorState, RatingLine, Skeleton } from '../components/Bits';
import { CompanyLogo } from '../components/CompanyCard';
import { Icon, PATHS } from '../components/Icon';
import { ProductCard } from '../components/ProductCard';
import { ReviewsSection } from '../components/ReviewsSection';
import { useCatalog } from '../data/DataProvider';
import { ratingKey } from '../data/format';

export function CompanyPage() {
  const { id = '' } = useParams();
  const { companies, products, loading, error } = useCatalog();
  const company = companies.find((c) => c.id === id);

  if (error) return <main className="stack"><ErrorState /></main>;
  if (loading) return <main className="stack"><Skeleton height={420} /></main>;
  if (!company) {
    return (
      <main className="stack">
        <EmptyState title="هذه الشركة غير متاحة حاليًا">
          <Link to="/companies" className="pill">كل الشركات</Link>
        </EmptyState>
      </main>
    );
  }

  const name = company.name.toLowerCase();
  const own = products.filter((p) => p.companyId === company.id || p.companyName.toLowerCase() === name);
  const about = company.description.trim();
  const address = company.address.trim();
  const phone = company.phone.trim();
  const hasMap = company.latitude !== null && company.longitude !== null;

  return (
    <main className="stack">
      <section className="tile company-head">
        <CompanyLogo company={company} size={88} />
        <div className="grow">
          <h1>{company.name}</h1>
          <RatingLine ratingsFor={ratingKey('company', company.id)} fallbackAverage={company.rating} fallbackCount={company.reviewCount} />
          <div className="company-facts">
            {(address || company.city) && (
              <span><Icon d={PATHS.pin} size={18} />{address || company.city}</span>
            )}
            {phone && (
              <a href={`tel:${phone}`} dir="ltr">{phone}</a>
            )}
            {hasMap && (
              <a
                className="more"
                href={`https://www.openstreetmap.org/?mlat=${company.latitude}&mlon=${company.longitude}#map=16/${company.latitude}/${company.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                عرض على الخريطة
              </a>
            )}
          </div>
          <CityTag companyId={company.id} />
        </div>
      </section>

      {about && (
        <section className="tile">
          <h2>نبذة عن الشركة</h2>
          <p className="prose">{about}</p>
        </section>
      )}

      <ReviewsSection field="companyId" id={company.id} />

      <section>
        <div className="section-title"><h2>المنتجات ({own.length})</h2></div>
        {own.length === 0 ? (
          <EmptyState title="لا توجد منتجات مدرجة لدى هذه الشركة بعد." />
        ) : (
          <div className="pcards">
            {own.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>
    </main>
  );
}
