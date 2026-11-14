import { useI18n } from '../i18n/I18nProvider';

/**
 * What a form field asks of the person, beside its label: a fine asterisk for a
 * field that must be filled, and a quiet "Optional" tag for one that need not
 * be. Only the forms that say so use them; a form that marks nothing looks as
 * it always did.
 */
export function RequiredMark() {
  const { t } = useI18n();
  const label = t('field.required');
  return (
    <span className="field-mark field-mark--required" role="img" aria-label={label} title={label}>
      <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true" focusable="false">
        <path
          d="M5 .8v8.4M1.36 2.9l7.28 4.2M1.36 7.1l7.28-4.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function OptionalMark() {
  const { t } = useI18n();
  return <span className="field-mark field-mark--optional">{t('field.optional')}</span>;
}
