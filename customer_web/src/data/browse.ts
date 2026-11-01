import type { CategoryTree } from './categoryTree';
import { averageOf, discountPercent, hasActiveOffer, isAvailable, ratingKey, salePrice } from './format';
import type { CatalogService, Company, CompanyService, Product, RatingStats, ServiceListing } from './types';

// Ports of the app's listing logic: category_browse.dart, home_product_view.dart,
// home_service_view.dart, home_company_view.dart, marketplace_search.dart.

export const servesCity = (company: Company, cityId: string | null): boolean =>
  cityId === null || company.serviceCityIds.length === 0 || company.serviceCityIds.includes(cityId);

export type Ratings = Map<string, RatingStats>;

// ── counts ─────────────────────────────────────────────────────────────────

export interface CategoryCount {
  products: number;
  services: number;
}

export const countTotal = (c: CategoryCount | undefined): number =>
  c ? c.products + c.services : 0;

/** An item filed in a category also counts in each category above it. */
export function countByCategory(
  tree: CategoryTree,
  productCategoryIds: Iterable<string | null>,
  serviceCategoryIds: Iterable<string | null>,
): Map<string, CategoryCount> {
  const counts = new Map<string, CategoryCount>();
  function add(id: string | null, key: keyof CategoryCount) {
    if (id === null || !tree.has(id)) return;
    for (const category of tree.pathOf(id)) {
      const entry = counts.get(category.id) ?? { products: 0, services: 0 };
      entry[key]++;
      counts.set(category.id, entry);
    }
  }
  for (const id of productCategoryIds) add(id, 'products');
  for (const id of serviceCategoryIds) add(id, 'services');
  return counts;
}

// ── filters ────────────────────────────────────────────────────────────────

export type BrowseKind = 'all' | 'products' | 'services';

export interface BrowseFilters {
  kind: BrowseKind;
  offers: boolean;
  inStock: boolean;
  delivery: boolean;
  installation: boolean;
  topRated: boolean;
  brand: string | null;
  companyId: string | null;
  minPrice: number | null;
  maxPrice: number | null;
}

export const NO_FILTERS: BrowseFilters = {
  kind: 'all', offers: false, inStock: false, delivery: false, installation: false,
  topRated: false, brand: null, companyId: null, minPrice: null, maxPrice: null,
};

/** Whether anything but the kind narrows the list. */
export const filtersActive = (f: BrowseFilters): boolean =>
  f.offers || f.inStock || f.delivery || f.installation || f.topRated ||
  f.brand !== null || f.companyId !== null || f.minPrice !== null || f.maxPrice !== null;

/** Brand, stock, delivery, installation and rating exist for products only. */
const showsServices = (f: BrowseFilters): boolean =>
  f.kind !== 'products' && !f.inStock && f.brand === null &&
  !f.delivery && !f.installation && !f.topRated;

function priceWithin(price: number | null, f: BrowseFilters): boolean {
  if (f.minPrice === null && f.maxPrice === null) return true;
  if (price === null) return false;
  return (f.minPrice === null || price >= f.minPrice) && (f.maxPrice === null || price <= f.maxPrice);
}

const brandKey = (brand: string): string => brand.trim().toLowerCase();

/** A product counts as "top rated" from this average (it needs a rating). */
const TOP_RATED_FROM = 4.0;

export function filterProducts(products: Product[], f: BrowseFilters, ratings: Ratings): Product[] {
  if (f.kind === 'services') return [];
  const brand = f.brand === null ? null : brandKey(f.brand);
  return products.filter((p) => {
    const stats = ratings.get(ratingKey('product', p.id));
    return (
      (!f.offers || hasActiveOffer(p)) &&
      (!f.inStock || isAvailable(p)) &&
      (!f.delivery || p.isDeliveryAvailable) &&
      (!f.installation || p.isInstallationAvailable) &&
      (!f.topRated || (!!stats && stats.count > 0 && averageOf(stats) >= TOP_RATED_FROM)) &&
      (brand === null || brandKey(p.brand) === brand) &&
      (f.companyId === null || p.companyId === f.companyId) &&
      priceWithin(salePrice(p), f)
    );
  });
}

