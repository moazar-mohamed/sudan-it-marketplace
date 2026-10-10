import { useState, type FormEvent } from 'react';
import { deleteCustomer } from '../data/actions';
import type { Customer, Order, ServiceRequest } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import { useRunner } from './feedback';
import { OpenWorkList } from './OpenWorkList';
import { Modal } from './ui';

/**
 * Deletes a customer's account (data/deleteCustomer.ts). It cannot be undone,
 * so the account's email has to be typed first; a customer with orders or
 * service requests in progress is shown what is open instead.
 */
export function CustomerDeleteModal({
  customer,
  openOrders,
  openRequests,
  onClose,
  onDeleted,
}: {
  customer: Customer;
  openOrders: Order[];
  openRequests: ServiceRequest[];
  onClose: () => void;
  /** Called after the account is gone, so the page can leave it. */
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toLowerCase() === customer.email.trim().toLowerCase() && typed.trim() !== '';
  const working = busy === 'delete';

  if (openOrders.length > 0 || openRequests.length > 0) {
    return (
      <Modal title={t('customer.convert.blocked.title')} onClose={onClose}>
        <p className="note">{t('customer.delete.blocked.body')}</p>
        <OpenWorkList openOrders={openOrders} openRequests={openRequests} />
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </Modal>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!matches || working) return;
    const ok = await run(
      'delete',
      () => deleteCustomer(customer),
      (result) => t(result.notificationsLeft ? 'customer.delete.doneLeft' : 'customer.delete.done'),
    );
    if (ok) onDeleted();
  };

  return (
    <Modal title={t('customer.delete.title')} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        <p className="modal__text">{t('customer.delete.removed')}</p>
        <p className="modal__text">{t('customer.delete.kept')}</p>
        <p className="note">{t('customer.delete.limit')}</p>
        <label className="field">
          <span>{t('customer.delete.typeEmail', { email: customer.email })}</span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            dir="ltr"
            autoComplete="off"
            autoFocus
          />
        </label>
        <p className="note">{t('customer.delete.final')}</p>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn--danger" disabled={!matches || working}>
            {working ? t('common.saving') : t('customer.delete.confirm')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
