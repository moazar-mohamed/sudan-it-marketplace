import { useEffect, useRef, useState, type FormEvent } from 'react';
import { requestPasswordReset } from '../auth/passwordReset';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/dictionary';

/** How long "Resend" stays unavailable after an e-mail was requested. */
export const RESEND_COOLDOWN_SECONDS = 60;

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function resetErrorKey(code: string | undefined): TranslationKey {
  switch (code) {
    case 'auth/invalid-email':
      return 'login.reset.error.invalid';
    case 'auth/too-many-requests':
      return 'login.error.tooMany';
    case 'auth/network-request-failed':
      return 'login.error.network';
    default:
      return 'login.reset.error.generic';
  }
}

/**
 * "Forgot password" on the login page. The outcome never says whether an
 * account exists for the address: an unknown address gets the same "if an
 * account exists" message as a known one.
 */
export function PasswordResetCard({
  initialEmail,
  onBack,
}: {
  initialEmail: string;
  onBack: () => void;
}) {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState(initialEmail);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Set synchronously, so two quick submits (Enter twice) can never both send.
  const inFlight = useRef(false);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const startCooldown = () => {
    if (timer.current) clearInterval(timer.current);
    setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    timer.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1 && timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
        return Math.max(0, s - 1);
      });
    }, 1000);
  };

  const send = async (address: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    try {
      await requestPasswordReset(address, locale);
      setSentTo(address);
      startCooldown();
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === 'auth/user-not-found') {
        // Same outcome as a success, so the form cannot reveal who is registered.
        setSentTo(address);
        startCooldown();
      } else {
        setError(resetErrorKey(code));
      }
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (sentTo) {
      if (secondsLeft === 0) void send(sentTo);
      return;
    }
    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setError('login.reset.error.invalid');
      return;
    }
    void send(address);
  };

  return (
    <form className="login__card" onSubmit={onSubmit} noValidate>
      <span className="login__logo">
        <Icon name="companies" size={26} />
      </span>

      {sentTo ? (
        <>
          <h1>{t('login.reset.sentTitle')}</h1>
          <p className="muted">{t('login.reset.sentBody', { email: sentTo })}</p>
        </>
      ) : (
        <>
          <h1>{t('login.reset.title')}</h1>
          <p className="muted">{t('login.reset.body')}</p>
        </>
      )}

      {error && (
        <div className="alert alert--error" role="alert">
          {t(error)}
        </div>
      )}

      {!sentTo && (
        <label className="field">
          <span>{t('login.email')}</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sending}
            required
            dir="ltr"
          />
        </label>
      )}

      {sentTo ? (
        <>
          <button className="btn btn--primary btn--block login__action" type="button" onClick={onBack}>
            {t('login.reset.back')}
          </button>
          <button
            className="btn btn--block login__action"
            type="submit"
            disabled={sending || secondsLeft > 0}
          >
            {secondsLeft > 0
              ? t('login.reset.resendIn', { seconds: secondsLeft })
              : t('login.reset.resend')}
          </button>
        </>
      ) : (
        <>
          <button
            className="btn btn--primary btn--block login__action"
            type="submit"
            disabled={sending || !email.trim()}
          >
            {sending ? t('login.reset.sending') : t('login.reset.send')}
          </button>
          <button className="btn btn--ghost btn--block login__action" type="button" onClick={onBack}>
            {t('login.reset.back')}
          </button>
        </>
      )}
    </form>
  );
}
