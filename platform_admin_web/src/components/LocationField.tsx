import { formatCoordinate, type GeoPoint } from '../data/location';
import { useI18n } from '../i18n/I18nProvider';

/**
 * Both ways to give a location: type the address, and/or pick the exact point
 * on a map. The map is an addition, never a replacement: the text input is
 * always available and works without any browser permission.
 */
export function LocationField({
  address,
  onAddressChange,
  point,
  onSelectOnMap,
  onRemovePoint,
  disabled,
}: {
  address: string;
  onAddressChange: (value: string) => void;
  point: GeoPoint | null;
  onSelectOnMap: () => void;
  onRemovePoint: () => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="location-field">
      <span className="location-field__title">{t('location.title')}</span>
      <label className="field">
        <input
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder={t('location.enterAddress')}
          aria-label={t('location.enterAddress')}
          dir="auto"
          disabled={disabled}
        />
      </label>
      <div className="or-divider">{t('location.or')}</div>
      {point ? (
        <div className="location-selected">
          <strong>📍 {t('location.selected')}</strong>
          <div className="location-selected__coords">
            <span>
              {t('location.lat')}: <bdi dir="ltr">{formatCoordinate(point.latitude)}</bdi>
            </span>
            <span>
              {t('location.lng')}: <bdi dir="ltr">{formatCoordinate(point.longitude)}</bdi>
            </span>
          </div>
          <div className="location-selected__actions">
            <button type="button" className="btn" onClick={onSelectOnMap} disabled={disabled}>
              {t('location.change')}
            </button>
            <button type="button" className="btn" onClick={onRemovePoint} disabled={disabled}>
              {t('location.remove')}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn" onClick={onSelectOnMap} disabled={disabled}>
          📍 {t('location.selectOnMap')}
        </button>
      )}
    </div>
  );
}
