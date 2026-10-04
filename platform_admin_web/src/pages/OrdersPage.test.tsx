// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PagedOrders } from '../data/orderHooks';
import type { OrderFilter } from '../data/orderQueries';
import { failed, makeSnapshot, ok } from '../data/dashboardTestkit';
import { mapCompany, mapOrder } from '../data/mappers';
import type { Order } from '../data/types';
import { ToastProvider } from '../components/feedback';
import { downloadCsv } from '../data/csv';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { OrdersPage, parseDay } from './OrdersPage';

const mock = vi.hoisted(() => ({
  paged: null as unknown,
  counts: null as unknown,
  snapshot: null as unknown,
  asked: [] as { filter: OrderFilter; enabled: boolean }[],
  askedCounts: [] as { filter: unknown; enabled: boolean; reload: number }[],
  exported: null as unknown,
  exportAsked: [] as OrderFilter[],
}));

vi.mock('../data/hooks', () => ({
  useCompanies: () => ({ status: 'ready', error: null, retry: () => undefined, data: [mapCompany('c1', { name: 'Nile Co' }), mapCompany('c2', { name: 'Blue Co' })] }),
}));
vi.mock('../data/orderHooks', () => ({
  usePagedOrders: (filter: OrderFilter, enabled = true) => {
    mock.asked.push({ filter, enabled });
    return mock.paged;
  },
  exportOrders: async (filter: OrderFilter) => {
    mock.exportAsked.push(filter);
    return mock.exported;
  },
  useOrderStatusCounts: (filter: unknown, enabled = true, reload = 0) => {
    mock.askedCounts.push({ filter, enabled, reload });
    return mock.counts;
  },
}));
vi.mock('../data/csv', async (original) => ({ ...(await original<typeof import('../data/csv')>()), downloadCsv: vi.fn() }));
vi.mock('../data/useDashboard', () => ({ useDashboard: () => ({ snapshot: mock.snapshot, refreshing: false, refresh: () => undefined }) }));

const hours = (h: number) => new Date(Date.now() - h * 3_600_000);
const paged = (over: Partial<PagedOrders> = {}): PagedOrders => ({
  status: 'ready',
  error: null,
  orders: [],
  hasMore: false,
  loadingMore: false,
  loadMore: vi.fn(),
  changes: 0,
  retry: vi.fn(),
  ...over,
});
const order = (id: string, extra: Record<string, unknown> = {}): Order =>
  mapOrder(id, { customerId: 'u', customerName: `Customer ${id}`, companyId: 'c1', companyName: 'Nile Co', totalAmount: 100, createdAt: hours(5), ...extra });

const Where = () => <p data-testid="where">{useLocation().search}</p>;
const show = (url = '/orders') =>
  render(
    <I18nProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[url]}>
          <OrdersPage />
          <Where />
        </MemoryRouter>
      </ToastProvider>
    </I18nProvider>,
  );
const lastAsk = () => mock.asked[mock.asked.length - 1];
const names = () => [...document.querySelectorAll('table.data tbody tr')].map((r) => r.children[1].textContent);

beforeEach(() => {
  mock.paged = paged({ orders: [order('a'), order('b')] });
  mock.counts = { processing: 3, out_for_delivery: 1, completed: 40, cancelled: 6 };
  mock.snapshot = null;
  mock.asked.length = 0;
  mock.askedCounts.length = 0;
  mock.exportAsked.length = 0;
  mock.exported = { orders: [order('a'), order('b'), order('c')], capped: false };
  vi.mocked(downloadCsv).mockReset();
});
afterEach(cleanup);

describe('reading a day from the address', () => {
  it('is the start or the end of that day', () => {
    expect(parseDay('2026-10-05', 'start')).toEqual(new Date(2026, 9, 5, 0, 0, 0, 0));
    expect(parseDay('2026-10-05', 'end')).toEqual(new Date(2026, 9, 5, 23, 59, 59, 999));
  });

  it('is nothing for text that is not a day, or a day that does not exist', () => {
    for (const bad of [null, '', 'soon', '2026-1-5', '2026-02-31', '2026-13-01', '05/10/2026']) {
      expect(parseDay(bad, 'start'), String(bad)).toBeNull();
    }
  });
});

