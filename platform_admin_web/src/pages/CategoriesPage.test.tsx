// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, ToastProvider } from '../components/feedback';
import {
  createCategory,
  deleteCategoryTree,
  moveCategory,
  repairCategoryChains,
  saveSiblingOrder,
  setCategoryActive,
  summarizeCategoryDeletion,
  updateCategory,
} from '../data/actions';
import type { CatalogService, Category, Product } from '../data/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { ar, en } from '../i18n/dictionary';
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

vi.mock('../data/actions', () => {
  return {
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    setCategoryActive: vi.fn(),
    saveSiblingOrder: vi.fn(),
    moveCategory: vi.fn(),
    repairCategoryChains: vi.fn(),
    summarizeCategoryDeletion: vi.fn(),
    deleteCategoryTree: vi.fn(),
  };
});

/** A category with its chain worked out from [parents] (id -> parent id). */
const parents = new Map<string, string | null>();
function chainOf(parentId: string | null): string[] {
  const chain: string[] = [];
  for (let current = parentId; current; current = parents.get(current) ?? null) chain.unshift(current);
  return chain;
}
function category(
  id: string,
  parentId: string | null,
  names: [string, string],
  extra: Partial<Category> = {},
): Category {
  parents.set(id, parentId);
  return {
    id,
    name: names[1],
    nameAr: names[0],
    nameEn: names[1],
    parentId,
    ancestorIds: chainOf(parentId),
    deletionPending: false,
    sortOrder: null,
    description: '',
    iconName: '',
    isActive: true,
    createdAt: new Date('2026-01-01'),
    ...extra,
  };
}

const product = (id: string, categoryId: string) => ({ id, categoryId }) as unknown as Product;
const service = (id: string, categoryId: string) => ({ id, categoryId }) as unknown as CatalogService;

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

const rows = () => screen.getAllByRole('row').slice(1);
const rowText = () => rows().map((r) => r.textContent ?? '');
const rowFor = (text: string) => {
  const row = screen.getAllByRole('row').find((r) => (r.textContent ?? '').includes(text));
  if (!row) throw new Error(`no row containing ${text}`);
  return row;
};
const names = () => rows().map((r) => within(r).getAllByRole('cell')[0].textContent ?? '');
const expand = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name: en['categories.expand'].replace('{name}', name) }));

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  parents.clear();
  store.categories = [
    category('net', null, ['شبكات', 'Networking'], { sortOrder: 0 }),
    category('rou', 'net', ['راوترات', 'Routers'], { sortOrder: 0 }),
    category('wifi', 'rou', ['واي فاي', 'Wi-Fi 6']),
    category('swi', 'net', ['سويتشات', 'Switches'], { sortOrder: 1 }),
    category('lap', null, ['لابتوبات', 'Laptops'], { sortOrder: 1 }),
  ];
  store.products = [product('p1', 'wifi'), product('p2', 'wifi'), product('p3', 'lap')];
  store.services = [service('s1', 'lap')];
  for (const fn of [
    createCategory, updateCategory, setCategoryActive, saveSiblingOrder, moveCategory,
    repairCategoryChains, deleteCategoryTree,
  ]) {
    vi.mocked(fn as (...args: unknown[]) => unknown).mockReset().mockResolvedValue(undefined);
  }
  vi.mocked(repairCategoryChains).mockResolvedValue(2);
  vi.mocked(summarizeCategoryDeletion).mockReset().mockResolvedValue({
    categories: 4, products: 12, services: 0, serviceLinks: 0,
  });
  vi.mocked(deleteCategoryTree).mockResolvedValue({ categories: 4, products: 12, services: 0, serviceLinks: 0 });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('one shared tree', () => {
  it('shows every category in one tree, with no separate product and service lists', () => {
    renderPage();
    expect(names().join('|')).toContain('Networking');
    expect(names().join('|')).toContain('Laptops');
    expect(screen.queryByRole('button', { name: /Product categories/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Service categories/ })).toBeNull();
  });

  it('an older category (no parent yet) is simply a top-level one, with nothing to migrate', () => {
    store.categories = [...store.categories, category('old', null, ['قديم', 'Old one'])];
    renderPage();
    expect(names().join('|')).toContain('Old one');
    expect(screen.queryByRole('button', { name: /Migrate/ })).toBeNull();
  });
});

