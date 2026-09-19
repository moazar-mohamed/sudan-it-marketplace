import { useState, type FormEvent } from 'react';
import { setCustomerActive, updateCustomerProfile } from '../data/actions';
import { createCustomerAccount } from '../data/provisionCustomer';
import type { Customer } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/dictionary';
import { useConfirm, useRunner, useToast } from './feedback';
import { Modal } from './ui';

/** Deactivate (with confirmation) or reactivate a customer: only isActive changes. */
export function useToggleCustomerActive() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const { busy, run } = useRunner();

  const toggle = async (customer: Customer) => {
    if (customer.isActive) {
      const ok = await confirm({
        title: t('customer.confirmDeactivate.title'),
        body: t('customer.confirmDeactivate.body', { name: customer.fullName || customer.email }),
        confirmLabel: t('customer.deactivate'),
        danger: true,
      });
      if (!ok) return;
    }
    await run(
      customer.id,
      () => setCustomerActive(customer.id, !customer.isActive),
      t(customer.isActive ? 'customer.deactivated' : 'customer.reactivated'),
    );
  };

  return { toggle, busyId: busy };
}

/** Edit the customer's normal profile fields (name, phone). Email and role are read-only. */
export function CustomerEditModal({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const [fullName, setFullName] = useState(customer.fullName);
  const [phone, setPhone] = useState(customer.phone);
  const [showError, setShowError] = useState(false);
  const nameMissing = !fullName.trim();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (nameMissing) {
      setShowError(true);
      return;
    }
    const ok = await run(
      'edit',
      () => updateCustomerProfile(customer.id, { fullName, phone }),
      t('customer.profileUpdated'),
    );
    if (ok) onClose();
  };

  return (
    <Modal title={t('customer.editTitle')} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
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
          <span>{t('col.phone')}</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" maxLength={30} />
        </label>
        <label className="field">
          <span>{t('col.email')}</span>
          <input value={customer.email} disabled dir="ltr" />
          <small className="muted">{t('customer.emailLocked')}</small>
        </label>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy === 'edit'}>
            {busy === 'edit' ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function createErrorKey(error: unknown): TranslationKey {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case 'auth/email-already-in-use':
      return 'customers.error.emailInUse';
    case 'auth/invalid-email':
      return 'customers.error.invalidEmail';
    case 'auth/network-request-failed':
      return 'login.error.network';
    case 'auth/operation-not-allowed':
      return 'customers.error.notAllowed';
    case 'permission-denied':
      return 'customers.error.profile';
    default:
      return 'customers.error.generic';
  }
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Creates a real, sign-in-capable customer account (see data/provisionCustomer.ts). */
export function CustomerCreateModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
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
      const result = await createCustomerAccount({ fullName, email, phone });
      const address = email.trim().toLowerCase();
      if (result.passwordEmailSent && result.phoneSaved) {
        toast(t('customers.created', { email: address }), 'success');
      } else {
        // The account exists either way; say exactly what still needs attention.
        toast(t('customers.created.partial', { email: address }), 'error');
        if (!result.passwordEmailSent) toast(t('customers.created.noEmail'), 'error');
        if (!result.phoneSaved) toast(t('customers.created.noPhone'), 'error');
      }
      onClose();
    } catch (error) {
      setFailure(createErrorKey(error));
      setSubmitting(false);
    }
  };

  return (
    <Modal title={t('customers.addTitle')} onClose={onClose}>
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
        <label className="field">
          <span>{t('col.phone')}</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" maxLength={30} />
        </label>
        <p className="note">{t('customers.addHint')}</p>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? t('customers.creating') : t('customers.add')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
