// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, ToastProvider } from '../components/feedback';
import { deleteCompany, setCompanyStatus } from '../data/actions';
import type { Company, Product } from '../data/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { ar, en } from '../i18n/dictionary';
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

vi.mock('../data/actions', () => ({ deleteCompany: vi.fn(), setCompanyStatus: vi.fn() }));
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

const summary = { companyDeleted: true, admins: 1, technicians: 2, invites: 1, products: 3, other: 4, ordersKept: 5 };

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
  localStorage.setItem('platform_admin_locale', 'en');
  store.products = [product('p1', 'A'), product('p2', 'B')];
  setCompanies([company('A', 'Alpha Tech', 'active'), company('B', 'Beta Corp', 'inactive')]);
  vi.mocked(deleteCompany).mockReset();
  vi.mocked(setCompanyStatus).mockReset();
  vi.mocked(setCompanyStatus).mockResolvedValue(undefined as never);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('company list row', () => {
  it('opens the company details when the row is clicked', () => {
    renderList();
    fireEvent.click(within(row('Alpha Tech')).getByText(/Alpha Tech Street/)); // the location cell
    expect(screen.getByTestId('details').textContent).toBe('Company details A');
  });

  it('opens the details when any non-action cell is clicked', () => {
    renderList();
    fireEvent.click(within(row('Beta Corp')).getByText(/4/)); // rating cell
    expect(screen.getByTestId('details').textContent).toBe('Company details B');
  });

  it('the company name is still a working link', () => {
    renderList();
    fireEvent.click(screen.getByRole('link', { name: 'Alpha Tech' }));
    expect(screen.getByTestId('details').textContent).toBe('Company details A');
  });

  it('no longer renders a View button', () => {
    renderList();
    expect(screen.queryByRole('link', { name: en['common.view'] })).toBeNull();
    expect(screen.queryByRole('button', { name: en['common.view'] })).toBeNull();
    expect(screen.queryByText(en['common.view'])).toBeNull();
  });

  it('renders Delete next to Deactivate on an active company (Delete first)', () => {
    renderList();
    const names = within(row('Alpha Tech'))
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names).toEqual([en['companies.delete'], en['companies.deactivate']]);
  });

  it('marks Delete as a destructive action', () => {
    renderList();
    expect(within(row('Alpha Tech')).getByRole('button', { name: en['companies.delete'] }).className).toContain(
      'btn--danger',
    );
  });

  it('keeps Delete next to Activate on an inactive company', () => {
    renderList();
    const names = within(row('Beta Corp'))
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names).toEqual([en['companies.activate'], en['companies.delete']]);
  });
});

describe('Deactivate', () => {
  it('still works, and does not open the details', async () => {
    renderList();
    fireEvent.click(within(row('Alpha Tech')).getByRole('button', { name: en['companies.deactivate'] }));

    expect(screen.queryByTestId('details')).toBeNull();
    expect(dialog()).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: en['companies.deactivate'] }));

    await waitFor(() => expect(setCompanyStatus).toHaveBeenCalledWith('A', 'inactive'));
    expect(deleteCompany).not.toHaveBeenCalled();
    expect(screen.queryByTestId('details')).toBeNull();
  });

  it('cancelling does nothing', () => {
    renderList();
    fireEvent.click(within(row('Alpha Tech')).getByRole('button', { name: en['companies.deactivate'] }));
    fireEvent.click(within(dialog()).getByRole('button', { name: en['common.cancel'] }));
    expect(setCompanyStatus).not.toHaveBeenCalled();
  });
});

