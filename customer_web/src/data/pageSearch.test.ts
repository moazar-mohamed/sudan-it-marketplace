import { describe, expect, it } from 'vitest';
import { CategoryTree } from './categoryTree';
import { narrowCompanies, narrowListings, narrowOrders, narrowProducts, narrowRequests } from './pageSearch';
import type { Category, Company, Order, Product, ServiceListing, ServiceRequest } from './types';

const category = (id: string, name: string): Category => ({
  id, name, nameAr: name, nameEn: '', description: '', parentId: null, sortOrder: null,
  iconName: '', color: '', isActive: true, deletionPending: false,
});
const tree = new CategoryTree([category('net', 'الشبكات'), category('print', 'الطابعات')]);

const product = (id: string, over: Partial<Product> = {}): Product => ({
  id, companyId: 'c1', companyName: 'Alpha Tech', categoryId: null, name: id, imageUrl: '',
  price: 100, currency: 'SDG', description: '', brand: '', inStock: true, stockCount: 5,
  specifications: {}, isDeliveryAvailable: true, isInstallationAvailable: false,
  installationPrice: null, offerPrice: null, offerEndsAt: null, offerBadge: null,
  hidden: false, status: 'published', imageUrls: [], createdAt: null, ...over,
});

const company = (id: string, over: Partial<Company> = {}): Company => ({
  id, name: id, rating: 0, reviewCount: 0, logoUrl: '', description: '', city: '', address: '',
  latitude: null, longitude: null, phone: '', status: 'active', serviceCityIds: [],
  pickupAddress: '', pickupPoints: [], paymentAccounts: [], ...over,
});

const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe('the search box inside a page', () => {
  const products = [
    product('Cisco Catalyst 2960', { categoryId: 'net', brand: 'Cisco' }),
    product('HP LaserJet Pro', { categoryId: 'print', brand: 'HP' }),
    product('Brother DCP', { categoryId: 'print', description: 'طابعة ليزر متعددة الوظائف' }),
  ];

  it('keeps everything, in the page order, while the box is empty', () => {
    expect(ids(narrowProducts(products, '  ', tree))).toEqual(ids(products));
  });

  it('finds products by name, brand, category and description', () => {
    expect(ids(narrowProducts(products, 'cisco', tree))).toEqual(['Cisco Catalyst 2960']);
    expect(ids(narrowProducts(products, 'الطابعات', tree))).toEqual(['HP LaserJet Pro', 'Brother DCP']);
    expect(ids(narrowProducts(products, 'ليزر', tree))).toEqual(['Brother DCP']);
  });

  it('keeps the order the visitor sorted by, not the match order', () => {
    const sorted = [products[2], products[1]];
    expect(ids(narrowProducts(sorted, 'الطابعات', tree))).toEqual(['Brother DCP', 'HP LaserJet Pro']);
  });

  it('finds a service by its name or by a company that offers it', () => {
    const listing = (id: string, name: string, companyName: string): ServiceListing => ({
      service: { id, categoryId: 'print', name, description: '', isActive: true },
      offers: [],
      companies: new Map([[companyName, company(companyName)]]),
    });
    const listings = [listing('s1', 'صيانة الطابعات', 'Sudan Print Hub'), listing('s2', 'تركيب الشبكات', 'Net Co')];
    expect(narrowListings(listings, 'صيانه', tree).map((l) => l.service.id)).toEqual(['s1']);
    expect(narrowListings(listings, 'net co', tree).map((l) => l.service.id)).toEqual(['s2']);
  });

  it('finds a company by name or city', () => {
    const companies = [company('Sudan Print Hub', { city: 'الخرطوم' }), company('الاقصي تكنولوجي', { city: 'أمدرمان' })];
    expect(ids(narrowCompanies(companies, 'print'))).toEqual(['Sudan Print Hub']);
    expect(ids(narrowCompanies(companies, 'امدرمان'))).toEqual(['الاقصي تكنولوجي']);
  });

  it('finds an order by product, company or order number', () => {
    const order = (id: string, productName: string, companyName: string) =>
      ({ id, productName, companyName } as unknown as Order);
    const orders = [order('AbC123xyz', 'HP LaserJet Pro', 'Sudan Print Hub'), order('ZZ9', 'Cisco Catalyst', 'Net Co')];
    expect(ids(narrowOrders(orders, 'laserjet'))).toEqual(['AbC123xyz']);
    expect(ids(narrowOrders(orders, 'net co'))).toEqual(['ZZ9']);
    expect(ids(narrowOrders(orders, 'abc123'))).toEqual(['AbC123xyz']);
  });

  it('finds a service request by service or company', () => {
    const request = (id: string, serviceName: string, companyName: string) =>
      ({ id, serviceName, companyName } as unknown as ServiceRequest);
    const requests = [request('r1', 'صيانة الطابعات', 'Sudan Print Hub'), request('r2', 'تركيب كاميرات', 'Net Co')];
    expect(ids(narrowRequests(requests, 'كاميرات'))).toEqual(['r2']);
    expect(ids(narrowRequests(requests, 'hub'))).toEqual(['r1']);
  });
});
