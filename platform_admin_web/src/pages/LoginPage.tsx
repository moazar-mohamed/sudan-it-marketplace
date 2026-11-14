import { useState, type FormEvent } from 'react';
import { useAuth, type AccessNotice } from '../auth/AuthProvider';
import { LanguageToggle } from '../components/Layout';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/dictionary';
import { PasswordResetCard } from './PasswordResetCard';

function authErrorKey(code: string | undefined): TranslationKey {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'login.error.invalid';
    case 'auth/too-many-requests':
      return 'login.error.tooMany';
    case 'auth/network-request-failed':
      return 'login.error.network';
    default:
      return 'login.error.generic';
  }
}

export function LoginPage({ notice }: { notice: AccessNotice | null }) {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);

  const message: TranslationKey | null = error ?? (notice ? `login.denied.${notice}` : null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(authErrorKey((err as { code?: string } | null)?.code));
      setSubmitting(false);
    }
    // On success the auth listener takes over (verifying access, then the
    // dashboard, or back here with a denial notice).
  };

  return (
    <div className="login">
      <div className="login__lang">
        <LanguageToggle />
      </div>
      {resetting ? (
        <PasswordResetCard initialEmail={email} onBack={() => setResetting(false)} />
      ) : (
      <form className="login__card" onSubmit={onSubmit} noValidate>
        <span className="login__logo">
          <Icon name="companies" size={26} />
        </span>
        <h1>{t('login.title')}</h1>
        <p className="muted">{t('login.subtitle')}</p>

        {message && (
          <div className="alert alert--error" role="alert">
            {t(message)}
          </div>
        )}

        <label className="field">
          <span>{t('login.email')}</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            dir="ltr"
          />
        </label>
        <label className="field">
          <span>{t('login.password')}</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            dir="ltr"
          />
        </label>
        <button
          className="btn btn--primary btn--block"
          type="submit"
          disabled={submitting || !email || !password}
        >
          {submitting ? t('login.submitting') : t('login.submit')}
        </button>
        <button
          className="btn btn--ghost btn--block login__action"
          type="button"
          disabled={submitting}
          onClick={() => setResetting(true)}
        >
          {t('login.forgot')}
        </button>
      </form>
      )}
    </div>
  );
}
