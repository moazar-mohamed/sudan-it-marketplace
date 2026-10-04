/*
 * The dashboard's queries (src/data/dashboardData.ts), run for real against the
 * Firestore emulator and the repository's rules: an active Platform Admin gets
 * the right figures from seeded data, and nobody else gets any. Local emulator
 * only (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { activeCompanyCount, fetchDashboard, type Piece } from '../src/data/dashboardData';

let env: RulesTestEnvironment;
const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000);
const daysAgo = (d: number) => hoursAgo(d * 24);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sudan-rules',
    firestore: {
      rules: readFileSync(
        process.env.RULES_FILE ?? fileURLToPath(new URL('../../firestore.rules', import.meta.url)),
        'utf8',
      ),
    },
  });
});
afterAll(async () => {
  await env?.cleanup();
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const put = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));

const value = <T>(piece: Piece<T>): T => {
  if (!piece.ok) throw new Error('piece failed');
  return piece.value;
};

beforeEach(async () => {
  await env.clearFirestore();
  const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
    put(`users/${id}`, { id, fullName: id, email: `${id}@x.test`, role, isActive: true, createdAt: daysAgo(200), ...extra });
  await user('pa', 'platform_admin');
  await user('pa_off', 'platform_admin', { isActive: false });
  await user('cust_old', 'customer');
  await user('cust_new', 'customer', { createdAt: daysAgo(3) });
  await user('cust_prev', 'customer', { createdAt: daysAgo(40) });
  await user('ca1', 'company_admin', { companyId: 'c1', createdAt: daysAgo(2) }); // recent, but not a customer

  const company = (id: string, extra: Record<string, unknown>) =>
    put(`companies/${id}`, { name: `Company ${id}`, rating: 0, reviewCount: 0, createdAt: daysAgo(100), ...extra });
  await company('c1', { status: 'active', createdAt: daysAgo(10) });
  await company('c_legacy', {}); // no stored status: counts as active
  await company('c_off', { status: 'inactive' });
  await company('c_pending', { status: 'pending', createdAt: daysAgo(1) });

  for (const id of ['p1', 'p2', 'p3']) await put(`products/${id}`, { id, companyId: 'c1', name: id, createdAt: daysAgo(5) });

  const order = (id: string, extra: Record<string, unknown>) =>
    put(`orders/${id}`, {
      id, customerId: 'cust_new', companyId: 'c1', companyName: 'Company c1', productId: 'p1', productName: 'p1',
      quantity: 1, totalAmount: 100, orderStatus: 'completed', paymentStatus: 'confirmed', createdAt: daysAgo(10), ...extra,
    });
  await order('o_done', {});
  await order('o_done_prev', { createdAt: daysAgo(45) });
  await order('o_old', { createdAt: daysAgo(200) });
  await order('o_unverified', { orderStatus: 'processing', paymentStatus: 'pending_verification', createdAt: hoursAgo(30) });
  await order('o_delivery', { orderStatus: 'out_for_delivery', createdAt: daysAgo(7) });
  await order('o_cancelled', { orderStatus: 'cancelled', createdAt: daysAgo(2) });

  await put('service_requests/r_pending', { id: 'r_pending', customerId: 'cust_new', companyId: 'c1', status: 'pending', createdAt: hoursAgo(60) });
  await put('service_requests/r_done', { id: 'r_done', customerId: 'cust_new', companyId: 'c1', status: 'completed', createdAt: daysAgo(9) });

  const review = (id: string, extra: Record<string, unknown>) =>
    put(`reviews/${id}`, { id, customerId: 'cust_new', companyId: 'c1', targetType: 'product', targetId: 'p1', stars: 5, hidden: false, createdAt: daysAgo(3), ...extra });
  await review('rv_low', { stars: 1 });
  await review('rv_two', { stars: 2 });
  await review('rv_good', { stars: 5 });
});

describe('the admin dashboard queries', () => {
  it('count every collection on the server', async () => {
    const snap = await fetchDashboard(as('pa'), NOW);
    const counts = Object.fromEntries(Object.entries(snap.counts).map(([k, p]) => [k, value(p)]));
    expect(counts).toEqual({
      companies: 4,
      inactiveCompanies: 2, // inactive + the legacy pending one; a company with no status is not counted
      customers: 3,
      products: 3,
      orders: 6,
      processingOrders: 1,
      completedOrders: 3,
    });
    expect(activeCompanyCount(snap.counts)).toBe(2); // c1 and the legacy company
  });

  it('read the five newest orders and companies', async () => {
    const snap = await fetchDashboard(as('pa'), NOW);
    expect(value(snap.recentOrders).map((o) => o.id)).toEqual([
      'o_unverified', 'o_cancelled', 'o_delivery', 'o_done', 'o_done_prev',
    ]);
    const companies = value(snap.recentCompanies).map((c) => c.id);
    expect(companies).toHaveLength(4);
    expect(companies[0]).toBe('c_pending');
  });

  it('read only the last 60 days of orders and only customer accounts created then', async () => {
    const snap = await fetchDashboard(as('pa'), NOW);
    expect(value(snap.windowOrders).map((o) => o.id).sort()).toEqual(
      ['o_cancelled', 'o_delivery', 'o_done', 'o_done_prev', 'o_unverified'],
    );
    // The company admin created 2 days ago is not a customer; the 200-day-old customer is out of range.
    expect(value(snap.newCustomers).map((c) => c.id).sort()).toEqual(['cust_new', 'cust_prev']);
  });

  it('read only what can still need attention', async () => {
    const snap = await fetchDashboard(as('pa'), NOW);
    expect(value(snap.openOrders).map((o) => o.id).sort()).toEqual(['o_delivery', 'o_unverified']);
    expect(value(snap.pendingRequests).map((r) => r.id)).toEqual(['r_pending']);
    expect(value(snap.lowReviews).map((r) => r.id).sort()).toEqual(['rv_low', 'rv_two']);
    // Active companies with no product: c1 has three, the legacy one (no stored status) has none.
    expect(value(snap.emptyCompanies).map((c) => c.id)).toEqual(['c_legacy']);
  });

  it('are refused for everyone who is not an active Platform Admin', async () => {
    const outsiders = [as('pa_off'), as('cust_new'), as('ca1'), env.unauthenticatedContext().firestore()];
    for (const db of outsiders) {
      const snap = await fetchDashboard(db, NOW);
      // Orders, customer accounts and service requests are never listable by them.
      expect(snap.counts.orders.ok).toBe(false);
      expect(snap.counts.customers.ok).toBe(false);
      expect(snap.recentOrders.ok).toBe(false);
      expect(snap.windowOrders.ok).toBe(false);
      expect(snap.newCustomers.ok).toBe(false);
      expect(snap.openOrders.ok).toBe(false);
      expect(snap.pendingRequests.ok).toBe(false);
    }
  });
});
