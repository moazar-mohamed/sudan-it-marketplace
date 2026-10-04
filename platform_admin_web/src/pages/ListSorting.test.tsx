// @vitest-environment jsdom
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, ToastProvider } from '../components/feedback';
import { mapCompany, mapCompanyService, mapCustomer, mapOrder, mapProduct, mapReview, mapService } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { CompaniesPage } from './CompaniesPage';
import { CustomersPage } from './CustomersPage';
import { OffersPage } from './OffersPage';
import { OrdersPage } from './OrdersPage';
import { ProductsPage } from './ProductsPage';
import { ReviewsPage } from './ReviewsPage';

const data = vi.hoisted(() => ({
  orders: [] as unknown[],
  counts: new Map<string, number>(),
  companies: [] as unknown[],
  customers: [] as unknown[],
  products: [] as unknown[],
  reviews: [] as unknown[],
  links: [] as unknown[],
  services: [] as unknown[],
}));

vi.mock('../data/hooks', () => {
  const ready = (key: keyof typeof data) => () => ({
    status: 'ready' as const,
    error: null,
    retry: () => undefined,
    data: data[key] as never[],
  });
  return {
    useCompanies: ready('companies'),
    useCustomers: ready('customers'),
    useProducts: ready('products'),
    useReviews: ready('reviews'),
    useCompanyServices: ready('links'),
    useServices: ready('services'),
  };
});
vi.mock('../data/orderHooks', () => ({
  usePagedOrders: () => ({
    status: 'ready' as const,
    error: null,
    orders: data.orders as never[],
    hasMore: false,
    loadingMore: false,
    loadMore: () => undefined,
    refresh: () => undefined,
    retry: () => undefined,
  }),
  useOrderStatusCounts: () => null,
  useCustomerOrderCounts: () => data.counts,
}));
vi.mock('../data/useDashboard', () => ({ useDashboard: () => ({ snapshot: null, refreshing: false, refresh: () => undefined }) }));
vi.mock('../data/actions', () => ({}));
vi.mock('../components/CompanyCreateModal', () => ({ CompanyCreateModal: () => null }));
vi.mock('../components/CustomerActions', () => ({
  CustomerCreateModal: () => null,
  CustomerEditModal: () => null,
  useToggleCustomerActive: () => ({ toggle: () => undefined, busyId: null }),
}));

const show = (page: React.ReactNode) =>
  render(
    <I18nProvider>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter>{page}</MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
    </I18nProvider>,
  );

/** The text of one column, top to bottom, of the first table on the page. */
const column = (index: number, table = 0) =>
  [...document.querySelectorAll('table.data')[table].querySelectorAll('tbody tr')].map((r) => r.children[index].textContent);

const heading = (label: string, table = 0) =>
  within(document.querySelectorAll('table.data')[table] as HTMLElement).getByRole('button', { name: label });

const day = (n: number) => new Date(Date.now() - n * 86_400_000);

beforeEach(() => {
  for (const key of Object.keys(data) as (keyof typeof data)[]) {
    if (key !== 'counts') data[key] = [];
  }
  data.counts = new Map();
});
afterEach(cleanup);

