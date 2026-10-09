// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchResults } from '../data/globalSearch';
import { mapCompany, mapCustomer, mapOrder, mapProduct } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { CommandPalette, SEARCH_DELAY_MS } from './CommandPalette';

const search = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('../data/globalSearch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/globalSearch')>()),
  searchRecords: search.run,
}));
vi.mock('../firebase', () => ({ db: {} }));

const none = (): SearchResults => ({
  company: { ok: true, value: [] },
  customer: { ok: true, value: [] },
  order: { ok: true, value: [] },
  product: { ok: true, value: [] },
});

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

const show = (onClose = vi.fn()) => {
  render(
    <I18nProvider>
      <MemoryRouter>
        <CommandPalette open onClose={onClose} />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
  return onClose;
};

const input = () => screen.getByRole('combobox') as HTMLInputElement;
const type = (value: string) => fireEvent.change(input(), { target: { value } });
const wait = async (ms = SEARCH_DELAY_MS) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const options = () => screen.queryAllByRole('option').map((o) => o.textContent);

beforeEach(() => {
  vi.useFakeTimers();
  search.run.mockReset();
  search.run.mockResolvedValue(none());
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the search window', () => {
  it('shows nothing when closed', () => {
    render(
      <I18nProvider>
        <MemoryRouter>
          <CommandPalette open={false} onClose={() => undefined} />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens with the cursor in the box and every page listed', () => {
    show();
    expect(screen.getByRole('dialog', { name: en['search.title'] })).toBeTruthy();
    expect(document.activeElement).toBe(input());
    expect(options()).toHaveLength(18);
    expect(options()[0]).toBe('Dashboard');
  });

  it('narrows the pages as you type, without reading anything yet', async () => {
    show();
    type('ord');
    expect(options()).toEqual(['Orders']);
    type('c');
    expect(search.run).not.toHaveBeenCalled();
    await wait(50);
    expect(search.run).not.toHaveBeenCalled();
  });

  it('finds a page in Arabic too', () => {
    localStorage.setItem('platform_admin_locale', 'ar');
    show();
    type('التحليلات');
    expect(options()).toEqual(['التحليلات']);
  });
});

describe('searching the records', () => {
  it('waits for a pause in typing, then searches once for the whole word', async () => {
    show();
    type('ni');
    await wait(100);
    type('nile');
    await wait(100);
    expect(search.run).not.toHaveBeenCalled();
    await wait(SEARCH_DELAY_MS);
    expect(search.run).toHaveBeenCalledTimes(1);
    expect(search.run.mock.calls[0][1]).toBe('nile');
  });

  it('does not search for a single character', async () => {
    show();
    type('n');
    await wait(SEARCH_DELAY_MS * 2);
    expect(search.run).not.toHaveBeenCalled();
    expect(screen.getByText(en['search.keepTyping'])).toBeTruthy();
  });

  it('lists what is found under its kind, after the pages', async () => {
    search.run.mockResolvedValue({
      ...none(),
      company: { ok: true, value: [{ kind: 'company', item: mapCompany('c1', { name: 'Nile Co', city: 'Khartoum', status: 'active' }) }] },
      customer: { ok: true, value: [{ kind: 'customer', item: mapCustomer('u1', { role: 'customer', fullName: 'Nile Buyer', email: 'n@x.test' }) }] },
      order: { ok: true, value: [{ kind: 'order', item: mapOrder('abcd1234zz', { customerId: 'u1', customerName: 'Nile Buyer', companyName: 'Nile Co', totalAmount: 500 }) }] },
      product: { ok: true, value: [{ kind: 'product', item: mapProduct('p1', { name: 'Nile Router', companyName: 'Nile Co' }) }] },
    });
    show();
    type('nile');
    await wait();
    const groups = screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'));
    expect(groups).toEqual(['Companies', 'Customers', 'Orders', 'Products']);
    const rows = options();
    expect(rows[0]).toContain('Nile Co');
    expect(rows[0]).toContain('Khartoum · Active');
    expect(rows[1]).toContain('Nile Buyer');
    expect(rows[1]).toContain('n@x.test');
    expect(rows[2]).toContain('#abcd1234 · Nile Buyer');
    expect(rows[2]).toContain('500');
    expect(rows[3]).toContain('Nile Router');
  });

  it('says it is searching, then that nothing was found', async () => {
    let release: (value: SearchResults) => void = () => undefined;
    search.run.mockImplementation(() => new Promise((resolve) => (release = resolve)));
    show();
    type('zzz');
    await wait();
    expect(screen.getByText(en['search.searching'])).toBeTruthy();
    await act(async () => release(none()));
    expect(screen.getByText(en['search.none'])).toBeTruthy();
    expect(screen.queryByText(en['search.searching'])).toBeNull();
  });

  it('says a kind could not be searched, and still shows the others', async () => {
    search.run.mockResolvedValue({
      ...none(),
      customer: { ok: false },
      company: { ok: true, value: [{ kind: 'company', item: mapCompany('c1', { name: 'Nile Co' }) }] },
    });
    show();
    type('nile');
    await wait();
    expect(screen.getByText('Customers could not be searched right now.')).toBeTruthy();
    expect(options()[0]).toContain('Nile Co');
  });

  it('never shows an older answer for a newer word', async () => {
    let first: (value: SearchResults) => void = () => undefined;
    search.run.mockImplementationOnce(() => new Promise((resolve) => (first = resolve)));
    show();
    type('nile');
    await wait();
    type('blue');
    await wait();
    await act(async () =>
      first({ ...none(), company: { ok: true, value: [{ kind: 'company', item: mapCompany('c1', { name: 'Nile Co' }) }] } }),
    );
    expect(screen.queryByText('Nile Co')).toBeNull();
  });
});

describe('moving and opening', () => {
  const found = async () => {
    search.run.mockResolvedValue({
      ...none(),
      company: { ok: true, value: [{ kind: 'company', item: mapCompany('c1', { name: 'Nile Co' }) }] },
      product: { ok: true, value: [{ kind: 'product', item: mapProduct('p1', { name: 'Nile Router' }) }] },
    });
    const onClose = show();
    type('nile');
    await wait();
    return onClose;
  };

  it('moves with the arrow keys, wrapping round, and Enter opens the chosen result', async () => {
    const onClose = await found();
    expect(options()).toHaveLength(2);
    const selected = () => screen.getAllByRole('option').findIndex((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected()).toBe(0);
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(selected()).toBe(1);
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(selected()).toBe(0);
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    expect(selected()).toBe(1);
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/products/p1');
  });

  it('tells assistive technology which result is chosen', async () => {
    await found();
    const active = screen.getAllByRole('option')[0];
    expect(input().getAttribute('aria-activedescendant')).toBe(active.id);
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });

  it('opens a result when it is clicked', async () => {
    await found();
    fireEvent.click(within(screen.getByRole('listbox')).getAllByRole('option')[0]);
    expect(screen.getByTestId('where').textContent).toBe('/companies/c1');
  });

  it('opens a page with Enter', () => {
    const onClose = show();
    type('analytics');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/analytics');
  });

  it('closes with Escape and with a click outside', () => {
    const onClose = show();
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(document.querySelector('.modal-backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does nothing on Enter when there is nothing to open', async () => {
    const onClose = show();
    type('qqqqq');
    await wait();
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
