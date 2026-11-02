import { Link, useParams } from 'react-router-dom';
import { Breadcrumbs, CityTag, EmptyState, ErrorState, PriceText, RatingLine, Skeleton } from '../components/Bits';
import { CompanyLogo } from '../components/CompanyCard';
import { servesCity } from '../data/browse';
import { useCatalog } from '../data/DataProvider';
import { categoryName, ratingKey } from '../data/format';
import { t } from '../i18n';

export function ServicePage() {
  const { id = '' } = useParams();
  const { services, links, companies, tree, cityId, loading, error } = useCatalog();
  const service = services.find((s) => s.id === id);

  if (error) return <main className="stack"><ErrorState /></main>;
  if (loading) return <main className="stack"><Skeleton height={320} /></main>;
  if (!service) {
    return (
      <main className="stack">
        <EmptyState title={t('هذه الخدمة غير متاحة حاليًا')}>
          <Link to="/browse?kind=services" className="pill">{t('كل الخدمات')}</Link>
        </EmptyState>
      </main>
    );
  }

  const path = tree.pathOf(service.categoryId);
  const description = service.description.trim();
  // Companies that serve the customer's city first, then by name.
  const offers = links
    .filter((l) => l.isActive && l.serviceId === service.id)
    .flatMap((offer) => {
      const company = companies.find((c) => c.id === offer.companyId);
      return company ? [{ offer, company }] : [];
    })
    .sort((a, b) => {
      const diff = (servesCity(a.company, cityId) ? 0 : 1) - (servesCity(b.company, cityId) ? 0 : 1);
      return diff || (a.company.name < b.company.name ? -1 : 1);
    });

  return (
    <main className="stack">
      <Breadcrumbs
        items={[
          { label: t('كل التصنيفات'), to: '/browse' },
          ...path.map((c) => ({ label: categoryName(c), to: `/category/${c.id}` })),
          { label: service.name },
        ]}
      />
      <section className="tile">
        <h1 className="page-title">{service.name}</h1>
        {description && <p className="prose">{description}</p>}
      </section>

      <section>
        <div className="section-title"><h2>{t('الشركات المتاحة')}</h2></div>
        {offers.length === 0 ? (
          <EmptyState title={t('لا توجد شركة تقدم هذه الخدمة حاليًا.')} />
        ) : (
          <div className="offers">
            {offers.map(({ offer, company }) => (
              <article key={offer.id} className="tile offer-card">
                <Link to={`/company/${company.id}`} className="company-row">
                  <CompanyLogo company={company} />
                  <span className="grow">
                    <strong style={{ display: 'block' }}>{company.name}</strong>
                    <RatingLine
                      ratingsFor={ratingKey('service', offer.id)}
                      fallbackAverage={company.rating}
                      fallbackCount={company.reviewCount}
                      showCount={false}
                    />
                    {company.city && <span className="pmeta"> · {company.city}</span>}
                  </span>
                </Link>
                {offer.price !== null && <PriceText item={offer} />}
                {offer.note && <p className="pmeta">{offer.note}</p>}
                <CityTag companyId={company.id} />
                <div className="buy-row">
                  <Link to={`/chats?offer=${offer.id}`} className="btn-line">{t('تواصل')}</Link>
                  <Link to={`/service-request?offer=${offer.id}`} className="btn-solid">{t('اطلب الخدمة')}</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
