import { useState } from 'react';
import { setCompanyServiceCities } from '../data/actions';
import type { Company } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import { CityChips } from './CityChips';
import { useRunner } from './feedback';
import { Modal } from './ui';

/** Platform Admin changes the cities a company serves. */
export function CompanyCitiesModal({ company, onClose }: { company: Company; onClose: () => void }) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const [cities, setCities] = useState<string[]>(company.serviceCityIds ?? []);

  const save = async () => {
    const ok = await run(
      'cities',
      () => setCompanyServiceCities(company.id, cities, company.name, company.serviceCityIds ?? [], company.status === 'active'),
      t('companies.updated'),
    );
    if (ok) onClose();
  };

  return (
    <Modal title={t('company.serviceCities')} onClose={onClose}>
      <p className="note">{t('company.serviceCitiesHint')}</p>
      <CityChips value={cities} onChange={setCities} label={t('company.serviceCities')} />
      <div className="modal__actions">
        <button type="button" className="btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn--primary" disabled={busy === 'cities'} onClick={save}>
          {busy === 'cities' ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </Modal>
  );
}
