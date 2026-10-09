// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardSnapshot } from '../data/dashboardData';
import { makeSnapshot, ok } from '../data/dashboardTestkit';
import { mapCompany, mapOrder, mapReview, mapServiceRequest } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { ToastProvider } from './feedback';
import { Layout } from './Layout';

const mock = vi.hoisted(() => ({ snapshot: null as unknown, newReports: [] as unknown[] }));

vi.mock('../data/useDashboard', () => ({
  useDashboard: () => ({ snapshot: mock.snapshot, refreshing: false, refresh: () => undefined }),
}));
vi.mock('../data/DashboardProvider', () => ({ DashboardProvider: ({ children }: { children: unknown }) => children }));
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ state: { status: 'authorized', profile: { uid: 'a', fullName: 'Mona', email: 'm@x.test' } }, signOut: () => undefined }),
}));
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../data/hooks', () => ({
  useNewReports: () => ({ status: 'ready', error: null, retry: () => undefined, data: mock.newReports }),
}));
vi.mock('../i18n/useChangeLanguage', () => ({ useChangeLanguage: () => () => undefined }));

const show = (snapshot: DashboardSnapshot | null) => {
  mock.snapshot = snapshot;
  render(
    <I18nProvider>
      <ToastProvider>
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      </ToastProvider>
    </I18nProvider>,
  );
};

// The side menu, not the phone's bottom bar (which repeats a few of the same links).
const sidebar = () => document.querySelector('.sidebar') as HTMLElement;

const badgeOf = (label: string) => {
  const link = within(sidebar()).getByText(label, { selector: 'span' }).closest('a')!;
  return link.querySelector('.nav-badge')?.textContent ?? null;
};

const hours = (h: number) => new Date(Date.now() - h * 3_600_000);

beforeEach(() => {
  localStorage.clear();
  mock.newReports = [];
});
afterEach(cleanup);

describe('sidebar badges', () => {
  it('show how many records each section has that need attention', () => {
    show(
      makeSnapshot({
        openOrders: ok([
          mapOrder('a', { orderStatus: 'processing', paymentStatus: 'pending_verification', createdAt: hours(30) }),
          mapOrder('b', { orderStatus: 'processing', paymentStatus: 'confirmed', createdAt: hours(24 * 6) }),
        ]),
        pendingRequests: ok([mapServiceRequest('r', { status: 'pending', createdAt: hours(60) })]),
        lowReviews: ok([mapReview('v', { stars: 1, createdAt: hours(24) })]),
        emptyCompanies: ok([mapCompany('c', { createdAt: hours(24 * 10) })]),
      }),
    );
    expect(badgeOf('Orders')).toBe('2');
    expect(badgeOf('Service Requests')).toBe('1');
    expect(badgeOf('Reviews')).toBe('1');
    expect(badgeOf('Companies')).toBe('1');
    expect(badgeOf('Customers')).toBeNull();
  });

  it('count the new reports on their own, even before the figures are read', () => {
    mock.newReports = [{ id: 'r1' }, { id: 'r2' }];
    show(null);
    expect(badgeOf('Reports')).toBe('2');
  });

  it('show nothing when there is nothing to do, or before the figures are read', () => {
    show(makeSnapshot());
    expect(document.querySelectorAll('.nav-badge')).toHaveLength(0);
    cleanup();
    show(null);
    expect(document.querySelectorAll('.nav-badge')).toHaveLength(0);
  });

  it('cap a big number at 99+', () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      mapOrder(`o${i}`, { orderStatus: 'processing', paymentStatus: 'pending_verification', createdAt: hours(30) }),
    );
    show(makeSnapshot({ openOrders: ok(many) }));
    expect(badgeOf('Orders')).toBe('99+');
  });
});

