/*
 * Validation for the login a Platform Admin creates together with a company.
 * Pure functions so the same rules run in the form and in the tests.
 */

/** Firebase Authentication's own minimum; the platform asks for no more than that. */
export const MIN_PASSWORD_LENGTH = 6;

export type PasswordProblem = 'required' | 'tooShort';

/** Why the initial password is not acceptable, or null when it is. */
export function passwordProblem(password: string): PasswordProblem | null {
  if (password.length === 0) return 'required';
  if (password.length < MIN_PASSWORD_LENGTH) return 'tooShort';
  return null;
}

/** Firebase Authentication treats emails case-insensitively; store one form. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
