// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PagedOrders } from '../data/orderHooks';
import { mapCompany, mapOrder } from '../data/mappers';
import type { Order } from '../data/types';
import { ToastProvider } from '../components/feedback';
import { I18nProvider } from '../i18n/I18nProvider';
import { setUi } from '../theme/ui';
import { OrdersPage } from './OrdersPage';

const mock = vi.hoisted(() => ({ paged: null as unknown }));

vi.mock('../data/hooks', () => ({
  useCompanies: () => ({
    status: 'ready',
    error: null,
    retry: () => undefined,
    data: [mapCompany('c1', { name: 'Nile Co' }), mapCompany('c2', { name: 'Blue Co' })],
  }),
}));
vi.mock('../data/orderHooks', () => ({
  usePagedOrders: () => mock.paged,
  exportOrders: async () => ({ orders: [], capped: false }),
  useOrderStatusCounts: () => ({ processing: 3, out_for_delivery: 1, completed: 40, cancelled: 6 }),
}));
vi.mock('../data/useDashboard', () => ({ useDashboard: () => ({ snapshot: null, refreshing: false, refresh: () => undefined }) }));
vi.mock('./OrderDetailsPage', () => ({ OrderDetailsById: ({ id }: { id: string }) => <p>details of order {id}</p> }));

const order = (id: string): Order =>
  mapOrder(id, { customerId: 'u', customerName: `Customer ${id}`, companyId: 'c1', companyName: 'Nile Co', totalAmount: 100, createdAt: new Date() });

const Where = () => <p data-testid="where">{useLocation().search}</p>;
const show = (url = '/orders') =>
  render(
    <I18nProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[url]}>
          <OrdersPage />
          <Where />
        </MemoryRouter>
      </ToastProvider>
    </I18nProvider>,
  );
const where = () => screen.getByTestId('where').textContent;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('platform_admin_locale', 'en');
  mock.paged = {
    status: 'ready',
    error: null,
    orders: [order('a'), order('b')],
    hasMore: false,
    loadingMore: false,
    loadMore: vi.fn(),
    changes: 0,
    retry: vi.fn(),
  } satisfies PagedOrders;
  act(() => setUi('v2'));
});
afterEach(() => {
  cleanup();
  act(() => setUi('v1'));
});

describe('the orders list in the redesign', () => {
  it('shows the company and the dates as filter pills in the toolbar, next to the status chips and the search', () => {
    show();
    const group = screen.getByRole('group', { name: 'Filters' });
    expect(within(group).getByRole('combobox', { name: 'Company' })).toBeTruthy();
    expect(group.querySelectorAll('input[type="date"]')).toHaveLength(2);
    expect(screen.getByRole('searchbox')).toBeTruthy();
    expect(within(group).queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('offers Clear while a filter is in use, and the filters still change the address', () => {
    show('/orders?company=c1&from=2026-10-01');
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Company' }), { target: { value: 'c2' } });
    expect(where()).toContain('company=c2');
    expect(where()).toContain('from=2026-10-01');
  });

  it('opens a row in a panel beside the list, and the full page stays one click away', () => {
    show();
    expect(screen.queryByRole('complementary')).toBeNull();
    fireEvent.click(document.querySelectorAll('table.data tbody tr')[1]);
    expect(where()).toBe('?open=b');
    const panel = screen.getByRole('complementary');
    expect(within(panel).getByText('details of order b')).toBeTruthy();
    expect(within(panel).getByRole('link', { name: 'Open the full page' }).getAttribute('href')).toBe('/orders/b');
    expect(document.querySelectorAll('tr.is-open')).toHaveLength(1);
  });

  it('opens from the address, and closes with the button or Escape', () => {
    show('/orders?open=a');
    expect(within(screen.getByRole('complementary')).getByText('details of order a')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(where()).toBe('');
    fireEvent.click(document.querySelectorAll('table.data tbody tr')[0]);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('closes the panel when a filter changes', () => {
    show('/orders?open=a');
    fireEvent.click(screen.getByRole('button', { name: /Processing/ }));
    expect(where()).toBe('?status=processing');
    expect(screen.queryByRole('complementary')).toBeNull();
  });
});

describe('with the redesign off, the list is as it was', () => {
  it('shows the company and the dates in the toolbar, and a row does not open a panel', () => {
    act(() => setUi('v1'));
    show('/orders?open=a');
    expect(screen.queryByRole('button', { name: /Filters/ })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Company' })).toBeTruthy();
    expect(document.querySelectorAll('input[type="date"]')).toHaveLength(2);
    expect(screen.queryByRole('complementary')).toBeNull();
    fireEvent.click(document.querySelectorAll('table.data tbody tr')[0]);
    expect(screen.queryByRole('complementary')).toBeNull();
  });
});