describe('the grouped menu', () => {
  it('groups the sections by what an admin is doing, in this order', () => {
    show(null);
    const groups = [...sidebar().querySelectorAll('.nav-group')].map((g) => ({
      title: g.getAttribute('aria-label'),
      links: [...g.querySelectorAll('a')].map((a) => a.textContent?.replace(/\d+\+?$/, '')),
    }));
    expect(groups).toEqual([
      { title: 'Operations', links: ['Dashboard', 'Orders', 'Service Requests', 'Reports'] },
      { title: 'Catalogue', links: ['Companies', 'Products', 'Services', 'Categories', 'Offers'] },
      { title: 'Community', links: ['Customers', 'Reviews'] },
      { title: 'System', links: ['Cities', 'Analytics', 'Activity log', 'Admins', 'Trash', 'Profile', 'Settings'] },
    ]);
  });

  it('keeps every section reachable exactly once in the side menu', () => {
    show(null);
    const hrefs = [...sidebar().querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toHaveLength(18);
  });
});

describe('the collapsible side menu', () => {
  const toggle = () => within(sidebar()).getByRole('button', { name: /menu/i });

  it('starts wide and shrinks to icons when collapsed, then widens again', () => {
    show(null);
    const app = document.querySelector('.app')!;
    expect(app.classList.contains('app--collapsed')).toBe(false);
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle());
    expect(app.classList.contains('app--collapsed')).toBe(true);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle());
    expect(app.classList.contains('app--collapsed')).toBe(false);
  });

  it('remembers the choice in this browser', () => {
    show(null);
    fireEvent.click(toggle());
    expect(localStorage.getItem('platform_admin_sidebar_collapsed')).toBe('1');
    cleanup();
    show(null);
    expect(document.querySelector('.app')!.classList.contains('app--collapsed')).toBe(true);
  });

  it('names each icon with a tooltip while the words are hidden', () => {
    show(null);
    const link = () => within(sidebar()).getByText('Orders', { selector: 'span' }).closest('a')!;
    expect(link().getAttribute('title')).toBeNull();
    fireEvent.click(toggle());
    expect(link().getAttribute('title')).toBe('Orders');
  });
});

describe('the phone bottom bar', () => {
  const bar = () => document.querySelector('.tabbar') as HTMLElement;

  it('keeps the four busiest sections and More one tap away, and no hamburger button', () => {
    show(null);
    const labels = [...bar().querySelectorAll('.tabbar__label')].map((l) => l.textContent);
    expect(labels).toEqual(['Dashboard', 'Orders', 'Service Requests', 'Companies', 'More']);
    expect(document.querySelector('.topbar__menu')).toBeNull();
  });

  it('shows the same attention badges as the side menu', () => {
    show(makeSnapshot({ openOrders: ok([mapOrder('a', { orderStatus: 'processing', paymentStatus: 'pending_verification', createdAt: hours(30) })]) }));
    const ordersTab = within(bar()).getByText('Orders').closest('a')!;
    expect(ordersTab.querySelector('.nav-badge')?.textContent).toBe('1');
  });

  it('opens the full menu from More and closes it again', () => {
    show(null);
    const more = within(bar()).getByRole('button', { name: 'More' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(sidebar().classList.contains('sidebar--open')).toBe(false);
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(sidebar().classList.contains('sidebar--open')).toBe(true);
    fireEvent.click(more);
    expect(sidebar().classList.contains('sidebar--open')).toBe(false);
  });

  it('closes the menu after a section is chosen, on Escape, and on a tap outside', () => {
    show(null);
    const open = () => fireEvent.click(within(bar()).getByRole('button', { name: 'More' }));
    open();
    fireEvent.click(within(sidebar()).getByText('Reviews', { selector: 'span' }));
    expect(sidebar().classList.contains('sidebar--open')).toBe(false);
    open();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(sidebar().classList.contains('sidebar--open')).toBe(false);
    open();
    fireEvent.click(document.querySelector('.scrim')!);
    expect(sidebar().classList.contains('sidebar--open')).toBe(false);
  });

  it('marks More as the current place when the page is not one of the four', () => {
    mock.snapshot = null;
    render(
      <I18nProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={['/reviews']}>
            <Layout />
          </MemoryRouter>
        </ToastProvider>
      </I18nProvider>,
    );
    expect(within(bar()).getByRole('button', { name: 'More' }).className).toContain('tabbar__item--active');
  });
});

describe('the search shortcut', () => {
  const open = () => screen.queryByRole('dialog', { name: 'Search the panel' });

  it('opens with Ctrl+K from anywhere and closes with it again', () => {
    show(null);
    expect(open()).toBeNull();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(open()).not.toBeNull();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(open()).toBeNull();
  });

  it('opens with Cmd+K on a Mac', () => {
    show(null);
    fireEvent.keyDown(window, { key: 'K', metaKey: true });
    expect(open()).not.toBeNull();
  });

  it('opens with / only when nobody is typing in a field', () => {
    show(null);
    const field = document.createElement('input');
    document.body.appendChild(field);
    fireEvent.keyDown(field, { key: '/' });
    expect(open()).toBeNull();
    field.remove();
    fireEvent.keyDown(document.body, { key: '/' });
    expect(open()).not.toBeNull();
  });

  it('opens from the button in the top bar, and Escape closes it', () => {
    show(null);
    fireEvent.click(screen.getByRole('button', { name: 'Search the panel' }));
    expect(open()).not.toBeNull();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(open()).toBeNull();
  });
});
