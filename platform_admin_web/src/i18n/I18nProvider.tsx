import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ar, en, type TranslationKey } from './dictionary';

export type Locale = 'en' | 'ar';
const STORAGE_KEY = 'platform_admin_locale';

interface I18nValue {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  number: (value: number) => string;
  money: (value: number, currency?: string) => string;
  date: (value: Date | null) => string;
  dateTime: (value: Date | null) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

/** The language chosen in this browser, or null when none was ever chosen. */
export function readStoredLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ar') return stored;
  } catch {
    // localStorage can be unavailable (private mode); fall through.
  }
  return null;
}

// English when nothing has been chosen yet (the browser language is not used).
function initialLocale(): Locale {
  return readStoredLocale() ?? 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    const dict: Record<TranslationKey, string> = locale === 'ar' ? ar : en;
    document.title = `${dict['app.name']} - ${dict['app.role']}`;
  }, [locale, dir]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preference just won't persist.
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    // Latin digits in both languages so figures match the app and the data.
    const tag = locale === 'ar' ? 'ar-u-nu-latn' : 'en';
    const numberFmt = new Intl.NumberFormat(tag, { maximumFractionDigits: 2 });
    const dateFmt = new Intl.DateTimeFormat(tag, { dateStyle: 'medium' });
    const dateTimeFmt = new Intl.DateTimeFormat(tag, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const dict: Record<TranslationKey, string> = locale === 'ar' ? ar : en;
    return {
      locale,
      dir,
      setLocale,
      t: (key, vars) => {
        let text: string = dict[key];
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
          }
        }
        return text;
      },
      number: (v) => numberFmt.format(v),
      // LRI/PDI isolate the amount so "45,000 SDG" keeps its order in RTL text.
      money: (v, currency = 'SDG') => `⁦${numberFmt.format(v)} ${currency}⁩`,
      date: (d) => (d ? dateFmt.format(d) : '—'),
      dateTime: (d) => (d ? dateTimeFmt.format(d) : '—'),
    };
  }, [locale, dir, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
