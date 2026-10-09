// @vitest-environment jsdom
import { act, cleanup, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  trashCategory,
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
    trashCategory: vi.fn(),
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
    color: '',
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

const rows = () => [...document.querySelectorAll<HTMLElement>('.cat-row')];
const rowText = () => rows().map((r) => r.textContent ?? '');
const rowFor = (text: string) => {
  const row = rows().find((r) => (r.textContent ?? '').includes(text));
  if (!row) throw new Error(`no row containing ${text}`);
  return row;
};
const names = () => rows().map((r) => r.querySelector('.cat-main')?.textContent ?? '');
/** Opens a row's "⋯" menu and returns the item with this name. */
const menuItem = (row: HTMLElement, name: string) => {
  fireEvent.click(within(row).getByRole('button', { name: /^(More actions for|المزيد من الإجراءات)/ }));
  return screen.getByRole('menuitem', { name }) as HTMLButtonElement;
};
const choose = (row: HTMLElement, name: string) => fireEvent.click(menuItem(row, name));
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
    repairCategoryChains, deleteCategoryTree, trashCategory,
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

  it('draws one card for each main category, with what is open under it inside that card', () => {
    renderPage();
    expect(document.querySelectorAll('.cat-card')).toHaveLength(2);
    expand('Networking');
    const cards = [...document.querySelectorAll('.cat-card')];
    expect(cards[0].querySelectorAll('.cat-row')).toHaveLength(3); // Networking, Routers, Switches
    expect(cards[1].querySelectorAll('.cat-row')).toHaveLength(1); // Laptops
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
    expect(rowFor('Wi-Fi 6').textContent).toContain('2 products and services'); // two products filed directly in it
    expect(rowFor('Laptops').textContent).toContain('2 products and services'); // a product and a service
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

  it('narrows to active or inactive categories, with a count on each, and cannot reorder while narrowed', () => {
    store.categories = (store.categories as Category[]).map((c) => (c.id === 'lap' ? { ...c, isActive: false } : c));
    renderPage();
    const chip = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}`) });
    expect(chip(en['user.inactive']).textContent).toContain('1');
    fireEvent.click(chip(en['user.inactive']));
    expect(names().join('|')).toContain('Laptops');
    expect(names().join('|')).not.toContain('Networking');
    expect(menuItem(rowFor('Laptops'), en['categories.moveUp']).disabled).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(chip(en['user.active']));
    expect(names().join('|')).toContain('Networking');
    expect(names().join('|')).not.toContain('Laptops');
  });

  it('cannot reorder while a search hides siblings', () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'lap' } });
    expect(menuItem(rowFor('Laptops'), en['categories.moveUp']).disabled).toBe(true);
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
    choose(rowFor('Laptops'), en['common.edit']);
    fireEvent.change(screen.getByLabelText(new RegExp(`^${en['categories.nameEnLabel']}`)), { target: { value: 'Notebooks' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['common.save'] }));
    });
    expect(updateCategory).toHaveBeenCalledWith('lap', {
      nameAr: 'لابتوبات',
      nameEn: 'Notebooks',
      description: '',
      iconName: '',
      color: '',
    });
  });
});

describe('moving', () => {
  const openMove = (name: string) => choose(rowFor(name), en['categories.move']);
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
    const down = menuItem(rowFor('Routers'), en['categories.moveDown']);
    await act(async () => {
      fireEvent.click(down);
    });
    expect(saveSiblingOrder).toHaveBeenCalledWith(['swi', 'rou']); // never mixes in other levels
  });

  it('the first sibling cannot go up and the last cannot go down', () => {
    renderPage();
    expect(menuItem(rowFor('Networking'), en['categories.moveUp']).disabled).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(menuItem(rowFor('Laptops'), en['categories.moveDown']).disabled).toBe(true);
  });

  it('asks before deactivating, then hides the category and its tree from customers', async () => {
    renderPage();
    choose(rowFor('Laptops'), en['categories.deactivate']);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain(en['categories.deactivateHint']);
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: en['categories.deactivate'] }));
    });
    expect(setCategoryActive).toHaveBeenCalledWith('lap', false, expect.any(String));
  });
});

describe('moving a category to the trash', () => {
  const idOf = (name: string) => (store.categories as Category[]).find((c) => c.nameEn === name)!.id;

  it('asks first and says nothing below it is deleted', () => {
    renderPage();
    choose(rowFor('Networking'), en['categories.trash']);
    const dialog = screen.getByRole('dialog', { name: en['categories.confirmTrash.title'] });
    expect(dialog.textContent).toContain('Networking');
    expect(dialog.textContent).toContain('not changed');
    expect(trashCategory).not.toHaveBeenCalled();
  });

  it('cancelling moves nothing', () => {
    renderPage();
    choose(rowFor('Networking'), en['categories.trash']);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en['common.cancel'] }));
    expect(trashCategory).not.toHaveBeenCalled();
  });

  it('confirming sends the whole tree and says how many categories went', async () => {
    vi.mocked(trashCategory).mockResolvedValue(4);
    renderPage();
    choose(rowFor('Networking'), en['categories.trash']);
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en['categories.trash'] }));
    });
    expect(trashCategory).toHaveBeenCalledWith(store.categories, idOf('Networking'));
    expect(await screen.findByText('Moved 4 categories to the trash.')).toBeTruthy();
  });

  it('is the only way out of the list: there is no direct Delete item any more', () => {
    renderPage();
    fireEvent.click(within(rowFor('Networking')).getByRole('button', { name: /^(More actions for|المزيد من الإجراءات)/ }));
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
  });
});

describe('deleting a category tree', () => {
  // Deleting for good now lives on the Trash page; this page offers the same
  // dialog only to finish a deletion that stopped part-way.
  const openDelete = (name: string) => {
    cleanup();
    store.categories = (store.categories as Category[]).map((c) =>
      c.nameEn === name ? { ...c, deletionPending: true, isActive: false } : c,
    );
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: en['categories.resume'] }));
  };
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
    choose(rowFor('لابتوبات'), ar['categories.trash']);
    return waitFor(() => expect(screen.getByRole('dialog').textContent).toContain('السلة'));
  });
});

describe('dragging a category', () => {
  const transfer = { setData: vi.fn(), effectAllowed: '' };
  const handleOf = (row: HTMLElement) => row.querySelector('.cat-handle') as HTMLElement;
  /** Drags [from] onto [to], pointing [at] (0 = top edge, 0.5 = middle, 1 = bottom edge) of it. */
  const dragOnto = async (from: HTMLElement, to: HTMLElement, at: number) => {
    to.getBoundingClientRect = () => ({ top: 0, height: 100 }) as DOMRect;
    await act(async () => {
      fireEvent.dragStart(handleOf(from), { dataTransfer: transfer });
    });
    // jsdom has no drag events with coordinates, so the height is set on the event itself.
    const pointed = (make: typeof createEvent.dragOver) => {
      const event = make(to, { dataTransfer: transfer });
      Object.defineProperty(event, 'clientY', { value: at * 100 });
      return event;
    };
    await act(async () => {
      fireEvent(to, pointed(createEvent.dragOver));
    });
    await act(async () => {
      fireEvent(to, pointed(createEvent.drop));
    });
  };

  it('gives every row a handle to hold', () => {
    renderPage();
    expect(rows().every((r) => r.querySelector('.cat-handle[draggable="true"]'))).toBe(true);
  });

  it('marks a category with nothing under it as empty, and one with something as not', () => {
    renderPage();
    expand('Networking');
    expect(rowFor('Switches').textContent).toContain(en['categories.emptyBadge']);
    expect(rowFor('Routers').textContent).not.toContain(en['categories.emptyBadge']);
    expect(rowFor('Networking').textContent).not.toContain(en['categories.emptyBadge']);
  });

  it('reorders siblings when dropped on the top edge of one of them', async () => {
    renderPage();
    expand('Networking');
    await dragOnto(rowFor('Switches'), rowFor('Routers'), 0.05);
    expect(saveSiblingOrder).toHaveBeenCalledWith(['swi', 'rou']);
    expect(moveCategory).not.toHaveBeenCalled();
  });

  it('moves a category under another when dropped in the middle of it, last among its children', async () => {
    renderPage();
    expand('Networking');
    await dragOnto(rowFor('Laptops'), rowFor('Networking'), 0.5);
    expect(moveCategory).toHaveBeenCalledWith(store.categories, 'lap', 'net');
    expect(saveSiblingOrder).toHaveBeenCalledWith(['rou', 'swi', 'lap']);
  });

  it('ignores a drop that would put a category under one of its own children', async () => {
    renderPage();
    expand('Networking');
    await dragOnto(rowFor('Networking'), rowFor('Routers'), 0.5);
    expect(moveCategory).not.toHaveBeenCalled();
    expect(saveSiblingOrder).not.toHaveBeenCalled();
  });

  it('turns the handles off while the list is searched', () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'lap' } });
    expect(rows().every((r) => r.querySelector('.cat-handle[draggable="false"]'))).toBe(true);
  });
});
