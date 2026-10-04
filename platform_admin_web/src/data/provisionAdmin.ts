import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../firebase';

/*
 * Adding another Platform Admin from the browser, with no Admin SDK and no
 * Cloud Functions:
 *
 *  1. A second, throw-away Firebase app instance creates the Authentication
 *     account, so the signed-in admin's own session is untouched.
 *  2. The CURRENT admin (not the new account) writes users/{uid} with role
 *     platform_admin. The rules allow exactly that shape, only to an active
 *     admin, only for a profile that does not exist yet.
 *  3. If the profile cannot be written the new Auth account is deleted again,
 *     so no login-less account is left behind.
 *  4. The account gets a random password nobody sees; the new admin sets their
 *     own through a password-reset email.
 */

export interface NewAdminInput {
  fullName: string;
  email: string;
}

export interface NewAdminResult {
  uid: string;
  /** The new admin needs this email to set a password and sign in. */
  passwordEmailSent: boolean;
}

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createAdminAccount(input: NewAdminInput): Promise<NewAdminResult> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();

  const provisioningApp = initializeApp(firebaseConfig, `admin-provisioning-${Date.now()}`);
  const provisioningAuth = getAuth(provisioningApp);
  let uid: string;
  try {
    const credential = await createUserWithEmailAndPassword(provisioningAuth, email, randomPassword());
    uid = credential.user.uid;
    try {
      await setDoc(doc(db, 'users', uid), {
        id: uid,
        fullName,
        email,
        role: 'platform_admin',
        isActive: true,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      await deleteUser(credential.user).catch(() => undefined);
      throw error;
    }
  } finally {
    await signOut(provisioningAuth).catch(() => undefined);
    await deleteApp(provisioningApp).catch(() => undefined);
  }

  // From here the account exists; a failed email is reported, not thrown.
  let passwordEmailSent = true;
  try {
    await sendPasswordResetEmail(auth, email);
  } catch {
    passwordEmailSent = false;
  }
  return { uid, passwordEmailSent };
}
