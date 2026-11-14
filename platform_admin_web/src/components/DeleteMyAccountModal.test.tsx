// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteMyAccount } from '../data/actions';
import { OwnAccountError } from '../data/adminAccounts';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { DeleteMyAccountModal } from './DeleteMyAccountModal';
import { ToastProvider } from './feedback';

vi.mock('../data/actions', () => ({ deleteMyAccount: vi.fn() }));

const me = { id: 'me', fullName: 'Mona', email: 'Mona@x.test', isActive: true };

const show = () => {
  const onClose = vi.fn();
  render(
    <I18nProvider>
      <ToastProvider>
        <DeleteMyAccountModal me={me} onClose={onClose} />
      </ToastProvider>
    </I18nProvider>,
  );
  return onClose;
};

const confirmButton = () => screen.getByRole('button', { name: en['admins.deleteMine.confirm'] }) as HTMLButtonElement;
const emailField = () => screen.getByLabelText(en['admins.deleteMine.typeEmail'].replace('{email}', 'Mona@x.test'));
const passwordField = () => screen.getByLabelText(en['admins.deleteMine.password']);

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  vi.mocked(deleteMyAccount).mockReset().mockResolvedValue({ loginRemoved: true });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('deleting your own account', () => {
  it('stays off until the email is typed and the password given', () => {
    show();
    expect(confirmButton().disabled).toBe(true);
    fireEvent.change(emailField(), { target: { value: 'mona@x.test' } });
    expect(confirmButton().disabled).toBe(true);
    fireEvent.change(passwordField(), { target: { value: 'secret12' } });
    expect(confirmButton().disabled).toBe(false);
    fireEvent.change(emailField(), { target: { value: 'someone@else.test' } });
    expect(confirmButton().disabled).toBe(true);
  });

  it('deletes with the password given, then closes', async () => {
    const onClose = show();
    fireEvent.change(emailField(), { target: { value: ' mona@X.test ' } });
    fireEvent.change(passwordField(), { target: { value: 'secret12' } });
    await act(async () => {
      fireEvent.click(confirmButton());
    });
    expect(deleteMyAccount).toHaveBeenCalledWith(me, 'secret12');
    expect(onClose).toHaveBeenCalled();
    expect(await screen.findByText(en['admins.deleteMine.done'])).toBeTruthy();
  });

  it('says so when the login could not be removed', async () => {
    vi.mocked(deleteMyAccount).mockResolvedValueOnce({ loginRemoved: false });
    show();
    fireEvent.change(emailField(), { target: { value: 'mona@x.test' } });
    fireEvent.change(passwordField(), { target: { value: 'secret12' } });
    await act(async () => {
      fireEvent.click(confirmButton());
    });
    expect(await screen.findByText(en['admins.deleteMine.loginKept'])).toBeTruthy();
  });

  it('says the password is wrong and stays open', async () => {
    vi.mocked(deleteMyAccount).mockRejectedValueOnce({ code: 'auth/invalid-credential' });
    const onClose = show();
    fireEvent.change(emailField(), { target: { value: 'mona@x.test' } });
    fireEvent.change(passwordField(), { target: { value: 'nope' } });
    await act(async () => {
      fireEvent.click(confirmButton());
    });
    expect(screen.getByText(en['admins.deleteMine.wrongPassword'])).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('explains that the only active admin cannot delete themselves', async () => {
    vi.mocked(deleteMyAccount).mockRejectedValueOnce(new OwnAccountError('delete-self/last-admin'));
    show();
    fireEvent.change(emailField(), { target: { value: 'mona@x.test' } });
    fireEvent.change(passwordField(), { target: { value: 'secret12' } });
    await act(async () => {
      fireEvent.click(confirmButton());
    });
    expect(screen.getByText(en['admins.deleteMine.lastAdmin'])).toBeTruthy();
  });
});
