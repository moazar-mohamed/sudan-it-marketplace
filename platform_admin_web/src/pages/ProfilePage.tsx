import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { emailChangeProblem, requestOwnEmailChange, type EmailChangeProblem } from '../auth/changeEmail';
import { changeOwnPassword, passwordChangeProblem, type PasswordChangeProblem } from '../auth/changePassword';
import { saveOwnName } from '../auth/ownProfile';
import { requestPasswordReset } from '../auth/passwordReset';
import { useToast } from '../components/feedback';
import { Disclosure, PageHeader, Text } from '../components/ui';
import { useAdmins } from '../data/hooks';
import { auth } from '../firebase';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/dictionary';

const PROBLEM_KEYS: Record<PasswordChangeProblem, TranslationKey> = {
  'current-required': 'profile.password.errRequired',
  'too-short': 'profile.password.errShort',
  mismatch: 'profile.password.errMismatch',
  same: 'profile.password.errSame',
};

const EMAIL_PROBLEM_KEYS: Record<EmailChangeProblem, TranslationKey> = {
  'password-required': 'profile.password.errRequired',
  invalid: 'profile.email.errInvalid',
  same: 'profile.email.errSame',
};

function failureKey(error: unknown): TranslationKey {
  switch ((error as { code?: string } | null)?.code) {
    case 'auth/email-already-in-use':
      return 'profile.email.errInUse';
    case 'auth/invalid-email':
      return 'profile.email.errInvalid';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'profile.password.errCurrent';
    case 'auth/weak-password':
      return 'profile.password.errShort';
    case 'auth/requires-recent-login':
    case 'auth/no-current-user':
      return 'profile.password.errRecent';
    case 'auth/too-many-requests':
      return 'login.error.tooMany';
    case 'auth/network-request-failed':
      return 'login.error.network';
    default:
      return 'profile.password.errGeneric';
  }
}

/** The name shown in the panel and the email the admin signs in with. */
function DetailsCard({ uid, name, email }: { uid: string; name: string; email: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const { patchProfile } = useAuth();
  const [fullName, setFullName] = useState(name);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<TranslationKey | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [emailError, setEmailError] = useState<TranslationKey | null>(null);

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (savingName) return;
    if (!fullName.trim()) {
      setNameError('profile.name.errRequired');
      return;
    }
    setSavingName(true);
    setNameError(null);
    try {
      await saveOwnName(uid, fullName);
      patchProfile({ fullName: fullName.trim() });
      toast(t('profile.name.saved'), 'success');
    } catch (err) {
      setNameError(failureKey(err));
    } finally {
      setSavingName(false);
    }
  };

  const sendLink = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const problem = emailChangeProblem(password, newEmail, email);
    if (problem) {
      setEmailError(EMAIL_PROBLEM_KEYS[problem]);
      return;
    }
    setSending(true);
    setEmailError(null);
    try {
      await requestOwnEmailChange(password, newEmail);
      toast(t('profile.email.sent', { email: newEmail.trim() }), 'success');
      setNewEmail('');
      setPassword('');
    } catch (err) {
      setEmailError(failureKey(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Disclosure title={t('profile.details')} icon="profile">
      <p className="muted profile__hint">{t('profile.details.hint')}</p>
      <form onSubmit={saveName} noValidate>
        {nameError && (
          <div className="alert alert--error" role="alert">
            {t(nameError)}
          </div>
        )}
        <label className="field">
          <span>{t('profile.name.label')}</span>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
        </label>
        <div className="profile__row">
          <button type="submit" className="btn btn--primary" disabled={savingName || fullName.trim() === name}>
            {t('profile.name.save')}
          </button>
        </div>
      </form>
      <hr className="profile__rule" />
      <form onSubmit={sendLink} noValidate>
        <p className="muted profile__hint">{t('profile.email.hint')}</p>
        {emailError && (
          <div className="alert alert--error" role="alert">
            {t(emailError)}
          </div>
        )}
        <div className="field-row">
          <label className="field">
            <span>{t('profile.email.new')}</span>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoComplete="email"
              dir="ltr"
            />
          </label>
          <label className="field">
            <span>{t('profile.email.confirmPassword')}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              dir="ltr"
            />
          </label>
        </div>
        <div className="profile__row">
          <button type="submit" className="btn btn--primary" disabled={sending}>
            {sending ? t('profile.email.sending') : t('profile.email.send')}
          </button>
        </div>
      </form>
    </Disclosure>
  );
}

function PasswordCard({ email }: { email: string }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const problem = passwordChangeProblem(current, next, confirm);
    if (problem) {
      setError(PROBLEM_KEYS[problem]);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await changeOwnPassword(current, next);
      toast(t('profile.password.changed'), 'success');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(failureKey(err));
    } finally {
      setSaving(false);
    }
  };

  const sendLink = async () => {
    try {
      await requestPasswordReset(email, locale);
      toast(t('profile.password.linkSent', { email }), 'success');
    } catch (err) {
      toast(t(failureKey(err)), 'error');
    }
  };

  return (
    <Disclosure title={t('profile.security')} icon="shield">
      <form onSubmit={onSubmit} noValidate>
        <p className="muted profile__hint">{t('profile.security.hint')}</p>
        {error && (
          <div className="alert alert--error" role="alert">
            {t(error)}
          </div>
        )}
        <label className="field">
          <span>{t('profile.password.current')}</span>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            dir="ltr"
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>{t('profile.password.new')}</span>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              dir="ltr"
            />
          </label>
          <label className="field">
            <span>{t('profile.password.confirm')}</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              dir="ltr"
            />
          </label>
        </div>
        <div className="profile__row">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? t('profile.password.saving') : t('profile.password.save')}
          </button>
          <span className="muted">
            {t('profile.password.forgot')}{' '}
            <button type="button" className="link-btn" onClick={() => void sendLink()}>
              {t('profile.password.sendLink')}
            </button>
          </span>
        </div>
      </form>
    </Disclosure>
  );
}

