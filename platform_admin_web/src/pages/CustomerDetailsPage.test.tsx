// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapCustomer } from '../data/mappers';
import { ConfirmProvider, ToastProvider } from '../components/feedback';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { CustomerDetailsPage } from './CustomerDetailsPage';

const mock = vi.hoisted(() => ({
  customers: [] as unknown[],
  orders: [] as unknown[],
  requests: [] as unknown[],
}));

const ready = (data: unknown[]) => ({ status: 'ready', error: null, retry: () => undefined, data: data as never[] });

vi.mock('../data/hooks', () => ({
  useCustomers: () => ready(mock.customers),
  useServiceRequests: () => ready(mock.requests),
}));
vi.mock('../data/orderHooks', () => ({
  useOrdersOf: () => ({ status: 'ready', error: null, retry: () => undefined, orders: mock.orders as never[] }),
}));
vi.mock('../data/actions', () => ({ convertCustomerToCompany: vi.fn(), deleteCustomer: vi.fn() }));
vi.mock('../components/AdminNotes', () => ({ AdminNotes: () => null }));
vi.mock('../components/CustomerActions', () => ({
  CustomerEditModal: () => null,
  useToggleCustomerActive: () => ({ toggle: () => undefined, busyId: null }),
}));
vi.mock('../components/CustomerConvertModal', () => ({
  CustomerConvertModal: ({ openOrders, openRequests }: { openOrders: { id: string }[]; openRequests: { id: string }[] }) => (
    <div data-testid="convert">
      orders:{openOrders.map((o) => o.id).join(',')} requests:{openRequests.map((r) => r.id).join(',')}
    </div>
  ),
}));

const customer = (extra: Record<string, unknown> = {}) =>
  mapCustomer('cust1', { role: 'customer', fullName: 'Amna', email: 'amna@x.test', isActive: true, createdAt: new Date(2026, 0, 1), ...extra });

const order = (id: string, orderStatus: string) => ({ id, orderStatus, productName: 'Router', totalAmount: 1, createdAt: null });

const show = () =>
  render(
    <I18nProvider>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter initialEntries={['/customers/cust1']}>
            <Routes>
              <Route path="/customers/:id" element={<CustomerDetailsPage />} />
            </Routes>
          </MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
    </I18nProvider>,
  );

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  mock.customers = [customer()];
  mock.orders = [];
  mock.requests = [];
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the customer page: converting to a company', () => {
  it('offers the conversion, and opens it with nothing in progress', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: en['customer.convert'] }));
    expect(screen.getByTestId('convert').textContent).toBe('orders: requests:');
  });

  it('hands over only the work still in progress: open orders and requests, not finished ones', () => {
    mock.orders = [order('o-open', 'processing'), order('o-way', 'out_for_delivery'), order('o-done', 'completed'), order('o-no', 'cancelled')];
    mock.requests = [
      { id: 's-open', customerId: 'cust1', status: 'in_progress' },
      { id: 's-done', customerId: 'cust1', status: 'completed' },
      { id: 's-other', customerId: 'someone-else', status: 'pending' },
    ];
    show();
    fireEvent.click(screen.getByRole('button', { name: en['customer.convert'] }));
    expect(screen.getByTestId('convert').textContent).toBe('orders:o-open,o-way requests:s-open');
  });

  it('offers deleting the account too, with the same work in progress handed over', () => {
    mock.orders = [order('o-open', 'processing')];
    show();
    fireEvent.click(screen.getByRole('button', { name: en['customer.delete'] }));
    expect(screen.getByText(en['customer.delete.blocked.body'])).toBeTruthy();
  });

  it('is open to a deactivated account too', () => {
    mock.customers = [customer({ isActive: false })];
    show();
    const button = screen.getByRole('button', { name: en['customer.convert'] }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(screen.getByTestId('convert')).toBeTruthy();
  });
});
