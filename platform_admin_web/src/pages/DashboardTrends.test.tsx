// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardSnapshot } from '../data/dashboardData';
import { failed, makeSnapshot, ok } from '../data/dashboardTestkit';
import { mapCustomer, mapOrder } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { DashboardPage } from './DashboardPage';

const hours = (h: number) => new Date(Date.now() - h * 3_600_000);

const mock = vi.hoisted(() => ({ snapshot: null as unknown }));

vi.mock('../data/useDashboard', () => ({
  useDashboard: () => ({ snapshot: mock.snapshot, refreshing: false, refresh: () => undefined }),
}));
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ state: { status: 'authorized', profile: { uid: 'a', fullName: 'Mona Ali', email: 'm@x.test' } } }),
}));

const order = (extra: Record<string, unknown>) => mapOrder('o', { customerId: 'u', totalAmount: 100, ...extra });

const show = (snapshot: DashboardSnapshot | null = makeSnapshot()) => {
  mock.snapshot = snapshot;
  render(
    <I18nProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </I18nProvider>,
  );
};

afterEach(cleanup);

describe('Dashboard "Last 30 days"', () => {
  const tile = (label: string) => {
    const el = screen.getByText(label).closest('.stat') as HTMLElement;
    return {
      value: el.querySelector('.stat__value')!.textContent,
      hint: el.querySelector('.stat__hint')?.textContent ?? null,
    };
  };

  it('compares orders with the 30 days before', () => {
    show(
      makeSnapshot({
        windowOrders: ok([order({ createdAt: hours(24) }), order({ createdAt: hours(48) }), order({ createdAt: hours(24 * 40) })]),
      }),
    );
    expect(tile(en['trend.orders'])).toEqual({ value: '2', hint: '+100% vs the 30 days before' });
  });

  it('counts only confirmed, not cancelled orders as sales', () => {
    show(
      makeSnapshot({
        windowOrders: ok([
          order({ createdAt: hours(24), paymentStatus: 'confirmed' }),
          order({ createdAt: hours(24), paymentStatus: 'confirmed', orderStatus: 'cancelled', totalAmount: 900 }),
          order({ createdAt: hours(24), paymentStatus: 'pending_verification', orderStatus: 'processing', totalAmount: 5000 }),
        ]),
      }),
    );
    const { value, hint } = tile(en['trend.sales']);
    expect(value).toContain('100');
    expect(value).not.toContain('1,000');
    expect(value).not.toContain('5,');
    expect(hint).toBe(en['trend.noPrevious']);
  });

  it('says there is nothing to compare with instead of inventing a percentage', () => {
    show(makeSnapshot({ newCustomers: ok([mapCustomer('c', { role: 'customer', createdAt: hours(10) })]) }));
    expect(tile(en['trend.customers'])).toEqual({ value: '1', hint: en['trend.noPrevious'] });
  });

  it('shows … before the first read and – when the source failed', () => {
    show(null);
    expect(tile(en['trend.orders'])).toEqual({ value: '…', hint: null });
    cleanup();
    show(makeSnapshot({ newCustomers: failed }));
    expect(tile(en['trend.customers'])).toEqual({ value: '–', hint: null });
  });
});

describe('Dashboard layout and refresh', () => {
  it('offers a refresh and says when the figures were read', () => {
    show();
    expect(screen.getByRole('button', { name: en['dashboard.refresh'] })).toBeTruthy();
    expect(screen.getByText(/^Updated /)).toBeTruthy();
  });

  it('shows the five newest orders and companies it was given', () => {
    show(
      makeSnapshot({
        recentOrders: ok([mapOrder('abcdefgh1234', { customerId: 'u', totalAmount: 5, companyName: 'Nile Co' })]),
      }),
    );
    expect(screen.getByText('#abcdefgh')).toBeTruthy();
  });
});