describe('the order list', () => {
  it('shows the first page, with how many of how many', () => {
    show();
    expect(names()).toEqual(['Customer a', 'Customer b']);
    expect(screen.getByText('Showing 2 of 50 orders')).toBeTruthy();
    expect(screen.queryByRole('button', { name: en['orders.loadMore'] })).toBeNull();
  });

  it('asks the server for a page with no filter at first', () => {
    show();
    expect(lastAsk()).toEqual({ filter: { status: null, companyId: null, from: null, to: null }, enabled: true });
  });

  it('shows the counts of every status from the server, not from the rows on screen', () => {
    show();
    const chip = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}`) }).querySelector('.chip__count')?.textContent;
    expect(chip(en['common.all'])).toBe('50');
    expect(chip(en['order.status.processing'])).toBe('3');
    expect(chip(en['order.status.completed'])).toBe('40');
    expect(chip(en['order.status.cancelled'])).toBe('6');
  });

  it('shows no counts until they are known', () => {
    mock.counts = null;
    show();
    expect(document.querySelectorAll('.chip__count')).toHaveLength(0);
    expect(screen.getByText('Showing 2 orders')).toBeTruthy();
  });

  it('offers the next page while there is one, and asks for it', () => {
    const loadMore = vi.fn();
    mock.paged = paged({ orders: [order('a')], hasMore: true, loadMore });
    show();
    fireEvent.click(screen.getByRole('button', { name: en['orders.loadMore'] }));
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('shows that it is loading more, and cannot be pressed meanwhile', () => {
    mock.paged = paged({ orders: [order('a')], hasMore: true, loadingMore: true });
    show();
    expect((screen.getByRole('button', { name: en['common.loading'] }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('waits with placeholders, shows an error with a retry, and a message when there are no orders at all', () => {
    mock.paged = paged({ status: 'loading' });
    show();
    expect(document.querySelector('.skeleton-list')).not.toBeNull();
    cleanup();
    const retry = vi.fn();
    mock.paged = paged({ status: 'error', retry });
    show();
    fireEvent.click(screen.getByRole('button', { name: en['common.retry'] }));
    expect(retry).toHaveBeenCalled();
    cleanup();
    mock.paged = paged();
    show();
    expect(screen.getByText(en['orders.empty'])).toBeTruthy();
  });

  it('says the list is being prepared when the server is still building its index', () => {
    mock.paged = paged({ status: 'error', error: { code: 'failed-precondition' } });
    show();
    expect(screen.getByText(en['error.indexBuilding'])).toBeTruthy();
    cleanup();
    mock.paged = paged({ status: 'error', error: { code: 'permission-denied' } });
    show();
    expect(screen.getByText(en['error.load'])).toBeTruthy();
  });

  it('says "no results" instead when a filter or the search leaves nothing', () => {
    mock.paged = paged();
    show('/orders?status=completed');
    expect(screen.getByText(en['common.noResults'])).toBeTruthy();
    cleanup();
    mock.paged = paged({ orders: [order('a')] });
    show();
    fireEvent.change(screen.getByPlaceholderText(en['orders.search']), { target: { value: 'nobody' } });
    expect(screen.getByText(en['common.noResults'])).toBeTruthy();
  });

  it('searches only the rows loaded, and says where to search every order', () => {
    show();
    fireEvent.change(screen.getByPlaceholderText(en['orders.search']), { target: { value: 'customer b' } });
    expect(names()).toEqual(['Customer b']);
    expect(screen.getByText(en['orders.searchHint'])).toBeTruthy();
  });

  it('has no refresh button: the list is live, and the counts are read again when it changes', () => {
    mock.paged = paged({ orders: [order('a')], changes: 0 });
    const view = show();
    expect(screen.queryByRole('button', { name: en['dashboard.refresh'] })).toBeNull();
    expect(mock.askedCounts[mock.askedCounts.length - 1].reload).toBe(0);
    cleanup();
    mock.paged = paged({ orders: [order('a'), order('b')], changes: 3 });
    show();
    expect(mock.askedCounts[mock.askedCounts.length - 1].reload).toBe(3);
    void view;
  });
});

describe('the filters go to the server', () => {
  it('sends the status of a chip, and keeps it in the address', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${en['order.status.completed']}`) }));
    expect(lastAsk().filter.status).toBe('completed');
    expect(screen.getByTestId('where').textContent).toBe('?status=completed');
  });

  it('reads the company and the status from the address', () => {
    show('/orders?company=c2&status=cancelled');
    expect(lastAsk().filter).toMatchObject({ status: 'cancelled', companyId: 'c2' });
    expect((screen.getByRole('combobox', { name: en['col.company'] }) as HTMLSelectElement).value).toBe('c2');
  });

  it('lists every company in the choice, not only those with orders on screen', () => {
    show();
    const options = within(screen.getByRole('combobox', { name: en['col.company'] })).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual([en['products.allCompanies'], 'Nile Co', 'Blue Co']);
  });

  it('sends a company chosen from the list', () => {
    show();
    fireEvent.change(screen.getByRole('combobox', { name: en['col.company'] }), { target: { value: 'c1' } });
    expect(lastAsk().filter.companyId).toBe('c1');
  });

  it('sends a date range as the whole of the first day to the whole of the last', () => {
    show();
    const [from, to] = screen.getAllByDisplayValue('') .filter((e) => (e as HTMLInputElement).type === 'date') as HTMLInputElement[];
    fireEvent.change(from, { target: { value: '2026-10-01' } });
    fireEvent.change(to, { target: { value: '2026-10-05' } });
    expect(lastAsk().filter.from).toEqual(new Date(2026, 9, 1, 0, 0, 0, 0));
    expect(lastAsk().filter.to).toEqual(new Date(2026, 9, 5, 23, 59, 59, 999));
    expect(screen.getByTestId('where').textContent).toBe('?from=2026-10-01&to=2026-10-05');
  });

  it('clears the dates with one click', () => {
    show('/orders?from=2026-10-01&to=2026-10-05&status=completed');
    fireEvent.click(screen.getByRole('button', { name: en['orders.clearDates'] }));
    expect(screen.getByTestId('where').textContent).toBe('?status=completed');
    expect(screen.queryByRole('button', { name: en['orders.clearDates'] })).toBeNull();
  });

  it('reads nothing, and says so, when the start is after the end', () => {
    show('/orders?from=2026-10-05&to=2026-10-01');
    expect(screen.getByRole('alert').textContent).toBe(en['orders.badRange']);
    expect(lastAsk().enabled).toBe(false);
    expect(document.querySelector('table.data')).toBeNull();
  });

  it('ignores a date in the address that is not a date', () => {
    show('/orders?from=yesterday');
    expect(lastAsk().filter.from).toBeNull();
  });
});

