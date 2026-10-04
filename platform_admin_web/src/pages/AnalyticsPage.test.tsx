// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapOrder } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { ar, en } from '../i18n/dictionary';
import { AnalyticsPage } from './AnalyticsPage';

type Status = 'loading' | 'ready' | 'error';
const mock = vi.hoisted(() => ({
  orders: { status: 'ready', data: [] } as { status: Status; data: unknown[] },
  /** What the page asked to read: a start time, or null for every order. */
  asked: [] as (Date | null)[],
}));

vi.mock('../data/hooks', () => {
  const none = () => ({ status: 'ready' as const, error: null, retry: () => undefined, data: [] as never[] });
  return {
    useCompanies: none,
    useCustomers: none,
  };
});
vi.mock('../data/orderHooks', () => ({
  useOrdersSince: (since: Date | null) => {
    mock.asked.push(since);
    return { status: mock.orders.status, error: null, orders: mock.orders.data, reload: () => undefined, retry: () => undefined };
  },
}));

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

/** A valid order: the total is products + installation + delivery. */
const order = (extra: Record<string, unknown>) => {
  const products = (extra.products as number | undefined) ?? 100;
  const installationFee = (extra.installationFee as number | undefined) ?? 0;
  const deliveryFee = (extra.deliveryFee as number | undefined) ?? 0;
  const { products: _products, ...rest } = extra;
  void _products;
  return mapOrder(String(extra.id), {
    customerId: 'u1',
    companyId: 'c1',
    companyName: 'Nile Co',
    productId: 'p1',
    productName: 'Router',
    quantity: 1,
    installationFee,
    deliveryFee,
    totalAmount: products + installationFee + deliveryFee,
    orderStatus: 'completed',
    paymentStatus: 'confirmed',
    createdAt: daysAgo(2),
    ...rest,
  });
};

const show = () =>
  render(
    <I18nProvider>
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    </I18nProvider>,
  );

const tile = (label: string) => {
  const el = screen.getByText(label).closest('.stat') as HTMLElement;
  return {
    value: el.querySelector('.stat__value')!.textContent,
    hint: el.querySelector('.stat__hint')?.textContent ?? null,
  };
};

afterEach(() => {
  cleanup();
  mock.orders = { status: 'ready', data: [] };
});

const BTN = new RegExp('^' + 'Export ' + String.fromCharCode(92) + '(CSV' + String.fromCharCode(92) + ')');

