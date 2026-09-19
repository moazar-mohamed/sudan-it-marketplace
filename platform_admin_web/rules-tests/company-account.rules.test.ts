/*
 * Company-admin accounts created by Platform Admin, and the first-login
 * password flag. Local emulator only (npm run test:rules); every user is a
 * fake identity.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let env: RulesTestEnvironment;
const now = new Date();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sudan-rules',
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

const as = (uid: string) => env.authenticatedContext(uid).firestore();

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const user = (id: string, role: string, extra: object = {}) =>
      setDoc(doc(db, 'users', id), {
        id,
        fullName: `Name ${id}`,
        email: `${id}@x.test`,
        role,
        isActive: true,
        createdAt: now,
        ...extra,
      });
    await user('admin', 'platform_admin');
    await user('cust1', 'customer');
    // A company that already exists, with a hand-made (legacy) admin.
    await setDoc(doc(db, 'companies', 'existing'), {
      name: 'Existing',
      status: 'active',
      rating: 0,
      reviewCount: 0,
      createdAt: now,
    });
    await user('legacyAdmin', 'company_admin', { companyId: 'existing' });
  });
});

const EMAIL = 'abc@x.test';

const companyDoc = (extra: Record<string, unknown> = {}) => ({
  name: 'ABC Technology',
  logoUrl: '',
  description: '',
  city: '',
  address: '',
  phone: '',
  email: EMAIL,
  pickupAddress: '',
  rating: 0,
  reviewCount: 0,
  status: 'active',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

const adminDoc = (uid: string, companyId: string, extra: Record<string, unknown> = {}) => ({
  id: uid,
  fullName: 'ABC Technology',
  email: EMAIL,
  role: 'company_admin',
  companyId,
  isActive: true,
  mustChangePassword: true,
  createdAt: serverTimestamp(),
  ...extra,
});

/** What the dashboard writes: the company and its admin profile in one batch. */
const provision = (
  opts: {
    who?: string;
    companyId?: string;
    profileCompanyId?: string;
    company?: Record<string, unknown>;
    profile?: Record<string, unknown>;
    skipCompany?: boolean;
  } = {},
) => {
  const db = as(opts.who ?? 'admin');
  const companyId = opts.companyId ?? 'AbC123xYz';
  const batch = writeBatch(db);
  if (!opts.skipCompany) batch.set(doc(db, 'companies', companyId), companyDoc(opts.company));
  batch.set(
    doc(db, 'users', 'newUid'),
    adminDoc('newUid', opts.profileCompanyId ?? companyId, opts.profile),
  );
  return batch.commit();
};

