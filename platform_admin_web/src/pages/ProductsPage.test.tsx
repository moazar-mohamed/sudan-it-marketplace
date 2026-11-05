// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, ToastProvider } from '../components/feedback';
import { endProductOffer, setProductHidden } from '../data/actions';
import type { Product } from '../data/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { setUi } from '../theme/ui';
import { ProductsPage } from './ProductsPage';

const mock = vi.hoisted(() => ({ products: [] as unknown[] }));

vi.mock('../data/hooks', () => ({
  useProducts: () => ({ status: 'ready', error: null, retry: () => undefined, data: mock.products as never[] }),
}));
vi.mock('../data/actions', () => ({ setProductHidden: vi.fn(), endProductOffer: vi.fn() }));
vi.mock('../data/useNow', () => ({ useNow: () => new Date('2026-11-03T10:00:00Z').getTime() }));

const product = (id: string, name: string, extra: Partial<Product> = {}): Product =>
  ({
    id,
    name,
    companyId: 'c1',
    companyName: 'Nile Co',
    description: '',
    imageUrl: '',
    price: 1000,
    currency: 'SDG',
    stockCount: 5,
    inStock: true,
    hidden: false,
    hiddenReason: '',
    isDeliveryAvailable: true,
    isInstallationAvailable: false,
    offerPrice: null,
    offerEndsAt: null,
    ...extra,
  }) as unknown as Product;

const show = () =>
  render(
    <I18nProvider>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter initialEntries={['/products']}>
            <Routes>
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/products/:id" element={<p>full page of the product</p>} />
            </Routes>
          </MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
    </I18nProvider>,
  );
const row = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;
const openMenu = (name: string) => {
  fireEvent.click(within(row(name)).getByRole('button', { name: en['common.actions'] }));
  return screen.getByRole('menu', { name: en['common.actions'] });
};

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  vi.mocked(setProductHidden).mockReset().mockResolvedValue(undefined as never);
  vi.mocked(endProductOffer).mockReset().mockResolvedValue(undefined as never);
  mock.products = [
    product('p1', 'Laptop'),
    product('p2', 'Router', { offerPrice: 800, offerEndsAt: new Date('2026-12-01T00:00:00Z') }),
    product('p3', 'Charger', { hidden: true, hiddenReason: 'wrong photos' }),
  ];
  act(() => setUi('v2'));
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  act(() => setUi('v1'));
});

describe('the product list in the redesign', () => {
  it('shows a menu per row instead of a View button, and the menu opens the product', () => {
    show();
    expect(screen.queryByRole('link', { name: en['common.view'] })).toBeNull();
    fireEvent.click(within(openMenu('Laptop')).getByRole('menuitem', { name: en['common.view'] }));
    expect(screen.getByText('full page of the product')).toBeTruthy();
  });

  it('offers Hide for a visible product, End offer only while an offer runs, and Show for a hidden one', () => {
    show();
    const laptop = within(openMenu('Laptop')).getAllByRole('menuitem').map((i) => i.textContent);
    expect(laptop).toEqual([en['common.view'], en['product.hide']]);
    fireEvent.keyDown(window, { key: 'Escape' });
    const router = within(openMenu('Router')).getAllByRole('menuitem').map((i) => i.textContent);
    expect(router).toEqual([en['common.view'], en['product.endOffer'], en['product.hide']]);
    fireEvent.keyDown(window, { key: 'Escape' });
    const charger = within(openMenu('Charger')).getAllByRole('menuitem').map((i) => i.textContent);
    expect(charger).toEqual([en['common.view'], en['product.show']]);
  });

  it('hiding asks for a reason, and sends it with the product', async () => {
    show();
    fireEvent.click(within(openMenu('Laptop')).getByRole('menuitem', { name: en['product.hide'] }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'misleading photos' } });
    fireEvent.click(within(dialog).getByRole('button', { name: en['product.hide'] }));
    await waitFor(() => expect(setProductHidden).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), true, 'misleading photos'));
  });

  it('showing a hidden product needs no reason', async () => {
    show();
    fireEvent.click(within(openMenu('Charger')).getByRole('menuitem', { name: en['product.show'] }));
    await waitFor(() => expect(setProductHidden).toHaveBeenCalledWith(expect.objectContaining({ id: 'p3' }), false));
  });

  it('ending an offer asks first, and cancelling ends nothing', async () => {
    show();
    fireEvent.click(within(openMenu('Router')).getByRole('menuitem', { name: en['product.endOffer'] }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en['common.cancel'] }));
    expect(endProductOffer).not.toHaveBeenCalled();
    fireEvent.click(within(openMenu('Router')).getByRole('menuitem', { name: en['product.endOffer'] }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en['product.endOffer'] }));
    await waitFor(() => expect(endProductOffer).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2' })));
  });

  it('shows the company filter as a pill in the toolbar', () => {
    show();
    expect(within(screen.getByRole('group', { name: en['common.filters'] })).getByRole('combobox', { name: en['col.company'] })).toBeTruthy();
  });
});

describe('with the redesign off, the list is as it was', () => {
  it('shows a View link per row and no menu', () => {
    act(() => setUi('v1'));
    show();
    expect(within(row('Laptop')).getByRole('link', { name: en['common.view'] }).getAttribute('href')).toBe('/products/p1');
    expect(within(row('Laptop')).queryByRole('button', { name: en['common.actions'] })).toBeNull();
    expect(screen.getByRole('combobox', { name: en['col.company'] })).toBeTruthy();
  });
});
