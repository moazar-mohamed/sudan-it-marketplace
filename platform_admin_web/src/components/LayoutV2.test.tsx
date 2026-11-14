// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardSnapshot } from '../data/dashboardData';
import { makeSnapshot, ok } from '../data/dashboardTestkit';
import { mapOrder, mapServiceRequest } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { setTheme } from '../theme/theme';
import { setDensity } from '../theme/ui';
import { ToastProvider } from './feedback';
import { Layout } from './Layout';
import { NAV } from './navItems';
import { NAV_V2, sectionOfPath } from './navItemsV2';

const mock = vi.hoisted(() => ({
  snapshot: null as unknown,
  newReports: [] as unknown[],
  signOut: vi.fn(),
  changeLanguage: vi.fn(),
}));

vi.mock('../data/useDashboard', () => ({
  useDashboard: () => ({ snapshot: mock.snapshot, refreshing: false, refresh: () => undefined }),
}));
vi.mock('../data/DashboardProvider', () => ({ DashboardProvider: ({ children }: { children: unknown }) => children }));
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    state: { status: 'authorized', profile: { uid: 'a', fullName: 'Mona', email: 'm@x.test' } },
    signOut: mock.signOut,
  }),
}));
vi.mock('../firebase', () => ({ db: {} }));
// The bell's list of notices to the admins is tested on its own (AlertsBell.test.tsx).
vi.mock('../data/platformNotices', () => ({ usePlatformNotices: () => [], markPlatformNoticeRead: async () => undefined, markPlatformNoticesRead: async () => undefined, platformNoticeTarget: () => '/' }));
// A pressed browser push and this browser's push address are tested on their own.
vi.mock('../data/webPush', () => ({ listenForPushOpens: () => () => undefined, refreshPush: async () => undefined }));
vi.mock('../data/hooks', () => ({
  useNewReports: () => ({ status: 'ready', error: null, retry: () => undefined, data: mock.newReports }),
}));
vi.mock('../i18n/useChangeLanguage', () => ({ useChangeLanguage: () => mock.changeLanguage }));

const show = (path: string, snapshot: DashboardSnapshot | null = null) => {
  mock.snapshot = snapshot;
  render(
    <I18nProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Layout />
        </MemoryRouter>
      </ToastProvider>
    </I18nProvider>,
  );
};

const sidebar = () => document.querySelector('.sidebar') as HTMLElement;
const hours = (h: number) => new Date(Date.now() - h * 3_600_000);
const labels = (links: Iterable<Element>) => [...links].map((a) => a.textContent?.replace(/\d+\+?$/, ''));

beforeEach(() => {
  localStorage.clear();
  mock.newReports = [];
  mock.signOut.mockClear();
  mock.changeLanguage.mockClear();
  act(() => {
    setDensity('comfortable');
    setTheme('system');
  });
});
afterEach(() => {
  cleanup();
});

