// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, ToastProvider } from '../components/feedback';
import { setReportStatus } from '../data/actions';
import { mapReport } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { ar, en } from '../i18n/dictionary';
import { ReportsPage } from './ReportsPage';

const mock = vi.hoisted(() => ({ reports: [] as unknown[] }));

vi.mock('../data/hooks', () => ({
  useReports: () => ({ status: 'ready', error: null, retry: () => undefined, data: mock.reports as never[] }),
}));
vi.mock('../data/actions', () => ({ setReportStatus: vi.fn() }));

const at = (day: number) => new Date(2026, 9, day, 10, 0);
const make = (id: string, extra: Record<string, unknown> = {}) =>
  mapReport(id, {
    reporterId: 'u1',
    reporterRole: 'customer',
    reporterName: 'Sara',
    reporterEmail: 'sara@x.test',
    reason: 'order_problem',
    subject: `Subject ${id}`,
    details: `Details of ${id}`,
    status: 'new',
    resolution: '',
    createdAt: at(1),
    updatedAt: at(1),
    ...extra,
  });

const show = () =>
  render(
    <MemoryRouter>
      <I18nProvider>
        <ToastProvider>
          <ConfirmProvider>
            <ReportsPage />
          </ConfirmProvider>
        </ToastProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
const bodyRows = () => screen.getAllByRole('row').slice(1);
const rowFor = (text: string) => bodyRows().find((r) => (r.textContent ?? '').includes(text))!;

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  mock.reports = [
    make('a', { createdAt: at(3), orderRef: 'AB12CD' }),
    make('b', { status: 'in_progress', reporterName: 'Nile Co', reporterRole: 'company_admin', companyId: 'c1', reason: 'company_conduct', createdAt: at(2) }),
    make('c', { status: 'closed', resolution: 'Refunded.', reason: 'payment', createdAt: at(1) }),
  ];
  vi.mocked(setReportStatus).mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the reports list', () => {
  it('lists every report with who sent it, why, and where it stands', () => {
    show();
    expect(bodyRows()).toHaveLength(3);
    const first = rowFor('Subject a').textContent ?? '';
    expect(first).toContain('Sara');
    expect(first).toContain(en['reports.role.customer']);
    expect(first).toContain(en['reports.reason.order_problem']);
    expect(first).toContain(en['reports.status.new']);
    expect(rowFor('Subject b').textContent).toContain(en['reports.role.company_admin']);
  });

  it('says so when there are none', () => {
    mock.reports = [];
    show();
    expect(screen.getByText(en['reports.empty'])).toBeTruthy();
  });

  it('narrows by status, with a count on each', () => {
    show();
    const chip = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}`) });
    expect(chip(en['reports.status.new']).textContent).toContain('1');
    fireEvent.click(chip(en['reports.status.closed']));
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0].textContent).toContain('Subject c');
  });

  it('finds a report by its text, its sender or the order named', () => {
    show();
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'nile' } });
    expect(bodyRows()).toHaveLength(1);
    fireEvent.change(search, { target: { value: 'ab12' } });
    expect(bodyRows()[0].textContent).toContain('Subject a');
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText(en['common.noResults'])).toBeTruthy();
  });

  it('an unknown status or reason from a newer app is shown, not hidden', () => {
    mock.reports = [make('x', { status: 'weird', reason: 'brand_new_reason' })];
    show();
    expect(bodyRows()[0].textContent).toContain('brand_new_reason');
    expect(bodyRows()[0].textContent).toContain(en['reports.status.new']);
  });
});

describe('handling one', () => {
  beforeEach(() => show());
  const open = (subject: string) => fireEvent.click(within(rowFor(subject)).getByRole('button', { name: en['reports.open'] }));
  const dialog = () => within(screen.getByRole('dialog'));
  const save = () =>
    act(async () => {
      fireEvent.click(dialog().getByRole('button', { name: en['common.save'] }));
    });

  it('shows everything the sender wrote, the order and a way to the company', () => {
    open('Subject a');
    expect(screen.getByRole('dialog').textContent).toContain('Details of a');
    expect(screen.getByRole('dialog').textContent).toContain('AB12CD');
    fireEvent.keyDown(window, { key: 'Escape' });
    open('Subject b');
    expect(dialog().getByRole('link', { name: en['reports.openCompany'] }).getAttribute('href')).toBe('/companies/c1');
  });

  it('has nothing to save until something changes', () => {
    open('Subject a');
    expect((dialog().getByRole('button', { name: en['common.save'] }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('moves the report along and writes the reply the sender will read', async () => {
    open('Subject a');
    fireEvent.click(dialog().getByRole('button', { name: en['reports.status.closed'] }));
    fireEvent.change(dialog().getByLabelText(en['reports.resolution']), { target: { value: ' Sorted. ' } });
    await save();
    expect(setReportStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', subject: 'Subject a' }), 'closed', ' Sorted. ');
    expect(await screen.findByText(en['reports.saved'])).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('can reopen a closed report', async () => {
    open('Subject c');
    fireEvent.click(dialog().getByRole('button', { name: en['reports.status.new'] }));
    await save();
    expect(setReportStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 'c', status: 'closed' }), 'new', 'Refunded.');
  });

  it('keeps the dialog open and says so when the rules refuse', async () => {
    vi.mocked(setReportStatus).mockRejectedValue(Object.assign(new Error('x'), { code: 'permission-denied' }));
    open('Subject a');
    fireEvent.click(dialog().getByRole('button', { name: en['reports.status.in_progress'] }));
    await save();
    expect(await screen.findByText(en['error.actionPermission'])).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('Arabic', () => {
  it('has every report string in Arabic', () => {
    for (const key of Object.keys(en).filter((k) => k.startsWith('reports.') || k === 'nav.reports')) {
      expect(ar[key as keyof typeof ar], key).toBeTruthy();
    }
  });
});
