import type { CategoryTree } from './categoryTree';
import { categorySearchText, isAvailable } from './format';
import { searchRanked } from './searchRanking';
import type { CatalogService, Category, Company, Product } from './types';

// Port of lib/features/search/presentation/marketplace_search.dart.

export interface MarketplaceResults {
  products: Product[];
  services: CatalogService[];
  companies: Company[];
}

export function marketplaceSearch(
  text: string,
  catalog: { tree: CategoryTree; products: Product[]; services: CatalogService[]; companies: Company[] },
): MarketplaceResults {
  if (text.trim() === '') return { products: [], services: [], companies: [] };
  const categoryText = (id: string | null) => {
    const category = catalog.tree.byId(id);
    return category ? categorySearchText(category) : '';
  };
  return {
    products: searchRanked(
      catalog.products,
      text,
      (p) => [
        { text: p.name, weight: 3 },
        { text: categoryText(p.categoryId), weight: 2 },
        { text: p.brand, weight: 2 },
        { text: p.companyName },
        { text: p.description },
        { text: Object.entries(p.specifications).map(([k, v]) => `${k} ${v}`).join(' ') },
      ],
      // Among equally good matches, what can be bought now comes first.
      (p) => (isAvailable(p) ? 1 : 0),
    ),
    services: searchRanked(catalog.services, text, (s) => [
      { text: s.name, weight: 3 },
      { text: categoryText(s.categoryId), weight: 2 },
      { text: s.description },
    ]),
    companies: searchRanked(catalog.companies, text, (c) => [
      { text: c.name, weight: 3 },
      { text: c.city },
      { text: c.address },
      { text: c.description },
    ]),
  };
}

/** Categories whose name matches what is being typed. */
export function matchingCategories(text: string, tree: CategoryTree): Category[] {
  if (text.trim() === '') return [];
  return searchRanked(
    tree.all.filter((c) => c.isActive),
    text,
    (c) => [{ text: categorySearchText(c), weight: 3 }],
  );
}
