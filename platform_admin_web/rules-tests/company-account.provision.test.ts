/*
 * The real company-creation code (data/provisionCompany.ts) run against the
 * Firebase AUTH emulator and the Firestore emulator with the project's rules:
 * the login is created in Firebase Authentication, the company and its admin
 * profile are linked by the exact id, and the password never reaches Firestore.
 * Runs only under `npm run test:rules` (which starts the Auth emulator too).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  updatePassword,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { isValidEmail, MIN_PASSWORD_LENGTH, normalizeEmail, passwordProblem } from '../src/data/companyAccount';
import {
  CompanyAccountError,
  createCompanyWithAdminAccount,
  secondaryAppProvisioner,
  type NewCompanyInput,
  type ProvisionDeps,
} from '../src/data/provisionCompany';

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const PROJECT = 'demo-sudan-rules';
const fakeConfig = { apiKey: 'fake-api-key', projectId: PROJECT, authDomain: `${PROJECT}.firebaseapp.com` };

let env: RulesTestEnvironment;

beforeAll(async () => {
  if (!authHost) return;
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: {
      rules: readFileSync(
        process.env.RULES_FILE ?? fileURLToPath(new URL('../../firestore.rules', import.meta.url)),
        'utf8',
      ),
    },
  });
});
afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  if (!authHost) return;
  // Each test starts with no Auth accounts and no documents.
  await fetch(`http://${authHost}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [id, role] of [
      ['admin', 'platform_admin'],
      ['cust1', 'customer'],
    ]) {
      await setDoc(doc(db, 'users', id), {
        id,
        fullName: id,
        email: `${id}@x.test`,
        role,
        isActive: true,
        createdAt: new Date(),
      });
    }
  });
});

const input = (extra: Partial<NewCompanyInput> = {}): NewCompanyInput => ({
  name: 'ABC Technology',
  description: 'Networking',
  city: 'Khartoum',
  address: 'Street 1',
  latitude: null,
  longitude: null,
  phone: '0911111111',
  email: 'Abc@Gmail.com',
  pickupAddress: 'Depot',
  initialPassword: 'Abc@2026',
  ...extra,
});

const deps = (who = 'admin'): ProvisionDeps => ({
  db: env.authenticatedContext(who).firestore(),
  provisionAccount: secondaryAppProvisioner(fakeConfig, { authEmulatorUrl: `http://${authHost}` }),
  resolveLogo: async () => '',
});

/** Signs in through the Auth emulator exactly as the company's app would. */
async function signIn(email: string, password: string) {
  const app = initializeApp(fakeConfig, `verify-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
    return (await signInWithEmailAndPassword(auth, email, password)).user.uid;
  } finally {
    await deleteApp(app);
  }
}

/**
 * The steps the company app takes on first login: sign in with the temporary
 * password, re-authenticate with it, then set the new password.
 */
async function changePasswordLikeTheApp(email: string, temporary: string, next: string) {
  const app = initializeApp(fakeConfig, `change-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
    const { user } = await signInWithEmailAndPassword(auth, email, temporary);
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, temporary));
    await updatePassword(user, next);
  } finally {
    await deleteApp(app);
  }
}

async function allDocuments() {
  const dump: Record<string, unknown> = {};
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const name of ['users', 'companies', 'products', 'orders']) {
      const snap = await getDocs(collection(ctx.firestore(), name));
      snap.forEach((d) => (dump[`${name}/${d.id}`] = d.data()));
    }
  });
  return dump;
}

describe('validation', () => {
  it('requires at least 6 characters (the Firebase Authentication minimum)', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(6);
    expect(passwordProblem('')).toBe('required');
    expect(passwordProblem('12345')).toBe('tooShort');
    expect(passwordProblem('Abc@2')).toBe('tooShort');
    expect(passwordProblem('Abc@20')).toBeNull(); // exactly 6
    expect(passwordProblem('Abc@2026')).toBeNull();
    expect(passwordProblem('      ')).toBeNull(); // 6 characters, spaces included
  });

  it('normalizes and checks the email', () => {
    expect(normalizeEmail('  Abc@Gmail.com ')).toBe('abc@gmail.com');
    expect(isValidEmail('abc@gmail.com')).toBe(true);
    expect(isValidEmail('abc@gmail')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('a b@gmail.com')).toBe(false);
  });
});