export function filterListings(listings: ServiceListing[], f: BrowseFilters): ServiceListing[] {
  if (!showsServices(f)) return [];
  return listings.filter(
    (l) =>
      (!f.offers || bestDiscount(l) > 0) &&
      (f.companyId === null || l.offers.some((o) => o.companyId === f.companyId)) &&
      priceWithin(startsFrom(l), f),
  );
}

/** The brands of [products], each once (spelled as first met), A to Z. */
export function brandsOf(products: Iterable<Product>): string[] {
  const byKey = new Map<string, string>();
  for (const p of products) {
    const brand = p.brand.trim();
    if (brand !== '' && !byKey.has(brandKey(brand))) byKey.set(brandKey(brand), brand);
  }
  return [...byKey.values()].sort((a, b) => compareText(a.toLowerCase(), b.toLowerCase()));
}

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// ── sort ───────────────────────────────────────────────────────────────────

export type ProductSort = 'newest' | 'priceLow' | 'priceHigh' | 'topRated';

/** Something without the thing being sorted on goes last, whichever way. */
function byPrice(a: Product, b: Product, descending: boolean): number {
  const pa = salePrice(a);
  const pb = salePrice(b);
  if (pa === null && pb === null) return 0;
  if (pa === null) return 1;
  if (pb === null) return -1;
  return descending ? pb - pa : pa - pb;
}

