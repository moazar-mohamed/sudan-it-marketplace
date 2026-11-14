import { EN } from './i18nEn';

// The panel is written in Arabic: each text is its own key, and English comes from
// the table in i18nEn.ts (a text missing there stays Arabic). Changing the language
// reloads the page, so labels built when a file loads are in the right language too.

export type Language = 'ar' | 'en';

const KEY = 'company-panel-language';

function stored(): Language | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'ar' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

export const language: Language = stored() ?? 'ar';

if (typeof document !== 'undefined') {
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  if (language === 'en') document.title = EN['لوحة الشركة'] ?? document.title;
}

/** The arrow that points the way a sentence reads: 'from → to'. */
export const ARROW = language === 'en' ? '→' : '←';

/** The text in the reader's language, with {0}, {1} filled in. */
export function t(text: string, ...args: (string | number | null | undefined)[]): string {
  const base = language === 'en' ? EN[text] ?? text : text;
  return args.length === 0 ? base : base.replace(/\{(\d+)\}/g, (match, i) => (Number(i) < args.length ? String(args[Number(i)] ?? '') : match));
}

/** Remembers the language on this device and reopens the panel in it. */
export function applyLanguage(next: Language): void {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    return;
  }
  if (next !== language) window.location.reload();
}
