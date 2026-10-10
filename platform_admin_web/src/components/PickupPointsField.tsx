import { useI18n } from '../i18n/I18nProvider';
import type { PickupPointInput } from '../data/actions';

export const MAX_PICKUP_POINTS = 5;
const MAX_NAME = 60;
const MAX_ADDRESS = 200;

/**
 * Where customers collect orders: the company's own location (no points, the
 * default) or up to five points, each with a name and an address. A company
 * adds map pins to its points later, from its own app.
 */
export function PickupPointsField({
  value,
  onChange,
  disabled,
  showError,
}: {
  value: PickupPointInput[];
  onChange: (next: PickupPointInput[]) => void;
  disabled?: boolean;
  showError?: boolean;
}) {
  const { t } = useI18n();
  const custom = value.length > 0;
  const patch = (index: number, change: Partial<PickupPointInput>) =>
    onChange(value.map((point, i) => (i === index ? { ...point, ...change } : point)));

  return (
    <fieldset className="field" disabled={disabled}>
      <legend>{t('company.pickup')}</legend>
      <label className="radio-row">
        <input
          type="radio"
          name="pickup-mode"
          checked={!custom}
          onChange={() => onChange([])}
        />{' '}
        <span>{t('pickup.modeCompany')}</span>
      </label>
      <small className="note">{t('pickup.modeCompanyHint')}</small>
      <label className="radio-row">
        <input
          type="radio"
          name="pickup-mode"
          checked={custom}
          onChange={() => onChange(custom ? value : [{ name: '', address: '' }])}
        />{' '}
        <span>{t('pickup.modeCustom')}</span>
      </label>
      {custom && (
        <div className="form-sections">
          {value.map((point, index) => {
            const incomplete = !point.name.trim() || !point.address.trim();
            return (
              <div className="field-row" key={index}>
                <label className="field">
                  <span>{t('pickup.pointName', { n: index + 1 })}</span>
                  <input
                    value={point.name}
                    maxLength={MAX_NAME}
                    dir="auto"
                    placeholder={t('pickup.pointNameHint')}
                    onChange={(e) => patch(index, { name: e.target.value })}
                    aria-invalid={showError && !point.name.trim()}
                  />
                </label>
                <label className="field">
                  <span>{t('pickup.pointAddress')}</span>
                  <input
                    value={point.address}
                    maxLength={MAX_ADDRESS}
                    dir="auto"
                    onChange={(e) => patch(index, { address: e.target.value })}
                    aria-invalid={showError && !point.address.trim()}
                  />
                </label>
                <button
                  type="button"
                  className="btn"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                >
                  {t('pickup.removePoint')}
                </button>
                {showError && incomplete && (
                  <small className="field__error">{t('pickup.pointIncomplete')}</small>
                )}
              </div>
            );
          })}
          {value.length < MAX_PICKUP_POINTS && (
            <button
              type="button"
              className="btn"
              onClick={() => onChange([...value, { name: '', address: '' }])}
            >
              {t('pickup.addPoint')}
            </button>
          )}
          <small className="note">{t('pickup.pointsHint', { max: MAX_PICKUP_POINTS })}</small>
        </div>
      )}
    </fieldset>
  );
}

/** True when a point is missing its name or its address. */
export const pickupPointsIncomplete = (points: PickupPointInput[] | undefined) =>
  (points ?? []).some((point) => !point.name.trim() || !point.address.trim());