function byNewest(a: Product, b: Product): number {
  if (a.createdAt === null && b.createdAt === null) return 0;
  if (a.createdAt === null) return 1;
  if (b.createdAt === null) return -1;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

/**
 * [products] ordered by [sort]; ties keep the order they came in. With
 * [serves] and the default (newest) order, products of companies that serve the
 * customer's city come first. An order the customer picked is kept as it is.
 */
export function sortProducts(
  products: Product[],
  sort: ProductSort,
  ratings: Ratings,
  serves?: (p: Product) => boolean,
): Product[] {
  const stats = (p: Product) => ratings.get(ratingKey('product', p.id));
  const average = (p: Product) => {
    const s = stats(p);
    return s ? averageOf(s) : 0;
  };
  const cityFirst = serves !== undefined && sort === 'newest';
  return [...products].sort((a, b) => {
    if (cityFirst) {
      const diff = (serves(a) ? 0 : 1) - (serves(b) ? 0 : 1);
      if (diff !== 0) return diff;
    }
    switch (sort) {
      case 'newest': return byNewest(a, b);
      case 'priceLow': return byPrice(a, b, false);
      case 'priceHigh': return byPrice(a, b, true);
      case 'topRated':
        return average(b) - average(a) || (stats(b)?.count ?? 0) - (stats(a)?.count ?? 0);
    }
  });
}

export type SearchSort = 'relevance' | 'priceLow' | 'priceHigh';

/** Relevance keeps the ranking; a price order puts products without a price last. */
export function arrangeResults(products: Product[], sort: SearchSort, inStockOnly: boolean): Product[] {
  const shown = products.filter((p) => !inStockOnly || isAvailable(p));
  if (sort === 'relevance') return shown;
  // The search screen's price is the offer price while one is stored.
  const price = (p: Product) => p.offerPrice ?? p.price;
  return shown.sort((a, b) => {
    const pa = price(a);
    const pb = price(b);
    if (pa === null && pb === null) return 0;
    if (pa === null) return 1;
    if (pb === null) return -1;
    return sort === 'priceLow' ? pa - pb : pb - pa;
  });
}

// ── services ───────────────────────────────────────────────────────────────

/** What the cheapest company asks, or null when none has set a price. */
export const startsFrom = (l: ServiceListing): number | null =>
  l.offers.length === 0 ? null : salePrice(l.offers[0]);

/** The best running discount among the offers, or 0. */
export const bestDiscount = (l: ServiceListing): number =>
  l.offers.reduce(
    (best, o) => (hasActiveOffer(o) && discountPercent(o) > best ? discountPercent(o) : best),
    0,
  );

/** Each service with the offers of [companies], most performed first. */
export function buildServiceListings(
  services: CatalogService[],
  links: CompanyService[],
  companies: Company[],
): ServiceListing[] {
  const companiesById = new Map(companies.map((c) => [c.id, c]));
  const listings = services.map((service) => {
    const offers = links
      .filter((l) => l.isActive && l.serviceId === service.id && companiesById.has(l.companyId))
      .sort((a, b) => {
        const pa = salePrice(a);
        const pb = salePrice(b);
        if (pa === null && pb === null) return 0;
        if (pa === null) return 1;
        if (pb === null) return -1;
        return pa - pb;
      });
    const map = new Map<string, Company>();
    for (const o of offers) map.set(o.companyId, companiesById.get(o.companyId)!);
    return { service, offers, companies: map };
  });
  return listings.sort((a, b) => b.offers.length - a.offers.length);
}

// ── companies ──────────────────────────────────────────────────────────────

export type CompanySort = 'topRated' | 'name' | 'mostReviewed';

/** The live average, else what is stored on the company. */
export function companyRating(company: Company, ratings: Ratings): { average: number; count: number } {
  const stats = ratings.get(ratingKey('company', company.id));
  return stats && stats.count > 0
    ? { average: averageOf(stats), count: stats.count }
    : { average: company.rating, count: company.reviewCount };
}

/** The top-level categories each company works in: what the chips filter by. */
export function companyTopCategories(
  tree: CategoryTree,
  products: Product[],
  links: CompanyService[],
  services: CatalogService[],
): Map<string, string[]> {
  const serviceCategory = new Map(services.map((s) => [s.id, s.categoryId]));
  const found = new Map<string, Set<string>>();
  function add(companyId: string, categoryId: string | null | undefined) {
    if (!companyId || !categoryId || !tree.isEffectivelyActive(categoryId)) return;
    const top = tree.pathOf(categoryId)[0];
    if (!top) return;
    if (!found.has(companyId)) found.set(companyId, new Set());
    found.get(companyId)!.add(top.id);
  }
  for (const p of products) add(p.companyId, p.categoryId);
  for (const l of links) if (l.isActive) add(l.companyId, serviceCategory.get(l.serviceId));

  const order = new Map(tree.childrenOf(null).map((c, i) => [c.id, i]));
  const rank = (id: string) => order.get(id) ?? Number.MAX_SAFE_INTEGER;
  const result = new Map<string, string[]>();
  for (const [companyId, ids] of found) {
    result.set(companyId, [...ids].sort((a, b) => rank(a) - rank(b)));
  }
  return result;
}

/** [companies] in a top-level category (or all), by [sort], those serving the city first. */
export function viewCompanies(
  companies: Company[],
  sort: CompanySort,
  ratings: Ratings,
  categoriesOf: Map<string, string[]>,
  categoryId: string | null,
  cityId: string | null,
): Company[] {
  const kept = companies.filter(
    (c) => categoryId === null || (categoriesOf.get(c.id) ?? []).includes(categoryId),
  );
  const ordered = kept.sort((a, b) => {
    const ra = companyRating(a, ratings);
    const rb = companyRating(b, ratings);
    switch (sort) {
      case 'topRated': return rb.average - ra.average || rb.count - ra.count;
      case 'mostReviewed': return rb.count - ra.count;
      case 'name': return compareText(a.name.toLowerCase(), b.name.toLowerCase());
    }
  });
  if (cityId === null) return ordered;
  return [
    ...ordered.filter((c) => servesCity(c, cityId)),
    ...ordered.filter((c) => !servesCity(c, cityId)),
  ];
}