describe('sortable list headings', () => {
  it('orders: sorts a money column by value, then back to the newest-first order', () => {
    data.orders = [
      mapOrder('o1', { customerId: 'u', customerName: 'Aya', totalAmount: 900, createdAt: day(1) }),
      mapOrder('o2', { customerId: 'u', customerName: 'Bashir', totalAmount: 120, createdAt: day(2) }),
      mapOrder('o3', { customerId: 'u', customerName: 'Chris', totalAmount: 5000, createdAt: day(3) }),
    ];
    show(<OrdersPage />);
    const names = () => column(1);
    expect(names()).toEqual(['Aya', 'Bashir', 'Chris']);
    fireEvent.click(heading(en['col.total']));
    expect(names()).toEqual(['Bashir', 'Aya', 'Chris']);
    fireEvent.click(heading(en['col.total']));
    expect(names()).toEqual(['Chris', 'Aya', 'Bashir']);
    fireEvent.click(heading(en['col.total']));
    expect(names()).toEqual(['Aya', 'Bashir', 'Chris']);
  });

  it('orders: sorts the loaded rows by date', () => {
    data.orders = [
      mapOrder('o1', { customerId: 'u', customerName: 'Aya', orderStatus: 'completed', createdAt: day(1) }),
      mapOrder('o2', { customerId: 'u', customerName: 'Bashir', orderStatus: 'processing', createdAt: day(5) }),
      mapOrder('o3', { customerId: 'u', customerName: 'Chris', orderStatus: 'processing', createdAt: day(3) }),
    ];
    show(<OrdersPage />);
    fireEvent.click(heading(en['col.date']));
    expect(column(1)).toEqual(['Bashir', 'Chris', 'Aya']);
  });

  it('customers: shows the order count of each customer once it is known, and sorts the other columns', () => {
    data.customers = [
      mapCustomer('c1', { role: 'customer', fullName: 'Aya', createdAt: day(30) }),
      mapCustomer('c2', { role: 'customer', fullName: 'Bashir', createdAt: day(20) }),
      mapCustomer('c3', { role: 'customer', fullName: 'Chris', createdAt: day(10) }),
    ];
    data.counts = new Map([['c2', 2], ['c3', 1]]);
    show(<CustomersPage />);
    // The count is read for the rows on screen only, so it is not a sortable column.
    expect(within(document.querySelector('table.data') as HTMLElement).queryByRole('button', { name: en['col.orders'] })).toBeNull();
    expect(column(5)).toEqual(['…', '2', '1']);
    fireEvent.click(heading(en['col.registered']));
    expect(column(0)).toEqual(['Aya', 'Bashir', 'Chris']);
  });

  it('companies: sorts by rating, and a click on a heading never opens a company', () => {
    data.companies = [
      mapCompany('c1', { name: 'Nile', rating: 3.5, status: 'active', createdAt: day(5) }),
      mapCompany('c2', { name: 'Blue', rating: 4.9, status: 'active', createdAt: day(4) }),
      mapCompany('c3', { name: 'Sun', rating: 2, status: 'active', createdAt: day(3) }),
    ];
    data.products = [];
    show(<CompaniesPage />);
    fireEvent.click(heading(en['col.rating']));
    expect(column(1)).toEqual(['Sun', 'Nile', 'Blue']);
    fireEvent.click(heading(en['col.name']));
    expect(column(1)).toEqual(['Blue', 'Nile', 'Sun']);
  });

  it('products: a product with no price sorts last whichever way the price column goes', () => {
    data.products = [
      mapProduct('p1', { name: 'Cable', price: 50, companyName: 'X' }),
      mapProduct('p2', { name: 'Quote only', companyName: 'X' }),
      mapProduct('p3', { name: 'Router', price: 900, companyName: 'X' }),
    ];
    show(<ProductsPage />);
    fireEvent.click(heading(en['col.price']));
    expect(column(1)).toEqual(['Cable', 'Router', 'Quote only']);
    fireEvent.click(heading(en['col.price']));
    expect(column(1)).toEqual(['Router', 'Cable', 'Quote only']);
  });

  it('reviews: sorts by stars', () => {
    data.reviews = [
      mapReview('r1', { authorName: 'Aya', stars: 5, createdAt: day(1) }),
      mapReview('r2', { authorName: 'Bashir', stars: 1, createdAt: day(2) }),
      mapReview('r3', { authorName: 'Chris', stars: 3, createdAt: day(3) }),
    ];
    show(<ReviewsPage />);
    expect(column(0)).toEqual(['Aya', 'Bashir', 'Chris']);
    fireEvent.click(heading(en['col.rating']));
    expect(column(0)).toEqual(['Bashir', 'Chris', 'Aya']);
  });

  it('offers: the product table and the service table sort on their own', () => {
    data.companies = [mapCompany('c1', { name: 'Nile' }), mapCompany('c2', { name: 'Blue' })];
    data.services = [mapService('s1', { name: 'Cabling', isActive: true })];
    data.products = [
      mapProduct('p1', { name: 'Router', companyName: 'Nile', price: 100, offerPrice: 90 }),
      mapProduct('p2', { name: 'Antenna', companyName: 'Blue', price: 100, offerPrice: 50 }),
    ];
    data.links = [
      mapCompanyService('l1', { companyId: 'c1', serviceId: 's1', isActive: true, price: 500, offerPrice: 400 }),
      mapCompanyService('l2', { companyId: 'c2', serviceId: 's1', isActive: true, price: 300, offerPrice: 100 }),
    ];
    show(<OffersPage />);
    fireEvent.click(heading(en['offers.col.offer'], 0));
    expect(column(0, 0)).toEqual(['Antenna', 'Router']);
    // The service table was not touched.
    expect(column(1, 1)).toEqual(['Nile', 'Blue']);
    fireEvent.click(heading(en['offers.col.offer'], 1));
    expect(column(1, 1)).toEqual(['Blue', 'Nile']);
    expect(column(0, 0)).toEqual(['Antenna', 'Router']);
  });

  it('every list marks its sorted column for assistive technology', () => {
    data.orders = [mapOrder('o1', { customerId: 'u', totalAmount: 1 })];
    show(<OrdersPage />);
    const th = heading(en['col.total']).closest('th')!;
    expect(th.getAttribute('aria-sort')).toBe('none');
    fireEvent.click(heading(en['col.total']));
    expect(th.getAttribute('aria-sort')).toBe('ascending');
  });
});
