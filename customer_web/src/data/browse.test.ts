import { describe, expect, it } from 'vitest';
import {
  brandsOf,
  buildServiceListings,
  countByCategory,
  filterListings,
  filterProducts,
  NO_FILTERS,
  servesCity,
  sortProducts,
  startsFrom,
} from './browse';
import { CategoryTree } from './categoryTree';
import { discountPercent, hasActiveOffer, isAvailable, salePrice } from './format';
import type { CatalogService, Category, Company, CompanyService, Product } from './types';

const category = (id: string, parentId: string | null = null, isActive = true): Category => ({
  id, name: id, nameAr: '', nameEn: '', description: '', parentId, sortOrder: null,
  iconName: '', color: '', isActive, deletionPending: false,
});

const product = (id: string, over: Partial<Product> = {}): Product => ({
  id, companyId: 'c1', companyName: 'C1', categoryId: null, name: id, imageUrl: '',
  price: 100, currency: 'SDG', description: '', brand: '', inStock: true, stockCount: 5,
  specifications: {}, isDeliveryAvailable: true, isInstallationAvailable: false,
  installationPrice: null, offerPrice: null, offerEndsAt: null, offerBadge: null,
  hidden: false, createdAt: null, ...over,
});

const company = (id: string, serviceCityIds: string[] = []): Company => ({
  id, name: id, rating: 0, reviewCount: 0, logoUrl: '', description: '', city: '', address: '',
  latitude: null, longitude: null, phone: '', status: 'active', serviceCityIds,
  pickupAddress: '', pickupPoints: [], paymentAccounts: [],
});

const noRatings = new Map();

describe('offers', () => {
  const past = new Date(Date.now() - 1000);
  const future = new Date(Date.now() + 100000);

  it('uses the offer price only while it runs', () => {
    expect(salePrice(product('a', { offerPrice: 80, offerEndsAt: future }))).toBe(80);
    expect(salePrice(product('a', { offerPrice: 80, offerEndsAt: null }))).toBe(80);
    expect(salePrice(product('a', { offerPrice: 80, offerEndsAt: past }))).toBe(100);
  });

  it('ignores an offer that is not below the price', () => {
    expect(hasActiveOffer(product('a', { offerPrice: 100 }))).toBe(false);
    expect(hasActiveOffer(product('a', { price: null, offerPrice: 50 }))).toBe(false);
  });

  it('rounds the discount to a whole percent', () => {
    expect(discountPercent(product('a', { offerPrice: 67 }))).toBe(33);
  });
});

describe('availability', () => {
  it('needs both the switch and stock', () => {
    expect(isAvailable(product('a'))).toBe(true);
    expect(isAvailable(product('a', { inStock: false }))).toBe(false);
    expect(isAvailable(product('a', { stockCount: 0 }))).toBe(false);
  });
});

