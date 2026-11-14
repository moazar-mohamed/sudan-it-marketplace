import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

/** The admin's own display name (the rules let anyone change their own name and nothing else here). */
export async function saveOwnName(uid: string, fullName: string): Promise<void> {
  const name = fullName.trim();
  if (!name) throw Object.assign(new Error('Name is required.'), { code: 'profile/name-required' });
  await updateDoc(doc(db, 'users', uid), { fullName: name, updatedAt: serverTimestamp() });
}

/**
 * After the email was changed through the confirmation link, the profile still
 * holds the old one: bring it in line. Best effort; returns whether it saved.
 */
export async function syncOwnEmail(uid: string, signInEmail: string, storedEmail: string): Promise<boolean> {
  if (!signInEmail || signInEmail.toLowerCase() === storedEmail.toLowerCase()) return false;
  try {
    await updateDoc(doc(db, 'users', uid), { email: signInEmail, updatedAt: serverTimestamp() });
    return true;
  } catch {
    return false;
  }
}
