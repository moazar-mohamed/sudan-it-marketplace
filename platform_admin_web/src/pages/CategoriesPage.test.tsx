// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, ToastProvider } from '../components/feedback';
import { createCategory, deleteCategory, saveCategoryOrder, updateCategory } from '../data/actions';
import type { CatalogService, Category, Product } from '../data/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { CategoriesPage } from './CategoriesPage';

const store = vi.hoisted(() => ({
  categories: [] as unknown[],
  products: [] as unknown[],
  services: [] as unknown[],
}));

vi.mock('../data/hooks', () => {
  const ready = (key: 'categories' | 'products' | 'services') => () => ({
    status: 'ready' as const,
    error: null,
    retry: () => undefined,
    data: store[key] as never[],
  });
  return {
    useCategories: ready('categories'),
    useProducts: ready('products'),
    useServices: ready('services'),
  };
});

vi.mock('../data/actions', () => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  saveCategoryOrder: vi.fn(),
  setCategoryActive: vi.fn(),
  deleteCategory: vi.fn(),
}));

const category = (id: string, extra: Partial<Category> = {}): Category => ({
  id,
  name: id,
  nameAr: '',
  nameEn: '',
  sortOrder: null,
  description: '',
  iconName: '',
  isActive: true,
  createdAt: new Date('2026-01-01'),
  ...extra,
});

function renderPage() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <ToastProvider>
          <ConfirmProvider>
            <CategoriesPage />
          </ConfirmProvider>
        </ToastProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

const dataRows = () => screen.getAllByRole('row').slice(1);

// A label also contains its hint (or, for the icon, the option names).
const byLabel = (label: string) => screen.getByLabelText(new RegExp(`^${label}`));

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  store.categories = [
    category('laptops', { name: 'Laptops', nameAr: 'لابتوب', nameEn: 'Laptops', sortOrder: 1, iconName: 'laptop' }),
    category('routers', { name: 'Routers', nameAr: 'راوتر', nameEn: 'Routers', sortOrder: 0, iconName: 'router' }),
    category('old', { name: 'Printers' }),
  ];
  vi.mocked(createCategory).mockReset().mockResolvedValue(undefined);
  vi.mocked(updateCategory).mockReset().mockResolvedValue(undefined);
  vi.mocked(saveCategoryOrder).mockReset().mockResolvedValue(undefined);
  vi.mocked(deleteCategory).mockReset().mockResolvedValue(undefined);
  store.products = [];
  store.services = [];
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the categories list', () => {
  it('shows them in the customer order, with both names and the icon', () => {
    renderPage();
    const rows = dataRows();
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('راوتر')).toBeTruthy();
    expect(within(rows[0]).getByText('Routers')).toBeTruthy();
    expect(rows[0].textContent).toContain('📡 Router');
    expect(within(rows[1]).getByText('لابتوب')).toBeTruthy();
    // A category with only the old name is listed last, under that name.
    expect(within(rows[2]).getByText('Printers')).toBeTruthy();
  });

  it('moves a category down and saves the whole new order', async () => {
    renderPage();
    fireEvent.click(within(dataRows()[0]).getByRole('button', { name: en['categories.moveDown'] }));
    await waitFor(() => expect(saveCategoryOrder).toHaveBeenCalledTimes(1));
    expect(saveCategoryOrder).toHaveBeenCalledWith(['laptops', 'routers', 'old']);
  });

  it('cannot move the first one up or the last one down', () => {
    renderPage();
    const first = within(dataRows()[0]).getByRole('button', { name: en['categories.moveUp'] });
    const last = within(dataRows()[2]).getByRole('button', { name: en['categories.moveDown'] });
    expect((first as HTMLButtonElement).disabled).toBe(true);
    expect((last as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('adding a category', () => {
  const open = () => fireEvent.click(screen.getByRole('button', { name: `+ ${en['categories.add']}` }));
  const field = (label: string) => byLabel(label) as HTMLInputElement;

  it('needs the Arabic and the English name', async () => {
    renderPage();
    open();
    fireEvent.change(field(en['categories.nameEnLabel']), { target: { value: 'Cameras' } });
    fireEvent.click(screen.getByRole('button', { name: en['common.save'] }));
    expect(await screen.findByText(en['categories.nameArRequired'])).toBeTruthy();
    expect(createCategory).not.toHaveBeenCalled();
  });

  it('saves both names, the chosen icon and a position after the others', async () => {
    renderPage();
    open();
    fireEvent.change(field(en['categories.nameArLabel']), { target: { value: 'كاميرات' } });
    fireEvent.change(field(en['categories.nameEnLabel']), { target: { value: 'Cameras' } });
    fireEvent.change(byLabel(en['categories.iconLabel']), { target: { value: 'camera' } });
    fireEvent.click(screen.getByRole('button', { name: en['common.save'] }));

    await waitFor(() => expect(createCategory).toHaveBeenCalledTimes(1));
    const [input, sortOrder] = vi.mocked(createCategory).mock.calls[0];
    expect(input).toMatchObject({ nameAr: 'كاميرات', nameEn: 'Cameras', iconName: 'camera' });
    expect(sortOrder).toBe(3);
  });

  it('offers a list of icons plus "automatic"', () => {
    renderPage();
    open();
    const select = byLabel(en['categories.iconLabel']) as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels[0]).toBe(en['categories.iconAuto']);
    expect(labels.some((l) => l?.includes('Router'))).toBe(true);
    expect(select.value).toBe('');
  });
});

describe('editing an older category', () => {
  it('fills the field of the script it was written in and asks for the other', async () => {
    renderPage();
    fireEvent.click(within(dataRows()[2]).getByRole('button', { name: en['common.edit'] }));
    expect((byLabel(en['categories.nameEnLabel']) as HTMLInputElement).value).toBe('Printers');
    expect((byLabel(en['categories.nameArLabel']) as HTMLInputElement).value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: en['common.save'] }));
    expect(await screen.findByText(en['categories.nameArRequired'])).toBeTruthy();
    expect(updateCategory).not.toHaveBeenCalled();

    fireEvent.change(byLabel(en['categories.nameArLabel']), { target: { value: 'طابعات' } });
    fireEvent.click(screen.getByRole('button', { name: en['common.save'] }));
    await waitFor(() => expect(updateCategory).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updateCategory).mock.calls[0][1]).toMatchObject({
      nameAr: 'طابعات',
      nameEn: 'Printers',
    });
  });
});

