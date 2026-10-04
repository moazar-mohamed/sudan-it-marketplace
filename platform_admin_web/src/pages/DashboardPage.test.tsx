// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardSnapshot } from '../data/dashboardData';
import { failed, makeSnapshot, ok } from '../data/dashboardTestkit';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { DashboardPage } from './DashboardPage';

const mock = vi.hoisted(() => ({ snapshot: null as unknown }));

vi.mock('../data/useDashboard', () => ({
  useDashboard: () => ({ snapshot: mock.snapshot, refreshing: false, refresh: () => undefined }),
}));
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ state: { status: 'authorized', profile: { uid: 'a', fullName: 'Mona Ali', email: 'm@x.test' } } }),
}));

const show = (snapshot: DashboardSnapshot | null) => {
  mock.snapshot = snapshot;
  render(
    <I18nProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </I18nProvider>,
  );
};

const tile = (label: string) => {
  const el = screen.getByText(label).closest('a')!;
  return el.querySelector('.stat__value')!.textContent;
};

afterEach(cleanup);

describe('Dashboard totals', () => {
  it('shows each server-side count', () => {
    show(
      makeSnapshot({
        counts: {
          companies: ok(7),
          inactiveCompanies: ok(2),
          customers: ok(41),
          products: ok(120),
          orders: ok(300),
          processingOrders: ok(12),
          completedOrders: ok(250),
        },
      }),
    );
    expect(tile(en['kpi.totalCompanies'])).toBe('7');
    expect(tile(en['kpi.activeCompanies'])).toBe('5');
    expect(tile(en['kpi.totalCustomers'])).toBe('41');
    expect(tile(en['kpi.totalProducts'])).toBe('120');
    expect(tile(en['kpi.totalOrders'])).toBe('300');
    expect(tile(en['kpi.processingOrders'])).toBe('12');
    expect(tile(en['kpi.completedOrders'])).toBe('250');
  });

  it('shows … until the first read finishes, never a partial count', () => {
    show(null);
    expect(tile(en['kpi.totalCustomers'])).toBe('…');
    expect(tile(en['kpi.activeCompanies'])).toBe('…');
  });

  it('shows – for a count that could not be read, never 0, and keeps the others', () => {
    show(makeSnapshot({ counts: { customers: failed, companies: ok(4), inactiveCompanies: failed, orders: ok(9) } }));
    expect(tile(en['kpi.totalCustomers'])).toBe('–');
    expect(tile(en['kpi.totalOrders'])).toBe('9');
    expect(tile(en['kpi.totalCompanies'])).toBe('4');
    // Active companies need both counts.
    expect(tile(en['kpi.activeCompanies'])).toBe('–');
  });

  it('counts a company with no stored status as active (all minus the stored non-active)', () => {
    show(makeSnapshot({ counts: { companies: ok(3), inactiveCompanies: ok(1) } }));
    expect(tile(en['kpi.activeCompanies'])).toBe('2');
  });
});
