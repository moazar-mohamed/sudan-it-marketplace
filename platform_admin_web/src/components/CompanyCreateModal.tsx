import { useState, type FormEvent } from 'react';
import { createCompany } from '../data/actions';
import { isValidEmail, passwordProblem } from '../data/companyAccount';
import { NO_IMAGE } from '../data/imageRules';
import type { NewCompanyInput } from '../data/provisionCompany';
import { useI18n } from '../i18n/I18nProvider';
import { useRunner } from './feedback';
import { ImagePickerField } from './ImagePickerField';
import { LocationField } from './LocationField';
import { MapPicker } from './MapPicker';
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
};

export function CompanyCreateModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const [form, setForm] = useState<NewCompanyInput>(EMPTY);
  const [showPassword, setShowPassword] = useState(false);
  const [showError, setShowError] = useState(false);
  const [picking, setPicking] = useState(false);
  const set = (
    key: 'name' | 'description' | 'city' | 'address' | 'phone' | 'email' | 'pickupAddress' | 'initialPassword',
  ) =>
    (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const point =
    form.latitude !== null && form.longitude !== null
      ? { latitude: form.latitude, longitude: form.longitude }
      : null;
  const nameMissing = !form.name.trim();
  const emailInvalid = !isValidEmail(form.email);
  const passwordIssue = passwordProblem(form.initialPassword);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (nameMissing || emailInvalid || passwordIssue) {
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
    <Modal title={t('companies.addTitle')} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        <ImagePickerField
          value={form.logo ?? NO_IMAGE}
          onChange={(logo) => setForm((prev) => ({ ...prev, logo }))}
          disabled={busy === 'create'}
          uploading={busy === 'create' && form.logo?.kind === 'file'}
        />
        <label className="field">
          <span>{t('col.name')}</span>
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
        <label className="field">
          <span>{t('company.city')}</span>
          <input value={form.city} onChange={(e) => set('city')(e.target.value)} dir="auto" />
        </label>
        <LocationField
          address={form.address}
          onAddressChange={set('address')}
          point={point}
          onSelectOnMap={() => setPicking(true)}
          onRemovePoint={() => setForm((prev) => ({ ...prev, latitude: null, longitude: null }))}
          disabled={busy === 'create'}
        />
        <div className="field-row">
          <label className="field">
            <span>{t('company.phone')}</span>
            <input value={form.phone} onChange={(e) => set('phone')(e.target.value)} dir="ltr" />
          </label>
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
        <label className="field">
          <span>{t('companies.password')}</span>
          <div className="field-row">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.initialPassword}
              onChange={(e) => set('initialPassword')(e.target.value)}
              dir="ltr"
              autoComplete="new-password"
              aria-invalid={showError && passwordIssue !== null}
            />
            <button
              type="button"
              className="btn"
              onClick={() => setShowPassword((shown) => !shown)}
            >
              {showPassword ? t('companies.passwordHide') : t('companies.passwordShow')}
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
        </label>
        <label className="field">
          <span>{t('company.pickup')}</span>
          <input
            value={form.pickupAddress}
            onChange={(e) => set('pickupAddress')(e.target.value)}
            dir="auto"
          />
        </label>
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
