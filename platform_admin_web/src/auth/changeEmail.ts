import { EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail } from 'firebase/auth';
import { auth } from '../firebase';

export type EmailChangeProblem = 'password-required' | 'invalid' | 'same';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What is wrong with the two fields before anything is sent, or null. */
export function emailChangeProblem(current: string, next: string, currentEmail: string): EmailChangeProblem | null {
  if (!current) return 'password-required';
  const email = next.trim();
  if (!EMAIL.test(email)) return 'invalid';
  if (email.toLowerCase() === currentEmail.toLowerCase()) return 'same';
  return null;
}

/**
 * Asks Firebase to change the signed-in admin's email: the current password is
 * checked again, then a confirmation link goes to the NEW address. The email
 * only changes when that link is opened.
 */
export async function requestOwnEmailChange(currentPassword: string, newEmail: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw Object.assign(new Error('Not signed in.'), { code: 'auth/no-current-user' });
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await verifyBeforeUpdateEmail(user, newEmail.trim());
}