describe('category tree', () => {
  const tree = new CategoryTree([category('a'), category('b', 'a'), category('c', 'b'), category('off', null, false), category('under', 'off')]);

  it('walks paths and subtrees at any depth', () => {
    expect(tree.pathOf('c').map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect([...tree.subtreeIds('a')].sort()).toEqual(['a', 'b', 'c']);
  });

  it('hides everything under an inactive parent', () => {
    expect(tree.isEffectivelyActive('c')).toBe(true);
    expect(tree.isEffectivelyActive('under')).toBe(false);
    expect(tree.activeChildrenOf(null).map((x) => x.id)).toEqual(['a']);
  });

  it('survives a cycle in bad data', () => {
    const loop = new CategoryTree([category('x', 'y'), category('y', 'x')]);
    expect(loop.pathOf('x')).toHaveLength(2);
  });

  it('counts an item in every category above it', () => {
    const counts = countByCategory(tree, ['c', null, 'missing'], ['b']);
    expect(counts.get('a')).toEqual({ products: 1, services: 1 });
    expect(counts.get('c')).toEqual({ products: 1, services: 0 });
  });
});

describe('filters', () => {
  const items = [
    product('cheap', { price: 10, brand: 'HP' }),
    product('dear', { price: 500, brand: ' hp ', companyId: 'c2' }),
    product('none', { price: null, brand: 'Dell' }),
    product('off', { inStock: false, price: 100 }),
  ];
  const ids = (list: Product[]) => list.map((p) => p.id);

  it('narrows by price, leaving out products without one', () => {
    expect(ids(filterProducts(items, { ...NO_FILTERS, minPrice: 50 }, noRatings))).toEqual(['dear', 'off']);
    expect(ids(filterProducts(items, { ...NO_FILTERS, maxPrice: 50 }, noRatings))).toEqual(['cheap']);
  });

  it('treats a brand the same however it is spelled', () => {
    expect(ids(filterProducts(items, { ...NO_FILTERS, brand: 'HP' }, noRatings))).toEqual(['cheap', 'dear']);
    expect(brandsOf(items)).toEqual(['Dell', 'HP']);
  });

  it('narrows by company and stock', () => {
    expect(ids(filterProducts(items, { ...NO_FILTERS, companyId: 'c2' }, noRatings))).toEqual(['dear']);
    expect(ids(filterProducts(items, { ...NO_FILTERS, inStock: true }, noRatings))).toEqual(['cheap', 'dear', 'none']);
  });

  it('leaves services out when a product-only filter is on', () => {
    const service: CatalogService = { id: 's', categoryId: 'a', name: 's', description: '', isActive: true };
    const link: CompanyService = { id: 'l', companyId: 'c1', serviceId: 's', isActive: true, note: '', price: 50, offerPrice: null, offerEndsAt: null, offerBadge: null };
    const listings = buildServiceListings([service], [link], [company('c1')]);
    expect(filterListings(listings, NO_FILTERS)).toHaveLength(1);
    expect(filterListings(listings, { ...NO_FILTERS, brand: 'HP' })).toHaveLength(0);
    expect(filterListings(listings, { ...NO_FILTERS, inStock: true })).toHaveLength(0);
    expect(filterListings(listings, { ...NO_FILTERS, kind: 'products' })).toHaveLength(0);
  });
});

describe('sorting', () => {
  const d = (n: number) => new Date(2026, 0, n);
  const items = [
    product('old', { createdAt: d(1), price: 30, companyId: 'near' }),
    product('new', { createdAt: d(9), price: 20, companyId: 'far' }),
    product('free', { createdAt: d(5), price: null, companyId: 'far' }),
  ];
  const ids = (list: Product[]) => list.map((p) => p.id);

  it('orders by price with no price last, either way', () => {
    expect(ids(sortProducts(items, 'priceLow', noRatings))).toEqual(['new', 'old', 'free']);
    expect(ids(sortProducts(items, 'priceHigh', noRatings))).toEqual(['old', 'new', 'free']);
  });

  it('puts the city first only in the default order', () => {
    const serves = (p: Product) => p.companyId === 'near';
    expect(ids(sortProducts(items, 'newest', noRatings, serves))).toEqual(['old', 'new', 'free']);
    expect(ids(sortProducts(items, 'priceLow', noRatings, serves))).toEqual(['new', 'old', 'free']);
  });
});

describe('cities', () => {
  it('restricts only when both sides have said', () => {
    expect(servesCity(company('a'), 'khartoum')).toBe(true);
    expect(servesCity(company('a', ['kassala']), null)).toBe(true);
    expect(servesCity(company('a', ['kassala']), 'khartoum')).toBe(false);
  });
});

describe('service listings', () => {
  const service: CatalogService = { id: 's', categoryId: 'a', name: 's', description: '', isActive: true };
  const link = (id: string, companyId: string, price: number | null): CompanyService => ({
    id, companyId, serviceId: 's', isActive: true, note: '', price, offerPrice: null, offerEndsAt: null, offerBadge: null,
  });

  it('starts from the cheapest, with no price last, and only visible companies', () => {
    const listings = buildServiceListings(
      [service],
      [link('1', 'a', null), link('2', 'b', 30), link('3', 'hidden', 5)],
      [company('a'), company('b')],
    );
    expect(listings[0].offers.map((o) => o.id)).toEqual(['2', '1']);
    expect(startsFrom(listings[0])).toBe(30);
  });
});
