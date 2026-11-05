// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, ToastProvider } from '../components/feedback';
import { setCompanyStatus, trashCompany } from '../data/actions';
import type { Company, Product } from '../data/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { setUi } from '../theme/ui';
import { CompaniesPage } from './CompaniesPage';

/* ---- in-memory stand-in for the live company / product collections ---- */
const store = vi.hoisted(() => ({
  companies: [] as unknown[],
  products: [] as unknown[],
  listeners: new Set<() => void>(),
}));

vi.mock('../data/hooks', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (l: () => void) => {
    store.listeners.add(l);
    return () => store.listeners.delete(l);
  };
  const live = (key: 'companies' | 'products') => () => ({
    status: 'ready' as const,
    error: null,
    retry: () => undefined,
    data: useSyncExternalStore(subscribe, () => store[key]) as never[],
  });
  return { useCompanies: live('companies'), useProducts: live('products') };
});

vi.mock('../data/actions', () => ({ trashCompany: vi.fn(), setCompanyStatus: vi.fn() }));
vi.mock('../components/CompanyCreateModal', () => ({ CompanyCreateModal: () => null }));

const setCompanies = (companies: Company[]) => {
  store.companies = companies;
  store.listeners.forEach((l) => l());
};

const company = (id: string, name: string, status: Company['status']): Company => ({
  id,
  name,
  rating: 4,
  reviewCount: 2,
  logoUrl: '',
  description: '',
  city: 'Khartoum',
  address: `${name} Street`,
  latitude: null,
  longitude: null,
  phone: '',
  email: `${id}@x.test`,
  pickupAddress: '',
  status,
  createdAt: new Date('2026-01-01'),
});

const product = (id: string, companyId: string) => ({ id, companyId, name: id }) as unknown as Product;

function Details() {
  const { id } = useParams();
  return <div data-testid="details">Company details {id}</div>;
}

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/companies']}>
      <I18nProvider>
        <ToastProvider>
          <ConfirmProvider>
            <Routes>
              <Route path="/companies" element={<CompaniesPage />} />
              <Route path="/companies/:id" element={<Details />} />
            </Routes>
          </ConfirmProvider>
        </ToastProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

const row = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;
const dialog = () => screen.getByRole('dialog');

beforeEach(() => {
  act(() => setUi('v2'));
  localStorage.setItem('platform_admin_locale', 'en');
  store.products = [product('p1', 'A'), product('p2', 'B')];
  setCompanies([company('A', 'Alpha Tech', 'active'), company('B', 'Beta Corp', 'inactive')]);
  vi.mocked(trashCompany).mockReset();
  vi.mocked(setCompanyStatus).mockReset();
  vi.mocked(setCompanyStatus).mockResolvedValue(undefined as never);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  act(() => setUi('v1'));
});

const menuButton = (name: string) => within(row(name)).getByRole('button', { name: en['common.actions'] });
const openMenu = (name: string) => {
  fireEvent.click(menuButton(name));
  return screen.getByRole('menu', { name: en['common.actions'] });
};

describe('company list row in the redesign', () => {
  it('an active company shows only the menu button; Deactivate and Move to trash sit inside it', () => {
    renderList();
    const buttons = within(row('Alpha Tech')).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(buttons).toEqual([en['common.actions']]);
    const menu = openMenu('Alpha Tech');
    const items = within(menu).getAllByRole('menuitem').map((i) => i.textContent);
    expect(items).toEqual([en['companies.deactivate'], en['companies.trash']]);
    expect(within(menu).getByRole('menuitem', { name: en['companies.trash'] }).className).toContain('row-menu__item--danger');
  });

  it('an inactive company keeps Activate in the row and Move to trash in the menu', () => {
    renderList();
    expect(within(row('Beta Corp')).getByRole('button', { name: en['companies.activate'] })).toBeTruthy();
    const items = within(openMenu('Beta Corp')).getAllByRole('menuitem').map((i) => i.textContent);
    expect(items).toEqual([en['companies.trash']]);
  });

  it('a pending company keeps Approve in the row; Reject and Move to trash sit in the menu', () => {
    setCompanies([company('P', 'Pending Co', 'pending')]);
    renderList();
    expect(within(row('Pending Co')).getByRole('button', { name: en['companies.approve'] })).toBeTruthy();
    const items = within(openMenu('Pending Co')).getAllByRole('menuitem').map((i) => i.textContent);
    expect(items).toEqual([en['companies.reject'], en['companies.trash']]);
  });

  it('the menu does not open the details', () => {
    renderList();
    openMenu('Alpha Tech');
    expect(screen.queryByTestId('details')).toBeNull();
  });

  it('Deactivate from the menu asks first, then does what it always did', async () => {
    renderList();
    fireEvent.click(within(openMenu('Alpha Tech')).getByRole('menuitem', { name: en['companies.deactivate'] }));
    expect(setCompanyStatus).not.toHaveBeenCalled();
    fireEvent.click(within(dialog()).getByRole('button', { name: en['companies.deactivate'] }));
    await waitFor(() => expect(setCompanyStatus).toHaveBeenCalledWith('A', 'inactive', expect.any(String)));
    expect(trashCompany).not.toHaveBeenCalled();
  });

  it('Move to trash from the menu asks first, says how many products hide, and cancelling moves nothing', () => {
    renderList();
    fireEvent.click(within(openMenu('Alpha Tech')).getByRole('menuitem', { name: en['companies.trash'] }));
    expect(screen.getByRole('dialog', { name: en['companies.confirmTrash.title'] })).toBeTruthy();
    expect(dialog().textContent).toContain('1 product(s)');
    fireEvent.click(within(dialog()).getByRole('button', { name: en['common.cancel'] }));
    expect(trashCompany).not.toHaveBeenCalled();
  });

  it('confirming Move to trash trashes the company', async () => {
    vi.mocked(trashCompany).mockResolvedValue(undefined as never);
    renderList();
    fireEvent.click(within(openMenu('Alpha Tech')).getByRole('menuitem', { name: en['companies.trash'] }));
    fireEvent.click(within(dialog()).getByRole('button', { name: en['companies.trash'] }));
    await waitFor(() => expect(trashCompany).toHaveBeenCalledTimes(1));
  });
});

describe('the toolbar in the redesign', () => {
  it('shows the city filter as a pill in the toolbar', () => {
    renderList();
    expect(within(screen.getByRole('group', { name: en['common.filters'] })).getByRole('combobox', { name: en['companies.cityFilter'] })).toBeTruthy();
  });
});
