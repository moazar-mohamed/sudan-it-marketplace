import { Link } from 'react-router-dom';
import { bestDiscount, startsFrom } from '../data/browse';
import { useCatalog } from '../data/DataProvider';
import { categoryColor, categoryName, countText, formatPrice } from '../data/format';
import { CategoryGlyph } from './CategoryGlyph';
import type { CatalogService } from '../data/types';
import { Highlighted } from './Bits';
import { FavoriteButton } from './FavoriteButton';
import { t } from '../i18n';

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
        <CategoryGlyph category={category} fallbackKey="service" size={28} />
      </span>
      <span className="grow">
        <span className="pname" style={{ display: 'block' }}><Highlighted text={service.name} query={highlight} /></span>
        {category && <span className="pcat">{categoryName(category)}</span>}
        {company && (
          <span className="pmeta" style={{ display: 'block' }}>
            {company.name}{others > 0 ? t(' و{0}', countText(others, t('شركة أخرى'), t('شركتان أخريان'), t('شركات أخرى'), t('شركة أخرى'))) : ''}
          </span>
        )}
      </span>
      <span className="send">
        {discount > 0 && <span className="discount">{t('خصم')}{' '}{discount}%</span>}
        {from !== null && (
          <span className="from">{t('يبدأ من')}{' '}<strong className="price">{formatPrice(from)}</strong></span>
        )}
        {/* No company has set a price: the service page offers the chat. */}
        {listing && from === null && <span className="on-request">{t('تواصل لمعرفة السعر')}</span>}
      </span>
      <FavoriteButton kind="service" targetId={service.id} name={service.name} />
    </Link>
  );
}