describe('the redesigned menu (v2)', () => {
  it('has nine sections: eight in the main menu and the settings under System', () => {
    show('/');
    const links = sidebar().querySelectorAll('.v2-link');
    expect(labels(links)).toEqual(['Dashboard', 'Orders', 'Companies', 'Catalogue', 'Customers', 'Reviews', 'Reports', 'Analytics', 'Settings']);
    expect(sidebar().querySelector('.v2-nav__label')?.textContent).toBe('System');
  });

  it('opens the parts of the section you are in, and only that one', () => {
    show('/categories');
    const group = within(sidebar()).getByRole('group', { name: 'Catalogue sections' });
    expect(labels(group.querySelectorAll('a'))).toEqual(['Products', 'Services', 'Categories', 'Offers']);
    expect(sidebar().querySelectorAll('.v2-sub')).toHaveLength(1);
    const active = group.querySelector('.v2-sublink--active');
    expect(active?.textContent).toBe('Categories');
    expect(sidebar().querySelector('.v2-link--active')?.textContent).toContain('Catalogue');
  });

  it('opens nothing under the dashboard', () => {
    show('/');
    expect(sidebar().querySelectorAll('.v2-sub')).toHaveLength(0);
    expect(sidebar().querySelector('.v2-link--active')?.textContent).toBe('Dashboard');
  });

  it('keeps the settings pages together under Settings, with the trash among them', () => {
    show('/trash');
    const group = within(sidebar()).getByRole('group', { name: 'Settings sections' });
    expect(labels(group.querySelectorAll('a'))).toEqual(['Notices and maintenance', 'Cities', 'Terms and conditions', 'Admins', 'Activity log', 'Trash']);
    expect(group.querySelector('.v2-sublink--active')?.textContent).toBe('Trash');
  });

  it('every address of the current panel belongs to a section, so no page is lost', () => {
    for (const item of NAV) expect(sectionOfPath(item.to), item.to).toBeDefined();
    for (const detail of ['/companies/x', '/customers/x', '/products/x', '/orders/x', '/service-requests/x']) {
      expect(sectionOfPath(detail), detail).toBeDefined();
    }
  });

  // The profile is reached from the person menu, not the side menu.
  it.each(NAV.filter((n) => n.to !== '/profile').map((n) => n.to))(
    'the address of the current menu %s is still a link once its section is open',
    (to) => {
      show(to);
      const hrefs = [...sidebar().querySelectorAll('a')].map((a) => a.getAttribute('href'));
      const section = NAV_V2.find((s) => s.to === to || s.children?.some((c) => c.to === to));
      expect(section, to).toBeDefined();
      expect(hrefs.includes(to) || hrefs.includes(section!.to), to).toBe(true);
    },
  );

  it('a section carries the sum of the attention counts of its parts', () => {
    show(
      '/orders',
      makeSnapshot({
        openOrders: ok([mapOrder('a', { orderStatus: 'processing', paymentStatus: 'pending_verification', createdAt: hours(30) })]),
        pendingRequests: ok([mapServiceRequest('r', { status: 'pending', createdAt: hours(60) })]),
      }),
    );
    const orders = within(sidebar()).getByText('Orders', { selector: 'span' }).closest('a')!;
    expect(orders.querySelector('.nav-badge')?.textContent).toBe('2');
    const parts = within(sidebar()).getByRole('group', { name: 'Orders sections' });
    expect(labels(parts.querySelectorAll('a'))).toEqual(['Product orders', 'Service Requests']);
    expect(parts.querySelectorAll('.nav-badge')).toHaveLength(2);
  });

  it('puts the tabs of the section above the page', () => {
    show('/offers');
    const tabs = document.querySelector('.content nav.ds-tabs') as HTMLElement;
    expect(labels(tabs.querySelectorAll('a'))).toEqual(['Products', 'Services', 'Categories', 'Offers']);
    expect(tabs.querySelector('[aria-current="page"]')?.textContent).toBe('Offers');
  });

  it('keeps four sections in the phone bar, with More for the rest', () => {
    show('/');
    const bar = document.querySelector('.tabbar') as HTMLElement;
    const items = [...bar.querySelectorAll('.tabbar__label')].map((n) => n.textContent);
    expect(items).toEqual(['Dashboard', 'Orders', 'Companies', 'Reports', 'More']);
  });

  it('marks More as current when you are in a section that is not in the bar', () => {
    show('/categories');
    const more = within(document.querySelector('.tabbar') as HTMLElement).getByRole('button', { name: /more/i });
    expect(more.className).toContain('tabbar__item--active');
  });
});

describe('the top bar and the person menu (v2)', () => {
  it('has search, the alerts bell and the person menu; sign-out and language live in the menu', () => {
    show('/');
    expect(screen.getByRole('button', { name: /search/i })).toBeTruthy();
    expect(document.querySelector('.bell')).toBeTruthy();
    expect(within(sidebar()).queryByRole('button', { name: /sign out/i })).toBeNull();
    expect(document.querySelector('.topbar__title')).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    const menu = screen.getByRole('menu', { name: 'Account menu' });
    expect(within(menu).getByText('Mona')).toBeTruthy();
    expect(within(menu).getByText('m@x.test')).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Profile' }).getAttribute('href')).toBe('/profile');
    expect(within(menu).getByRole('menuitem', { name: 'Change password' }).getAttribute('href')).toBe('/profile');
  });

  it('signs out from the menu', () => {
    show('/');
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(mock.signOut).toHaveBeenCalledTimes(1);
  });

  it('changes language, appearance and density from the menu', () => {
    show('/');
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'العربية' }));
    expect(mock.changeLanguage).toHaveBeenCalledWith('ar');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.getByRole('menuitemradio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Compact' }));
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
  });

  it('closes with Escape and with a press outside', () => {
    show('/');
    const open = () => fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    open();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    open();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