describe('Analytics page', () => {
  it('shows the last 30 days by default and a dash for what cannot be averaged', () => {
    show();
    expect(screen.getByRole('button', { name: new RegExp(en['analytics.period.30d']) }).getAttribute('aria-pressed')).toBe('true');
    expect(tile(en['analytics.averageOrder']).value).toBe('–');
    expect(tile(en['analytics.cancelRate']).value).toBe('–');
  });

  it('counts only confirmed, not cancelled orders as sales, within the selected period', () => {
    mock.orders = {
      status: 'ready',
      data: [
        order({ id: 'a', products: 100 }),
        order({ id: 'b', products: 300 }),
        order({ id: 'w', products: 70, paymentStatus: 'pending_verification', orderStatus: 'processing' }),
        order({ id: 'c', products: 50, orderStatus: 'cancelled', cancelReason: 'expired' }),
        order({ id: 'old', products: 1000, createdAt: daysAgo(60) }),
      ],
    };
    show();
    expect(tile(en['analytics.ordersPlaced']).value).toBe('4');
    expect(tile(en['analytics.confirmedSales']).value).toContain('400');
    expect(tile(en['analytics.awaiting']).value).toContain('70');
    expect(tile(en['analytics.averageOrder']).value).toContain('200');
    expect(tile(en['analytics.cancelled']).value).toBe('1');
    expect(tile(en['analytics.cancelRate']).value).toBe('25%');

    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['analytics.period.all']) }));
    expect(tile(en['analytics.ordersPlaced']).value).toBe('5');
    expect(tile(en['analytics.confirmedSales']).value).toContain('1,400');
  });

  it('flags the unconfirmed orders that are past the 24 hours', () => {
    mock.orders = {
      status: 'ready',
      data: [
        order({ id: 'fresh', paymentStatus: 'pending_verification', orderStatus: 'processing', createdAt: hoursAgo(3) }),
        order({ id: 'late', paymentStatus: 'pending_verification', orderStatus: 'processing', createdAt: hoursAgo(40) }),
      ],
    };
    show();
    expect(tile(en['analytics.awaiting']).hint).toBe('1 past 24 hours (they will expire)');
  });

  it('shows no overdue hint when nothing is overdue', () => {
    mock.orders = {
      status: 'ready',
      data: [order({ id: 'fresh', paymentStatus: 'pending_verification', orderStatus: 'processing', createdAt: hoursAgo(3) })],
    };
    show();
    expect(tile(en['analytics.awaiting']).hint).toBeNull();
  });

  it('splits the confirmed sales into products, installation and delivery', () => {
    mock.orders = { status: 'ready', data: [order({ id: 'a', products: 100, installationFee: 20, deliveryFee: 5 })] };
    show();
    const card = screen.getByText(en['analytics.salesBreakdown']).closest('.card') as HTMLElement;
    const row = (label: string) => within(card).getByText(label).closest('li')!.textContent;
    expect(row(en['analytics.part.products'])).toContain('100');
    expect(row(en['analytics.part.installation'])).toContain('20');
    expect(row(en['analytics.part.delivery'])).toContain('5');
  });

  it('says how many orders have no date, outside "All time"', () => {
    mock.orders = { status: 'ready', data: [order({ id: 'a' }), order({ id: 'b', createdAt: undefined })] };
    show();
    expect(screen.getByText('1 orders have no date, so they appear only under "All time".')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['analytics.period.all']) }));
    expect(screen.queryByText(/have no date/)).toBeNull();
  });

  it('prints how the figures are calculated', () => {
    show();
    const card = screen.getByText(en['analytics.definitions.title']).closest('.card') as HTMLElement;
    expect(within(card).getAllByRole('listitem')).toHaveLength(5);
    expect(ar['analytics.definitions.confirmed']).toBeTruthy();
  });

  it('lists the cancellation reasons and the best company by confirmed sales, linked to its page', () => {
    mock.orders = {
      status: 'ready',
      data: [
        order({ id: 'a', products: 100 }),
        order({ id: 'b', companyId: 'c2', companyName: 'Blue Co', products: 900 }),
        order({ id: 'u', companyId: 'c3', companyName: 'Unpaid Co', products: 5000, paymentStatus: 'pending_verification', orderStatus: 'processing' }),
        order({ id: 'c', orderStatus: 'cancelled', cancelReason: 'out_of_stock' }),
      ],
    };
    show();
    const card = screen.getByText(en['analytics.topCompanies']).closest('.card') as HTMLElement;
    const links = within(card).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Blue Co', 'Nile Co']);
    expect(links[0].getAttribute('href')).toBe('/companies/c2');
    expect(screen.getByText(en['analytics.reason.out_of_stock'])).toBeTruthy();
  });

  it('disables the export when the period has no orders and enables it otherwise', () => {
    show();
    expect((screen.getByRole('button', { name: BTN }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    mock.orders = { status: 'ready', data: [order({ id: 'a' })] };
    show();
    expect((screen.getByRole('button', { name: BTN }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('exports exactly the orders of the selected period', async () => {
    mock.orders = { status: 'ready', data: [order({ id: 'new1' }), order({ id: 'old1', createdAt: daysAgo(60) })] };
    let exported: Blob | null = null;
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      exported = blob as Blob;
      return 'blob:test';
    };
    URL.revokeObjectURL = () => undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    show();
    fireEvent.click(screen.getByRole('button', { name: BTN }));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      en['analytics.exportCsv'],
      en['analytics.export.byDay'],
      en['analytics.export.byCompany'],
      en['analytics.export.byProduct'],
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: en['analytics.exportCsv'] }));
    expect(click).toHaveBeenCalledTimes(1);
    const text = await (exported as unknown as Blob).text();
    expect(text).toContain('new1');
    expect(text).not.toContain('old1');
    click.mockRestore();
  });

  it('waits for the orders instead of showing zeros', () => {
    mock.orders = { status: 'loading', data: [] };
    show();
    expect(screen.queryByText(en['analytics.ordersPlaced'])).toBeNull();
  });
});

describe('Analytics: which orders are read', () => {
  it('reads the last year, not every order, for every period but all time', () => {
    mock.asked.length = 0;
    mock.orders = { status: 'ready', data: [] };
    show();
    const since = mock.asked[mock.asked.length - 1];
    expect(since).not.toBeNull();
    const days = (Date.now() - since!.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(365);
    expect(days).toBeLessThan(367);
  });

  it('reads every order only when "all time" is chosen, and says it can take a while', () => {
    mock.asked.length = 0;
    mock.orders = { status: 'ready', data: [] };
    show();
    expect(screen.queryByText(en['analytics.allTimeNote'])).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['analytics.period.all']) }));
    expect(mock.asked[mock.asked.length - 1]).toBeNull();
    expect(screen.getByText(en['analytics.allTimeNote'])).toBeTruthy();
  });

  it('does not show a count for "all time" until the whole history has been read', () => {
    mock.orders = { status: 'ready', data: [order({ id: 'a' }), order({ id: 'b' })] };
    show();
    const chip = screen.getByRole('button', { name: new RegExp(en['analytics.period.all']) });
    expect(chip.querySelector('.chip__count')).toBeNull();
    const thirty = screen.getByRole('button', { name: new RegExp(en['analytics.period.30d']) });
    expect(thirty.querySelector('.chip__count')!.textContent).toBe('2');
  });
});
