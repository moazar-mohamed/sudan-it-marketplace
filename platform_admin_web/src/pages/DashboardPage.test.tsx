// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { DashboardPage } from './DashboardPage';

type Status = 'loading' | 'ready' | 'error';
const hooks = vi.hoisted(() => ({
  customers: { status: 'ready', data: [] as unknown[] } as { status: Status; data: unknown[] },
}));

vi.mock('../data/hooks', () => {
  const ready = () => ({ status: 'ready' as const, error: null, retry: () => undefined, data: [] as never[] });
  return {
    useCompanies: ready,
    useOrders: ready,
    useProducts: ready,
    useCustomers: () => ({ error: null, retry: () => undefined, ...hooks.customers }),
  };
});

const customer = (id: string, isActive = true) => ({ id, fullName: id, email: '', phone: '', isActive, createdAt: null });

const customersTile = () => {
  render(
    <I18nProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </I18nProvider>,
  );
  const tile = screen.getByText(en['kpi.totalCustomers']).closest('a')!;
  return tile.querySelector('.stat__value')!.textContent;
};

afterEach(cleanup);

describe('Dashboard "Total customers"', () => {
  it('shows the number of customer profiles', () => {
    hooks.customers = { status: 'ready', data: [customer('a'), customer('b')] };
    expect(customersTile()).toBe('2');
  });

  it('counts deactivated customers as well', () => {
    hooks.customers = { status: 'ready', data: [customer('a'), customer('b', false), customer('c')] };
    expect(customersTile()).toBe('3');
  });

  it('shows … while loading, never a partial count', () => {
    hooks.customers = { status: 'loading', data: [] };
    expect(customersTile()).toBe('…');
  });

  it('shows – when the customers could not be loaded, never 0', () => {
    hooks.customers = { status: 'error', data: [] };
    expect(customersTile()).toBe('–');
  });
});