export function ProfilePage() {
  const { t, number, date } = useI18n();
  const { state, signOut } = useAuth();
  const admins = useAdmins();
  const profile = state.status === 'authorized' ? state.profile : null;
  const meta = auth.currentUser?.metadata;
  const since = meta?.creationTime ? new Date(meta.creationTime) : null;
  const lastIn = meta?.lastSignInTime ? new Date(meta.lastSignInTime) : null;
  const activeAdmins = admins.data.filter((a) => a.isActive).length;

  return (
    <>
      <PageHeader
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
      />
      {profile && (
        <>
          <section className="card profile__hero">
            <span className="userchip__avatar userchip__avatar--lg">
              {(profile.fullName || profile.email || 'A').charAt(0).toUpperCase()}
            </span>
            <div className="profile__who">
              <h2>
                <Text>{profile.fullName || profile.email}</Text>
              </h2>
              <div className="profile__badges">
                <span className="badge badge--info">{t('profile.roleValue')}</span>
                <span className="badge badge--success">{t('profile.active')}</span>
              </div>
              <dl className="profile__meta">
                <div>
                  <dt>{t('profile.email')}</dt>
                  <dd>
                    <bdi dir="ltr">{profile.email || '—'}</bdi>
                  </dd>
                </div>
                {since && (
                  <div>
                    <dt>{t('profile.memberSince')}</dt>
                    <dd>{date(since)}</dd>
                  </div>
                )}
                {lastIn && (
                  <div>
                    <dt>{t('profile.lastSignIn')}</dt>
                    <dd>{date(lastIn)}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="profile__hero-actions">
              <Link to="/admins" className="btn btn--sm">
                {t('profile.admins.manage')}
                {admins.status === 'ready' && ` · ${t('profile.admins.count', { n: number(activeAdmins) })}`}
              </Link>
              <button className="btn btn--sm btn--danger-ghost" onClick={() => void signOut()}>
                {t('common.signOut')}
              </button>
            </div>
          </section>
          <div className="profile__grid">
            <DetailsCard uid={profile.uid} name={profile.fullName} email={profile.email} />
            <PasswordCard email={profile.email} />
          </div>
        </>
      )}
    </>
  );
}
