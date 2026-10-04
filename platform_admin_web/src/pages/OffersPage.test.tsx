// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, ToastProvider } from '../components/feedback';
import { endProductOffer, endServiceOffer } from '../data/actions';
import { mapCompany, mapCompanyService, mapProduct, mapService } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { OffersPage } from './OffersPage';

const day = (n: number) => new Date(Date.now() + n * 86_400_000);

const data = vi.hoisted(() => ({
  products: [] as unknown[],
  links: [] as unknown[],
  services: [] as unknown[],
  companies: [] as unknown[],
}));

vi.mock('../data/hooks', () => {
  const ready = (key: keyof typeof data) => () => ({
    status: 'ready' as const,
    error: null,
    retry: () => undefined,
    data: data[key] as never[],
  });
  return {
    useProducts: ready('products'),
    useCompanyServices: ready('links'),
    useServices: ready('services'),
    useCompanies: ready('companies'),
  };
});
vi.mock('../data/actions', () => ({ endProductOffer: vi.fn(), endServiceOffer: vi.fn() }));

const show = () =>
  render(
    <I18nProvider>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter>
            <OffersPage />
          </MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
    </I18nProvider>,
  );

beforeEach(() => {
  vi.mocked(endProductOffer).mockReset().mockResolvedValue(undefined);
  vi.mocked(endServiceOffer).mockReset().mockResolvedValue(undefined);
  data.companies = [mapCompany('c1', { name: 'Nile Co' }), mapCompany('c2', { name: 'Blue Co' })];
  data.services = [mapService('s1', { name: 'Cabling', isActive: true })];
  data.products = [
    mapProduct('p1', { name: 'Router', companyName: 'Nile Co', price: 100, offerPrice: 80, offerEndsAt: day(2) }),
    mapProduct('p2', { name: 'Switch', companyName: 'Blue Co', price: 100 }), // no offer
    mapProduct('p3', { name: 'Old offer', companyName: 'Blue Co', price: 100, offerPrice: 70, offerEndsAt: day(-1) }), // ended
  ];
  data.links = [
    mapCompanyService('l1', { companyId: 'c1', serviceId: 's1', isActive: true, price: 500, offerPrice: 400 }),
    mapCompanyService('l2', { companyId: 'c2', serviceId: 's1', isActive: true, price: 500 }),
  ];
});
afterEach(cleanup);

const card = (title: string) => screen.getByText(title).closest('.card') as HTMLElement;

describe('Offers page', () => {
  it('lists only the offers running now, on products and on services', () => {
    show();
    const products = card(en['offers.products']);
    expect(within(products).getByText('Router')).toBeTruthy();
    expect(within(products).queryByText('Switch')).toBeNull();
    expect(within(products).queryByText('Old offer')).toBeNull();

    const services = card(en['offers.services']);
    expect(within(services).getByText('Cabling')).toBeTruthy();
    expect(within(services).getByText('Nile Co')).toBeTruthy();
    expect(within(services).queryByText('Blue Co')).toBeNull();
    expect(services.textContent).toContain(en['offers.noEnd']);
  });

  it('says when nothing runs', () => {
    data.products = [];
    data.links = [];
    show();
    expect(screen.getAllByText(en['offers.empty'])).toHaveLength(2);
  });

  it('searches by item and company', () => {
    show();
    fireEvent.change(screen.getByPlaceholderText(en['offers.search']), { target: { value: 'cabling' } });
    expect(within(card(en['offers.products'])).queryByText('Router')).toBeNull();
    expect(within(card(en['offers.services'])).getByText('Cabling')).toBeTruthy();
  });

  it('ends a product offer after a confirmation', async () => {
    show();
    fireEvent.click(within(card(en['offers.products'])).getByRole('button', { name: en['offers.end'] }));
    expect(endProductOffer).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en['offers.end'] }));
    await waitFor(() => expect(endProductOffer).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' })));
  });

  it('ends a service offer, naming the service and its company', async () => {
    show();
    fireEvent.click(within(card(en['offers.services'])).getByRole('button', { name: en['offers.end'] }));
    expect(within(screen.getByRole('dialog')).getByText(/Cabling — Nile Co/)).toBeTruthy();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en['offers.end'] }));
    await waitFor(() => expect(endServiceOffer).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1' }), 'Cabling — Nile Co'));
  });

  it('does nothing when the confirmation is cancelled', () => {
    show();
    fireEvent.click(within(card(en['offers.products'])).getByRole('button', { name: en['offers.end'] }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en['common.cancel'] }));
    expect(endProductOffer).not.toHaveBeenCalled();
  });
});

describe('a company service link', () => {
  it('reads its price and offer, and treats a non-positive price as none', () => {
    const link = mapCompanyService('l', { companyId: 'c', serviceId: 's', isActive: true, price: 0, offerPrice: -5, offerBadge: 'special' });
    expect(link.price).toBeNull();
    expect(link.offerPrice).toBeNull();
    expect(link.offerBadge).toBe('special');
    expect(mapCompanyService('l', {}).isActive).toBe(false);
  });
});
