import { Link } from 'react-router-dom';
import { ratingKey } from '../data/format';
import type { Company } from '../data/types';
import { CityTag, Highlighted, RatingLine } from './Bits';

export const CompanyLogo = ({ company, size = 46 }: { company: Company; size?: number }) => (
  <span className="avatar" style={{ width: size, height: size }}>
    {company.logoUrl ? <img src={company.logoUrl} alt="" /> : company.name.slice(0, 1)}
  </span>
);

export function CompanyCard({ company, highlight }: { company: Company; highlight?: string }) {
  return (
    <Link to={`/company/${company.id}`} className="ccard">
      <CompanyLogo company={company} size={56} />
      <span className="grow">
        <span className="pname" style={{ display: 'block' }}><Highlighted text={company.name} query={highlight} /></span>
        {company.city && <span className="pmeta" style={{ display: 'block' }}>{company.city}</span>}
        <RatingLine ratingsFor={ratingKey('company', company.id)} fallbackAverage={company.rating} fallbackCount={company.reviewCount} />
        <CityTag companyId={company.id} />
      </span>
    </Link>
  );
}
