import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useConfirm, useRunner, useToast } from '../components/feedback';
import { ActiveBadge } from '../components/StatusBadges';
import { DataGate, EmptyState, Modal, PageHeader, Text } from '../components/ui';
import { createAdmin, setAdminActive } from '../data/actions';
import { useAdmins } from '../data/hooks';
import type { PlatformAdmin } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/dictionary';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createErrorKey(error: unknown): TranslationKey {
  switch ((error as { code?: string } | null)?.code) {
    case 'auth/email-already-in-use':
      return 'customers.error.emailInUse';
    case 'auth/invalid-email':
      return 'customers.error.invalidEmail';
    case 'auth/network-request-failed':
      return 'login.error.network';
    case 'auth/operation-not-allowed':
      return 'customers.error.notAllowed';
    case 'permission-denied':
      return 'admins.error.profile';
    default:
      return 'admins.error.generic';
  }
}

/** Creates a real, sign-in-capable admin account (see data/provisionAdmin.ts). */
function AdminCreateModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showError, setShowError] = useState(false);
  const [failure, setFailure] = useState<TranslationKey | null>(null);

  const nameMissing = !fullName.trim();
  const emailInvalid = !EMAIL_SHAPE.test(email.trim());

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (nameMissing || emailInvalid) {
      setShowError(true);
      return;
    }
    setSubmitting(true);
    setFailure(null);
    try {
      const result = await createAdmin({ fullName, email });
      if (result.passwordEmailSent) {
        toast(t('admins.created', { email: email.trim().toLowerCase() }), 'success');
      } else {
        toast(t('admins.created.noEmail'), 'error');
      }
      onClose();
    } catch (error) {
      setFailure(createErrorKey(error));
      setSubmitting(false);
    }
  };

  return (
    <Modal title={t('admins.addTitle')} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        {failure && (
          <div className="alert alert--error" role="alert">
            {t(failure)}
          </div>
        )}
        <label className="field">
          <span>{t('col.name')}</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoFocus
            dir="auto"
            maxLength={100}
            aria-invalid={showError && nameMissing}
          />
          {showError && nameMissing && (
            <small className="field__error">{t('customer.nameRequired')}</small>
          )}
        </label>
        <label className="field">
          <span>{t('col.email')}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            autoComplete="off"
            aria-invalid={showError && emailInvalid}
          />
          {showError && emailInvalid && (
            <small className="field__error">{t('customers.error.invalidEmail')}</small>
          )}
        </label>
        <p className="note">{t('admins.addHint')}</p>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? t('admins.creating') : t('admins.add')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * The people who can sign in to this panel. Any admin can add another, and
 * switch another off or on (never themselves, so nobody locks themselves out).
 */
export function AdminsPage() {
  const { t, date } = useI18n();
  const { state } = useAuth();
  const myId = state.status === 'authorized' ? state.profile.uid : '';
  const admins = useAdmins();
  const confirm = useConfirm();
  const { busy, run } = useRunner();
  const [adding, setAdding] = useState(false);

  const toggle = async (admin: PlatformAdmin) => {
    const name = admin.fullName || admin.email;
    if (admin.isActive) {
      const ok = await confirm({
        title: t('admins.confirmDeactivate.title'),
        body: t('admins.confirmDeactivate.body', { name }),
        confirmLabel: t('admins.deactivate'),
        danger: true,
      });
      if (!ok) return;
    }
    await run(
      admin.id,
      () => setAdminActive(admin.id, !admin.isActive, name),
      t(admin.isActive ? 'admins.deactivated' : 'admins.reactivated'),
    );
  };

  return (
    <>
      <PageHeader
        title={t('admins.title')}
        subtitle={t('admins.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
        actions={
          <button className="btn btn--primary" onClick={() => setAdding(true)}>
            + {t('admins.add')}
          </button>
        }
      />
      {adding && <AdminCreateModal onClose={() => setAdding(false)} />}
      <DataGate gates={[admins]}>
        {admins.data.length === 0 ? (
          <EmptyState message={t('admins.empty')} />
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('col.name')}</th>
                    <th>{t('col.email')}</th>
                    <th>{t('col.status')}</th>
                    <th>{t('col.created')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.data.map((a) => {
                    const mine = a.id === myId;
                    return (
                      <tr key={a.id}>
                        <td className="strong">
                          <Text>{a.fullName || '—'}</Text>
                          {mine && <span className="badge badge--info admins__you">{t('admins.you')}</span>}
                        </td>
                        <td>
                          <bdi dir="ltr">{a.email || '—'}</bdi>
                        </td>
                        <td>
                          <ActiveBadge active={a.isActive} />
                        </td>
                        <td className="nowrap">{date(a.createdAt)}</td>
                        <td>
                          <button
                            className={a.isActive ? 'btn btn--danger-ghost btn--sm' : 'btn btn--sm'}
                            disabled={mine || busy === a.id}
                            title={mine ? t('admins.cannotSelf') : undefined}
                            onClick={() => void toggle(a)}
                          >
                            {a.isActive ? t('admins.deactivate') : t('admins.activate')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DataGate>
    </>
  );
}
