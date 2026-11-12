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
  await sendPasswordResetEmail(auth, email.trim(), returnHere());
}

/**
 * On the panel's own domain the e-mail's "Continue" button leads back to
 * https://admin.sictm.net, not to the old web.app address. Elsewhere (the
 * web.app link, a local test) Firebase keeps its default, no continue link.
 */
function returnHere() {
  if (typeof window === 'undefined' || window.location.hostname !== 'admin.sictm.net') return undefined;
  return { url: 'https://admin.sictm.net/' };
}