describe('Platform Admin creates a company together with its admin profile', () => {
  it('succeeds when the profile links to the company created in the same batch', async () => {
    await assertSucceeds(provision());
  });

  it('links by the exact company id, including letter case', async () => {
    await assertSucceeds(provision({ companyId: 'AbC123xYz' }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      const profile = (await getDoc(doc(ctx.firestore(), 'users', 'newUid'))).data();
      const company = await getDoc(doc(ctx.firestore(), 'companies', 'AbC123xYz'));
      expect(profile?.companyId).toBe('AbC123xYz');
      expect(company.exists()).toBe(true);
    });
  });

  it('refuses a companyId that differs from the created company only by case', async () => {
    await assertFails(provision({ companyId: 'c1', profileCompanyId: 'C1' }));
  });

  it('refuses a profile whose company is not created in the same batch', async () => {
    await assertFails(provision({ skipCompany: true, profileCompanyId: 'nowhere' }));
  });

  it('refuses to add an admin to a company that already exists', async () => {
    await assertFails(provision({ skipCompany: true, profileCompanyId: 'existing' }));
  });

  it('starts the account with mustChangePassword true', async () => {
    await assertFails(provision({ profile: { mustChangePassword: false } }));
    const db = as('admin');
    const missing = writeBatch(db);
    const withoutFlag = Object.fromEntries(
      Object.entries(adminDoc('newUid', 'AbC123xYz')).filter(([key]) => key !== 'mustChangePassword'),
    );
    missing.set(doc(db, 'companies', 'AbC123xYz'), companyDoc());
    missing.set(doc(db, 'users', 'newUid'), withoutFlag);
    await assertFails(missing.commit());
  });

  it('refuses any extra field, in particular a password', async () => {
    await assertFails(provision({ profile: { password: 'Abc@2026' } }));
    await assertFails(provision({ profile: { initialPassword: 'Abc@2026' } }));
  });

  it('refuses a profile email that is not the company login email', async () => {
    await assertFails(provision({ profile: { email: 'someone-else@x.test' } }));
  });

  it('refuses other roles and inactive accounts through this path', async () => {
    await assertFails(provision({ profile: { role: 'platform_admin' } }));
    await assertFails(provision({ profile: { role: 'customer' } }));
    await assertFails(provision({ profile: { isActive: false } }));
  });

  it('only a Platform Admin can do it', async () => {
    await assertFails(provision({ who: 'cust1' }));
    await assertFails(provision({ who: 'legacyAdmin' }));
  });

  it('nobody can create a company_admin profile for themselves', async () => {
    await assertFails(
      setDoc(doc(as('newUid'), 'users', 'newUid'), adminDoc('newUid', 'existing')),
    );
  });

  it('the new admin is linked: they can add a product to exactly that company', async () => {
    await assertSucceeds(provision());
    await assertSucceeds(
      setDoc(doc(as('newUid'), 'products', 'p1'), {
        id: 'p1',
        companyId: 'AbC123xYz',
        companyName: 'ABC Technology',
        name: 'Router',
        imageUrl: '',
        price: null,
        currency: 'SDG',
        stockCount: 3,
        inStock: true,
        description: '',
        specifications: {},
        isDeliveryAvailable: true,
        isInstallationAvailable: false,
        installationPrice: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(as('newUid'), 'products', 'p2'), {
        id: 'p2',
        companyId: 'abc123xyz',
        companyName: 'x',
        name: 'Other case',
        imageUrl: '',
        price: null,
        currency: 'SDG',
        stockCount: 3,
        inStock: true,
        description: '',
        specifications: {},
        isDeliveryAvailable: true,
        isInstallationAvailable: false,
        installationPrice: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('first-login password flag', () => {
  beforeEach(async () => {
    await assertSucceeds(provision());
  });

  const clear = (extra: Record<string, unknown> = {}) =>
    updateDoc(doc(as('newUid'), 'users', 'newUid'), {
      mustChangePassword: false,
      updatedAt: serverTimestamp(),
      ...extra,
    });

  it('the account itself can clear the flag after choosing a password', async () => {
    await assertSucceeds(clear());
    await env.withSecurityRulesDisabled(async (ctx) => {
      const profile = (await getDoc(doc(ctx.firestore(), 'users', 'newUid'))).data();
      expect(profile?.mustChangePassword).toBe(false);
      expect(profile?.companyId).toBe('AbC123xYz');
      expect(profile?.role).toBe('company_admin');
    });
  });

  it('clearing the flag cannot change anything else', async () => {
    await assertFails(clear({ role: 'platform_admin' }));
    await assertFails(clear({ companyId: 'existing' }));
    await assertFails(clear({ isActive: false }));
    await assertFails(clear({ password: 'Abc@2026' }));
  });

  it('the flag can never be set back to true', async () => {
    await assertSucceeds(clear());
    await assertFails(
      updateDoc(doc(as('newUid'), 'users', 'newUid'), {
        mustChangePassword: true,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('nobody else can clear it', async () => {
    await assertFails(
      updateDoc(doc(as('cust1'), 'users', 'newUid'), {
        mustChangePassword: false,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as('admin'), 'users', 'newUid'), {
        mustChangePassword: false,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('a legacy company admin or a customer cannot use the flag', async () => {
    await assertFails(
      updateDoc(doc(as('legacyAdmin'), 'users', 'legacyAdmin'), {
        mustChangePassword: false,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as('cust1'), 'users', 'cust1'), {
        mustChangePassword: true,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('the company admin can read their own profile (flag included) to decide the gate', async () => {
    const profile = (await assertSucceeds(getDoc(doc(as('newUid'), 'users', 'newUid')))).data();
    expect(profile?.mustChangePassword).toBe(true);
  });
});
