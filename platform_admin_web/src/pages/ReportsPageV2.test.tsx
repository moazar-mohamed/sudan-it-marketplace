// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, ToastProvider } from '../components/feedback';
import { setReportStatus } from '../data/actions';
import { mapReport } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { setUi } from '../theme/ui';
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
  act(() => setUi('v2'));
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
  act(() => setUi('v1'));
});

describe('handling one in the redesign: the report opens beside the list', () => {
  beforeEach(() => show());
  const open = (subject: string) => fireEvent.click(within(rowFor(subject)).getByRole('button', { name: en['reports.open'] }));
  const panel = () => within(screen.getByRole('complementary'));
  const save = () =>
    act(async () => {
      fireEvent.click(panel().getByRole('button', { name: en['common.save'] }));
    });

  it('opens a panel, not a dialog, with everything the sender wrote, the order and a way to the company', () => {
    open('Subject a');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('complementary').textContent).toContain('Details of a');
    expect(screen.getByRole('complementary').textContent).toContain('AB12CD');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('complementary')).toBeNull();
    open('Subject b');
    expect(panel().getByRole('link', { name: en['reports.openCompany'] }).getAttribute('href')).toBe('/companies/c1');
  });

  it('has nothing to save until something changes', () => {
    open('Subject a');
    expect((panel().getByRole('button', { name: en['common.save'] }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('moves the report along, writes the reply the sender will read, and closes the panel', async () => {
    open('Subject a');
    fireEvent.click(panel().getByRole('button', { name: en['reports.status.closed'] }));
    fireEvent.change(panel().getByLabelText(en['reports.resolution']), { target: { value: ' Sorted. ' } });
    await save();
    expect(setReportStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', subject: 'Subject a' }), 'closed', ' Sorted. ');
    expect(await screen.findByText(en['reports.saved'])).toBeTruthy();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('can reopen a closed report', async () => {
    open('Subject c');
    fireEvent.click(panel().getByRole('button', { name: en['reports.status.new'] }));
    await save();
    expect(setReportStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 'c', status: 'closed' }), 'new', 'Refunded.');
  });

  it('keeps the panel open and says so when the rules refuse', async () => {
    vi.mocked(setReportStatus).mockRejectedValue(Object.assign(new Error('x'), { code: 'permission-denied' }));
    open('Subject a');
    fireEvent.click(panel().getByRole('button', { name: en['reports.status.in_progress'] }));
    await save();
    expect(await screen.findByText(en['error.actionPermission'])).toBeTruthy();
    expect(screen.getByRole('complementary')).toBeTruthy();
  });

  it('Cancel closes the panel without saving', () => {
    open('Subject a');
    fireEvent.click(panel().getByRole('button', { name: en['common.cancel'] }));
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(setReportStatus).not.toHaveBeenCalled();
  });
});
