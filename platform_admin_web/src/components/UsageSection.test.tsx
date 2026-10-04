// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsageFigures } from '../data/usageQueries';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { UsageSection } from './UsageSection';

const mock = vi.hoisted(() => ({ fetchUsage: vi.fn() }));

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../data/usageQueries', () => ({ fetchUsage: mock.fetchUsage }));

const days = ['2026-10-03', '2026-10-04'];
const figures = (over: Partial<UsageFigures> = {}): UsageFigures => ({
  days,
  active: { ok: true, value: [4, 9] },
  newCustomers: { ok: true, value: [1, 2] },
  mostViewed: { ok: true, value: [{ id: 'p1', views: 40, name: 'Router', companyName: 'Nile Co' }, { id: 'x', views: 3, name: '', companyName: '' }] },
  ...over,
});

const show = () =>
  render(
    <MemoryRouter>
      <I18nProvider>
        <UsageSection />
      </I18nProvider>
    </MemoryRouter>,
  );
const head = () => screen.getByRole('button', { name: new RegExp(en['usage.title']) });

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  mock.fetchUsage.mockReset().mockResolvedValue(figures());
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the usage section', () => {
  it('reads nothing until it is opened', () => {
    show();
    expect(mock.fetchUsage).not.toHaveBeenCalled();
  });

  it('opens to the two daily charts and the products opened most', async () => {
    show();
    await act(async () => {
      fireEvent.click(head());
    });
    expect(mock.fetchUsage).toHaveBeenCalledTimes(1);
    expect(screen.getByText(en['usage.active'])).toBeTruthy();
    expect(screen.getByText(en['usage.newCustomers'])).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Router' }).getAttribute('href')).toBe('/products/p1');
    expect(screen.getByText('40')).toBeTruthy();
    expect(screen.getByText(en['usage.removed'])).toBeTruthy();
    expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(2);
  });

  it('a piece that could not be read says so, and the others still show', async () => {
    mock.fetchUsage.mockResolvedValue(figures({ active: { ok: false, error: new Error('x') } }));
    show();
    await act(async () => {
      fireEvent.click(head());
    });
    expect(screen.getAllByText(en['usage.failed'])).toHaveLength(1);
    expect(screen.getByText(en['usage.newCustomers'])).toBeTruthy();
  });

  it('says when no product has been opened yet', async () => {
    mock.fetchUsage.mockResolvedValue(figures({ mostViewed: { ok: true, value: [] } }));
    show();
    await act(async () => {
      fireEvent.click(head());
    });
    expect(screen.getByText(en['usage.noViews'])).toBeTruthy();
  });

  it('reads again on Refresh', async () => {
    show();
    await act(async () => {
      fireEvent.click(head());
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['dashboard.refresh'] }));
    });
    expect(mock.fetchUsage).toHaveBeenCalledTimes(2);
  });
});
