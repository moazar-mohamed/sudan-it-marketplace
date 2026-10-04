import { useId, useState, type FormEvent } from 'react';
import { createCompany } from '../data/actions';
import { isValidEmail, passwordProblem } from '../data/companyAccount';
import { registrationProblems } from '../data/companyDocuments';
import { NO_IMAGE } from '../data/imageRules';
import type { NewCompanyInput } from '../data/provisionCompany';
import { useI18n } from '../i18n/I18nProvider';
import { useRunner } from './feedback';
import { Icon } from './Icon';
import { ImagePickerField } from './ImagePickerField';
import { LocationField } from './LocationField';
import { MapPicker } from './MapPicker';
import { PhoneField, phoneValueProblem } from './PhoneField';
import { RegistrationFields } from './RegistrationFields';
import { Modal } from './ui';

const EMPTY: NewCompanyInput = {
  name: '',
  description: '',
  city: '',
  address: '',
  latitude: null,
  longitude: null,
  phone: '',
  email: '',
  pickupAddress: '',
  initialPassword: '',
  logo: NO_IMAGE,
  registrationNumber: '',
  registrationDocument: null,
};

export function CompanyCreateModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const [form, setForm] = useState<NewCompanyInput>(EMPTY);
  const [showPassword, setShowPassword] = useState(false);
  const [showError, setShowError] = useState(false);
  const [picking, setPicking] = useState(false);
  const passwordLabelId = useId();
  const set = (
    key: 'name' | 'description' | 'city' | 'address' | 'phone' | 'email' | 'pickupAddress' | 'initialPassword',
  ) =>
    (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const point =
    form.latitude !== null && form.longitude !== null
      ? { latitude: form.latitude, longitude: form.longitude }
      : null;
  const nameMissing = !form.name.trim();
  const phoneInvalid = phoneValueProblem(form.phone) !== null;
  const emailInvalid = !isValidEmail(form.email);
  const passwordIssue = passwordProblem(form.initialPassword);
  const registration = {
    registrationNumber: form.registrationNumber,
    document: form.registrationDocument,
  };
  const registrationIncomplete = registrationProblems(registration).length > 0;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (nameMissing || phoneInvalid || emailInvalid || passwordIssue || registrationIncomplete) {
      setShowError(true);
      return;
    }
    const ok = await run('create', () => createCompany(form), t('companies.added'));
    if (ok) onClose();
  };

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

  return (
    <Modal title={t('companies.addTitle')} onClose={onClose} wide>
      <form onSubmit={onSubmit} noValidate className="form-sections">
        <section className="form-card">
          <h3 className="form-card__title">{t('companies.section.basic')}</h3>
          <ImagePickerField
            value={form.logo ?? NO_IMAGE}
            onChange={(logo) => setForm((prev) => ({ ...prev, logo }))}
            disabled={busy === 'create'}
            uploading={busy === 'create' && form.logo?.kind === 'file'}
          />
          <label className="field">
            <span>{t('company.name')}</span>
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
            <span>{t('company.description')}</span>
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
              <span>{t('company.city')}</span>
              <input value={form.city} onChange={(e) => set('city')(e.target.value)} dir="auto" />
            </label>
            <label className="field">
              <span>{t('company.pickup')}</span>
              <input
                value={form.pickupAddress}
                onChange={(e) => set('pickupAddress')(e.target.value)}
                dir="auto"
              />
            </label>
          </div>
          <LocationField
            address={form.address}
            onAddressChange={set('address')}
            point={point}
            onSelectOnMap={() => setPicking(true)}
            onRemovePoint={() => setForm((prev) => ({ ...prev, latitude: null, longitude: null }))}
            disabled={busy === 'create'}
          />
        </section>

        <section className="form-card">
          <h3 className="form-card__title">{t('companies.section.account')}</h3>
          <div className="field-row">
            <PhoneField
              label={t('company.phone')}
              value={form.phone}
              onChange={set('phone')}
              showError={showError}
              disabled={busy === 'create'}
            />
            <label className="field">
              <span>{t('company.email')}</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email')(e.target.value)}
                dir="ltr"
                autoComplete="off"
                aria-invalid={showError && emailInvalid}
              />
              {showError && emailInvalid && (
                <small className="field__error">{t('companies.emailRequired')}</small>
              )}
            </label>
          </div>
          <div className="field">
            <span id={passwordLabelId}>{t('companies.password')}</span>
            <div className="field__control">
              <input
                aria-labelledby={passwordLabelId}
                type={showPassword ? 'text' : 'password'}
                value={form.initialPassword}
                onChange={(e) => set('initialPassword')(e.target.value)}
                dir="ltr"
                autoComplete="new-password"
                aria-invalid={showError && passwordIssue !== null}
              />
              <button
                type="button"
                className="field__eye"
                aria-pressed={showPassword}
                aria-label={showPassword ? t('companies.passwordHide') : t('companies.passwordShow')}
                title={showPassword ? t('companies.passwordHide') : t('companies.passwordShow')}
                onClick={() => setShowPassword((shown) => !shown)}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
              </button>
            </div>
            {showError && passwordIssue && (
              <small className="field__error">
                {passwordIssue === 'required'
                  ? t('companies.passwordRequired')
                  : t('companies.passwordTooShort')}
              </small>
            )}
            <small className="note">{t('companies.passwordHint')}</small>
          </div>
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
            disabled={busy === 'create'}
          />
        </section>
        <p className="note">{t('companies.addHint')}</p>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy === 'create'}>
            {busy === 'create' ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
