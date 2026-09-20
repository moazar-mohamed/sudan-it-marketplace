import { useCallback } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '../components/feedback';
import { ar, en } from './dictionary';
import { useI18n, type Locale } from './I18nProvider';
import { saveLanguage } from './saveLanguage';

/**
 * Changes the dashboard language everywhere at once (texts and RTL/LTR),
 * remembers it in this browser and, when signed in, saves it to the user's
 * own profile. Used by the Settings page and the quick toggle.
 */
export function useChangeLanguage() {
  const { locale, setLocale } = useI18n();
  const { state } = useAuth();
  const toast = useToast();
  const uid = state.status === 'authorized' ? state.profile.uid : null;

  return useCallback(
    async (next: Locale) => {
      if (next === locale) return;
      setLocale(next);
      if (!uid) return;
      const saved = await saveLanguage(uid, next);
      // Said in the language just chosen, which is the one now on screen.
      if (!saved) toast((next === 'ar' ? ar : en)['settings.languageSaveFailed'], 'error');
    },
    [locale, setLocale, uid, toast],
  );
}
