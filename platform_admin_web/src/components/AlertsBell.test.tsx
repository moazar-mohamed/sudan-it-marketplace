// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attentionCounts } from '../data/attention';
import { attentionItems, attentionTotal } from '../data/attentionItems';
import type { DashboardSnapshot } from '../data/dashboardData';
import { failed, makeSnapshot, ok } from '../data/dashboardTestkit';
import { mapCompany, mapOrder, mapReview, mapServiceRequest } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { setBaseTitle } from '../ui/titleBadge';
import { AlertsBell } from './AlertsBell';
import { ToastProvider } from './feedback';
import { useAttentionAlerts } from './useAttentionAlerts';

const mock = vi.hoisted(() => ({ snapshot: null as unknown, refresh: vi.fn(), newReports: [] as unknown[] }));
vi.mock('../data/hooks', () => ({
  useNewReports: () => ({ status: 'ready', error: null, retry: () => undefined, data: mock.newReports }),
}));
vi.mock('../data/useDashboard', () => ({
  useDashboard: () => ({ snapshot: mock.snapshot, refreshing: false, refresh: mock.refresh }),
}));

const hours = (h: number) => new Date(Date.now() - h * 3_600_000);
const unverified = (id: string, ageHours = 30) =>
  mapOrder(id, { orderStatus: 'processing', paymentStatus: 'pending_verification', createdAt: hours(ageHours) });

const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;

const show = (snapshot: DashboardSnapshot | null) => {
  mock.snapshot = snapshot;
  render(
    <I18nProvider>
      <MemoryRouter>
        <AlertsBell />
        <Where />
      </MemoryRouter>
    </I18nProvider>,
  );
};

const bell = () => screen.getByRole('button', { name: /Alerts/ });

beforeEach(() => {
  mock.refresh.mockReset();
  mock.newReports = [];
  localStorage.clear();
});
afterEach(cleanup);

