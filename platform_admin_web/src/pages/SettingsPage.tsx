import { Card, PageHeader } from '../components/ui';
import { Icon } from '../components/Icon';
import { useI18n, type Locale } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/dictionary';
import { useChangeLanguage } from '../i18n/useChangeLanguage';

// Each language is named in its own language, so it can be found from either.
const LANGUAGES: { value: Locale; label: TranslationKey }[] = [
  { value: 'en', label: 'settings.languageEnglish' },
  { value: 'ar', label: 'settings.languageArabic' },
];

export function SettingsPage() {
  const { t, locale } = useI18n();
  const changeLanguage = useChangeLanguage();

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <Card>
        <fieldset className="option-list">
          <legend>
            <Icon name="globe" size={16} /> {t('common.language')}
          </legend>
          <p className="muted">{t('settings.languageHint')}</p>
          {LANGUAGES.map((option) => (
            <label
              key={option.value}
              className={locale === option.value ? 'option option--selected' : 'option'}
            >
              <input
                type="radio"
                name="language"
                value={option.value}
                checked={locale === option.value}
                onChange={() => void changeLanguage(option.value)}
              />
              <span lang={option.value}>{t(option.label)}</span>
            </label>
          ))}
        </fieldset>
      </Card>
    </>
  );
}
