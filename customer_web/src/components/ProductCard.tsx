import { Link } from 'react-router-dom';
import { useCatalog } from '../data/DataProvider';
import { categoryColor, categoryName, hasActiveOffer, iconPath, isNewProduct, ratingKey } from '../data/format';
import type { Product } from '../data/types';
import { CityTag, Highlighted, OfferPill, PriceText, RatingLine } from './Bits';
import { Icon, PATHS } from './Icon';

export function ProductCard({ product: p, highlight }: { product: Product; highlight?: string }) {
  const { tree } = useCatalog();
  const category = tree.byId(p.categoryId);
  const color = categoryColor(category, p.id);
  return (
    <Link to={`/product/${p.id}`} className="pcard">
      <div className="pimg" style={p.imageUrl ? undefined : { background: `${color}1f`, color }}>
        {p.imageUrl ? (
          <img src={p.imageUrl} alt="" loading="lazy" />
        ) : (
          <Icon d={category ? iconPath(category.iconName) : PATHS.box} size={54} />
        )}
        {hasActiveOffer(p) ? <OfferPill item={p} /> : isNewProduct(p) && <span className="badge">جديد</span>}
      </div>
      <div className="pbody">
        {category && <div className="pcat">{categoryName(category)}</div>}
        <div className="pname"><Highlighted text={p.name} query={highlight} /></div>
        <div className="pmeta">{p.companyName}</div>
        <div className="prow">
          <PriceText item={p} currency={p.currency} />
          <RatingLine ratingsFor={ratingKey('product', p.id)} showCount={false} showNew={false} />
        </div>
        {(p.isDeliveryAvailable || p.isInstallationAvailable) && (
          <div className="ptags">
            {p.isDeliveryAvailable && <span>توصيل</span>}
            {p.isInstallationAvailable && <span>تركيب</span>}
          </div>
        )}
        <CityTag companyId={p.companyId} />
      </div>
    </Link>
  );
}
