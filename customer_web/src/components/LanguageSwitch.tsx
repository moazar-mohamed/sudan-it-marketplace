import { saveLanguage } from '../data/account';
import { applyLanguage, language, markLanguagePending, t } from '../i18n';
import type { Language } from '../i18n';

/** Each language is named in itself, so it can be found from the other one. */
export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
];

/**
 * Changes the language the way Settings does: on this device at once, and in the
 * profile; a save that fails is sent again on the next visit. A visitor (no
 * [uid]) keeps it on this device only, and it reaches the profile at sign-in.
 */
export async function switchLanguage(uid: string | null, next: Language): Promise<void> {
  if (uid !== null) markLanguagePending(!(await saveLanguage(uid, next)));
  applyLanguage(next);
}

/** The site header's one-press switch: shows the language it changes to. */
export function LanguageButton({ uid }: { uid: string | null }) {
  const next: Language = language === 'ar' ? 'en' : 'ar';
  const target = LANGUAGES.find((l) => l.value === next)!;
  return (
    <button type="button" className="lang-btn" onClick={() => switchLanguage(uid, next)} aria-label={`${t('اللغة')}: ${target.label}`} title={target.label}>
      {next === 'en' ? 'EN' : 'ع'}
    </button>
  );
}

/** On the sign-in pages, where Settings cannot be reached yet. */
export function LanguageSwitch() {
  return (
    <div className="language-switch">
      {LANGUAGES.filter((l) => l.value !== language).map((l) => (
        <button key={l.value} type="button" className="link-btn" onClick={() => applyLanguage(l.value)}>{l.label}</button>
      ))}
    </div>
  );
}
