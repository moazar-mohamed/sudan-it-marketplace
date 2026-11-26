// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, ToastProvider } from '../components/feedback';
import { decideApplication, mapCompanyApplication } from '../data/companyApplications';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { CompanyApplicationsPage } from './CompanyApplicationsPage';

const mock = vi.hoisted(() => ({ applications: [] as unknown[] }));

vi.mock('../data/hooks', () => ({
  useCompanyApplications: () => ({ status: 'ready', error: null, retry: () => undefined, data: mock.applications as never[] }),
}));
vi.mock('../data/companyApplications', async (original) => ({
  ...(await original<typeof import('../data/companyApplications')>()),
  decideApplication: vi.fn(),
}));

const make = (id: string, extra: Record<string, unknown> = {}) =>
  mapCompanyApplication(id, {
    applicantEmail: `${id}@x.test`,
    companyName: `Company ${id}`,
    contactName: `Contact ${id}`,
    phone: '+249912345678',
    cityId: 'khartoum',
    registrationNumber: `CR-${id}`,
    about: `About ${id}`,
    status: 'pending',
    decisionNote: '',
    createdAt: Timestamp.fromDate(new Date(2026, 10, 20)),
    ...extra,
  });

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

function renderPage() {
  localStorage.setItem('platform_admin_locale', 'en');
  return render(
    <I18nProvider>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter initialEntries={['/applications']}>
            <Routes>
              <Route path="/applications" element={<CompanyApplicationsPage />} />
              <Route path="*" element={<Where />} />
            </Routes>
          </MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.mocked(decideApplication).mockReset();
  vi.mocked(decideApplication).mockResolvedValue(undefined);
  mock.applications = [make('a1'), make('a2', { status: 'approved' }), make('a3', { status: 'rejected', decisionNote: 'Wrong number' })];
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('CompanyApplicationsPage', () => {
  it('shows the waiting requests first', () => {
    renderPage();
    expect(screen.getByText('Company a1')).toBeTruthy();
    expect(screen.queryByText('Company a2')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['common.all']) }));
    expect(screen.getByText('Company a2')).toBeTruthy();
    expect(screen.getByText('Company a3')).toBeTruthy();
  });

  it("approving opens the sender's customer page with the convert form", () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: en['applications.open'] }));
    fireEvent.click(screen.getByRole('button', { name: en['applications.approve'] }));
    expect(screen.getByTestId('where').textContent).toBe('/customers/a1?apply=1');
  });

  it('rejecting asks for a reason and records it', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: en['applications.open'] }));
    fireEvent.click(screen.getByRole('button', { name: en['applications.reject'] }));
    const dialog = screen.getByRole('dialog', { name: en['applications.rejectTitle'] });
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'The number is not registered.' } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: en['applications.reject'] }));
    });
    expect(decideApplication).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), 'rejected', 'The number is not registered.');
  });

  it('a decided request has no approve or reject buttons, and shows the reason of a rejection', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['applications.status.rejected']) }));
    fireEvent.click(screen.getByRole('button', { name: en['applications.open'] }));
    expect(screen.getByText('Wrong number')).toBeTruthy();
    expect(screen.queryByRole('button', { name: en['applications.approve'] })).toBeNull();
    expect(screen.getByRole('button', { name: en['applications.openAccount'] })).toBeTruthy();
  });
});
