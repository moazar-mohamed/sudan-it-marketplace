import { deleteApp, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signOut,
} from 'firebase/auth';
import { collection, doc, getDoc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore';
import type { CompanyInput } from './actions';
import { isValidEmail, normalizeEmail, passwordProblem } from './companyAccount';
import { NO_IMAGE, type ImageSelection } from './imageRules';
import { toGeoPoint } from './location';

/*
 * Creating a company TOGETHER WITH the login its admin will use, from the
 * browser, with no Admin SDK, no Cloud Functions and no service-account key:
 *
 *  1. The company document id is generated first. It is the single source for
 *     the company-admin's `companyId`, so the two can never differ (not even
 *     in letter case, which is how a "C1" / "c1" mismatch happens when ids are
 *     typed by hand).
 *  2. A second, throw-away Firebase app instance creates the Firebase
 *     Authentication account with the initial password. A separate instance
 *     keeps the Platform Admin's own session untouched
 *     (createUserWithEmailAndPassword signs the new user in on whichever Auth
 *     instance it is called on). The password goes to Firebase Authentication
 *     only; it is never written to Firestore.
 *  3. The company and the company-admin's users/{uid} profile are written in
 *     ONE batch, so either both exist or neither does. The profile carries
 *     mustChangePassword: true, so the company must choose its own password on
 *     first login.
 *  4. If that batch is refused, the new Auth account is deleted again so no
 *     login-less orphan is left behind.
 */

export interface NewCompanyInput extends CompanyInput {
  /** Temporary password for the company's login; sent to Firebase Auth only. */
  initialPassword: string;
}

export interface ProvisionedAccount {
  uid: string;
  /** Deletes the just-created Authentication account. */
  rollback: () => Promise<void>;
  /** Signs the throw-away session out and discards its app instance. */
  close: () => Promise<void>;
}

export type AccountProvisioner = (email: string, password: string) => Promise<ProvisionedAccount>;

export interface ProvisionDeps {
  db: Firestore;
  provisionAccount: AccountProvisioner;
  resolveLogo: (logo: ImageSelection, storagePath: string) => Promise<string>;
}

export type CompanyAccountErrorCode =
  | 'company-account/invalid-email'
  | 'company-account/weak-password'
  | 'company-account/email-in-use'
  | 'company-account/link-mismatch';

/** A problem the Platform Admin can fix by changing the form. */
export class CompanyAccountError extends Error {
  readonly code: CompanyAccountErrorCode;
  constructor(code: CompanyAccountErrorCode) {
    super(code);
    this.name = 'CompanyAccountError';
    this.code = code;
  }
}

function toCompanyAccountError(error: unknown): unknown {
  switch ((error as { code?: string } | null)?.code) {
    case 'auth/email-already-in-use':
      return new CompanyAccountError('company-account/email-in-use');
    case 'auth/invalid-email':
      return new CompanyAccountError('company-account/invalid-email');
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return new CompanyAccountError('company-account/weak-password');
    default:
      return error;
  }
}

/** The account provisioner used by the dashboard (and, with an emulator URL, by tests). */
export function secondaryAppProvisioner(
  config: FirebaseOptions,
  options: { authEmulatorUrl?: string } = {},
): AccountProvisioner {
  return async (email, password) => {
    const app = initializeApp(
      config,
      `company-provisioning-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const auth = getAuth(app);
    if (options.authEmulatorUrl) {
      connectAuthEmulator(auth, options.authEmulatorUrl, { disableWarnings: true });
    }
    const close = async () => {
      await signOut(auth).catch(() => undefined);
      await deleteApp(app).catch(() => undefined);
    };
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      return {
        uid: credential.user.uid,
        rollback: async () => {
          await deleteUser(credential.user).catch(() => undefined);
        },
        close,
      };
    } catch (error) {
      await close();
      throw error;
    }
  };
}

/** The company document exactly as before; the email is stored in login form. */
function companyDocument(input: CompanyInput, email: string, logoUrl: string) {
  // Coordinates are saved as numbers and only when a real point was picked;
  // a text-only company simply has no latitude/longitude fields.
  const point = toGeoPoint(input.latitude, input.longitude);
  return {
    name: input.name.trim(),
    logoUrl,
    description: input.description.trim(),
    city: input.city.trim(),
    address: input.address.trim(),
    ...(point ? { latitude: point.latitude, longitude: point.longitude } : {}),
    phone: input.phone.trim(),
    email,
    pickupAddress: input.pickupAddress.trim(),
    rating: 0,
    reviewCount: 0,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function createCompanyWithAdminAccount(
  input: NewCompanyInput,
  deps: ProvisionDeps,
): Promise<{ companyId: string; uid: string }> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw new CompanyAccountError('company-account/invalid-email');
  if (passwordProblem(input.initialPassword)) {
    throw new CompanyAccountError('company-account/weak-password');
  }

  const companyRef = doc(collection(deps.db, 'companies'));
  const logoUrl = await deps.resolveLogo(input.logo ?? NO_IMAGE, `company-logos/${companyRef.id}`);

  let account: ProvisionedAccount;
  try {
    account = await deps.provisionAccount(email, input.initialPassword);
  } catch (error) {
    throw toCompanyAccountError(error);
  }

  try {
    const batch = writeBatch(deps.db);
    batch.set(companyRef, companyDocument(input, email, logoUrl));
    // No password field, ever: it lives only in Firebase Authentication.
    batch.set(doc(deps.db, 'users', account.uid), {
      id: account.uid,
      fullName: input.name.trim(),
      email,
      role: 'company_admin',
      companyId: companyRef.id,
      isActive: true,
      mustChangePassword: true,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    await account.rollback();
    throw error;
  } finally {
    await account.close();
  }
  await verifyCompanyLink(deps.db, companyRef.id, account.uid);
  return { companyId: companyRef.id, uid: account.uid };
}

/**
 * Reads back what was just written and checks the link character for
 * character: companies/{companyId} exists and the admin profile's companyId is
 * exactly that id. (If the documents cannot be read the check is skipped; it
 * never undoes a creation that already succeeded.)
 */
async function verifyCompanyLink(db: Firestore, companyId: string, uid: string): Promise<void> {
  let company;
  let profile;
  try {
    company = await getDoc(doc(db, 'companies', companyId));
    profile = await getDoc(doc(db, 'users', uid));
  } catch {
    return;
  }
  if (!company.exists() || profile.data()?.companyId !== companyId) {
    throw new CompanyAccountError('company-account/link-mismatch');
  }
}
