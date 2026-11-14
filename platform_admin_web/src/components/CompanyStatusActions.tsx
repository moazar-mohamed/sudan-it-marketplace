import { setCompanyStatus, trashCompany } from '../data/actions';
import { useProducts } from '../data/hooks';
import type { Company, CompanyStatus } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import { useConfirm, useRunner } from './feedback';
import { RowMenu, type RowMenuItem } from './RowMenu';

/**
 * Approve / reject a pending company, activate / deactivate a decided one, and
 * move any of them to the trash (nothing is deleted; the Trash page restores it
 * or deletes it for good). Reject, deactivate and trash ask for confirmation.
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
    await run(company.id, () => setCompanyStatus(company.id, status, company.name), t('companies.updated'));
  };

  const remove = async () => {
    const count = products.data.filter((p) => p.companyId === company.id).length;
    const ok = await confirm({
      title: t('companies.confirmTrash.title'),
      body: t('companies.confirmTrash.body', { name: company.name, count }),
      confirmLabel: t('companies.trash'),
      danger: true,
    });
    if (!ok) return;
    const done = await run(company.id, () => trashCompany(company), t('companies.trashed'));
    if (done) onDeleted?.();
  };

  const disabled = busy === company.id;

  // The one everyday action (approve / activate) is a button; the rest, the sensitive ones
  // among them, are folded into a "..." menu.
  const trashItem: RowMenuItem = { key: 'trash', label: t('companies.trash'), danger: true, separated: true, disabled, onSelect: () => void remove() };
  const menu = (items: RowMenuItem[]) => <RowMenu label={t('common.actions')} items={items} disabled={disabled} />;
  if (company.status === 'pending') {
    return (
      <div className="btn-group">
        <button className="btn btn--primary btn--sm" disabled={disabled} onClick={() => change('active', null)}>
          {t('companies.approve')}
        </button>
        {menu([{ key: 'reject', label: t('companies.reject'), danger: true, onSelect: () => void change('rejected', 'reject') }, trashItem])}
      </div>
    );
  }
  if (company.status === 'active') {
    return (
      <div className="btn-group">
        {menu([{ key: 'deactivate', label: t('companies.deactivate'), danger: true, onSelect: () => void change('inactive', 'deactivate') }, trashItem])}
      </div>
    );
  }
  return (
    <div className="btn-group">
      <button className="btn btn--sm" disabled={disabled} onClick={() => change('active', null)}>
        {t('companies.activate')}
      </button>
      {menu([trashItem])}
    </div>
  );
}
