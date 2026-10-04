// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardSnapshot } from '../data/dashboardData';
import { failed, makeSnapshot, ok } from '../data/dashboardTestkit';
import { mapCustomer, mapOrder } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { ar, en } from '../i18n/dictionary';
import { DashboardPage } from './DashboardPage';

const hours = (h: number) => new Date(Date.now() - h * 3_600_000);
const days = (d: number) => hours(d * 24);

const mock = vi.hoisted(() => ({ snapshot: null as unknown, profile: { uid: 'a', fullName: 'Mona Ali', email: 'm@x.test' } as unknown }));

vi.mock('../data/useDashboard', () => ({
  useDashboard: () => ({ snapshot: mock.snapshot, refreshing: false, refresh: () => undefined }),
}));
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ state: mock.profile ? { status: 'authorized', profile: mock.profile } : { status: 'loading' } }),
}));

const order = (extra: Record<string, unknown>) =>
  mapOrder('o', { customerId: 'u', totalAmount: 100, paymentStatus: 'confirmed', orderStatus: 'completed', ...extra });

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

const tile = (label: string) => screen.getByText(label).closest('.stat') as HTMLElement;
const period = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  localStorage.clear();
  mock.profile = { uid: 'a', fullName: 'Mona Ali', email: 'm@x.test' };
});
afterEach(cleanup);

describe('Dashboard greeting', () => {
  it('greets the signed-in admin by first name and says when the figures were read', () => {
    show();
    expect(screen.getByRole('heading', { level: 1, name: 'Hello, Mona' })).toBeTruthy();
    expect(screen.getByText(/^Updated /)).toBeTruthy();
  });

  it('falls back to the plain title when no name is known', () => {
    mock.profile = null;
    show();
    expect(screen.getByRole('heading', { level: 1, name: en['dashboard.title'] })).toBeTruthy();
  });

  it('uses the email when the account has no name', () => {
    mock.profile = { uid: 'a', fullName: '', email: 'sara@x.test' };
    show();
    expect(screen.getByRole('heading', { level: 1, name: 'Hello, sara@x.test' })).toBeTruthy();
  });
});

describe('Dashboard period', () => {
  const snapshot = () =>
    makeSnapshot({
      windowOrders: ok([
        order({ createdAt: days(1) }),
        order({ createdAt: days(3) }),
        order({ createdAt: days(10) }),
        order({ createdAt: days(12) }),
        order({ createdAt: days(20) }),
        order({ createdAt: days(40) }),
      ]),
    });

  it('starts on 30 days and offers 7 and 14 next to the refresh button', () => {
    show(snapshot());
    expect(period('30 days').getAttribute('aria-pressed')).toBe('true');
    expect(period('7 days').getAttribute('aria-pressed')).toBe('false');
    expect(period('14 days')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Last 30 days' })).toBeTruthy();
  });

  it('changes the figures, the comparison and the heading together', () => {
    show(snapshot());
    expect(within(tile(en['trend.orders'])).getByText('5')).toBeTruthy();
    fireEvent.click(period('7 days'));
    expect(period('7 days').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { level: 2, name: 'Last 7 days' })).toBeTruthy();
    const orders = tile(en['trend.orders']);
    expect(orders.querySelector('.stat__value')!.textContent).toBe('2');
    // 2 in the last 7 days against 2 in the 7 before (10 and 12 days ago): no change.
    expect(orders.querySelector('.stat__hint')!.textContent).toBe('0% vs the 7 days before');
    fireEvent.click(period('14 days'));
    expect(tile(en['trend.orders']).querySelector('.stat__value')!.textContent).toBe('4');
  });

  it('counts a period by the same rule as the line chart under it', () => {
    show(snapshot());
    fireEvent.click(period('14 days'));
    const sales = tile(en['trend.sales']).querySelector('.stat__value')!.textContent;
    const chart = screen.getByRole('img', { name: /in the last 14 days/ });
    expect(chart.getAttribute('aria-label')).toContain(sales!);
  });

  it('says days the Arabic way: 3 to 10 are أيام, the rest يوماً', () => {
    localStorage.setItem('platform_admin_locale', 'ar');
    show(snapshot());
    expect(screen.getByRole('heading', { level: 2, name: 'آخر 30 يوماً' })).toBeTruthy();
    fireEvent.click(period('7 أيام'));
    expect(screen.getByRole('heading', { level: 2, name: 'آخر 7 أيام' })).toBeTruthy();
    expect(screen.getByText(ar['trend.cancelRate'])).toBeTruthy();
  });
});

