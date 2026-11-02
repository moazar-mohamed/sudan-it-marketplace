import { Link } from 'react-router-dom';
import { Icon, PATHS } from '../components/Icon';
import { LANGUAGES } from '../components/LanguageSwitch';
import { saveLanguage } from '../data/account';
import { useCatalog } from '../data/DataProvider';
import { useTheme } from '../theme';
import type { ThemeChoice } from '../theme';
import { applyLanguage, language, markLanguagePending, t } from '../i18n';
import type { Language } from '../i18n';

const THEMES: { value: ThemeChoice; label: string; hint?: string }[] = [
  { value: 'system', label: t('حسب الجهاز'), hint: t('يتبع إعداد جهازك') },
  { value: 'light', label: t('فاتح') },
  { value: 'dark', label: t('داكن') },
];

export function SettingsPage() {
  const { choice, pick } = useTheme();
  const { profile } = useCatalog();

  async function changeLanguage(next: Language) {
    // Changed on this device either way; a failed save is sent again on the next visit.
    markLanguagePending(!(await saveLanguage(profile.id, next)));
    applyLanguage(next);
  }

  return (
    <main className="stack narrow">
      <h1 className="page-title">{t('الإعدادات')}</h1>
      <section className="tile" aria-label={t('المظهر')}>
        <h2>{t('المظهر')}</h2>
        {THEMES.map((t) => (
          <label key={t.value} className="check">
            <input type="radio" name="theme" checked={choice === t.value} onChange={() => pick(t.value)} />
            <span>
              {t.label}
              {t.hint && <span className="pmeta" style={{ display: 'block' }}>{t.hint}</span>}
            </span>
          </label>
        ))}
      </section>
      <section className="tile" aria-label={t('اللغة')}>
        <h2>{t('اللغة')}</h2>
        {LANGUAGES.map((l) => (
          <label key={l.value} className="check">
            <input type="radio" name="language" checked={language === l.value} onChange={() => changeLanguage(l.value)} />
            <span>{l.label}</span>
          </label>
        ))}
      </section>
      <h2 className="group-title">{t('المساعدة')}</h2>
      <section className="rows" aria-label={t('المساعدة')}>
        <Link className="row" to="/reports/new">
          <Icon d={PATHS.flag} />
          <span className="grow">{t('الإبلاغ عن مشكلة')}</span>
        </Link>
        <Link className="row" to="/reports">
          <Icon d={PATHS.box} />
          <span className="grow">{t('بلاغاتي')}</span>
        </Link>
      </section>
    </main>
  );
}
