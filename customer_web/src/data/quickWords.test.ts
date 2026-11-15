import { describe, expect, it } from 'vitest';
import { CategoryTree } from './categoryTree';
import { workingQuickWords } from './quickWords';
import type { CatalogService, Category, Company, Product } from './types';

const category = (id: string, name: string): Category => ({
  id, name, nameAr: name, nameEn: '', description: '', parentId: null, sortOrder: null,
  iconName: '', color: '', isActive: true, deletionPending: false,
});

const product = (id: string, over: Partial<Product> = {}): Product => ({
  id, companyId: 'c1', companyName: 'Sudan Print Hub', categoryId: null, name: id, imageUrl: '',
  price: 100, currency: 'SDG', description: '', brand: '', inStock: true, stockCount: 5,
  specifications: {}, isDeliveryAvailable: true, isInstallationAvailable: false,
  installationPrice: null, offerPrice: null, offerEndsAt: null, offerBadge: null,
  hidden: false, status: 'published', imageUrls: [], createdAt: null, ...over,
});

const service = (id: string, name: string): CatalogService => ({ id, categoryId: 'print', name, description: '', isActive: true });

const company = (id: string, name: string): Company => ({
  id, name, rating: 0, reviewCount: 0, logoUrl: '', description: '', city: '', address: '',
  latitude: null, longitude: null, phone: '', status: 'active', serviceCityIds: [],
  pickupAddress: '', pickupPoints: [],
});

const catalog = {
  tree: new CategoryTree([category('print', 'الطابعات')]),
  products: [
    product('HP LaserJet Pro', { categoryId: 'print', brand: 'HP', description: 'طابعة ليزر' }),
    product('Canon 85A Toner', { categoryId: 'print', brand: 'Canon', description: 'خرطوشة حبر' }),
  ],
  services: [service('s1', 'صيانة الطابعات')],
  companies: [company('c1', 'Sudan Print Hub')],
};

describe('quick-search words on the home page', () => {
  it('drops words that would find nothing', () => {
    expect(workingQuickWords(['Cisco', 'راوتر', 'HP', 'UPS', 'Canon'], catalog)).toEqual(['HP', 'Canon']);
  });

  it('keeps the given order and stops at the limit', () => {
    expect(workingQuickWords(['طابعة', 'HP', 'Canon', 'حبر', 'صيانة'], catalog, 3)).toEqual(['طابعة', 'HP', 'Canon']);
  });

  it('counts services and companies, not only products', () => {
    expect(workingQuickWords(['صيانة', 'Sudan Print Hub'], catalog)).toEqual(['صيانة', 'Sudan Print Hub']);
  });

  it('skips repeats and blank words', () => {
    expect(workingQuickWords(['HP', 'hp', '  ', 'HP '], catalog)).toEqual(['HP']);
  });

  it('offers nothing when the catalog is empty', () => {
    expect(workingQuickWords(['HP', 'Cisco'], { ...catalog, products: [], services: [], companies: [] })).toEqual([]);
  });
});
