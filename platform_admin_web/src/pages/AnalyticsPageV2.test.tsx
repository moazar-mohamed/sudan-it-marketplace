// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapOrder } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { AnalyticsPage } from './AnalyticsPage';

vi.mock('../data/hooks', () => {
  const none = () => ({ status: 'ready' as const, error: null, retry: () => undefined, data: [] as never[] });
  return { useCompanies: none, useCustomers: none };
});
vi.mock('../data/orderHooks', () => ({
  useOrdersSince: () => ({
    status: 'ready',
    error: null,
    orders: [
      mapOrder('o1', {
        customerId: 'u1',
        companyId: 'c1',
        companyName: 'Nile Co',
        productId: 'p1',
        productName: 'Router',
        quantity: 1,
        totalAmount: 100,
        orderStatus: 'completed',
        paymentStatus: 'confirmed',
        createdAt: new Date(Date.now() - 2 * 86_400_000),
      }),
    ],
    reload: () => undefined,
    retry: () => undefined,
  }),
}));
vi.mock('../components/UsageSection', () => ({ UsageSection: () => <p>usage figures</p> }));
vi.mock('../components/CitiesSection', () => ({ CitiesSection: () => <p>cities figures</p> }));

const show = (url = '/analytics') =>
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={[url]}>
        <AnalyticsPage />
      </MemoryRouter>
    </I18nProvider>,
  );
const tab = (key: 'sales' | 'companies' | 'cancellations' | 'usage') => screen.getByRole('button', { name: en[`analytics.tab.${key}`] });

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the analytics page in the redesign', () => {
  it('opens on the sales, and shows only that part', () => {
    show();
    expect(tab('sales').getAttribute('aria-current')).toBe('page');
    expect(screen.getByText(en['analytics.confirmedSales'])).toBeTruthy();
    expect(screen.getByText(en['analytics.monthSales'])).toBeTruthy();
    expect(screen.queryByText(en['analytics.topCompanies'])).toBeNull();
    expect(screen.queryByText(en['analytics.cancelReasons'])).toBeNull();
    expect(screen.queryByText('usage figures')).toBeNull();
  });

  it('each tab shows its own part: companies and products, cancellations, usage', () => {
    show();
    fireEvent.click(tab('companies'));
    expect(screen.getByText(en['analytics.topCompanies'])).toBeTruthy();
    expect(screen.getByText(en['analytics.topProducts'])).toBeTruthy();
    expect(screen.getByText(en['analytics.companiesByStatus'])).toBeTruthy();
    expect(screen.getByText('cities figures')).toBeTruthy();
    expect(screen.queryByText(en['analytics.confirmedSales'])).toBeNull();
    fireEvent.click(tab('cancellations'));
    expect(screen.getByText(en['analytics.cancelReasons'])).toBeTruthy();
    expect(screen.queryByText(en['analytics.topCompanies'])).toBeNull();
    fireEvent.click(tab('usage'));
    expect(screen.getByText('usage figures')).toBeTruthy();
    expect(screen.queryByText(en['analytics.cancelReasons'])).toBeNull();
  });

  it('opens on the tab named in the address, and keeps the period chips and the definitions on every tab', () => {
    show('/analytics?tab=usage');
    expect(tab('usage').getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('usage figures')).toBeTruthy();
    expect(within(screen.getByRole('group')).getAllByRole('button').length).toBeGreaterThan(2);
    expect(screen.getByText(en['analytics.definitions.title'])).toBeTruthy();
  });
});
