import { useState } from 'react';
import { cancelOrderAsAdmin } from '../data/actions';
import { useI18n } from '../i18n/I18nProvider';
import { useRunner } from './feedback';
import { ReasonDialog } from './ReasonDialog';

/**
 * "Cancel order" for an order that is stuck while still Processing. The reason
 * is required and kept in the activity log; the stock the order took goes back
 * (see cancelOrderAsAdmin). Shown only for a Processing order.
 */
export function AdminOrderCancel({ orderId }: { orderId: string }) {
  const { t } = useI18n();
  const { run } = useRunner();
  const [open, setOpen] = useState(false);

  // A failure (including "the company already moved it on") is explained by the
  // runner's toast and leaves the dialog open.
  const submit = (reason: string) =>
    run('cancel', () => cancelOrderAsAdmin(orderId, reason), t('order.cancelAdmin.done'));

  return (
    <>
      <button className="btn btn--danger" onClick={() => setOpen(true)}>
        {t('order.cancelAdmin')}
      </button>
      {open && (
        <ReasonDialog
          title={t('order.cancelAdminTitle')}
          body={t('order.cancelAdminBody')}
          label={t('order.cancelAdminReason')}
          confirmLabel={t('order.cancelAdmin')}
          danger
          onClose={() => setOpen(false)}
          onSubmit={submit}
        />
      )}
    </>
  );
}
