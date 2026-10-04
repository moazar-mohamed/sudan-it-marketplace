// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, ToastProvider } from '../components/feedback';
import { createAdmin, setAdminActive } from '../data/actions';
import { mapPlatformAdmin } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { ar, en } from '../i18n/dictionary';
import { AdminsPage } from './AdminsPage';

const mock = vi.hoisted(() => ({ admins: [] as unknown[] }));

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ state: { status: 'authorized', profile: { uid: 'me', fullName: 'Mona', email: 'm@x.test' } } }),
}));
vi.mock('../data/hooks', () => ({
  useAdmins: () => ({ status: 'ready', error: null, retry: () => undefined, data: mock.admins as never[] }),
}));
vi.mock('../data/actions', () => ({ createAdmin: vi.fn(), setAdminActive: vi.fn() }));

const show = () =>
  render(
    <MemoryRouter>
      <I18nProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AdminsPage />
          </ConfirmProvider>
        </ToastProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
const rowFor = (text: string) => screen.getAllByRole('row').find((r) => (r.textContent ?? '').includes(text))!;

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  mock.admins = [
    mapPlatformAdmin('me', { fullName: 'Mona', email: 'm@x.test', isActive: true, createdAt: new Date(2026, 0, 2) }),
    mapPlatformAdmin('a2', { fullName: 'Omar', email: 'o@x.test', isActive: true, createdAt: new Date(2026, 1, 2) }),
    mapPlatformAdmin('a3', { fullName: 'Hana', email: 'h@x.test', isActive: false, createdAt: new Date(2026, 2, 2) }),
  ];
  vi.mocked(createAdmin).mockReset().mockResolvedValue({ uid: 'n1', passwordEmailSent: true });
  vi.mocked(setAdminActive).mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the admins page', () => {
  it('lists the admins with their access, and marks you', () => {
    show();
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(rowFor('Mona').textContent).toContain(en['admins.you']);
    expect(rowFor('Omar').textContent).not.toContain(en['admins.you']);
    expect(rowFor('Hana').textContent).toContain(en['user.inactive']);
  });

  it('an admin whose profile has no active flag is shown as not active', () => {
    expect(mapPlatformAdmin('x', { fullName: 'No flag', email: 'n@x.test' }).isActive).toBe(false);
  });

  it('you cannot deactivate yourself', () => {
    show();
    const button = within(rowFor('Mona')).getByRole('button', { name: en['admins.deactivate'] }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('asks before deactivating another admin, then does it', async () => {
    show();
    fireEvent.click(within(rowFor('Omar')).getByRole('button', { name: en['admins.deactivate'] }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Omar');
    expect(setAdminActive).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: en['admins.deactivate'] }));
    });
    expect(setAdminActive).toHaveBeenCalledWith('a2', false, 'Omar');
  });

  it('reactivates without asking', async () => {
    show();
    await act(async () => {
      fireEvent.click(within(rowFor('Hana')).getByRole('button', { name: en['admins.activate'] }));
    });
    expect(setAdminActive).toHaveBeenCalledWith('a3', true, 'Hana');
  });
});

describe('adding an admin', () => {
  const open = () => fireEvent.click(screen.getByRole('button', { name: `+ ${en['admins.add']}` }));
  const fill = (name: string, email: string) => {
    fireEvent.change(screen.getByLabelText(en['col.name']), { target: { value: name } });
    fireEvent.change(screen.getByLabelText(en['col.email']), { target: { value: email } });
  };
  const submit = () =>
    act(async () => {
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en['admins.add'] }));
    });

  it('needs a name and a valid email before anything is created', async () => {
    show();
    open();
    fill('', 'nope');
    await submit();
    expect(createAdmin).not.toHaveBeenCalled();
    expect(screen.getByText(en['customer.nameRequired'])).toBeTruthy();
    expect(screen.getByText(en['customers.error.invalidEmail'])).toBeTruthy();
  });

  it('creates the admin and says the password email was sent', async () => {
    show();
    open();
    fill('New One', 'New@X.test');
    await submit();
    expect(createAdmin).toHaveBeenCalledWith({ fullName: 'New One', email: 'New@X.test' });
    expect(await screen.findByText(en['admins.created'].replace('{email}', 'new@x.test'))).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says so when the password email could not be sent', async () => {
    vi.mocked(createAdmin).mockResolvedValue({ uid: 'n1', passwordEmailSent: false });
    show();
    open();
    fill('New One', 'new@x.test');
    await submit();
    expect(await screen.findByText(en['admins.created.noEmail'])).toBeTruthy();
  });

  it('keeps the form open and names the problem when the email is already used', async () => {
    vi.mocked(createAdmin).mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/email-already-in-use' }));
    show();
    open();
    fill('New One', 'o@x.test');
    await submit();
    expect(await screen.findByText(en['customers.error.emailInUse'])).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('says the profile was refused when the rules turn it down', async () => {
    vi.mocked(createAdmin).mockRejectedValue(Object.assign(new Error('x'), { code: 'permission-denied' }));
    show();
    open();
    fill('New One', 'n@x.test');
    await submit();
    expect(await screen.findByText(en['admins.error.profile'])).toBeTruthy();
  });
});

describe('Arabic', () => {
  it('has every string in Arabic', () => {
    for (const key of Object.keys(en).filter((k) => k.startsWith('admins.') || k === 'nav.admins')) {
      expect(ar[key as keyof typeof ar], key).toBeTruthy();
    }
  });
});
