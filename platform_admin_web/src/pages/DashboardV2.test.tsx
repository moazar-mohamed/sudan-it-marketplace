// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardSnapshot } from '../data/dashboardData';
import { makeSnapshot, ok } from '../data/dashboardTestkit';
import { mapOrder } from '../data/mappers';
import type { Category } from '../data/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { setUi } from '../theme/ui';
import { DashboardPage } from './DashboardPage';

const mock = vi.hoisted(() => ({ snapshot: null as unknown }));

vi.mock('../data/useDashboard', () => ({
  useDashboard: () => ({ snapshot: mock.snapshot, refreshing: false, refresh: () => undefined }),
}));
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ state: { status: 'authorized', profile: { uid: 'a', fullName: 'Mona Ali', email: 'm@x.test' } } }),
}));
const category = (id: string, nameEn: string, parentId: string | null, sortOrder: number): Category =>
  ({ id, name: nameEn, nameAr: nameEn, nameEn, parentId, ancestorIds: [], deletionPending: false, sortOrder, description: '', iconName: '', isActive: true }) as unknown as Category;
vi.mock('../data/hooks', () => ({
  useCategories: () => ({
    status: 'ready',
    error: null,
    retry: () => undefined,
    data: [category('c1', 'Computers', null, 1), category('c2', 'Laptops', 'c1', 1), category('c3', 'Networking', null, 2)],
  }),
}));

const hours = (h: number) => new Date(Date.now() - h * 3_600_000);
const show = (snapshot: DashboardSnapshot = makeSnapshot()) => {
  mock.snapshot = snapshot;
  render(
    <I18nProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </I18nProvider>,
  );
};

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  act(() => setUi('v2'));
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  act(() => setUi('v1'));
});

describe('the home page in the redesign', () => {
  it('greets the admin and says how many things need attention, with a way to start', () => {
    show(makeSnapshot({ openOrders: ok([mapOrder('a', { orderStatus: 'processing', paymentStatus: 'pending_verification', createdAt: hours(30) })]) }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hello, Mona');
    expect(screen.getByText(/need your attention today/)).toBeTruthy();
    expect(screen.getByRole('link', { name: en['home.start'] })).toBeTruthy();
  });

  it('says so when nothing needs attention, and offers no start button', () => {
    show();
    expect(screen.getByText(en['home.allClear'])).toBeTruthy();
    expect(screen.queryByRole('link', { name: en['home.start'] })).toBeNull();
  });

  it('lists the tasks as links, each with its count', () => {
    show(makeSnapshot({ openOrders: ok([mapOrder('a', { orderStatus: 'processing', paymentStatus: 'pending_verification', createdAt: hours(30) })]) }));
    const card = screen.getByText(en['home.tasks']).closest('.card') as HTMLElement;
    const link = within(card).getAllByRole('link')[0];
    expect(link.getAttribute('href')).toContain('/orders');
    expect(link.querySelector('.home-task__count')?.textContent).toBe('1');
  });

  it('shows the top categories as tiles with their sub-category count, and a way to manage them', () => {
    show();
    const card = screen.getByText(en['home.categories']).closest('.card') as HTMLElement;
    expect(within(card).getByText('Computers')).toBeTruthy();
    expect(within(card).getByText('Networking')).toBeTruthy();
    expect(within(card).queryByText('Laptops')).toBeNull();
    expect(within(card).getByText('1 sub-categories')).toBeTruthy();
    expect(within(card).getByRole('link', { name: en['home.manageCategories'] }).getAttribute('href')).toBe('/categories');
  });

  it('keeps the period switch, the trend cards and the system totals (closed until opened)', () => {
    show();
    expect(screen.getByRole('group', { name: en['dashboard.period'] })).toBeTruthy();
    expect(screen.getByText(en['trend.orders'])).toBeTruthy();
    const totals = screen.getByRole('button', { name: new RegExp(en['home.totals']) });
    expect(totals.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(totals);
    expect(totals.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(en['kpi.totalCompanies'])).toBeTruthy();
  });

  it('has no refresh button: the figures refresh by themselves', () => {
    show();
    expect(screen.queryByRole('button', { name: en['dashboard.refresh'] })).toBeNull();
    expect(screen.getByText(/Updated/)).toBeTruthy();
  });

  it('still shows the recent orders and the recent companies', () => {
    show();
    expect(screen.getByText(en['dashboard.recentOrders'])).toBeTruthy();
    expect(screen.getByText(en['dashboard.recentCompanies'])).toBeTruthy();
  });
});

describe('with the redesign off, the home page is as it was', () => {
  it('keeps the refresh button, the trend title and no hero', () => {
    act(() => setUi('v1'));
    show();
    expect(screen.getByRole('button', { name: en['dashboard.refresh'] })).toBeTruthy();
    expect(document.querySelector('.home-hero')).toBeNull();
    expect(screen.queryByText(en['home.tasks'])).toBeNull();
  });
});
