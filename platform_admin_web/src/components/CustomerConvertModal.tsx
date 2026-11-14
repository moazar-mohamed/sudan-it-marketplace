import { useState, type FormEvent } from 'react';
import { convertCustomerToCompany } from '../data/actions';
import { registrationProblems } from '../data/companyDocuments';
import type { ConvertCompanyInput } from '../data/convertCustomer';
import { NO_IMAGE } from '../data/imageRules';
import type { Customer, Order, ServiceRequest } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';
import { CityChips } from './CityChips';
import { OptionalMark, RequiredMark } from './FieldMark';
import { useConfirm, useRunner } from './feedback';
import { ImagePickerField } from './ImagePickerField';
import { LocationField } from './LocationField';
import { MapPicker } from './MapPicker';
import { OpenWorkList } from './OpenWorkList';
import { PhoneField, phoneValueProblem } from './PhoneField';
import { RegistrationFields } from './RegistrationFields';
import { Modal } from './ui';

/**
 * Turns a customer's account into the admin of a new company (data/
 * convertCustomer.ts). The person keeps their login, so the form is the company
 * form without an email or a password. A customer who still has orders or
 * service requests in progress is shown what is open instead of the form.
 */
export function CustomerConvertModal({
  customer,
  openOrders,
  openRequests,
  onClose,
}: {
  customer: Customer;
  openOrders: Order[];
  openRequests: ServiceRequest[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const { busy, run } = useRunner();
  const [form, setForm] = useState<ConvertCompanyInput>({
    name: '',
    description: '',
    city: '',
    serviceCityIds: [],
    address: '',
    latitude: null,
    longitude: null,
    phone: customer.phone,
    pickupAddress: '',
    logo: NO_IMAGE,
    registrationNumber: '',
    registrationDocument: null,
  });
  const [showError, setShowError] = useState(false);
  const [picking, setPicking] = useState(false);
  const set = (key: 'name' | 'description' | 'city' | 'address' | 'phone' | 'pickupAddress') =>
    (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const point =
    form.latitude !== null && form.longitude !== null
      ? { latitude: form.latitude, longitude: form.longitude }
      : null;
  const nameMissing = !form.name.trim();
  const phoneInvalid = phoneValueProblem(form.phone) !== null;
  const registration = {
    registrationNumber: form.registrationNumber,
    document: form.registrationDocument,
  };
  const registrationIncomplete = registrationProblems(registration).length > 0;
  const who = customer.fullName || customer.email;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (nameMissing || phoneInvalid || registrationIncomplete) {
      setShowError(true);
      return;
    }
    const ok = await confirm({
      title: t('customer.convert.confirm.title'),
      body: t('customer.convert.confirm.body', { name: who }),
      confirmLabel: t('customer.convert.confirm.action'),
      danger: true,
    });
    if (!ok) return;
    const done = await run(
      'convert',
      () => convertCustomerToCompany(customer, form),
      t('customer.convert.done', { name: who }),
    );
    if (done) onClose();
  };

  if (openOrders.length > 0 || openRequests.length > 0) {
    return (
      <Modal title={t('customer.convert.blocked.title')} onClose={onClose}>
        <p className="note">{t('customer.convert.blocked.body')}</p>
        <OpenWorkList openOrders={openOrders} openRequests={openRequests} />
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </Modal>
    );
  }

  // The map replaces the form inside the same dialog, so the typed values are
  // kept while the point is being chosen.
  if (picking) {
    return (
      <Modal title={t('location.selectOnMap')} onClose={() => setPicking(false)} wide>
        <MapPicker
          initial={point}
          onCancel={() => setPicking(false)}
          onConfirm={(p) => {
            setForm((prev) => ({ ...prev, latitude: p.latitude, longitude: p.longitude }));
            setPicking(false);
          }}
        />
      </Modal>
    );
  }

  const working = busy === 'convert';
  return (
    <Modal title={t('customer.convert.title')} onClose={onClose} wide>
      <form onSubmit={onSubmit} noValidate className="form-sections">
        <p className="note">{t('customer.convert.intro')}</p>
        <section className="form-card">
          <h3 className="form-card__title">{t('companies.section.basic')}</h3>
          <ImagePickerField
            value={form.logo ?? NO_IMAGE}
            onChange={(logo) => setForm((prev) => ({ ...prev, logo }))}
            disabled={working}
            uploading={working && form.logo?.kind === 'file'}
            mark={<OptionalMark />}
          />
          <label className="field">
            <span>
              {t('company.name')}
              <RequiredMark />
            </span>
            <input
              value={form.name}
              onChange={(e) => set('name')(e.target.value)}
              autoFocus
              dir="auto"
              maxLength={120}
              aria-invalid={showError && nameMissing}
            />
            {showError && nameMissing && (
              <small className="field__error">{t('companies.nameRequired')}</small>
            )}
          </label>
          <label className="field">
            <span>
              {t('company.description')}
              <OptionalMark />
            </span>
            <textarea
              value={form.description}
              onChange={(e) => set('description')(e.target.value)}
              rows={3}
              dir="auto"
            />
          </label>
        </section>

        <section className="form-card">
          <h3 className="form-card__title">{t('companies.section.place')}</h3>
          <div className="field-row">
            <label className="field">
              <span>
                {t('company.city')}
                <OptionalMark />
              </span>
              <input value={form.city} onChange={(e) => set('city')(e.target.value)} dir="auto" />
            </label>
            <label className="field">
              <span>
                {t('company.pickup')}
                <OptionalMark />
              </span>
              <input
                value={form.pickupAddress}
                onChange={(e) => set('pickupAddress')(e.target.value)}
                dir="auto"
              />
            </label>
          </div>
          <div className="field">
            <span>
              {t('company.serviceCities')}
              <OptionalMark />
            </span>
            <CityChips
              value={form.serviceCityIds ?? []}
              onChange={(next) => setForm((prev) => ({ ...prev, serviceCityIds: next }))}
              label={t('company.serviceCities')}
            />
            <small>{t('company.serviceCitiesHint')}</small>
          </div>
          <LocationField
            address={form.address}
            onAddressChange={set('address')}
            point={point}
            onSelectOnMap={() => setPicking(true)}
            onRemovePoint={() => setForm((prev) => ({ ...prev, latitude: null, longitude: null }))}
            disabled={working}
            mark={<OptionalMark />}
          />
        </section>

        <section className="form-card">
          <h3 className="form-card__title">{t('companies.section.account')}</h3>
          <div className="field-row">
            <PhoneField
              label={t('company.phone')}
              mark={<OptionalMark />}
              value={form.phone}
              onChange={set('phone')}
              showError={showError}
              disabled={working}
            />
            <label className="field">
              <span>{t('customer.convert.signInEmail')}</span>
              <input value={customer.email} disabled dir="ltr" />
            </label>
          </div>
          <small className="note">{t('customer.convert.hint')}</small>
        </section>

        <section className="form-card">
          <RegistrationFields
            value={registration}
            onChange={(next) =>
              setForm((prev) => ({
                ...prev,
                registrationNumber: next.registrationNumber,
                registrationDocument: next.document,
              }))
            }
            showErrors={showError}
            disabled={working}
            requiredMarks
          />
        </section>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn--primary" disabled={working}>
            {working ? t('common.saving') : t('customer.convert')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
