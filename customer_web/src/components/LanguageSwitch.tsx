import { useState } from 'react';
import { saveLanguage } from '../data/account';
import { applyLanguage, language, markLanguagePending, t } from '../i18n';
import type { Language } from '../i18n';
import { BusyLabel } from './BusyLabel';

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
  if (uid !== null) {
    // A slow connection never holds the page: after two seconds it switches anyway,
    // and an unconfirmed save is sent again on the next visit.
    const late = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000));
    markLanguagePending(!(await Promise.race([saveLanguage(uid, next), late])));
  }
  applyLanguage(next);
}

/** The site header's one-press switch: shows the language it changes to. */
export function LanguageButton({ uid }: { uid: string | null }) {
  const next: Language = language === 'ar' ? 'en' : 'ar';
  const target = LANGUAGES.find((l) => l.value === next)!;
  const [busy, setBusy] = useState(false);
  function change() {
    if (busy) return;
    setBusy(true);
    void switchLanguage(uid, next);
  }
  return (
    <button type="button" className="lang-btn" disabled={busy} aria-busy={busy} onClick={change} aria-label={busy ? t('جارٍ تغيير اللغة…') : `${t('اللغة')}: ${target.label}`} title={target.label}>
      <BusyLabel busy={busy}>{next === 'en' ? 'EN' : 'ع'}</BusyLabel>
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