describe('Delete', () => {
  it('shows a confirmation and does not open the details', () => {
    renderList();
    fireEvent.click(within(row('Alpha Tech')).getByRole('button', { name: en['companies.delete'] }));

    expect(screen.queryByTestId('details')).toBeNull();
    expect(screen.getByRole('dialog', { name: en['companies.confirmDelete.title'] })).toBeTruthy();
    expect(deleteCompany).not.toHaveBeenCalled(); // nothing happens until it is confirmed
  });

  it('the confirmation spells out what is deleted and what is kept', () => {
    renderList();
    fireEvent.click(within(row('Alpha Tech')).getByRole('button', { name: en['companies.delete'] }));

    const text = dialog().textContent ?? '';
    expect(text).toContain('Alpha Tech');
    expect(text).toContain('the company');
    expect(text).toContain('its company admin');
    expect(text).toContain('its employees / technicians');
    expect(text).toContain('its technician invites');
    expect(text).toContain('its 1 product(s) and other company-owned data');
    expect(text).toContain('Orders and order history will NOT be deleted');
    // and that an active company is deactivated first
    expect(text).toContain(en['companies.confirmDelete.activeNote']);
  });

  it('cancelling deletes nothing', () => {
    renderList();
    fireEvent.click(within(row('Alpha Tech')).getByRole('button', { name: en['companies.delete'] }));
    fireEvent.click(within(dialog()).getByRole('button', { name: en['common.cancel'] }));

    expect(deleteCompany).not.toHaveBeenCalled();
    expect(setCompanyStatus).not.toHaveBeenCalled();
    expect(screen.getByText('Alpha Tech')).toBeTruthy();
  });

  it('confirming deactivates an active company first, then runs the cascade, and the row disappears', async () => {
    vi.mocked(deleteCompany).mockImplementation(async (id: string) => {
      setCompanies((store.companies as Company[]).filter((c) => c.id !== id)); // the live list drops it
      return summary as never;
    });
    renderList();
    fireEvent.click(within(row('Alpha Tech')).getByRole('button', { name: en['companies.delete'] }));
    fireEvent.click(within(dialog()).getByRole('button', { name: en['companies.delete'] }));

    await waitFor(() => expect(screen.queryByText('Alpha Tech')).toBeNull());
    expect(setCompanyStatus).toHaveBeenCalledWith('A', 'inactive');
    expect(deleteCompany).toHaveBeenCalledWith('A'); // the cascade, not a bare document delete
    expect(vi.mocked(setCompanyStatus).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deleteCompany).mock.invocationCallOrder[0],
    );
    expect(screen.getByText('Beta Corp')).toBeTruthy(); // the other company stays
    expect(screen.queryByTestId('details')).toBeNull();

    // success message: what went, and that orders were kept
    const toast = await screen.findByRole('status');
    expect(toast.textContent).toContain('Company deleted');
    expect(toast.textContent).toContain('5 order(s) kept');
  });

  it('an inactive company goes straight to the cascade (no deactivation step)', async () => {
    vi.mocked(deleteCompany).mockImplementation(async (id: string) => {
      setCompanies((store.companies as Company[]).filter((c) => c.id !== id));
      return summary as never;
    });
    renderList();
    fireEvent.click(within(row('Beta Corp')).getByRole('button', { name: en['companies.delete'] }));
    expect(dialog().textContent).not.toContain(en['companies.confirmDelete.activeNote']);
    fireEvent.click(within(dialog()).getByRole('button', { name: en['companies.delete'] }));

    await waitFor(() => expect(screen.queryByText('Beta Corp')).toBeNull());
    expect(setCompanyStatus).not.toHaveBeenCalled();
    expect(deleteCompany).toHaveBeenCalledWith('B');
    expect(screen.getByText('Alpha Tech')).toBeTruthy();
  });

  it('a refused deletion keeps the row and reports the problem', async () => {
    vi.mocked(deleteCompany).mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    renderList();
    fireEvent.click(within(row('Beta Corp')).getByRole('button', { name: en['companies.delete'] }));
    fireEvent.click(within(dialog()).getByRole('button', { name: en['companies.delete'] }));

    const toast = await screen.findByRole('status');
    await waitFor(() => expect(toast.textContent).toContain(en['error.actionPermission']));
    expect(screen.getByText('Beta Corp')).toBeTruthy();
  });
});

describe('Arabic', () => {
  it('shows the Arabic buttons and confirmation, right-to-left', () => {
    localStorage.setItem('platform_admin_locale', 'ar');
    renderList();
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.queryByText(en['common.view'])).toBeNull();
    expect(screen.queryByText(ar['common.view'])).toBeNull();

    const names = within(row('Alpha Tech'))
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names).toEqual([ar['companies.delete'], ar['companies.deactivate']]);

    fireEvent.click(within(row('Alpha Tech')).getByRole('button', { name: ar['companies.delete'] }));
    const text = dialog().textContent ?? '';
    expect(text).toContain('مدير الشركة');
    expect(text).toContain('موظفيها');
    expect(text).toContain('دعوات الفنيين');
    expect(text).toContain('الطلبات وسجل الطلبات لن تُحذف');
    expect(screen.queryByTestId('details')).toBeNull();
  });
});
