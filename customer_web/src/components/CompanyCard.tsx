import { Link } from 'react-router-dom';
import { localCityText } from '../data/cities';
import { useCatalog } from '../data/DataProvider';
import { categoryColor, itemsCount, ratingKey } from '../data/format';
import type { Company } from '../data/types';
import { CityTag, Highlighted, RatingLine } from './Bits';

/** The company's logo, else its first letter in white on a colour that stays the same for it. */
export const CompanyLogo = ({ company, size = 46 }: { company: Company; size?: number }) =>
  company.logoUrl ? (
    <span className="avatar" style={{ width: size, height: size }}>
      <img src={company.logoUrl} alt="" />
    </span>
  ) : (
    <span className="avatar" style={{ width: size, height: size, background: categoryColor(undefined, company.id), color: '#fff' }}>
      {company.name.slice(0, 1)}
    </span>
  );

export function CompanyCard({ company, highlight }: { company: Company; highlight?: string }) {
  const { itemCounts, cities } = useCatalog();
  const items = itemCounts.get(company.id) ?? 0;
  const where = [localCityText(company.city, cities), items > 0 ? itemsCount(items) : ''].filter((s) => s !== '').join(' · ');
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
