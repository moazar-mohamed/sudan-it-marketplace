import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { useChangeLanguage } from '../i18n/useChangeLanguage';
import { useTheme, type ThemePreference } from '../theme/theme';
import { useUi, type Density } from '../theme/ui';
import { Icon } from './Icon';

const THEME_CHOICES: { value: ThemePreference; key: 'settings.themeSystem' | 'settings.themeLight' | 'settings.themeDark' }[] = [
  { value: 'system', key: 'settings.themeSystem' },
  { value: 'light', key: 'settings.themeLight' },
  { value: 'dark', key: 'settings.themeDark' },
];

const DENSITY_CHOICES: { value: Density; key: 'userMenu.densityComfortable' | 'userMenu.densityCompact' }[] = [
  { value: 'comfortable', key: 'userMenu.densityComfortable' },
  { value: 'compact', key: 'userMenu.densityCompact' },
];

/**
 * The person's own menu in the top bar (redesign): profile and password, language,
 * appearance, density, the way back to the previous look, and signing out.
 */
export function UserMenu({ name, email }: { name: string; email: string }) {
  const { t, locale } = useI18n();
  const { signOut } = useAuth();
  const changeLanguage = useChangeLanguage();
  const { theme, setTheme } = useTheme();
  const { density, setDensity, setUi } = useUi();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Closes with Escape or a press outside.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onPress = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPress);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPress);
    };
  }, [open]);

  const initial = (name || email || 'A').charAt(0).toUpperCase();

  return (
    <div className="v2-user" ref={box}>
      <button
        type="button"
        className="v2-user__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('userMenu.title')}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="v2-user__avatar">{initial}</span>
        <span className="v2-user__name">
          <bdi>{name || email}</bdi>
        </span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div className="v2-user__menu" role="menu" aria-label={t('userMenu.title')}>
          <div className="v2-user__who">
            <span className="v2-user__avatar v2-user__avatar--lg">{initial}</span>
            <span>
              <strong>
                <bdi>{name || email}</bdi>
              </strong>
              <small>
                <bdi>{email}</bdi>
              </small>
            </span>
          </div>
          <Link to="/profile" role="menuitem" className="v2-user__item" onClick={() => setOpen(false)}>
            <Icon name="profile" size={18} />
            {t('userMenu.profile')}
          </Link>
          <Link to="/profile" role="menuitem" className="v2-user__item" onClick={() => setOpen(false)}>
            <Icon name="shield" size={18} />
            {t('userMenu.password')}
          </Link>

          <div className="v2-user__row">
            <span>{t('userMenu.language')}</span>
            <div className="v2-user__seg" role="group" aria-label={t('userMenu.language')}>
              <button type="button" role="menuitemradio" aria-checked={locale === 'ar'} onClick={() => void changeLanguage('ar')}>
                {t('settings.languageArabic')}
              </button>
              <button type="button" role="menuitemradio" aria-checked={locale === 'en'} onClick={() => void changeLanguage('en')}>
                {t('settings.languageEnglish')}
              </button>
            </div>
          </div>
          <div className="v2-user__row">
            <span>{t('settings.theme')}</span>
            <div className="v2-user__seg" role="group" aria-label={t('settings.theme')}>
              {THEME_CHOICES.map((c) => (
                <button key={c.value} type="button" role="menuitemradio" aria-checked={theme === c.value} onClick={() => setTheme(c.value)}>
                  {t(c.key)}
                </button>
              ))}
            </div>
          </div>
          <div className="v2-user__row">
            <span>{t('userMenu.density')}</span>
            <div className="v2-user__seg" role="group" aria-label={t('userMenu.density')}>
              {DENSITY_CHOICES.map((c) => (
                <button key={c.value} type="button" role="menuitemradio" aria-checked={density === c.value} onClick={() => setDensity(c.value)}>
                  {t(c.key)}
                </button>
              ))}
            </div>
          </div>

          <button type="button" role="menuitem" className="v2-user__item" onClick={() => setUi('v1')}>
            <Icon name="back" size={18} flipInRtl />
            {t('userMenu.previousLook')}
          </button>
          <button type="button" role="menuitem" className="v2-user__item v2-user__item--danger" onClick={() => void signOut()}>
            <Icon name="logout" size={18} />
            {t('common.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}
