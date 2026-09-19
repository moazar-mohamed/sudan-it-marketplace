import { describe, expect, it } from 'vitest';
import dashboardSource from '../pages/DashboardPage.tsx?raw';
import { mapCompany, mapCustomer, mapOrder, mapProduct } from './mappers';
import { countActiveCompanies, countOrdersWithStatus, isActiveCompany } from './stats';
import { COMPANY_FILTER_STATUSES, ORDER_STATUSES } from './types';

// Documents shaped like the ones Firestore returns (and the Flutter app writes).
const companies = [
  { name: 'Khartoum Tech', status: 'active' },
  { name: 'Legacy Co (no status field)' },
  { name: 'Nile Co', status: 'inactive' },
].map((d, i) => mapCompany(`c${i}`, d));

const orders = [
  { orderStatus: 'processing' },
  { orderStatus: 'out_for_delivery' },
  { orderStatus: 'completed' },
  { orderStatus: 'completed' },
  { orderStatus: 'outForDelivery' },
].map((d, i) => mapOrder(`o${i}`, { customerId: 'u1', totalAmount: 10, ...d }));

describe('dashboard statistic cards', () => {
  it('total companies / customers / products / orders count every document', () => {
    expect(companies).toHaveLength(3);
    expect(orders).toHaveLength(5);
    expect([{ role: 'customer' }, { role: 'customer', isActive: false }].map((d, i) => mapCustomer(`u${i}`, d))).toHaveLength(2);
    expect([{ name: 'A' }, { name: 'B' }].map((d, i) => mapProduct(`p${i}`, d))).toHaveLength(2);
  });

  it('active companies counts stored "active" plus companies with no stored status', () => {
    expect(countActiveCompanies(companies)).toBe(2);
    expect(companies.filter(isActiveCompany).map((c) => c.name)).toEqual([
      'Khartoum Tech',
      'Legacy Co (no status field)',
    ]);
  });

  it('processing / completed orders count exactly their own status', () => {
    expect(countOrdersWithStatus(orders, 'processing')).toBe(1);
    expect(countOrdersWithStatus(orders, 'completed')).toBe(2);
    // The remaining status is the third bucket; every order lands in exactly one.
    expect(countOrdersWithStatus(orders, 'out_for_delivery')).toBe(2);
    const sum = ORDER_STATUSES.reduce((n, s) => n + countOrdersWithStatus(orders, s), 0);
    expect(sum).toBe(orders.length);
  });

  it('empty collections give zero, not a placeholder', () => {
    expect(countActiveCompanies([])).toBe(0);
    expect(countOrdersWithStatus([], 'processing')).toBe(0);
  });
});

describe('dashboard source', () => {
  it('reads live Firestore data only: no mock/demo data', () => {
    expect(dashboardSource).not.toMatch(/mock|demo|faker/i);
    for (const hook of ['useCompanies', 'useCustomers', 'useProducts', 'useOrders']) {
      expect(dashboardSource).toContain(hook);
    }
  });

  it('has no Pending companies card or statistic', () => {
    expect(dashboardSource).not.toMatch(/pending/i);
  });

  it('every card links to a page and a filter that exist', () => {
    const links = [...dashboardSource.matchAll(/to="(\/[^"]*)"/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThanOrEqual(7); // seven cards (+ the two "view all" links)
    for (const link of links) {
      const url = new URL(link, 'http://x');
      expect(['/companies', '/customers', '/products', '/orders']).toContain(url.pathname);
      const status = url.searchParams.get('status');
      if (status === null) continue;
      const allowed: readonly string[] =
        url.pathname === '/companies' ? COMPANY_FILTER_STATUSES : ORDER_STATUSES;
      expect(allowed).toContain(status);
    }
    // The filtered cards are wired to the matching filters.
    expect(links).toContain('/companies?status=active');
    expect(links).toContain('/orders?status=processing');
    expect(links).toContain('/orders?status=completed');
  });
});
