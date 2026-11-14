import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '../firebase';

/** Firebase Authentication's own minimum. */
export const MIN_PASSWORD_LENGTH = 6;

export type PasswordChangeProblem = 'current-required' | 'too-short' | 'mismatch' | 'same';

/** What is wrong with the three fields before anything is sent, or null. */
export function passwordChangeProblem(
  current: string,
  next: string,
  confirm: string,
): PasswordChangeProblem | null {
  if (!current) return 'current-required';
  if (next.length < MIN_PASSWORD_LENGTH) return 'too-short';
  if (next !== confirm) return 'mismatch';
  if (next === current) return 'same';
  return null;
}

/**
 * Changes the signed-in admin's own password. The current one is checked again
 * first (Firebase asks for a recent sign-in before it changes a password).
 */
export async function changeOwnPassword(current: string, next: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw Object.assign(new Error('Not signed in.'), { code: 'auth/no-current-user' });
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
  await updatePassword(user, next);
}
