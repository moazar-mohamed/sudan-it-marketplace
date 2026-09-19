import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, firebaseConfig } from '../firebase';
import { updateCustomerProfile } from './actions';

/*
 * Creating a REAL customer account from the browser, with no Admin SDK, no
 * Cloud Functions and no service-account key:
 *
 *  1. A second, throw-away Firebase app instance creates the Authentication
 *     account. Using a separate instance is what keeps the Platform Admin's own
 *     session untouched (createUserWithEmailAndPassword signs the new user in
 *     on whichever Auth instance it is called on).
 *  2. Still on that instance, the new user creates their OWN users/{uid}
 *     profile, exactly like a customer registering in the app. The existing
 *     rule for self-registration allows precisely this shape (role customer,
 *     isActive true, server timestamp), so nothing is widened for it.
 *  3. If the profile cannot be written, the new Auth account is deleted again
 *     so no login-less orphan is left behind.
 *  4. The account is created with a random password that nobody ever sees; the
 *     customer sets their own through a password-reset email.
 */

export interface NewCustomerInput {
  fullName: string;
  email: string;
  phone: string;
}

export interface NewCustomerResult {
  uid: string;
  /** The phone is added after creation (self-registration cannot carry one). */
  phoneSaved: boolean;
  /** The customer needs this email to set a password and sign in. */
  passwordEmailSent: boolean;
}

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createCustomerAccount(input: NewCustomerInput): Promise<NewCustomerResult> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();

  const provisioningApp = initializeApp(firebaseConfig, `customer-provisioning-${Date.now()}`);
  const provisioningAuth = getAuth(provisioningApp);
  let uid: string;
  try {
    const credential = await createUserWithEmailAndPassword(provisioningAuth, email, randomPassword());
    uid = credential.user.uid;
    try {
      await setDoc(doc(getFirestore(provisioningApp), 'users', uid), {
        id: uid,
        fullName,
        email,
        role: 'customer',
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

  // From here the account exists; anything that fails is reported, not thrown.
  let phoneSaved = phone === '';
  if (phone) {
    try {
      await updateCustomerProfile(uid, { fullName, phone });
      phoneSaved = true;
    } catch {
      phoneSaved = false;
    }
  }
  let passwordEmailSent = true;
  try {
    await sendPasswordResetEmail(auth, email);
  } catch {
    passwordEmailSent = false;
  }
  return { uid, phoneSaved, passwordEmailSent };
}
