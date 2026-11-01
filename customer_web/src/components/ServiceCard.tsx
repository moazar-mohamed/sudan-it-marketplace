import { Link } from 'react-router-dom';
import { bestDiscount, startsFrom } from '../data/browse';
import { useCatalog } from '../data/DataProvider';
import { categoryColor, categoryName, countText, formatPrice, iconPath } from '../data/format';
import type { CatalogService } from '../data/types';
import { Highlighted } from './Bits';
import { Icon } from './Icon';

/** A service: its category's look, the company to start from and what it asks. */
export function ServiceCard({ service, highlight }: { service: CatalogService; highlight?: string }) {
  const { tree, listings } = useCatalog();
  const category = tree.byId(service.categoryId);
  const color = categoryColor(category, service.id);
  const listing = listings.find((l) => l.service.id === service.id);
  const lead = listing?.offers[0];
  const company = lead ? listing.companies.get(lead.companyId) : undefined;
  const others = listing ? listing.offers.length - 1 : 0;
  const from = listing ? startsFrom(listing) : null;
  const discount = listing ? bestDiscount(listing) : 0;
  return (
    <Link to={`/service/${service.id}`} className="scard">
      <span className="sicon" style={{ background: `${color}1f`, color }}>
        <Icon d={iconPath(category?.iconName ?? 'service')} size={28} />
      </span>
      <span className="grow">
        <span className="pname" style={{ display: 'block' }}><Highlighted text={service.name} query={highlight} /></span>
        {category && <span className="pcat">{categoryName(category)}</span>}
        {company && (
          <span className="pmeta" style={{ display: 'block' }}>
            {company.name}{others > 0 ? ` و${countText(others, 'شركة أخرى', 'شركتان أخريان', 'شركات أخرى', 'شركة أخرى')}` : ''}
          </span>
        )}
      </span>
      <span className="send">
        {discount > 0 && <span className="discount">خصم {discount}%</span>}
        {from !== null && (
          <span className="from">يبدأ من <strong className="price">{formatPrice(from)}</strong></span>
        )}
      </span>
    </Link>
  );
}
