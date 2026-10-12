import { useState, type FormEvent } from 'react';
import { deleteMyAccount } from '../data/actions';
import { OwnAccountError } from '../data/adminAccounts';
import { useI18n } from '../i18n/I18nProvider';
import { useToast } from './feedback';
import { Modal } from './ui';

/**
 * Deletes the signed-in admin's own account, for good: the profile and the
 * sign-in itself (data/adminAccounts.ts). It cannot be undone, so the email is
 * typed and the password asked again. The only active admin cannot do it: the
 * panel is never left without one.
 */
export function DeleteMyAccountModal({
  me,
  onClose,
}: {
  me: { id: string; fullName: string; email: string; isActive: boolean };
  onClose: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<'wrongPassword' | 'lastAdmin' | 'tooMany' | 'network' | 'generic' | null>(null);

  const matches = typed.trim() !== '' && typed.trim().toLowerCase() === me.email.trim().toLowerCase();
  const ready = matches && password.length > 0 && !working;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setWorking(true);
    setFailure(null);
    try {
      const result = await deleteMyAccount(me, password);
      // The session ends by itself once the login is gone.
      toast(t(result.loginRemoved ? 'admins.deleteMine.done' : 'admins.deleteMine.loginKept'), 'success');
      onClose();
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      setFailure(
        error instanceof OwnAccountError
          ? 'lastAdmin'
          : code === 'auth/wrong-password' || code === 'auth/invalid-credential'
            ? 'wrongPassword'
            : code === 'auth/too-many-requests'
              ? 'tooMany'
              : code === 'auth/network-request-failed'
                ? 'network'
                : 'generic',
      );
      setWorking(false);
    }
  };

  const failureText = {
    wrongPassword: t('admins.deleteMine.wrongPassword'),
    lastAdmin: t('admins.deleteMine.lastAdmin'),
    tooMany: t('login.error.tooMany'),
    network: t('login.error.network'),
    generic: t('admins.deleteMine.failed'),
  };

  return (
    <Modal title={t('admins.deleteMine.title')} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        {failure && (
          <div className="alert alert--error" role="alert">
            {failureText[failure]}
          </div>
        )}
        <p className="modal__text">{t('admins.deleteMine.body')}</p>
        <label className="field">
          <span>{t('admins.deleteMine.typeEmail', { email: me.email })}</span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            dir="ltr"
            autoComplete="off"
            autoFocus
            disabled={working}
          />
        </label>
        <label className="field">
          <span>{t('admins.deleteMine.password')}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
            autoComplete="current-password"
            disabled={working}
          />
        </label>
        <p className="note">{t('admins.deleteMine.final')}</p>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose} disabled={working}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn--danger" disabled={!ready}>
            {working ? t('common.saving') : t('admins.deleteMine.confirm')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
