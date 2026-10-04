// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapCustomer } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { CustomersPage, CUSTOMERS_PER_PAGE } from './CustomersPage';

const mock = vi.hoisted(() => ({ customers: [] as unknown[], asked: [] as string[][], counts: new Map<string, number>() }));

vi.mock('../data/hooks', () => ({
  useCustomers: () => ({ status: 'ready', error: null, retry: () => undefined, data: mock.customers as never[] }),
}));
vi.mock('../data/orderHooks', () => ({
  useCustomerOrderCounts: (ids: string[]) => {
    mock.asked.push([...ids]);
    return mock.counts;
  },
}));
vi.mock('../data/actions', () => ({}));
vi.mock('../components/CustomerActions', () => ({
  CustomerCreateModal: () => null,
  CustomerEditModal: () => null,
  useToggleCustomerActive: () => ({ toggle: () => undefined, busyId: null }),
}));

const people = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    mapCustomer(`u${String(i).padStart(3, '0')}`, { role: 'customer', fullName: `Person ${String(i).padStart(3, '0')}`, createdAt: new Date(2026, 0, 1 + (i % 28)) }),
  );

const show = () =>
  render(
    <I18nProvider>
      <MemoryRouter>
        <CustomersPage />
      </MemoryRouter>
    </I18nProvider>,
  );
const rows = () => [...document.querySelectorAll('table.data tbody tr')].map((r) => r.children[0].textContent);
const range = () => document.querySelector('.card__foot .muted')!.textContent;

beforeEach(() => {
  mock.customers = people(60);
  mock.asked.length = 0;
  mock.counts = new Map();
});
afterEach(cleanup);

describe('the customer list, a page at a time', () => {
  it('shows one page, and says which rows of how many', () => {
    show();
    expect(rows()).toHaveLength(CUSTOMERS_PER_PAGE);
    expect(range()).toBe('Showing 1–25 of 60');
  });

  it('counts the orders of the customers on screen only', () => {
    show();
    const lastAsk = mock.asked[mock.asked.length - 1];
    expect(lastAsk).toHaveLength(CUSTOMERS_PER_PAGE);
    expect(lastAsk[0]).toBe(rows()[0] ? 'u000' : '');
  });

  it('moves to the next and the previous page, counting those customers instead', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: en['common.next'] }));
    expect(range()).toBe('Showing 26–50 of 60');
    expect(mock.asked[mock.asked.length - 1][0]).toBe('u025');
    fireEvent.click(screen.getByRole('button', { name: en['common.next'] }));
    expect(range()).toBe('Showing 51–60 of 60');
    expect(rows()).toHaveLength(10);
    expect((screen.getByRole('button', { name: en['common.next'] }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: en['common.previous'] }));
    expect(range()).toBe('Showing 26–50 of 60');
  });

  it('disables Previous on the first page', () => {
    show();
    expect((screen.getByRole('button', { name: en['common.previous'] }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('has no pager when everyone fits on one page', () => {
    mock.customers = people(5);
    show();
    expect(screen.queryByRole('button', { name: en['common.next'] })).toBeNull();
    expect(range()).toBe('Showing 1–5 of 5');
  });

  it('goes back to the first page when the search changes', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: en['common.next'] }));
    fireEvent.change(screen.getByPlaceholderText(en['customers.search']), { target: { value: 'Person 0' } });
    expect(range()).toBe('Showing 1–25 of 60');
    fireEvent.change(screen.getByPlaceholderText(en['customers.search']), { target: { value: 'Person 05' } });
    expect(range()).toBe('Showing 1–10 of 10');
  });

  it('sorts the whole list, then pages through it', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: en['col.name'] }));
    fireEvent.click(screen.getByRole('button', { name: en['col.name'] }));
    expect(rows()[0]).toBe('Person 059');
    fireEvent.click(screen.getByRole('button', { name: en['common.next'] }));
    expect(rows()[0]).toBe('Person 034');
  });

  it('shows … for an order count that is still being read, then the number', () => {
    mock.customers = people(2);
    mock.counts = new Map([['u001', 4]]);
    show();
    const counts = [...document.querySelectorAll('table.data tbody tr')].map((r) => r.children[5].textContent);
    expect(counts).toEqual(['…', '4']);
  });
});
