// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapCustomer } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { CustomersPage } from './CustomersPage';

const mock = vi.hoisted(() => ({ customers: [] as unknown[], toggled: [] as string[], edited: [] as string[] }));

vi.mock('../data/hooks', () => ({
  useCustomers: () => ({ status: 'ready', error: null, retry: () => undefined, data: mock.customers as never[] }),
}));
vi.mock('../data/orderHooks', () => ({ useCustomerOrderCounts: () => new Map([['u1', 3]]) }));
vi.mock('../data/actions', () => ({}));
vi.mock('../components/CustomerActions', () => ({
  CustomerCreateModal: () => null,
  CustomerEditModal: ({ customer }: { customer: { id: string } }) => {
    mock.edited.push(customer.id);
    return null;
  },
  useToggleCustomerActive: () => ({ toggle: (c: { id: string }) => mock.toggled.push(c.id), busyId: null }),
}));

const show = () =>
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/customers']}>
        <Routes>
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:id" element={<p>details of the customer</p>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  mock.customers = [
    mapCustomer('u1', { role: 'customer', fullName: 'Amna Customer', email: 'amna@x.test', createdAt: new Date(2026, 0, 1) }),
  ];
  mock.toggled.length = 0;
  mock.edited.length = 0;
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const row = () => document.querySelector('table.data tbody tr') as HTMLElement;

describe('a customer row', () => {
  it('opens the customer from any cell, not only the name', () => {
    for (const cell of [1, 2, 3, 4, 5]) {
      show();
      fireEvent.click(row().children[cell]);
      expect(screen.getByText('details of the customer')).toBeTruthy();
      cleanup();
    }
  });

  it('opens it from the row itself, and shows it can be clicked', () => {
    show();
    expect(row().classList.contains('row--clickable')).toBe(true);
    fireEvent.click(row());
    expect(screen.getByText('details of the customer')).toBeTruthy();
  });

  it('leaves its buttons to do their own work', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: en['common.edit'] }));
    fireEvent.click(screen.getByRole('button', { name: en['customer.deactivateShort'] }));
    expect(mock.edited).toContain('u1');
    expect(mock.toggled).toEqual(['u1']);
    expect(screen.queryByText('details of the customer')).toBeNull();
  });

  it('still opens it from the name link and the View link', () => {
    show();
    fireEvent.click(screen.getByRole('link', { name: en['common.view'] }));
    expect(screen.getByText('details of the customer')).toBeTruthy();
  });
});
