import { Link } from 'react-router-dom';
import { localCityText } from '../data/cities';
import { useCatalog } from '../data/DataProvider';
import { categoryColor, categoryName, hasActiveOffer, isNewProduct, ratingKey } from '../data/format';
import type { Product } from '../data/types';
import { CityTag, Highlighted, OfferPill, PriceText, RatingLine } from './Bits';
import { CategoryGlyph } from './CategoryGlyph';
import { CompareButton } from './Compare';
import { FavoriteButton } from './FavoriteButton';
import { Icon, PATHS } from './Icon';
import { t } from '../i18n';

export function ProductCard({ product: p, highlight }: { product: Product; highlight?: string }) {
  const { tree, companies, cities } = useCatalog();
  const category = tree.byId(p.categoryId);
  const city = localCityText(companies.find((c) => c.id === p.companyId)?.city ?? '', cities);
  const color = categoryColor(category, p.id);
  return (
    <Link to={`/product/${p.id}`} className="pcard">
      <div className="pimg" style={p.imageUrl ? undefined : { background: `linear-gradient(135deg, ${color}, ${color}b3)`, color: '#fff' }}>
        {p.imageUrl ? (
          <img src={p.imageUrl} alt="" loading="lazy" />
        ) : (
          category ? <CategoryGlyph category={category} size={56} /> : <Icon d={PATHS.box} size={54} />
        )}
        <FavoriteButton kind="product" targetId={p.id} name={p.name} className="on-image" />
        <CompareButton productId={p.id} className="on-image" />
        {hasActiveOffer(p) ? <OfferPill item={p} /> : isNewProduct(p) && <span className="badge">{t('جديد')}</span>}
        {category && <span className="pimg-cat">{categoryName(category)}</span>}
      </div>
      <div className="pbody">
        <div className="pname"><Highlighted text={p.name} query={highlight} /></div>
        {p.description.trim() !== '' && <div className="pdesc">{p.description}</div>}
        <div className="pco">
          <Icon d={PATHS.building} size={15} />
          <span>{[p.companyName, city].filter((s) => s !== '').join(' · ')}</span>
        </div>
        <div className="prow">
          <PriceText item={p} currency={p.currency} />
          <RatingLine ratingsFor={ratingKey('product', p.id)} showCount={false} showNew={false} />
        </div>
        {(p.isDeliveryAvailable || p.isInstallationAvailable) && (
          <div className="ptags">
            {p.isDeliveryAvailable && <span>{t('توصيل')}</span>}
            {p.isInstallationAvailable && <span>{t('تركيب')}</span>}
          </div>
        )}
        <CityTag companyId={p.companyId} />
      </div>
    </Link>
  );
}
