// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapAuditEntry } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { ar, en } from '../i18n/dictionary';
import { ActivityPage } from './ActivityPage';

type Status = 'loading' | 'ready' | 'error';
const mock = vi.hoisted(() => ({ log: { status: 'ready', data: [] } as { status: Status; data: unknown[] } }));

vi.mock('../data/hooks', () => ({
  useAuditLog: () => ({ error: null, retry: () => undefined, ...mock.log }),
}));

const day = (n: number) => new Date(Date.UTC(2026, 9, n, 10, 0, 0));
const entry = (id: string, extra: Record<string, unknown>) =>
  mapAuditEntry(id, { actorId: 'pa', actorName: 'Mona', targetName: '', createdAt: day(3), ...extra });

const show = (url = '/activity') =>
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={[url]}>
        <ActivityPage />
      </MemoryRouter>
    </I18nProvider>,
  );

afterEach(() => {
  cleanup();
  mock.log = { status: 'ready', data: [] };
});

const rows = () => Array.from(document.querySelectorAll('tbody tr')) as HTMLElement[];

describe('Activity log page', () => {
  it('explains an empty trail', () => {
    show();
    expect(screen.getByText(en['activity.empty'])).toBeTruthy();
  });

  it('shows who did what to which record, in words', () => {
    mock.log = {
      status: 'ready',
      data: [
        entry('1', { action: 'company.status', targetType: 'company', targetId: 'c1', targetName: 'Nile Co', detail: 'inactive' }),
        entry('2', { action: 'review.hide', targetType: 'review', targetId: 'o1', targetName: 'Sara → Nile Co' }),
        entry('3', { action: 'category.move', targetType: 'category', targetId: 'k1', targetName: 'Laptops', detail: 'Computers' }),
        entry('4', { action: 'category.move', targetType: 'category', targetId: 'k1', targetName: 'Laptops' }),
      ],
    };
    show();
    const [status, hide, move, top] = rows();
    expect(within(status).getByText('Mona')).toBeTruthy();
    expect(within(status).getByText(en['activity.action.company.status'])).toBeTruthy();
    expect(within(status).getByText(en['company.status.inactive'])).toBeTruthy();
    expect(within(hide).getByText(en['activity.action.review.hide'])).toBeTruthy();
    expect(within(move).getByText('to Computers')).toBeTruthy();
    expect(within(top).getByText(en['activity.moveToTop'])).toBeTruthy();
  });

  it('links a company and a customer to their page, but not a deleted company or a review', () => {
    mock.log = {
      status: 'ready',
      data: [
        entry('1', { action: 'company.status', targetType: 'company', targetId: 'c1', targetName: 'Nile Co' }),
        entry('2', { action: 'customer.edit', targetType: 'customer', targetId: 'u9', targetName: 'Omar' }),
        entry('3', { action: 'company.delete', targetType: 'company', targetId: 'c2', targetName: 'Gone Co' }),
        entry('4', { action: 'review.hide', targetType: 'review', targetId: 'o1', targetName: 'Sara' }),
      ],
    };
    show();
    const [company, customer, deleted, review] = rows();
    expect(within(company).getByRole('link').getAttribute('href')).toBe('/companies/c1');
    expect(within(customer).getByRole('link').getAttribute('href')).toBe('/customers/u9');
    expect(within(deleted).queryByRole('link')).toBeNull();
    expect(within(review).queryByRole('link')).toBeNull();
  });

  it('narrows to one record with ?target= and can be cleared', () => {
    mock.log = {
      status: 'ready',
      data: [
        entry('1', { action: 'company.status', targetType: 'company', targetId: 'c1', targetName: 'Nile Co' }),
        entry('2', { action: 'company.status', targetType: 'company', targetId: 'c2', targetName: 'Blue Co' }),
        entry('3', { action: 'company.registration', targetType: 'company', targetId: 'c1', targetName: 'Nile Co' }),
      ],
    };
    show('/activity?target=c1');
    expect(rows()).toHaveLength(2);
    expect(screen.getByText(/Showing the activity on one record/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en['attention.clear'] }));
    expect(rows()).toHaveLength(3);
  });

  it('falls back to the raw code for an action it does not know yet', () => {
    mock.log = { status: 'ready', data: [entry('1', { action: 'future.thing', targetType: 'company', targetId: 'c1' })] };
    show();
    expect(screen.getByText('future.thing')).toBeTruthy();
  });

  it('filters by record type and by search', () => {
    mock.log = {
      status: 'ready',
      data: [
        entry('1', { action: 'company.create', targetType: 'company', targetId: 'c1', targetName: 'Nile Co' }),
        entry('2', { action: 'service.create', targetType: 'service', targetId: 's1', targetName: 'Cabling' }),
        entry('3', { action: 'service.update', targetType: 'service', targetId: 's1', targetName: 'Cabling', actorName: 'Hana' }),
      ],
    };
    show();
    expect(rows()).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['activity.type.service']) }));
    expect(rows()).toHaveLength(2);

    fireEvent.change(screen.getByPlaceholderText(en['activity.search']), { target: { value: 'hana' } });
    expect(rows()).toHaveLength(1);

    fireEvent.change(screen.getByPlaceholderText(en['activity.search']), { target: { value: 'zzz' } });
    expect(screen.getByText(en['common.noResults'])).toBeTruthy();
  });

  it('has a sentence in Arabic for every action the dashboard can record', () => {
    const codes = [
      'company.create', 'company.status', 'company.delete', 'company.registration',
      'customer.create', 'customer.edit', 'customer.active',
      'review.hide', 'review.show',
      'category.create', 'category.update', 'category.active', 'category.move', 'category.delete',
      'service.create', 'service.update', 'service.active',
      'admin.create', 'admin.active',
      'report.status',
    ];
    for (const code of codes) {
      const key = `activity.action.${code}` as keyof typeof en;
      expect(en[key], `en ${code}`).toBeTruthy();
      expect(ar[key], `ar ${code}`).toBeTruthy();
    }
  });
});
