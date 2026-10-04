import { NoticesSection } from '../components/NoticesCard';
import { Disclosure, PageHeader } from '../components/ui';
import { useI18n, type Locale } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/dictionary';
import { useChangeLanguage } from '../i18n/useChangeLanguage';
import { useTheme, type ThemePreference } from '../theme/theme';

// Each language is named in its own language, so it can be found from either.
const LANGUAGES: { value: Locale; label: TranslationKey }[] = [
  { value: 'en', label: 'settings.languageEnglish' },
  { value: 'ar', label: 'settings.languageArabic' },
];

const THEMES: { value: ThemePreference; label: TranslationKey }[] = [
  { value: 'system', label: 'settings.themeSystem' },
  { value: 'light', label: 'settings.themeLight' },
  { value: 'dark', label: 'settings.themeDark' },
];

export function SettingsPage() {
  const { t, locale } = useI18n();
  const changeLanguage = useChangeLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <>
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
      />
      <Disclosure
        title={t('common.language')}
        icon="globe"
        summary={t(LANGUAGES.find((l) => l.value === locale)?.label ?? 'settings.languageEnglish')}
      >
        <fieldset className="option-list" aria-label={t('common.language')}>
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
      </Disclosure>
      <Disclosure
        title={t('settings.theme')}
        icon="sun"
        summary={t(THEMES.find((o) => o.value === theme)?.label ?? 'settings.themeSystem')}
      >
        <fieldset className="option-list" aria-label={t('settings.theme')}>
          <p className="muted">{t('settings.themeHint')}</p>
          {THEMES.map((option) => (
            <label key={option.value} className={theme === option.value ? 'option option--selected' : 'option'}>
              <input
                type="radio"
                name="theme"
                value={option.value}
                checked={theme === option.value}
                onChange={() => setTheme(option.value)}
              />
              <span>{t(option.label)}</span>
            </label>
          ))}
        </fieldset>
      </Disclosure>
      <NoticesSection />
    </>
  );
}
