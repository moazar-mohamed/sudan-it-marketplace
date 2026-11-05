import { Link } from 'react-router-dom';
import { useCatalog } from '../data/DataProvider';
import { ratingKey } from '../data/format';
import type { Company } from '../data/types';
import { t } from '../i18n';
import { CityTag, Highlighted, RatingLine } from './Bits';

export const CompanyLogo = ({ company, size = 46 }: { company: Company; size?: number }) => (
  <span className="avatar" style={{ width: size, height: size }}>
    {company.logoUrl ? <img src={company.logoUrl} alt="" /> : company.name.slice(0, 1)}
  </span>
);

export function CompanyCard({ company, highlight }: { company: Company; highlight?: string }) {
  const { itemCounts } = useCatalog();
  const items = itemCounts.get(company.id) ?? 0;
  const where = [company.city, items > 0 ? `${items} ${t('عنصر')}` : ''].filter((s) => s !== '').join(' · ');
  return (
    <Link to={`/company/${company.id}`} className="ccard">
      <CompanyLogo company={company} size={56} />
      <span className="grow">
        <span className="pname" style={{ display: 'block' }}><Highlighted text={company.name} query={highlight} /></span>
        {where && <span className="pmeta" style={{ display: 'block' }}>{where}</span>}
        <RatingLine ratingsFor={ratingKey('company', company.id)} fallbackAverage={company.rating} fallbackCount={company.reviewCount} />
        <CityTag companyId={company.id} />
      </span>
    </Link>
  );
}
