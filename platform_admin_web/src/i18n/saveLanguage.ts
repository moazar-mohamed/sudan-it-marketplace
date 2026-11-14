import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Locale } from './I18nProvider';

const PENDING_KEY = 'platform_admin_language_pending';

export function isLanguagePending(): boolean {
  try {
    return localStorage.getItem(PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

function setPending(value: boolean) {
  try {
    if (value) localStorage.setItem(PENDING_KEY, '1');
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // Storage unavailable: the choice just is not remembered as pending.
  }
}

/**
 * Stores the chosen language on the signed-in user's own profile document.
 * The security rules allow exactly this edit (only `language`, only en/ar).
 * Returns false when it could not be saved; the language is still changed in
 * this browser, and the save is retried at the next sign-in.
 */
export async function saveLanguage(uid: string, locale: Locale): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'users', uid), { language: locale });
    setPending(false);
    return true;
  } catch {
    setPending(true);
    return false;
  }
}
