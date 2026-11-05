// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapCustomer } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { setUi } from '../theme/ui';
import { CustomersPage } from './CustomersPage';

const mock = vi.hoisted(() => ({ customers: [] as unknown[] }));

vi.mock('../data/hooks', () => ({
  useCustomers: () => ({ status: 'ready', error: null, retry: () => undefined, data: mock.customers as never[] }),
}));
vi.mock('../data/orderHooks', () => ({ useCustomerOrderCounts: () => new Map([['u1', 3]]) }));
vi.mock('../data/actions', () => ({}));
vi.mock('../components/CustomerActions', () => ({
  CustomerCreateModal: () => null,
  CustomerEditModal: () => null,
  useToggleCustomerActive: () => ({ toggle: () => undefined, busyId: null }),
}));
vi.mock('./CustomerDetailsPage', () => ({ CustomerDetails: ({ id }: { id: string }) => <p>details of customer {id}</p> }));

const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;
const show = (url = '/customers') =>
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:id" element={<p>full page of the customer</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </I18nProvider>,
  );
const row = () => document.querySelector('table.data tbody tr') as HTMLElement;

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  mock.customers = [mapCustomer('u1', { role: 'customer', fullName: 'Amna Customer', email: 'amna@x.test', createdAt: new Date(2026, 0, 1) })];
  act(() => setUi('v2'));
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  act(() => setUi('v1'));
});

describe('the customer list in the redesign', () => {
  it('opens a row in a panel beside the list instead of leaving the list', () => {
    show();
    fireEvent.click(row().children[2]);
    expect(screen.getByTestId('where').textContent).toBe('/customers?open=u1');
    const panel = screen.getByRole('complementary', { name: 'Amna Customer' });
    expect(within(panel).getByText('details of customer u1')).toBeTruthy();
    expect(within(panel).getByRole('link', { name: 'Open the full page' }).getAttribute('href')).toBe('/customers/u1');
    expect(document.querySelectorAll('tr.is-open')).toHaveLength(1);
  });

  it('opens from the address and closes with the button', () => {
    show('/customers?open=u1');
    expect(screen.getByRole('complementary')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByTestId('where').textContent).toBe('/customers');
  });

  it('a button in the row keeps its own action and does not open the panel', () => {
    show();
    fireEvent.click(within(row()).getByRole('button', { name: /Edit/ }));
    expect(screen.queryByRole('complementary')).toBeNull();
  });
});

describe('with the redesign off, a row still goes to the customer page', () => {
  it('navigates and shows no panel', () => {
    act(() => setUi('v1'));
    show();
    fireEvent.click(row().children[2]);
    expect(screen.getByText('full page of the customer')).toBeTruthy();
    expect(screen.queryByRole('complementary')).toBeNull();
  });
});
