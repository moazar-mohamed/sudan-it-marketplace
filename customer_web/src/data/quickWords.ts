import type { CategoryTree } from './categoryTree';
import { marketplaceSearch } from './marketplaceSearch';
import type { CatalogService, Company, Product } from './types';

interface Catalog {
  tree: CategoryTree;
  products: Product[];
  services: CatalogService[];
  companies: Company[];
}

/**
 * The one-press search words worth offering on the home page: only the candidates that
 * find at least one product, service or company (the same search as the search page),
 * in the given order, without repeats, at most `max`. A word that would land on
 * "No results" is never offered.
 */
export function workingQuickWords(candidates: string[], catalog: Catalog, max = 5): string[] {
  const chosen: string[] = [];
  for (const word of candidates) {
    if (chosen.length >= max) break;
    const key = word.trim().toLowerCase();
    if (key === '' || chosen.some((w) => w.toLowerCase() === key)) continue;
    const found = marketplaceSearch(word, catalog);
    if (found.products.length + found.services.length + found.companies.length > 0) chosen.push(word.trim());
  }
  return chosen;
}
