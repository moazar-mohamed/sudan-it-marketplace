import { categoryEmoji } from '../data/categoryEmoji';
import { categorySearchText } from '../data/format';
import type { Category } from '../data/types';

/**
 * A category's colourful picture: the shape Platform Admin chose, else one that
 * fits its name. It is decoration: the name is always written beside it.
 */
export function CategoryGlyph({ category, fallbackKey = '', size = 30 }: { category?: Category; fallbackKey?: string; size?: number }) {
  const emoji = category ? categoryEmoji(category.iconName, categorySearchText(category)) : categoryEmoji(fallbackKey);
  return (
    <span className="glyph" style={{ fontSize: size, width: size * 1.25, height: size * 1.25 }} aria-hidden="true">
      {emoji}
    </span>
  );
}
