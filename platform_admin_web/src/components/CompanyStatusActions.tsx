import { deleteCompany, setCompanyStatus } from '../data/actions';
import type { CompanyDeletionSummary } from '../data/deleteCompany';
import { useProducts } from '../data/hooks';
import type { Company, CompanyStatus } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import { useConfirm, useRunner } from './feedback';

/**
 * Approve / reject a pending company, activate / deactivate a decided one, and
 * delete one that is not active. Reject, deactivate and delete ask for
 * confirmation first; an active company must be deactivated before deletion.
 */
export function CompanyStatusActions({
  company,
  onDeleted,
}: {
  company: Company;
  onDeleted?: () => void;
}) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const products = useProducts();
  const { busy, run } = useRunner();

  const change = async (status: CompanyStatus, needsConfirm: 'reject' | 'deactivate' | null) => {
    if (needsConfirm) {
      const ok = await confirm({
        title: t(
          needsConfirm === 'reject'
            ? 'companies.confirmReject.title'
            : 'companies.confirmDeactivate.title',
        ),
        body: t(
          needsConfirm === 'reject'
            ? 'companies.confirmReject.body'
            : 'companies.confirmDeactivate.body',
          { name: company.name },
        ),
        confirmLabel: t(needsConfirm === 'reject' ? 'companies.reject' : 'companies.deactivate'),
        danger: true,
      });
      if (!ok) return;
    }
    await run(company.id, () => setCompanyStatus(company.id, status), t('companies.updated'));
  };

  const remove = async () => {
    const count = products.data.filter((p) => p.companyId === company.id).length;
    const isActive = company.status === 'active';
    const ok = await confirm({
      title: t('companies.confirmDelete.title'),
      body:
        t('companies.confirmDelete.body', { name: company.name, count }) +
        (isActive ? '\n\n' + t('companies.confirmDelete.activeNote') : ''),
      confirmLabel: t('companies.delete'),
      danger: true,
    });
    if (!ok) return;
    // Only an inactive company can be deleted, so an active one is deactivated
    // first (a step the rules already allow); the cascade then removes it and
    // everything it owns. Orders are never part of it.
    const cascade = async () => {
      if (isActive) await setCompanyStatus(company.id, 'inactive');
      return deleteCompany(company.id);
    };
    const done = await run(company.id, cascade, (r: CompanyDeletionSummary) =>
      t('companies.deletedCascade', {
        admins: r.admins,
        technicians: r.technicians,
        invites: r.invites,
        products: r.products,
        other: r.other,
        orders: r.ordersKept === null ? t('companies.ordersKeptUnknown') : t('companies.ordersKept', { count: r.ordersKept }),
      }),
    );
    if (done) onDeleted?.();
  };

  const disabled = busy === company.id;
  const deleteButton = (
    <button className="btn btn--danger btn--sm" disabled={disabled} onClick={() => void remove()}>
      {t('companies.delete')}
    </button>
  );

  if (company.status === 'pending') {
    return (
      <div className="btn-group">
        <button
          className="btn btn--primary btn--sm"
          disabled={disabled}
          onClick={() => change('active', null)}
        >
          {t('companies.approve')}
        </button>
        <button
          className="btn btn--danger-ghost btn--sm"
          disabled={disabled}
          onClick={() => change('rejected', 'reject')}
        >
          {t('companies.reject')}
        </button>
        {deleteButton}
      </div>
    );
  }

  if (company.status === 'active') {
    return (
      <div className="btn-group">
        {deleteButton}
        <button
          className="btn btn--danger-ghost btn--sm"
          disabled={disabled}
          onClick={() => change('inactive', 'deactivate')}
        >
          {t('companies.deactivate')}
        </button>
      </div>
    );
  }

  return (
    <div className="btn-group">
      <button className="btn btn--sm" disabled={disabled} onClick={() => change('active', null)}>
        {t('companies.activate')}
      </button>
      {deleteButton}
    </div>
  );
}
