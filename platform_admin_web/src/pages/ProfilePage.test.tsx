// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changeOwnPassword } from '../auth/changePassword';
import { requestPasswordReset } from '../auth/passwordReset';
import { ToastProvider } from '../components/feedback';
import { mapPlatformAdmin } from '../data/mappers';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { ProfilePage } from './ProfilePage';

const mock = vi.hoisted(() => ({ admins: [] as unknown[] }));

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    state: { status: 'authorized', profile: { uid: 'me', fullName: 'Mona Ali', email: 'mona@x.test', role: 'platform_admin' } },
  }),
}));
vi.mock('../firebase', () => ({
  auth: { currentUser: { metadata: { creationTime: '2026-01-05T10:00:00Z', lastSignInTime: '2026-10-03T08:00:00Z' } } },
}));
vi.mock('../data/hooks', () => ({
  useAdmins: () => ({ status: 'ready', error: null, retry: () => undefined, data: mock.admins as never[] }),
}));
vi.mock('../auth/changePassword', async (original) => ({
  ...(await original<typeof import('../auth/changePassword')>()),
  changeOwnPassword: vi.fn(),
}));
vi.mock('../auth/passwordReset', () => ({ requestPasswordReset: vi.fn() }));

const show = () =>
  render(
    <MemoryRouter>
      <I18nProvider>
        <ToastProvider>
          <ProfilePage />
        </ToastProvider>
      </I18nProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  mock.admins = [
    mapPlatformAdmin('me', { isActive: true }),
    mapPlatformAdmin('a2', { isActive: true }),
    mapPlatformAdmin('a3', { isActive: false }),
  ];
  vi.mocked(changeOwnPassword).mockReset().mockResolvedValue(undefined);
  vi.mocked(requestPasswordReset).mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const openSecurity = () => fireEvent.click(screen.getByRole('button', { name: new RegExp(en['profile.security']) }));
const fillPasswords = (current: string, next: string, confirm: string) => {
  fireEvent.change(screen.getByLabelText(en['profile.password.current']), { target: { value: current } });
  fireEvent.change(screen.getByLabelText(en['profile.password.new']), { target: { value: next } });
  fireEvent.change(screen.getByLabelText(en['profile.password.confirm']), { target: { value: confirm } });
};
const submit = () =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name: en['profile.password.save'] }));
  });

describe('who you are', () => {
  it('shows your name, role, email and when you joined and last signed in', () => {
    show();
    expect(screen.getByRole('heading', { name: 'Mona Ali' })).toBeTruthy();
    expect(screen.getByText(en['profile.roleValue'])).toBeTruthy();
    expect(screen.getByText('mona@x.test')).toBeTruthy();
    expect(screen.getByText(en['profile.memberSince'])).toBeTruthy();
    expect(screen.getByText(en['profile.lastSignIn'])).toBeTruthy();
  });

  it('links to the admins page with the number of active admins', () => {
    show();
    const link = screen.getByRole('link', { name: new RegExp(en['profile.admins.manage']) });
    expect(link.getAttribute('href')).toBe('/admins');
    expect(link.textContent).toContain('2 active');
  });
});

describe('changing the password', () => {
  it('is closed until the Security card is opened', () => {
    show();
    const head = screen.getByRole('button', { name: new RegExp(en['profile.security']) });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByLabelText(en['profile.password.current']).closest('[hidden]')).not.toBeNull();
    openSecurity();
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByLabelText(en['profile.password.current']).closest('[hidden]')).toBeNull();
  });

  it('names the problem and sends nothing when the fields are wrong', async () => {
    show();
    openSecurity();
    fillPasswords('old', 'abc', 'abc');
    await submit();
    expect(screen.getByText(en['profile.password.errShort'])).toBeTruthy();
    fillPasswords('old', 'newpass1', 'newpass2');
    await submit();
    expect(screen.getByText(en['profile.password.errMismatch'])).toBeTruthy();
    expect(changeOwnPassword).not.toHaveBeenCalled();
  });

  it('changes it, says so and clears the fields', async () => {
    show();
    openSecurity();
    fillPasswords('oldpass', 'newpass1', 'newpass1');
    await submit();
    expect(changeOwnPassword).toHaveBeenCalledWith('oldpass', 'newpass1');
    expect(await screen.findByText(en['profile.password.changed'])).toBeTruthy();
    expect((screen.getByLabelText(en['profile.password.current']) as HTMLInputElement).value).toBe('');
  });

  it('says the current password is wrong', async () => {
    vi.mocked(changeOwnPassword).mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/invalid-credential' }));
    show();
    openSecurity();
    fillPasswords('bad', 'newpass1', 'newpass1');
    await submit();
    expect(await screen.findByText(en['profile.password.errCurrent'])).toBeTruthy();
  });

  it('emails a reset link to your own address', async () => {
    show();
    openSecurity();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['profile.password.sendLink'] }));
    });
    expect(requestPasswordReset).toHaveBeenCalledWith('mona@x.test', 'en');
    expect(await screen.findByText(en['profile.password.linkSent'].replace('{email}', 'mona@x.test'))).toBeTruthy();
  });
});
