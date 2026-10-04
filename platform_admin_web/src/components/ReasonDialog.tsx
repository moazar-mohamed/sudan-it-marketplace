import { useState, type FormEvent } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { Modal } from './ui';

export const MAX_REASON_LENGTH = 200;

/**
 * Asks for a short written reason before a moderation action (hiding a
 * product, cancelling an order). The reason is required, at most 200
 * characters, and is kept in the activity log. `onSubmit` resolves true when
 * the action went through: the dialog then closes; on false it stays open so
 * the admin can try again.
 */
export function ReasonDialog({
  title,
  body,
  label,
  confirmLabel,
  danger,
  onSubmit,
  onClose,
}: {
  title: string;
  body: string;
  label: string;
  confirmLabel: string;
  danger?: boolean;
  onSubmit: (reason: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t, number } = useI18n();
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);
  const [touched, setTouched] = useState(false);
  const missing = reason.trim() === '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (working) return;
    if (missing) {
      setTouched(true);
      return;
    }
    setWorking(true);
    const done = await onSubmit(reason.trim());
    setWorking(false);
    if (done) onClose();
  };

  return (
    <Modal title={title} onClose={onClose} narrow>
      <form onSubmit={(e) => void submit(e)}>
        <p className="modal__text">{body}</p>
        <label className="field">
          <span>{label}</span>
          <textarea
            rows={3}
            maxLength={MAX_REASON_LENGTH}
            value={reason}
            aria-invalid={touched && missing}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
          <small className={touched && missing ? 'field__error' : undefined}>
            {touched && missing
              ? t('moderation.reasonRequired')
              : t('moderation.reasonCount', { count: number(MAX_REASON_LENGTH - reason.length) })}
          </small>
        </label>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className={danger ? 'btn btn--danger' : 'btn btn--primary'} disabled={working}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
