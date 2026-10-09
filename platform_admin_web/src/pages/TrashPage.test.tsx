// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, ToastProvider } from '../components/feedback';
import { deleteCompany, restoreCategory, restoreCompany, summarizeCategoryDeletion } from '../data/actions';
import type { Category, Company, Product } from '../data/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { ar, en } from '../i18n/dictionary';
import { TrashPage } from './TrashPage';

const store = vi.hoisted(() => ({
  companies: [] as unknown[],
  categories: [] as unknown[],
  products: [] as unknown[],
}));

vi.mock('../data/hooks', () => {
  const ready = (key: 'companies' | 'categories' | 'products') => () => ({
    status: 'ready' as const,
    error: null,
    retry: () => undefined,
    data: store[key] as never[],
  });
  return { useCompanies: ready('companies'), useAllCategories: ready('categories'), useProducts: ready('products') };
});

vi.mock('../data/actions', () => ({
  deleteCompany: vi.fn(),
  restoreCompany: vi.fn(),
  restoreCategory: vi.fn(),
  summarizeCategoryDeletion: vi.fn(),
  deleteCategoryTree: vi.fn(),
}));

const company = (id: string, name: string, extra: Partial<Company> = {}): Company => ({
  id,
  name,
  rating: 0,
  reviewCount: 0,
  logoUrl: '',
  description: '',
  city: '',
  address: '',
  latitude: null,
  longitude: null,
  phone: '',
  email: '',
  pickupAddress: '',
  status: 'inactive',
  createdAt: new Date('2026-01-01'),
  ...extra,
});

const category = (id: string, parentId: string | null, nameEn: string, extra: Partial<Category> = {}): Category => ({
  id,
  name: nameEn,
  nameAr: '',
  nameEn,
  parentId,
  ancestorIds: parentId ? [parentId] : [],
  deletionPending: false,
  sortOrder: null,
  description: '',
  iconName: '',
  color: '',
  isActive: false,
  createdAt: new Date('2026-01-01'),
  ...extra,
});

function renderPage() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <ToastProvider>
          <ConfirmProvider>
            <TrashPage />
          </ConfirmProvider>
        </ToastProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

const row = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;
const names = () => [...document.querySelectorAll('tbody tr')].map((r) => r.querySelector('td')?.textContent ?? '');

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  store.companies = [
    company('A', 'Alpha Tech', { trashedAt: new Date('2026-03-01'), statusBeforeTrash: 'active' }),
    company('B', 'Beta Corp'), // not in the trash
  ];
  store.categories = [
    category('net', null, 'Networking', { trashedAt: new Date('2026-04-01'), trashRootId: 'net' }),
    category('rou', 'net', 'Routers', { trashedAt: new Date('2026-04-01'), trashRootId: 'net' }),
    category('lap', null, 'Laptops', { isActive: true }), // not in the trash
  ];
  store.products = [{ id: 'p1', companyId: 'A' } as unknown as Product];
  for (const fn of [deleteCompany, restoreCompany, restoreCategory]) {
    vi.mocked(fn as (...args: unknown[]) => unknown).mockReset().mockResolvedValue(undefined);
  }
  vi.mocked(summarizeCategoryDeletion).mockReset().mockResolvedValue({ categories: 2, products: 0, services: 0, serviceLinks: 0 });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('what is in the trash', () => {
  it('lists the trashed companies and categories, newest first, one row per trashed category tree', () => {
    renderPage();
    expect(names()).toEqual(['Networking', 'Alpha Tech']);
    expect(screen.queryByText('Beta Corp')).toBeNull();
    expect(screen.queryByText('Routers')).toBeNull();
    expect(screen.queryByText('Laptops')).toBeNull();
  });

  it('says what a company was before and how many sub-categories a category carried', () => {
    renderPage();
    expect(within(row('Alpha Tech')).getByText(en['company.status.active'])).toBeTruthy();
    expect(within(row('Networking')).getByText('1 sub-categories')).toBeTruthy();
  });

  it('filters by type', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['trash.type.company']) }));
    expect(names()).toEqual(['Alpha Tech']);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['trash.type.category']) }));
    expect(names()).toEqual(['Networking']);
  });

  it('says so when the trash is empty', () => {
    store.companies = [company('B', 'Beta Corp')];
    store.categories = [];
    renderPage();
    expect(screen.getByText(en['trash.empty'])).toBeTruthy();
  });
});

describe('restoring', () => {
  it('brings a company back with what it was', async () => {
    renderPage();
    await act(async () => {
      fireEvent.click(within(row('Alpha Tech')).getByRole('button', { name: en['trash.restore'] }));
    });
    expect(restoreCompany).toHaveBeenCalledWith(store.companies[0]);
    expect(await screen.findByText(en['trash.restored'])).toBeTruthy();
  });

  it('brings a category tree back', async () => {
    renderPage();
    await act(async () => {
      fireEvent.click(within(row('Networking')).getByRole('button', { name: en['trash.restore'] }));
    });
    expect(restoreCategory).toHaveBeenCalledWith(store.categories, 'net');
  });

  it('cannot bring a category back under a parent that is still in the trash', () => {
    store.categories = [
      category('top', null, 'Top', { trashedAt: new Date('2026-05-01'), trashRootId: 'top' }),
      category('kid', 'top', 'Kid', { trashedAt: new Date('2026-04-01'), trashRootId: 'kid' }),
    ];
    renderPage();
    const button = within(row('Kid')).getByRole('button', { name: en['trash.restore'] }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toBe(en['trash.parentTrashed']);
    expect((within(row('Top')).getByRole('button', { name: en['trash.restore'] }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('deleting for good', () => {
  it('asks first, spelling out what goes and that orders stay, then runs the full deletion', async () => {
    vi.mocked(deleteCompany).mockResolvedValue({
      companyDeleted: true, admins: 1, technicians: 2, invites: 0, products: 1, other: 0, ordersKept: 3,
    } as never);
    renderPage();
    fireEvent.click(within(row('Alpha Tech')).getByRole('button', { name: en['trash.deleteForever'] }));
    const dialog = screen.getByRole('dialog', { name: en['companies.confirmDelete.title'] });
    expect(dialog.textContent).toContain('Alpha Tech');
    expect(dialog.textContent).toContain('Orders and order history will NOT be deleted');
    expect(deleteCompany).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: en['trash.deleteForever'] }));
    });
    expect(deleteCompany).toHaveBeenCalledWith('A', 'Alpha Tech');
    expect(await screen.findByText(/3 order\(s\) kept/)).toBeTruthy();
  });

  it('cancelling deletes nothing', () => {
    renderPage();
    fireEvent.click(within(row('Alpha Tech')).getByRole('button', { name: en['trash.deleteForever'] }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en['common.cancel'] }));
    expect(deleteCompany).not.toHaveBeenCalled();
  });

  it('opens the category deletion dialog (with its counts) for a category', async () => {
    renderPage();
    fireEvent.click(within(row('Networking')).getByRole('button', { name: en['trash.deleteForever'] }));
    await waitFor(() => expect(summarizeCategoryDeletion).toHaveBeenCalledWith(store.categories, 'net'));
    expect(await screen.findByText(en['categories.deleteCats'].replace('{n}', '2'))).toBeTruthy();
  });
});

describe('Arabic', () => {
  it('is right-to-left with Arabic labels', () => {
    localStorage.setItem('platform_admin_locale', 'ar');
    renderPage();
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByText(ar['trash.title'])).toBeTruthy();
    expect(screen.getAllByRole('button', { name: ar['trash.restore'] }).length).toBe(2);
  });
});