describe('a list the dashboard flagged', () => {
  const flaggedSnapshot = () =>
    makeSnapshot({
      openOrders: ok([
        order('stale', { orderStatus: 'processing', paymentStatus: 'pending_verification', createdAt: hours(30) }),
        order('fresh', { orderStatus: 'processing', paymentStatus: 'pending_verification', createdAt: hours(2) }),
        order('late', { orderStatus: 'processing', paymentStatus: 'pending_verification', createdAt: hours(40), companyId: 'c2' }),
        order('stuck', { orderStatus: 'out_for_delivery', paymentStatus: 'confirmed', createdAt: hours(24 * 6) }),
      ]),
    });

  it('shows exactly the rows the dashboard counted, read from its own figures and not from the server', () => {
    mock.snapshot = flaggedSnapshot();
    show('/orders?attention=unverified');
    expect(names().sort()).toEqual(['Customer late', 'Customer stale']);
    expect(lastAsk().enabled).toBe(false);
    expect(screen.getByText('Showing 2 orders')).toBeTruthy();
  });

  it('shows the stuck orders for the other rule', () => {
    mock.snapshot = flaggedSnapshot();
    show('/orders?attention=stuck');
    expect(names()).toEqual(['Customer stuck']);
  });

  it('still narrows by company, and counts statuses among the rows it has', () => {
    mock.snapshot = flaggedSnapshot();
    show('/orders?attention=unverified&company=c2');
    expect(names()).toEqual(['Customer late']);
    const chip = screen.getByRole('button', { name: new RegExp(`^${en['order.status.processing']}`) });
    expect(chip.querySelector('.chip__count')!.textContent).toBe('1');
  });

  it('shows the banner, and clearing it goes back to the whole list', () => {
    mock.snapshot = flaggedSnapshot();
    show('/orders?attention=unverified&status=processing');
    fireEvent.click(screen.getByRole('button', { name: en['attention.clear'] }));
    expect(screen.getByTestId('where').textContent).toBe('?status=processing');
    expect(lastAsk().enabled).toBe(true);
  });

  it('waits for the dashboard figures, and says error if they could not be read', () => {
    mock.snapshot = null;
    show('/orders?attention=stuck');
    expect(document.querySelector('.skeleton-list')).not.toBeNull();
    cleanup();
    mock.snapshot = makeSnapshot({ openOrders: failed });
    show('/orders?attention=stuck');
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('has no refresh button of its own: the dashboard refreshes the figures', () => {
    mock.snapshot = flaggedSnapshot();
    show('/orders?attention=stuck');
    expect(screen.queryByRole('button', { name: en['dashboard.refresh'] })).toBeNull();
  });
});

describe('exporting the orders', () => {
  const press = () =>
    act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['common.exportCsv'] }));
    });

  it('reads every order the filters match, not only the page on screen, and downloads them', async () => {
    show('/orders?status=completed&company=c1&from=2026-10-01');
    await press();
    expect(mock.exportAsked).toEqual([{ status: 'completed', companyId: 'c1', from: new Date(2026, 9, 1, 0, 0, 0, 0), to: null }]);
    expect(vi.mocked(downloadCsv)).toHaveBeenCalledTimes(1);
    const [name, text] = vi.mocked(downloadCsv).mock.calls[0];
    expect(name).toMatch(/^orders-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(text.match(/order_id|Customer [abc]/g)).toHaveLength(1 + 3); // the header and the three orders read
    expect(await screen.findByText('Exported 3 orders.')).toBeTruthy();
  });

  it('says so when the cap cut the list short', async () => {
    mock.exported = { orders: [order('a'), order('b')], capped: true };
    show();
    await press();
    expect(await screen.findByText(en['orders.exportCapped'].replace('{n}', '2'))).toBeTruthy();
  });

  it('has nothing to export while the list is still loading, or the dates are backwards', () => {
    mock.paged = paged({ status: 'loading' });
    show();
    expect((screen.getByRole('button', { name: en['common.exportCsv'] }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    mock.paged = paged({ orders: [order('a')] });
    show('/orders?from=2026-10-05&to=2026-10-01');
    expect((screen.getByRole('button', { name: en['common.exportCsv'] }) as HTMLButtonElement).disabled).toBe(true);
  });
});