describe('showing the tree', () => {
  it('opens with only the top level and expands one branch at a time, at any depth', () => {
    renderPage();
    expect(rows()).toHaveLength(2); // Networking, Laptops
    expand('Networking');
    expect(rows()).toHaveLength(4); // + Routers, Switches
    expand('Routers');
    expect(rows()).toHaveLength(5); // + Wi-Fi 6
    expect(names()[2]).toContain('Wi-Fi 6');
    // collapsing a branch hides everything under it
    fireEvent.click(screen.getByRole('button', { name: en['categories.collapse'].replace('{name}', 'Networking') }));
    expect(rows()).toHaveLength(2);
  });

  it('expands and collapses everything at once', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: en['categories.expandAll'] }));
    expect(rows()).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: en['categories.collapseAll'] }));
    expect(rows()).toHaveLength(2);
  });

  it('shows how many sub-categories and items each category holds', () => {
    renderPage();
    expect(rowFor('Networking').textContent).toContain('2 sub-categories');
    expand('Networking');
    expand('Routers');
    expect(rowFor('Wi-Fi 6').textContent).toContain('2 products/services here'); // two products filed directly in it
    expect(rowFor('Laptops').textContent).toContain('2 products/services here'); // a product and a service
  });

  it('finds a category by its Arabic or English name and opens the way to it', () => {
    renderPage();
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'wi-fi' } });
    expect(rowText().map((t) => t.includes('Networking') || t.includes('Routers') || t.includes('Wi-Fi 6'))).toEqual([true, true, true]);
    fireEvent.change(search, { target: { value: 'واي فاي' } });
    expect(rows()).toHaveLength(3);
    fireEvent.change(search, { target: { value: 'لابتوب' } });
    expect(rowText().join('|')).toContain('Laptops');
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText(en['categories.noMatch'])).toBeTruthy();
  });

  it('cannot reorder while a search hides siblings', () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'lap' } });
    const up = within(rowFor('Laptops')).getByRole('button', { name: en['categories.moveUp'] });
    expect((up as HTMLButtonElement).disabled).toBe(true);
  });

  it('says so when there are no categories', () => {
    store.categories = [];
    renderPage();
    expect(screen.getByText(en['categories.empty'])).toBeTruthy();
  });
});

