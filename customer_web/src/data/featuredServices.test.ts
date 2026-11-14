import { describe, expect, it } from 'vitest';
import { featuredServices } from './featuredServices';
import type { CompanyService, ServiceListing } from './types';

const offer = (id: string, price: number | null, offerPrice: number | null = null): CompanyService => ({
  id,
  companyId: `c_${id}`,
  serviceId: 's',
  isActive: true,
  note: '',
  price,
  offerPrice,
  offerEndsAt: null,
  offerBadge: null,
});

const listing = (name: string, offers: CompanyService[]): ServiceListing => ({
  service: { id: name, categoryId: 'k', name, description: '', isActive: true },
  offers,
  companies: new Map(),
});

describe('featured services on the home page', () => {
  it('puts a running discount first, the biggest first', () => {
    const plain = listing('Repair', [offer('a', 100)]);
    const small = listing('Cabling', [offer('b', 100, 90)]);
    const big = listing('Setup', [offer('c', 100, 50)]);
    expect(featuredServices([plain, small, big]).map((l) => l.service.name)).toEqual(['Setup', 'Cabling', 'Repair']);
  });

  it('then the services the most companies offer', () => {
    const one = listing('Repair', [offer('a', 100)]);
    const three = listing('Install', [offer('b', 100), offer('c', 120), offer('d', null)]);
    expect(featuredServices([one, three]).map((l) => l.service.name)).toEqual(['Install', 'Repair']);
  });

  it('shows at most four, and none when no company offers a service', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => listing(n, [offer(n, 100)]));
    expect(featuredServices(many)).toHaveLength(4);
    expect(featuredServices([])).toEqual([]);
  });
});
