import type { Locale } from './I18nProvider';

export interface LanguagePlan {
  /** Show this language (the account's stored one). */
  adopt?: Locale;
  /** Save this language (the one chosen on this browser) to the account. */
  push?: Locale;
}

/**
 * Decides how the language of a browser and the language stored on the
 * signed-in user's profile (users/{uid}.language) come together:
 *
 * 1. a valid language on the profile wins,
 * 2. otherwise the language chosen on this browser is saved to the profile,
 * 3. otherwise nothing changes (English stays the default).
 *
 * `pending` means a choice made on this browser could not be saved yet, so it
 * is pushed instead of being overwritten by the older stored value.
 */
export function reconcileLanguage(
  remote: Locale | undefined,
  local: Locale | null,
  pending: boolean,
): LanguagePlan {
  if (remote && !pending) return { adopt: remote };
  if (local) return { push: local };
  return {};
}
