import type { CategoryTree } from './categoryTree';
import { categorySearchText } from './format';
import { searchRanked } from './searchRanking';
import type { Company, Order, Product, ServiceListing, ServiceRequest } from './types';

// The search box inside a page narrows what that page already shows. It uses
// the same matching as the site's search (every word must match, Arabic
// spellings folded, synonyms), but keeps the page's own order: the sort the
// visitor chose still applies to what is left.

function narrow<T>(items: readonly T[], query: string, fieldsOf: Parameters<typeof searchRanked<T>>[2]): T[] {
  if (query.trim() === '') return [...items];
  const hits = new Set(searchRanked(items, query, fieldsOf));
  return items.filter((item) => hits.has(item));
}

const categoryText = (tree: CategoryTree, id: string | null) => {
  const category = tree.byId(id);
  return category ? categorySearchText(category) : '';
};

/** Products by name, category, brand, company, description and specifications. */
export const narrowProducts = (products: readonly Product[], query: string, tree: CategoryTree): Product[] =>
  narrow(products, query, (p) => [
    { text: p.name, weight: 3 },
    { text: categoryText(tree, p.categoryId), weight: 2 },
    { text: p.brand, weight: 2 },
    { text: p.companyName },
    { text: p.description },
    { text: Object.entries(p.specifications).map(([k, v]) => `${k} ${v}`).join(' ') },
  ]);

/** Services by name, category, description and the companies that offer them. */
export const narrowListings = (listings: readonly ServiceListing[], query: string, tree: CategoryTree): ServiceListing[] =>
  narrow(listings, query, (l) => [
    { text: l.service.name, weight: 3 },
    { text: categoryText(tree, l.service.categoryId), weight: 2 },
    { text: l.service.description },
    { text: [...l.companies.values()].map((c) => c.name).join(' ') },
  ]);

/** Companies by name, city, address and description. */
export const narrowCompanies = (companies: readonly Company[], query: string): Company[] =>
  narrow(companies, query, (c) => [
    { text: c.name, weight: 3 },
    { text: c.city },
    { text: c.address },
    { text: c.description },
  ]);

/** The customer's orders by product, company and order number. */
export const narrowOrders = (orders: readonly Order[], query: string): Order[] =>
  narrow(orders, query, (o) => [
    { text: o.productName, weight: 3 },
    { text: o.companyName, weight: 2 },
    { text: o.id },
  ]);

/** The customer's service requests by service, company and request number. */
export const narrowRequests = (requests: readonly ServiceRequest[], query: string): ServiceRequest[] =>
  narrow(requests, query, (r) => [
    { text: r.serviceName, weight: 3 },
    { text: r.companyName, weight: 2 },
    { text: r.id },
  ]);
