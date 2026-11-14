import { useI18n } from '../i18n/I18nProvider';
import { Icon } from './Icon';

/** Tells the admin a list is narrowed to what the dashboard flagged, and lets them undo it. */
export function AttentionBanner({ label, onClear }: { label: string; onClear: () => void }) {
  const { t } = useI18n();
  return (
    <div className="attention-banner" role="status">
      <Icon name="alert" size={16} />
      <span>{t('attention.showing', { label })}</span>
      <button className="btn btn--sm" onClick={onClear}>
        {t('attention.clear')}
      </button>
    </div>
  );
}
