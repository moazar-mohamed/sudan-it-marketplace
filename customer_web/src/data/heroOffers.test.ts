import { describe, expect, it } from 'vitest';
import { heroOffers, offerTimeLeft } from './heroOffers';
import type { CompanyService, Product, ServiceListing } from './types';

const now = new Date('2026-11-14T12:00:00Z');
const later = (ms: number) => new Date(now.getTime() + ms);

const product = (id: string, over: Partial<Product> = {}): Product => ({
  id, companyId: 'c1', companyName: 'C1', categoryId: 'k', name: id, imageUrl: '',
  price: 100, currency: 'SDG', description: '', brand: '', inStock: true, stockCount: 5,
  specifications: {}, isDeliveryAvailable: true, isInstallationAvailable: false,
  installationPrice: null, offerPrice: null, offerEndsAt: null, offerBadge: null,
  hidden: false, status: 'published', imageUrls: [], createdAt: null, ...over,
});

const offer = (id: string, price: number | null, offerPrice: number | null, offerEndsAt: Date | null = null): CompanyService => ({
  id, companyId: `c_${id}`, serviceId: 's', isActive: true, note: '', price, offerPrice, offerEndsAt, offerBadge: null,
});

const listing = (id: string, offers: CompanyService[]): ServiceListing => ({
  service: { id, categoryId: 'k', name: id, description: '', isActive: true },
  offers,
  companies: new Map(),
});

describe('heroOffers', () => {
  it('keeps only running offers, biggest discount first', () => {
    const list = heroOffers(
      [
        product('none'),
        product('ten', { offerPrice: 90 }),
        product('ended', { offerPrice: 10, offerEndsAt: later(-1000) }),
        product('half', { offerPrice: 50, offerEndsAt: later(60000) }),
      ],
      [],
      5,
      now,
    );
    expect(list.map((o) => o.key)).toEqual(['p:half', 'p:ten']);
    expect(list[0].path).toBe('/product/half');
  });

  it('shows a service once, with its best running offer, next to products', () => {
    const list = heroOffers(
      [product('p', { offerPrice: 80 })],
      [listing('svc', [offer('a', 100, 90), offer('b', 100, 60), offer('c', 100, null)]), listing('plain', [offer('d', 100, null)])],
      5,
      now,
    );
    expect(list.map((o) => o.key)).toEqual(['s:svc', 'p:p']);
    expect(list[0].item.offerPrice).toBe(60);
    expect(list[0].path).toBe('/service/svc');
    expect(list[0].kind).toBe('service');
  });

  it('puts the one ending first ahead on an equal discount, and stops at the limit', () => {
    const list = heroOffers(
      [
        product('open', { offerPrice: 80 }),
        product('soon', { offerPrice: 80, offerEndsAt: later(1000) }),
        product('x', { offerPrice: 90 }),
      ],
      [],
      2,
      now,
    );
    expect(list.map((o) => o.key)).toEqual(['p:soon', 'p:open']);
  });
});

describe('offerTimeLeft', () => {
  it('counts whole days from a day on', () => {
    expect(offerTimeLeft(later(3 * 86400000 + 5000), now)).toEqual({ days: 3 });
  });

  it('gives hours, minutes and seconds under a day', () => {
    expect(offerTimeLeft(later((5 * 3600 + 7 * 60 + 9) * 1000), now)).toEqual({ parts: ['05', '07', '09'] });
  });

  it('is null once the offer is over', () => {
    expect(offerTimeLeft(later(0), now)).toBeNull();
  });
});
