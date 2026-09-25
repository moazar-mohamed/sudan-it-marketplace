import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import type { Locale } from '../i18n/I18nProvider';

/**
 * Asks Firebase Authentication to e-mail a password-reset link. `locale`
 * ('en' | 'ar') picks the language of the e-mail. Firebase may report success
 * for an address that has no account; callers must not reveal the difference.
 */
export async function requestPasswordReset(email: string, locale: Locale): Promise<void> {
  auth.languageCode = locale;
  await sendPasswordResetEmail(auth, email.trim());
}
