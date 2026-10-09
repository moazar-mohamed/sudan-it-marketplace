// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, ToastProvider } from '../components/feedback';
import { setCompanyStatus, trashCompany } from '../data/actions';
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

  it('renders Move to trash next to Deactivate on an active company (trash first)', () => {
    renderList();
    const names = within(row('Alpha Tech'))
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names).toEqual([en['companies.trash'], en['companies.deactivate']]);
  });

  it('marks Move to trash as a destructive action', () => {
    renderList();
    expect(within(row('Alpha Tech')).getByRole('button', { name: en['companies.trash'] }).className).toContain(
      'btn--danger',
    );
  });

  it('keeps Move to trash next to Activate on an inactive company', () => {
    renderList();
    const names = within(row('Beta Corp'))
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names).toEqual([en['companies.activate'], en['companies.trash']]);
  });
});

describe('Deactivate', () => {
  it('still works, and does not open the details', async () => {
    renderList();
    fireEvent.click(within(row('Alpha Tech')).getByRole('button', { name: en['companies.deactivate'] }));

    expect(screen.queryByTestId('details')).toBeNull();
    expect(dialog()).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: en['companies.deactivate'] }));

    await waitFor(() => expect(setCompanyStatus).toHaveBeenCalledWith('A', 'inactive', expect.any(String)));
    expect(trashCompany).not.toHaveBeenCalled();
    expect(screen.queryByTestId('details')).toBeNull();
  });

  it('cancelling does nothing', () => {
    renderList();
    fireEvent.click(within(row('Alpha Tech')).getByRole('button', { name: en['companies.deactivate'] }));
    fireEvent.click(within(dialog()).getByRole('button', { name: en['common.cancel'] }));
    expect(setCompanyStatus).not.toHaveBeenCalled();
  });
});

describe('Move to trash', () => {
  it('asks first, and does not open the details', () => {
    renderList();
    fireEvent.click(within(row('Alpha Tech')).getByRole('button', { name: en['companies.trash'] }));

    expect(screen.queryByTestId('details')).toBeNull();
    expect(screen.getByRole('dialog', { name: en['companies.confirmTrash.title'] })).toBeTruthy();
    expect(trashCompany).not.toHaveBeenCalled(); // nothing happens until it is confirmed
  });

  it('says that nothing is deleted and how many products are hidden', () => {
    renderList();
    fireEvent.click(within(row('Alpha Tech')).getByRole('button', { name: en['companies.trash'] }));

    const text = dialog().textContent ?? '';
    expect(text).toContain('Alpha Tech');
    expect(text).toContain('1 product(s)');
    expect(text).toContain('Nothing is deleted');
    expect(text).toContain('restore it from the trash');
  });

  it('the permanent deletion keeps its promise about orders, in both languages, and never mentions invites', () => {
    const keys = ['companies.confirmDelete.body', 'companies.deletedCascade'] as const;
    for (const key of keys) {
      expect(en[key]).not.toMatch(/invite/i);
      expect(ar[key]).not.toContain('دعو');
    }
    expect(en['companies.confirmDelete.body']).toContain('Orders and order history will NOT be deleted');
    expect(ar['companies.confirmDelete.body']).toContain('الطلبات وسجل الطلبات لن تُحذف');
  });

  it('cancelling moves nothing', () => {
    renderList();
    fireEvent.click(within(row('Alpha Tech')).getByRole('button', { name: en['companies.trash'] }));
    fireEvent.click(within(dialog()).getByRole('button', { name: en['common.cancel'] }));

    expect(trashCompany).not.toHaveBeenCalled();
    expect(setCompanyStatus).not.toHaveBeenCalled();
    expect(screen.getByText('Alpha Tech')).toBeTruthy();
  });

  it('confirming trashes an active company straight away (no deactivation step) and the row leaves the list', async () => {
    vi.mocked(trashCompany).mockImplementation(async (c) => {
      setCompanies((store.companies as Company[]).map((x) => (x.id === c.id ? { ...x, trashedAt: new Date() } : x)));
    });
    renderList();
    fireEvent.click(within(row('Alpha Tech')).getByRole('button', { name: en['companies.trash'] }));
    fireEvent.click(within(dialog()).getByRole('button', { name: en['companies.trash'] }));

    await waitFor(() => expect(screen.queryByText('Alpha Tech')).toBeNull());
    expect(setCompanyStatus).not.toHaveBeenCalled();
    expect(trashCompany).toHaveBeenCalledWith(expect.objectContaining({ id: 'A', name: 'Alpha Tech', status: 'active' }));
    expect(screen.getByText('Beta Corp')).toBeTruthy(); // the other company stays
    expect(screen.queryByTestId('details')).toBeNull();

    const toast = await screen.findByRole('status');
    expect(toast.textContent).toContain(en['companies.trashed']);
  });

  it('a company that is already in the trash is not listed here', () => {
    setCompanies([
      company('A', 'Alpha Tech', 'active'),
      { ...company('B', 'Beta Corp', 'inactive'), trashedAt: new Date('2026-02-01') },
    ]);
    renderList();
    expect(screen.getByText('Alpha Tech')).toBeTruthy();
    expect(screen.queryByText('Beta Corp')).toBeNull();
  });

  it('a refused move keeps the row and reports the problem', async () => {
    vi.mocked(trashCompany).mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    renderList();
    fireEvent.click(within(row('Beta Corp')).getByRole('button', { name: en['companies.trash'] }));
    fireEvent.click(within(dialog()).getByRole('button', { name: en['companies.trash'] }));

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
    expect(names).toEqual([ar['companies.trash'], ar['companies.deactivate']]);

    fireEvent.click(within(row('Alpha Tech')).getByRole('button', { name: ar['companies.trash'] }));
    const text = dialog().textContent ?? '';
    expect(text).toContain('لا يُحذف شيء');
    expect(text).toContain('من السلة');
    expect(screen.queryByTestId('details')).toBeNull();
  });
});