describe.skipIf(!authHost)('creating a company with an initial password', () => {
  it('creates a Firebase Auth account that can sign in immediately', async () => {
    const { uid } = await createCompanyWithAdminAccount(input(), deps());
    expect(await signIn('abc@gmail.com', 'Abc@2026')).toBe(uid);
  });

  it('accepts a password of exactly 6 characters and it can sign in (Firebase minimum)', async () => {
    const { uid } = await createCompanyWithAdminAccount(input({ initialPassword: 'Abc@20' }), deps());
    expect(await signIn('abc@gmail.com', 'Abc@20')).toBe(uid);
  });

  it('links the profile to the company by the exact id (including case)', async () => {
    const { companyId, uid } = await createCompanyWithAdminAccount(input(), deps());

    let profile: Record<string, unknown> | undefined;
    let company: Record<string, unknown> | undefined;
    await env.withSecurityRulesDisabled(async (ctx) => {
      profile = (await getDoc(doc(ctx.firestore(), 'users', uid))).data();
      company = (await getDoc(doc(ctx.firestore(), 'companies', companyId))).data();
    });

    expect(company).toBeDefined();
    expect(profile?.companyId).toBe(companyId); // strict equality: same case, same characters
    expect(profile?.id).toBe(uid);
    expect(profile?.role).toBe('company_admin');
    expect(profile?.mustChangePassword).toBe(true);
    expect(profile?.isActive).toBe(true);
    expect(profile?.email).toBe('abc@gmail.com');
    expect(company?.name).toBe('ABC Technology');
    expect(company?.status).toBe('active');
    expect(company?.email).toBe('abc@gmail.com');
    // Firestore auto ids mix upper and lower case, which is why they must not be retyped.
    expect(companyId).toMatch(/[A-Z]/);
  });

  it('never writes the plaintext password to Firestore', async () => {
    await createCompanyWithAdminAccount(input({ initialPassword: 'Sup3r-Secret-Pw!' }), deps());
    const dump = await allDocuments();
    expect(Object.keys(dump).length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(dump)).not.toContain('Sup3r-Secret-Pw!');
    for (const data of Object.values(dump) as Record<string, unknown>[]) {
      // (mustChangePassword is a boolean flag, not a password.)
      expect(Object.keys(data).filter((k) => /^(password|initialPassword|pwd|secret)$/i.test(k))).toEqual([]);
    }
  });

  it('the company may keep the temporary password when it completes the change', async () => {
    const { uid } = await createCompanyWithAdminAccount(input({ initialPassword: '123456' }), deps());
    await changePasswordLikeTheApp('abc@gmail.com', '123456', '123456'); // new == temporary
    expect(await signIn('abc@gmail.com', '123456')).toBe(uid);
  });

  it('the company may choose a different password when it completes the change', async () => {
    const { uid } = await createCompanyWithAdminAccount(input({ initialPassword: '123456' }), deps());
    await changePasswordLikeTheApp('abc@gmail.com', '123456', 'abc123'); // new != temporary
    expect(await signIn('abc@gmail.com', 'abc123')).toBe(uid);
    await expect(signIn('abc@gmail.com', '123456')).rejects.toBeDefined(); // old one no longer works
  });

  it('a wrong temporary password cannot start the change', async () => {
    await createCompanyWithAdminAccount(input({ initialPassword: '123456' }), deps());
    await expect(changePasswordLikeTheApp('abc@gmail.com', '654321', 'abc123')).rejects.toBeDefined();
    expect(await signIn('abc@gmail.com', '123456')).toBeDefined(); // unchanged
  });

  it('rejects a short or empty password before anything is created', async () => {
    for (const initialPassword of ['', '12345', 'short', 'Abc@2']) {
      await expect(
        createCompanyWithAdminAccount(input({ initialPassword }), deps()),
      ).rejects.toMatchObject({ code: 'company-account/weak-password' });
    }
    expect(Object.keys(await allDocuments()).filter((k) => k.startsWith('companies/'))).toHaveLength(0);
    await expect(signIn('abc@gmail.com', 'short')).rejects.toBeDefined();
  });

  it('rejects an invalid email before anything is created', async () => {
    await expect(
      createCompanyWithAdminAccount(input({ email: 'not-an-email' }), deps()),
    ).rejects.toBeInstanceOf(CompanyAccountError);
    expect(Object.keys(await allDocuments()).filter((k) => k.startsWith('companies/'))).toHaveLength(0);
  });

  it('refuses an email that already has an account, and creates no second company', async () => {
    const first = await createCompanyWithAdminAccount(input(), deps());
    await expect(
      createCompanyWithAdminAccount(input({ name: 'Second', initialPassword: 'Different@2026' }), deps()),
    ).rejects.toMatchObject({ code: 'company-account/email-in-use' });

    const companies = Object.keys(await allDocuments()).filter((k) => k.startsWith('companies/'));
    expect(companies).toEqual([`companies/${first.companyId}`]);
    // The original account and password are untouched.
    expect(await signIn('abc@gmail.com', 'Abc@2026')).toBe(first.uid);
  });

  it('leaves no login behind when the profile/company write is refused', async () => {
    // A customer is not allowed to create companies or company admins.
    await expect(createCompanyWithAdminAccount(input(), deps('cust1'))).rejects.toMatchObject({
      code: 'permission-denied',
    });
    const dump = await allDocuments();
    expect(Object.keys(dump).filter((k) => k.startsWith('companies/'))).toHaveLength(0);
    // The Auth account that was created for it has been removed again.
    await expect(signIn('abc@gmail.com', 'Abc@2026')).rejects.toBeDefined();
    // ...so the email can be used once the problem is fixed.
    const { uid } = await createCompanyWithAdminAccount(input(), deps());
    expect(await signIn('abc@gmail.com', 'Abc@2026')).toBe(uid);
  });
});