describe('deleting a category', () => {
  const deleteButton = (row: HTMLElement) =>
    within(row).getByRole('button', { name: en['categories.delete'] }) as HTMLButtonElement;

  it('asks first, then deletes exactly that category', async () => {
    renderPage();
    fireEvent.click(deleteButton(dataRows()[2]));
    expect(deleteCategory).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog', { name: en['categories.confirmDelete.title'] });
    fireEvent.click(within(dialog).getByRole('button', { name: en['categories.delete'] }));
    await waitFor(() => expect(deleteCategory).toHaveBeenCalledWith('old'));
  });

  it('does nothing when the confirmation is cancelled', async () => {
    renderPage();
    fireEvent.click(deleteButton(dataRows()[2]));
    const dialog = await screen.findByRole('dialog', { name: en['categories.confirmDelete.title'] });
    fireEvent.click(within(dialog).getByRole('button', { name: en['common.cancel'] }));
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it('is not offered for a category that products or services still use', () => {
    store.products = [{ id: 'p1', categoryId: 'laptops' } as unknown as Product];
    store.services = [{ id: 's1', categoryId: 'routers' } as unknown as CatalogService];
    renderPage();
    const rows = dataRows();
    // routers (first row) is used by a service, laptops (second) by a product.
    expect(deleteButton(rows[0]).disabled).toBe(true);
    expect(deleteButton(rows[1]).disabled).toBe(true);
    expect(deleteButton(rows[2]).disabled).toBe(false);
    expect(deleteButton(rows[0]).title).toContain('0 products and 1 services');
  });
});
