import { EN } from './i18nEn';

// The site is written in Arabic: each text is its own key, and English comes from
// the table in i18nEn.ts. Changing language reloads the page, so lists of labels
// built when a file loads are in the right language too.

export type Language = 'ar' | 'en';

const LANGUAGE_KEY = 'language';
const PENDING_KEY = 'language_pending_sync';

export const isLanguage = (v: unknown): v is Language => v === 'ar' || v === 'en';

function stored(): Language | null {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

export const language: Language = stored() ?? 'ar';

if (typeof document !== 'undefined') {
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  if (language === 'en') document.title = EN['سوق السودان للتقنية'] ?? document.title;
}

/** Whether this browser ever chose a language. */
export const hasChosenLanguage = (): boolean => stored() !== null;

/** The text in the reader's language, with {0}, {1} filled in. */
export function t(text: string, ...args: (string | number)[]): string {
  const base = language === 'en' ? EN[text] ?? text : text;
  return args.length === 0 ? base : base.replace(/\{(\d+)\}/g, (match, i) => String(args[Number(i)] ?? match));
}

/** The name a customer reads: the English one on the English site, or whichever exists. */
export const localName = (nameAr: string, nameEn: string): string =>
  language === 'en' ? nameEn.trim() || nameAr.trim() : nameAr.trim() || nameEn.trim();

/** Remembers the language on this device and opens the site in it. */
export function applyLanguage(next: Language): void {
  try {
    localStorage.setItem(LANGUAGE_KEY, next);
  } catch {
    return;
  }
  if (next !== language) window.location.reload();
}

/** A choice that could not reach the profile yet: the next visit sends it again. */
export function markLanguagePending(pending: boolean): void {
  try {
    if (pending) localStorage.setItem(PENDING_KEY, '1');
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // It stays on this device only.
  }
}

export function languageIsPending(): boolean {
  try {
    return localStorage.getItem(PENDING_KEY) === '1';
  } catch {
    return false;
  }
}
