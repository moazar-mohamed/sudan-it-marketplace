// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapServiceRequest } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { ServiceRequestsPage } from './ServiceRequestsPage';

const mock = vi.hoisted(() => ({ requests: [] as unknown[] }));

vi.mock('../data/hooks', () => ({
  useServiceRequests: () => ({ status: 'ready', error: null, retry: () => undefined, data: mock.requests as never[] }),
}));
vi.mock('../data/useNow', () => ({ useNow: () => Date.now() }));
vi.mock('./ServiceRequestDetailsPage', () => ({ ServiceRequestDetails: ({ id }: { id: string }) => <p>details of request {id}</p> }));

const Where = () => <p data-testid="where">{useLocation().search}</p>;
const show = (url = '/service-requests') =>
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={[url]}>
        <ServiceRequestsPage />
        <Where />
      </MemoryRouter>
    </I18nProvider>,
  );
const rows = () => document.querySelectorAll('table.data tbody tr');

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  mock.requests = [
    mapServiceRequest('r1', { customerName: 'Amna', companyId: 'c1', companyName: 'Nile Co', serviceName: 'Network repair', status: 'pending', createdAt: new Date() }),
    mapServiceRequest('r2', { customerName: 'Omar', companyId: 'c2', companyName: 'Blue Co', serviceName: 'Camera set-up', status: 'accepted', createdAt: new Date() }),
  ];
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the service request list in the redesign', () => {
  it('opens a row in a panel beside the list, with the full page one click away', () => {
    show();
    fireEvent.click(rows()[1]);
    expect(screen.getByTestId('where').textContent).toBe('?open=r2');
    const panel = screen.getByRole('complementary');
    expect(within(panel).getByText('details of request r2')).toBeTruthy();
    expect(within(panel).getByRole('link', { name: en['common.openDetails'] }).getAttribute('href')).toBe('/service-requests/r2');
    expect(document.querySelectorAll('tr.is-open')).toHaveLength(1);
  });

  it('opens from the address, closes with the button, and a link in the row keeps its own action', () => {
    show('/service-requests?open=r1');
    expect(within(screen.getByRole('complementary')).getByText('details of request r1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en['common.close'] }));
    expect(screen.queryByRole('complementary')).toBeNull();
    fireEvent.click(within(rows()[0] as HTMLElement).getAllByRole('link')[0]);
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('shows the company filter as a pill in the toolbar', () => {
    show();
    expect(within(screen.getByRole('group', { name: en['common.filters'] })).getByRole('combobox', { name: en['col.company'] })).toBeTruthy();
  });
});
