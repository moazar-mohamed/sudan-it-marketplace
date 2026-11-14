// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestPasswordReset } from '../auth/passwordReset';
import { ToastProvider } from '../components/feedback';
import { I18nProvider } from '../i18n/I18nProvider';
import { ar, en } from '../i18n/dictionary';
import { LoginPage } from './LoginPage';
import { PasswordResetCard, RESEND_COOLDOWN_SECONDS } from './PasswordResetCard';

vi.mock('../auth/passwordReset', () => ({ requestPasswordReset: vi.fn() }));
const signIn = vi.hoisted(() => vi.fn());
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ signIn, state: { status: 'signedOut', notice: null } }),
}));

const send = vi.mocked(requestPasswordReset);
const authError = (code: string) => Object.assign(new Error(code), { code });

const renderCard = (initialEmail = '', onBack = vi.fn()) =>
  render(
    <I18nProvider>
      <PasswordResetCard initialEmail={initialEmail} onBack={onBack} />
    </I18nProvider>,
  );

const emailInput = () => screen.getByLabelText(en['login.email']) as HTMLInputElement;
const submit = async (address: string) => {
  fireEvent.change(emailInput(), { target: { value: address } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: en['login.reset.send'] }));
  });
};

beforeEach(() => {
  localStorage.clear();
  send.mockReset().mockResolvedValue(undefined);
  signIn.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('Password reset card', () => {
  it('is pre-filled with the address typed on the sign-in form', () => {
    renderCard('me@example.test');
    expect(emailInput().value).toBe('me@example.test');
  });

  it('refuses a malformed address without contacting Firebase', async () => {
    renderCard();
    await submit('not-an-email');
    expect(screen.getByRole('alert').textContent).toBe(en['login.reset.error.invalid']);
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the trimmed address in the page language and shows the result', async () => {
    renderCard();
    await submit('  user@example.test ');

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('user@example.test', 'en');
    expect(screen.getByRole('heading', { name: en['login.reset.sentTitle'] })).toBeTruthy();
    expect(screen.getByText(/If an account exists for user@example\.test/)).toBeTruthy();
    expect(screen.queryByLabelText(en['login.email'])).toBeNull(); // the form is replaced
  });

  it('an address with no account looks exactly like a success', async () => {
    send.mockRejectedValue(authError('auth/user-not-found'));
    renderCard();
    await submit('nobody@example.test');

    expect(screen.getByRole('heading', { name: en['login.reset.sentTitle'] })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['auth/too-many-requests', en['login.error.tooMany']],
    ['auth/network-request-failed', en['login.error.network']],
    ['auth/invalid-email', en['login.reset.error.invalid']],
    ['auth/something-unexpected', en['login.reset.error.generic']],
  ])('a %s failure shows its message and keeps the form', async (code, message) => {
    send.mockRejectedValue(authError(code));
    renderCard();
    await submit('user@example.test');

    expect(screen.getByRole('alert').textContent).toBe(message);
    expect(emailInput().value).toBe('user@example.test'); // not lost
    expect(screen.queryByRole('heading', { name: en['login.reset.sentTitle'] })).toBeNull();
  });

  it('a second submit while sending does not send twice', async () => {
    let finish!: () => void;
    send.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    renderCard();
    fireEvent.change(emailInput(), { target: { value: 'user@example.test' } });
    await act(async () => {
      fireEvent.submit(emailInput().closest('form')!);
      fireEvent.submit(emailInput().closest('form')!);
    });
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(screen.getByRole('heading', { name: en['login.reset.sentTitle'] })).toBeTruthy();
  });

  it('Resend is locked for a cooldown, then sends to the same address', async () => {
    vi.useFakeTimers();
    renderCard();
    await submit('user@example.test');

    const locked = screen.getByRole('button', { name: `Resend in ${RESEND_COOLDOWN_SECONDS}s` });
    expect((locked as HTMLButtonElement).disabled).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByRole('button', { name: 'Resend in 30s' })).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    const resend = screen.getByRole('button', { name: en['login.reset.resend'] });
    expect((resend as HTMLButtonElement).disabled).toBe(false);
    await act(async () => {
      fireEvent.click(resend);
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith('user@example.test', 'en');
  });

  it('"Back to sign in" calls onBack', async () => {
    const onBack = vi.fn();
    renderCard('', onBack);
    fireEvent.click(screen.getByRole('button', { name: en['login.reset.back'] }));
    expect(onBack).toHaveBeenCalled();
  });

  it('works in Arabic: Arabic text, right-to-left page, "ar" e-mail language', async () => {
    localStorage.setItem('platform_admin_locale', 'ar');
    renderCard();
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByText(ar['login.reset.body'])).toBeTruthy();

    fireEvent.change(screen.getByLabelText(ar['login.email']), {
      target: { value: 'user@example.test' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: ar['login.reset.send'] }));
    });

    expect(send).toHaveBeenCalledWith('user@example.test', 'ar');
    expect(screen.getByRole('heading', { name: ar['login.reset.sentTitle'] })).toBeTruthy();
    // the address stays isolated left-to-right inside the Arabic sentence
    expect(ar['login.reset.sentBody']).toContain('‎{email}‎');
  });
});

describe('Login page link', () => {
  const renderLogin = () =>
    render(
      <I18nProvider>
        <ToastProvider>
          <LoginPage notice={null} />
        </ToastProvider>
      </I18nProvider>,
    );

  it('opens the reset form with the typed address, and going back keeps it', () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText(en['login.email']), {
      target: { value: 'me@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: en['login.forgot'] }));

    expect(screen.getByRole('heading', { name: en['login.reset.title'] })).toBeTruthy();
    expect(emailInput().value).toBe('me@example.test');
    expect(screen.queryByLabelText(en['login.password'])).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: en['login.reset.back'] }));
    expect(screen.getByRole('heading', { name: en['login.title'] })).toBeTruthy();
    expect((screen.getByLabelText(en['login.email']) as HTMLInputElement).value).toBe(
      'me@example.test',
    );
  });

  it('signing in still works next to the new link', async () => {
    signIn.mockResolvedValue(undefined);
    renderLogin();
    fireEvent.change(screen.getByLabelText(en['login.email']), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText(en['login.password']), { target: { value: 'secret1' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['login.submit'] }));
    });
    expect(signIn).toHaveBeenCalledWith('a@b.co', 'secret1');
  });
});