describe('the alerts bell', () => {
  it('shows nothing on the bell when nothing needs attention, or before the first read', () => {
    show(makeSnapshot());
    expect(document.querySelector('.bell__badge')).toBeNull();
    cleanup();
    show(null);
    expect(document.querySelector('.bell__badge')).toBeNull();
  });

  it('counts the records that need attention, by the dashboard\'s own rules', () => {
    show(
      makeSnapshot({
        openOrders: ok([unverified('a'), unverified('b'), mapOrder('c', { orderStatus: 'processing', paymentStatus: 'confirmed', createdAt: hours(24 * 6) })]),
        pendingRequests: ok([mapServiceRequest('r', { status: 'pending', createdAt: hours(60) })]),
        lowReviews: ok([mapReview('v', { stars: 1, createdAt: hours(24) })]),
        emptyCompanies: ok([mapCompany('c', { createdAt: hours(24 * 10) })]),
      }),
    );
    expect(document.querySelector('.bell__badge')!.textContent).toBe('6');
    expect(bell().getAttribute('aria-label')).toBe('Alerts: 6 need attention');
  });

  it('caps a big number at 99+', () => {
    show(makeSnapshot({ openOrders: ok(Array.from({ length: 120 }, (_, i) => unverified(`o${i}`))) }));
    expect(document.querySelector('.bell__badge')!.textContent).toBe('99+');
  });

  it('opens a list of what needs attention, each linking to its rows, and closes after a click', () => {
    show(makeSnapshot({ openOrders: ok([unverified('a')]), lowReviews: ok([mapReview('v', { stars: 1, createdAt: hours(24) })]) }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(bell());
    const panel = screen.getByRole('dialog', { name: en['alerts.title'] });
    const rows = within(panel).getAllByRole('link');
    expect(rows.map((r) => r.getAttribute('href'))).toEqual([
      '/orders?attention=unverified',
      '/reviews?attention=low',
      // The same unverified payment is also one that is waiting to be confirmed.
      '/orders?status=processing',
    ]);
    fireEvent.click(rows[0]);
    expect(screen.getByTestId('where').textContent).toBe('/orders?attention=unverified');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says so when nothing needs attention', () => {
    show(makeSnapshot());
    fireEvent.click(bell());
    expect(screen.getByText(en['alerts.none'])).toBeTruthy();
  });

  it('lists what is only waiting for others, without counting it as attention', () => {
    show(
      makeSnapshot({
        openOrders: ok([unverified('fresh', 2), unverified('also-fresh', 3)]),
        pendingRequests: ok([mapServiceRequest('r', { status: 'pending', createdAt: hours(5) })]),
      }),
    );
    expect(document.querySelector('.bell__badge')).toBeNull();
    fireEvent.click(bell());
    const panel = screen.getByRole('dialog');
    expect(within(panel).getByText(en['alerts.pendingRequests']).closest('a')!.textContent).toContain('1');
    expect(within(panel).getByText(en['alerts.unverifiedAny']).closest('a')!.textContent).toContain('2');
    expect(within(panel).getByText(en['alerts.unverifiedAny']).closest('a')!.getAttribute('href')).toBe('/orders?status=processing');
  });

  it('closes with Escape and with a press outside, but not with a press inside', () => {
    show(makeSnapshot());
    fireEvent.click(bell());
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(bell());
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('refreshes on demand and says when the figures were read', () => {
    show(makeSnapshot());
    fireEvent.click(bell());
    expect(screen.getByText(/^Updated /)).toBeTruthy();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en['dashboard.refresh'] }));
    expect(mock.refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps working when a source could not be read', () => {
    show(makeSnapshot({ openOrders: failed, lowReviews: ok([mapReview('v', { stars: 1, createdAt: hours(24) })]) }));
    expect(document.querySelector('.bell__badge')!.textContent).toBe('1');
  });
});

describe('new reports in the bell', () => {
  it('count on the bell with the rest, and are listed first with a link to the reports', () => {
    mock.newReports = [{ id: 'r1' }, { id: 'r2' }];
    show(makeSnapshot({ openOrders: ok([unverified('a')]) }));
    expect(document.querySelector('.bell__badge')?.textContent).toBe('3');
    fireEvent.click(bell());
    const row = screen.getByRole('link', { name: new RegExp(en['alerts.newReportsRow']) });
    expect(row.getAttribute('href')).toBe('/reports');
    expect(row.textContent).toContain('2');
    fireEvent.click(row);
    expect(screen.getByTestId('where').textContent).toBe('/reports');
  });

  it('are counted even before the dashboard figures are read, and never say "nothing needs attention"', () => {
    mock.newReports = [{ id: 'r1' }];
    show(null);
    expect(document.querySelector('.bell__badge')?.textContent).toBe('1');
    fireEvent.click(bell());
    expect(screen.queryByText(en['alerts.none'])).toBeNull();
  });
});

describe('the shared attention rules', () => {
  it('lists the five rules in order with their urgency and their link', () => {
    const items = attentionItems(null, (key) => key);
    expect(items.map((i) => i.key)).toEqual(['unverified', 'stuck', 'staleRequests', 'lowReviews', 'noProducts']);
    expect(items.map((i) => i.severity)).toEqual(['high', 'medium', 'medium', 'medium', 'info']);
    expect(items.every((i) => i.count === undefined)).toBe(true);
  });

  it('adds up what could be read, and says null when nothing could', () => {
    expect(attentionTotal(null)).toBeNull();
    expect(attentionTotal({ unverified: 2, stuck: null, staleRequests: 1, lowReviews: 0, noProducts: null })).toBe(3);
    expect(attentionTotal({ unverified: null, stuck: null, staleRequests: null, lowReviews: null, noProducts: null })).toBeNull();
    expect(attentionTotal(attentionCounts(makeSnapshot()))).toBe(0);
  });
});

describe('alerts while the panel stays open', () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <I18nProvider>
      <ToastProvider>{children}</ToastProvider>
    </I18nProvider>
  );
  const toasts = () => [...document.querySelectorAll('.toast')].map((t) => t.textContent);
  const withOrders = (n: number) => makeSnapshot({ openOrders: ok(Array.from({ length: n }, (_, i) => unverified(`o${i}`))) });

  // The language provider owns the page name.
  const NAME = `${en['app.name']} - ${en['app.role']}`;
  beforeEach(() => setBaseTitle(NAME));

  it('puts the number in front of the tab title, and takes it off when nothing is left', () => {
    const { rerender } = renderHook(({ s }) => useAttentionAlerts(s), { wrapper: Wrapper, initialProps: { s: withOrders(3) as DashboardSnapshot | null } });
    expect(document.title).toBe(`(3) ${NAME}`);
    rerender({ s: withOrders(0) });
    expect(document.title).toBe(NAME);
  });

  it('stays quiet for the first read: opening the panel is not news', () => {
    renderHook(() => useAttentionAlerts(withOrders(4)), { wrapper: Wrapper });
    expect(toasts()).toEqual([]);
  });

  it('says so when a later read finds more than the one before', () => {
    const { rerender } = renderHook(({ s }) => useAttentionAlerts(s), { wrapper: Wrapper, initialProps: { s: withOrders(2) as DashboardSnapshot | null } });
    act(() => rerender({ s: withOrders(5) }));
    expect(toasts()).toEqual(['New: 3 more need your attention.']);
    expect(document.querySelector('.toast--info')).not.toBeNull();
  });

  it('says nothing when there are fewer, or the same number', () => {
    const { rerender } = renderHook(({ s }) => useAttentionAlerts(s), { wrapper: Wrapper, initialProps: { s: withOrders(5) as DashboardSnapshot | null } });
    act(() => rerender({ s: withOrders(5) }));
    act(() => rerender({ s: withOrders(2) }));
    expect(toasts()).toEqual([]);
    // A rise from the lower number counts again.
    act(() => rerender({ s: withOrders(3) }));
    expect(toasts()).toEqual(['New: 1 more need your attention.']);
  });

  it('counts the reports waiting in the tab title, even before the figures are read', () => {
    const { rerender } = renderHook(({ s, r }) => useAttentionAlerts(s, r), { wrapper: Wrapper, initialProps: { s: null as DashboardSnapshot | null, r: 2 as number | null } });
    expect(document.title).toBe(`(2) ${NAME}`);
    rerender({ s: withOrders(3), r: 2 });
    expect(document.title).toBe(`(5) ${NAME}`);
    rerender({ s: withOrders(3), r: 0 });
    expect(document.title).toBe(`(3) ${NAME}`);
  });

  it('says so at once when a new report arrives, and not for the ones already waiting', () => {
    const { rerender } = renderHook(({ r }) => useAttentionAlerts(null, r), { wrapper: Wrapper, initialProps: { r: null as number | null } });
    rerender({ r: 4 });
    expect(toasts()).toEqual([]);
    act(() => rerender({ r: 5 }));
    expect(toasts()).toEqual(['New: 1 new report from a customer or a company.']);
    act(() => rerender({ r: 3 }));
    expect(toasts()).toHaveLength(1);
  });

  it('does nothing before the first read, and clears the title when the panel is left', () => {
    const { rerender, unmount } = renderHook(({ s }) => useAttentionAlerts(s), { wrapper: Wrapper, initialProps: { s: null as DashboardSnapshot | null } });
    expect(document.title).toBe(NAME);
    rerender({ s: withOrders(2) });
    expect(document.title).toBe(`(2) ${NAME}`);
    unmount();
    expect(document.title).toBe(NAME);
  });
});
