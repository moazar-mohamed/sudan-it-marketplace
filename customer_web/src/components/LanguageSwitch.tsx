import { applyLanguage, language } from '../i18n';
import type { Language } from '../i18n';

/** Each language is named in itself, so it can be found from the other one. */
export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
];

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