describe('Dashboard trend cards', () => {
  it('draw the last days under each figure', () => {
    show(makeSnapshot({ windowOrders: ok([order({ createdAt: days(1) }), order({ createdAt: days(2) })]) }));
    for (const label of [en['trend.orders'], en['trend.sales'], en['trend.customers'], en['trend.cancelRate']]) {
      expect(tile(label).querySelector('.stat__spark svg'), label).not.toBeNull();
    }
    expect(tile(en['kpi.totalOrders'])).toBeTruthy();
    expect(tile(en['kpi.totalOrders']).querySelector('.stat__spark')).toBeNull();
  });

  it('draw one point per day of the chosen period', () => {
    show(makeSnapshot({ windowOrders: ok([order({ createdAt: days(1) })]) }));
    const points = () => (tile(en['trend.orders']).querySelector('.spark__line')!.getAttribute('d') ?? '').split(/(?=[ML])/).length;
    expect(points()).toBe(30);
    fireEvent.click(period('7 days'));
    expect(points()).toBe(7);
  });

  it('colour the change green when it is good and red when it is bad, with an arrow too', () => {
    show(
      makeSnapshot({
        windowOrders: ok([order({ createdAt: days(1) }), order({ createdAt: days(2) }), order({ createdAt: days(40) })]),
        newCustomers: ok([mapCustomer('c', { role: 'customer', createdAt: days(40) })]),
      }),
    );
    const orders = tile(en['trend.orders']).querySelector('.stat__hint')!;
    expect(orders.className).toContain('stat__hint--up');
    expect(orders.className).toContain('stat__hint--arrow-up');
    const customers = tile(en['trend.customers']).querySelector('.stat__hint')!;
    expect(customers.className).toContain('stat__hint--down');
    expect(customers.className).toContain('stat__hint--arrow-down');
  });

  it('shows a rising cancel rate as red with an up arrow, and a falling one as green with a down arrow', () => {
    show(
      makeSnapshot({
        windowOrders: ok([
          order({ createdAt: days(1) }),
          order({ createdAt: days(2), orderStatus: 'cancelled' }),
          order({ createdAt: days(40) }),
          order({ createdAt: days(41) }),
        ]),
      }),
    );
    let card = tile(en['trend.cancelRate']);
    expect(card.querySelector('.stat__value')!.textContent).toBe('50%');
    expect(card.querySelector('.stat__hint')!.textContent).toBe('+50 points vs the 30 days before');
    expect(card.querySelector('.stat__hint')!.className).toContain('stat__hint--down stat__hint--arrow-up');
    cleanup();

    show(
      makeSnapshot({
        windowOrders: ok([
          order({ createdAt: days(1) }),
          order({ createdAt: days(2) }),
          order({ createdAt: days(40) }),
          order({ createdAt: days(41), orderStatus: 'cancelled' }),
        ]),
      }),
    );
    card = tile(en['trend.cancelRate']);
    expect(card.querySelector('.stat__value')!.textContent).toBe('0%');
    expect(card.querySelector('.stat__hint')!.className).toContain('stat__hint--up stat__hint--arrow-down');
  });

  it('shows — for a cancel rate with no orders to divide by, and never invents a comparison', () => {
    show(makeSnapshot());
    const card = tile(en['trend.cancelRate']);
    expect(card.querySelector('.stat__value')!.textContent).toBe('—');
    expect(card.querySelector('.stat__hint')!.textContent).toBe(en['trend.noPrevious']);
  });

  it('shows … then a shimmering bar before the first read, and – when the source failed', () => {
    show(null);
    const value = tile(en['trend.cancelRate']).querySelector('.stat__value')!;
    expect(value.textContent).toBe('…');
    expect(value.classList.contains('skeleton')).toBe(true);
    cleanup();
    show(makeSnapshot({ windowOrders: failed }));
    expect(tile(en['trend.cancelRate']).querySelector('.stat__value')!.textContent).toBe('–');
    expect(tile(en['trend.cancelRate']).querySelector('.skeleton')).toBeNull();
  });
});

describe('Dashboard sales chart', () => {
  it('draws the confirmed sales of each day, never the unconfirmed or cancelled ones', () => {
    show(
      makeSnapshot({
        windowOrders: ok([
          order({ createdAt: hours(5), totalAmount: 300 }),
          order({ createdAt: hours(6), totalAmount: 700, orderStatus: 'cancelled' }),
          order({ createdAt: hours(7), totalAmount: 900, paymentStatus: 'pending_verification', orderStatus: 'processing' }),
        ]),
      }),
    );
    const chart = screen.getByRole('img', { name: /in the last 30 days/ });
    expect(chart.getAttribute('aria-label')).toContain('300');
    expect(chart.getAttribute('aria-label')).not.toContain('1,000');
    expect(chart.getAttribute('aria-label')).not.toContain('900');
    expect(document.querySelectorAll('.chart__dot')).toHaveLength(30);
  });

  it('follows the period and ends at today', () => {
    show(makeSnapshot({ windowOrders: ok([order({ createdAt: hours(5) })]) }));
    fireEvent.click(period('7 days'));
    expect(document.querySelectorAll('.chart__dot')).toHaveLength(7);
    expect(screen.getByText(en['dashboard.chart.today'])).toBeTruthy();
  });

  it('says so when the period had no confirmed sale, instead of drawing a flat line', () => {
    show(makeSnapshot({ windowOrders: ok([order({ createdAt: days(1), paymentStatus: 'pending_verification', orderStatus: 'processing' })]) }));
    expect(screen.getByText(en['dashboard.chart.empty'])).toBeTruthy();
    expect(document.querySelector('.chart')).toBeNull();
  });

  it('waits with a skeleton, and shows an error with a retry when the orders could not be read', () => {
    show(null);
    expect(document.querySelector('.skeleton-list')).not.toBeNull();
    cleanup();
    show(makeSnapshot({ windowOrders: failed }));
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });
});