describe('adding categories', () => {
  const fill = async (arabic: string, english: string) => {
    fireEvent.change(screen.getByLabelText(new RegExp(`^${en['categories.nameArLabel']}`)), { target: { value: arabic } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${en['categories.nameEnLabel']}`)), { target: { value: english } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['common.save'] }));
    });
  };

  it('adds a top-level category', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: `+ ${en['categories.add']}` }));
    await fill('طابعات', 'Printers');
    expect(createCategory).toHaveBeenCalledTimes(1);
    const [input, all] = vi.mocked(createCategory).mock.calls[0];
    expect(input).toMatchObject({ parentId: null, nameAr: 'طابعات', nameEn: 'Printers' });
    expect(all).toBe(store.categories);
    expect(await screen.findByText(en['categories.saved'])).toBeTruthy();
  });

  it('adds a sub-category at any level, under the category chosen', async () => {
    renderPage();
    expand('Networking');
    expand('Routers');
    fireEvent.click(within(rowFor('Wi-Fi 6')).getByRole('button', { name: en['categories.addChild'] }));
    // the dialog says where it goes
    expect(screen.getByRole('dialog').textContent).toContain('Networking › Routers › Wi-Fi 6');
    await fill('وايفاي 7', 'Wi-Fi 7');
    expect(vi.mocked(createCategory).mock.calls[0][0]).toMatchObject({
      parentId: 'wifi',
      nameEn: 'Wi-Fi 7',
    });
  });

  it('opens the parent afterwards so the new category is visible', async () => {
    renderPage();
    expect(rows()).toHaveLength(2); // Networking is collapsed
    fireEvent.click(within(rowFor('Networking')).getByRole('button', { name: en['categories.addChild'] }));
    await fill('موجهات', 'Access points');
    expect(rows()).toHaveLength(4); // Networking is open now: Routers, Switches
  });

  it('needs both names', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: `+ ${en['categories.add']}` }));
    await fill('طابعات', '');
    expect(screen.getByText(en['categories.nameEnRequired'])).toBeTruthy();
    expect(createCategory).not.toHaveBeenCalled();
  });

  it('shows an error when the rules refuse the write, and keeps the dialog open', async () => {
    vi.mocked(createCategory).mockRejectedValue(Object.assign(new Error('x'), { code: 'permission-denied' }));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: `+ ${en['categories.add']}` }));
    await fill('طابعات', 'Printers');
    expect(await screen.findByText(en['error.actionPermission'])).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('editing', () => {
  it('changes the two names, description and icon of a category', async () => {
    renderPage();
    fireEvent.click(within(rowFor('Laptops')).getByRole('button', { name: en['common.edit'] }));
    fireEvent.change(screen.getByLabelText(new RegExp(`^${en['categories.nameEnLabel']}`)), { target: { value: 'Notebooks' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['common.save'] }));
    });
    expect(updateCategory).toHaveBeenCalledWith('lap', {
      nameAr: 'لابتوبات',
      nameEn: 'Notebooks',
      description: '',
      iconName: '',
    });
  });
});

describe('moving', () => {
  const openMove = (name: string) =>
    fireEvent.click(within(rowFor(name)).getByRole('button', { name: en['categories.move'] }));
  const choices = () =>
    within(screen.getByRole('dialog')).getAllByRole('option').map((o) => o.textContent ?? '');

  it('offers any category, never itself or its own sub-categories', () => {
    renderPage();
    expand('Networking');
    openMove('Routers');
    const list = choices();
    expect(list).toContain(en['categories.topLevel']);
    expect(list).toContain('Laptops');
    expect(list).not.toContain('Networking'); // where it already is
    expect(list).toContain('Networking › Switches');
    expect(list.some((o) => o.includes('Routers'))).toBe(false); // itself and Wi-Fi 6 below it
    expect(list.some((o) => o.includes('Wi-Fi'))).toBe(false);
  });

  it('a top-level category cannot be moved onto its own descendant, but can go under another top-level one', () => {
    renderPage();
    openMove('Networking');
    const list = choices();
    expect(list).toEqual(['Laptops']); // already at the top level; not under itself or Routers/Switches/Wi-Fi 6
  });

  it('moves under the chosen parent', async () => {
    renderPage();
    expand('Networking');
    openMove('Switches');
    fireEvent.change(within(screen.getByRole('dialog')).getByRole('combobox'), { target: { value: 'lap' } });
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en['categories.move'] }));
    });
    expect(moveCategory).toHaveBeenCalledWith(store.categories, 'swi', 'lap');
    expect(await screen.findByText(en['categories.moved'])).toBeTruthy();
  });

  it('moves to the top level', async () => {
    renderPage();
    expand('Networking');
    openMove('Switches');
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en['categories.move'] }));
    });
    expect(moveCategory).toHaveBeenCalledWith(store.categories, 'swi', null);
  });
});

describe('ordering, activating', () => {
  it('reorders only among siblings and saves their whole new order', async () => {
    renderPage();
    expand('Networking');
    await act(async () => {
      fireEvent.click(within(rowFor('Routers')).getByRole('button', { name: en['categories.moveDown'] }));
    });
    expect(saveSiblingOrder).toHaveBeenCalledWith(['swi', 'rou']); // never mixes in other levels
  });

  it('the first sibling cannot go up and the last cannot go down', () => {
    renderPage();
    const first = within(rowFor('Networking')).getByRole('button', { name: en['categories.moveUp'] });
    const last = within(rowFor('Laptops')).getByRole('button', { name: en['categories.moveDown'] });
    expect((first as HTMLButtonElement).disabled).toBe(true);
    expect((last as HTMLButtonElement).disabled).toBe(true);
  });

  it('asks before deactivating, then hides the category and its tree from customers', async () => {
    renderPage();
    fireEvent.click(within(rowFor('Laptops')).getByRole('button', { name: en['categories.deactivate'] }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain(en['categories.deactivateHint']);
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: en['categories.deactivate'] }));
    });
    expect(setCategoryActive).toHaveBeenCalledWith('lap', false);
  });
});

describe('deleting a category tree', () => {
  const openDelete = (name: string) =>
    fireEvent.click(within(rowFor(name)).getByRole('button', { name: en['categories.delete'] }));
  const confirmButton = () => screen.getByRole('button', { name: en['categories.deleteEverything'] }) as HTMLButtonElement;

  it('first says exactly what will be deleted and what is kept', async () => {
    renderPage();
    openDelete('Networking');
    expect(await screen.findByText(en['categories.deleteCats'].replace('{n}', '4'))).toBeTruthy();
    expect(summarizeCategoryDeletion).toHaveBeenCalledWith(store.categories, 'net');
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain(en['categories.deleteProducts'].replace('{n}', '12'));
    expect(dialog.textContent).toContain(en['categories.deleteServices'].replace('{n}', '0'));
    expect(dialog.textContent).toContain(en['categories.deleteLinks'].replace('{n}', '0'));
    expect(dialog.textContent).toContain(en['categories.deleteKept']);
    expect(deleteCategoryTree).not.toHaveBeenCalled();
  });

  it('needs an explicit confirmation before anything is deleted', async () => {
    renderPage();
    openDelete('Networking');
    await screen.findByText(en['categories.deleteCats'].replace('{n}', '4'));
    expect(confirmButton().disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(en['categories.deleteUndone']));
    expect(confirmButton().disabled).toBe(false);
    await act(async () => {
      fireEvent.click(confirmButton());
    });
    expect(deleteCategoryTree).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deleteCategoryTree).mock.calls[0][0]).toBe(store.categories);
    expect(vi.mocked(deleteCategoryTree).mock.calls[0][1]).toBe('net');
    expect(await screen.findByText('Deleted 4 categories, 12 products and 0 services.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cancelling deletes nothing', async () => {
    renderPage();
    openDelete('Laptops');
    await screen.findByText(en['categories.deleteCats'].replace('{n}', '4'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en['common.cancel'] }));
    expect(deleteCategoryTree).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows progress while it runs', async () => {
    let report: (p: { phase: 'products'; done: number; total: number }) => void = () => undefined;
    let finish: () => void = () => undefined;
    vi.mocked(deleteCategoryTree).mockImplementation(
      (_all, _id, options) =>
        new Promise((resolve) => {
          report = (p) => options?.onProgress?.(p);
          finish = () => resolve({ categories: 4, products: 12, services: 0, serviceLinks: 0 });
        }),
    );
    renderPage();
    openDelete('Networking');
    await screen.findByText(en['categories.deleteCats'].replace('{n}', '4'));
    fireEvent.click(screen.getByLabelText(en['categories.deleteUndone']));
    await act(async () => {
      fireEvent.click(confirmButton());
    });
    act(() => report({ phase: 'products', done: 400, total: 985 }));
    expect(within(screen.getByRole('dialog')).getByRole('status').textContent).toBe('Deleting... products: 400 of 985');
    expect(confirmButton().disabled).toBe(true); // cannot start twice
    await act(async () => finish());
  });

  it('when it stops part-way it says so and can be run again', async () => {
    vi.mocked(deleteCategoryTree).mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    renderPage();
    openDelete('Networking');
    await screen.findByText(en['categories.deleteCats'].replace('{n}', '4'));
    fireEvent.click(screen.getByLabelText(en['categories.deleteUndone']));
    await act(async () => {
      fireEvent.click(confirmButton());
    });
    expect(await screen.findByText(en['categories.deleteFailed'])).toBeTruthy();
    expect(confirmButton().disabled).toBe(false);
    await act(async () => {
      fireEvent.click(confirmButton());
    });
    expect(deleteCategoryTree).toHaveBeenCalledTimes(2);
  });

  it('cannot delete when what would be affected could not be counted', async () => {
    vi.mocked(summarizeCategoryDeletion).mockRejectedValue(new Error('offline'));
    renderPage();
    openDelete('Networking');
    expect(await screen.findByText(en['categories.deleteCountFailed'])).toBeTruthy();
    expect(confirmButton().disabled).toBe(true);
  });

  it('offers to finish a deletion that was interrupted', async () => {
    store.categories = (store.categories as Category[]).map((c) =>
      c.id === 'lap' ? { ...c, deletionPending: true, isActive: false } : c,
    );
    renderPage();
    expect(screen.getByText(en['categories.interrupted'].replace('{name}', 'Laptops'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en['categories.resume'] }));
    expect(await screen.findByText(en['categories.deleteCats'].replace('{n}', '4'))).toBeTruthy();
    expect(summarizeCategoryDeletion).toHaveBeenCalledWith(store.categories, 'lap');
  });
});

describe('repairing', () => {
  it('offers a repair when a move stopped part-way', async () => {
    store.categories = (store.categories as Category[]).map((c) =>
      c.id === 'wifi' ? { ...c, ancestorIds: ['net'] } : c,
    );
    renderPage();
    expect(screen.getByText(new RegExp(en['categories.repairNeeded'].slice(0, 20)))).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['categories.repair'] }));
    });
    expect(repairCategoryChains).toHaveBeenCalledWith(store.categories);
    expect(await screen.findByText('Repaired 2 categories.')).toBeTruthy();
  });
});

describe('Arabic', () => {
  it('shows Arabic names first, translated labels and a right-to-left page', () => {
    localStorage.setItem('platform_admin_locale', 'ar');
    renderPage();
    expect(document.documentElement.dir).toBe('rtl');
    expect(names()[0]).toContain('شبكات');
    expect(screen.getByRole('button', { name: ar['categories.expand'].replace('{name}', 'شبكات') })).toBeTruthy();
    fireEvent.click(within(rowFor('لابتوبات')).getByRole('button', { name: ar['categories.delete'] }));
    return waitFor(() => expect(screen.getByRole('dialog').textContent).toContain('حذف'));
  });
});
