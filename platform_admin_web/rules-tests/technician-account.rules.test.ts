/*
 * Technician accounts created by their own company admin (temporary password,
 * first-login flag) and the payment accounts a company keeps on its profile.
 * Local emulator only (npm run test:rules); every user is a fake identity.
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
    for (const id of ['c1', 'c2']) {
      await setDoc(doc(db, 'companies', id), {
        name: `Company ${id}`,
        logoUrl: '',
        description: '',
        city: '',
        address: '',
        phone: '',
        email: `${id}@x.test`,
        pickupAddress: '',
        status: 'active',
        rating: 0,
        reviewCount: 0,
        createdAt: now,
      });
    }
    await user('adminC1', 'company_admin', { companyId: 'c1' });
    await user('adminC2', 'company_admin', { companyId: 'c2' });
    await user('cust1', 'customer');
  });
});

const TECH_EMAIL = 'tech@x.test';

const techUser = (extra: Record<string, unknown> = {}) => ({
  id: 'techUid',
  fullName: 'Tech One',
  email: TECH_EMAIL,
  role: 'technician',
  companyId: 'c1',
  phone: '0912345678',
  isActive: true,
  mustChangePassword: true,
  createdAt: serverTimestamp(),
  ...extra,
});

const techRecord = (extra: Record<string, unknown> = {}) => ({
  id: 'techUid',
  uid: 'techUid',
  companyId: 'c1',
  fullName: 'Tech One',
  phone: '0912345678',
  email: TECH_EMAIL,
  isActive: true,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

/** What the company admin's app writes: profile + technician record, one batch. */
const provision = (
  opts: {
    who?: string;
    profile?: Record<string, unknown>;
    record?: Record<string, unknown>;
    skipRecord?: boolean;
  } = {},
) => {
  const db = as(opts.who ?? 'adminC1');
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', 'techUid'), techUser(opts.profile));
  if (!opts.skipRecord) batch.set(doc(db, 'technicians', 'techUid'), techRecord(opts.record));
  return batch.commit();
};

describe('a company admin creates a technician account', () => {
  it('succeeds for their own company, with the first-login flag on', async () => {
    await assertSucceeds(provision());
    await env.withSecurityRulesDisabled(async (ctx) => {
      const profile = (await getDoc(doc(ctx.firestore(), 'users', 'techUid'))).data();
      expect(profile?.role).toBe('technician');
      expect(profile?.companyId).toBe('c1');
      expect(profile?.mustChangePassword).toBe(true);
    });
  });

  it('refuses another company: the admin of c2 cannot add a technician to c1', async () => {
    await assertFails(provision({ who: 'adminC2' }));
  });

  it('refuses a profile without the technician record in the same batch', async () => {
    await assertFails(provision({ skipRecord: true }));
  });

  it('refuses a technician record for another company or another email', async () => {
    await assertFails(provision({ record: { companyId: 'c2' } }));
    await assertFails(provision({ record: { email: 'someone-else@x.test' } }));
  });

  it('must start with mustChangePassword true', async () => {
    await assertFails(provision({ profile: { mustChangePassword: false } }));
  });

  it('refuses any extra field, in particular a password', async () => {
    await assertFails(provision({ profile: { password: 'Temp@2026' } }));
  });

  it('refuses other roles and inactive accounts through this path', async () => {
    await assertFails(provision({ profile: { role: 'company_admin' } }));
    await assertFails(provision({ profile: { role: 'platform_admin' } }));
    await assertFails(provision({ profile: { isActive: false } }));
  });

  it('refuses an upper-case email (the record and login use lower case)', async () => {
    await assertFails(
      provision({ profile: { email: 'Tech@x.test' }, record: { email: 'Tech@x.test' } }),
    );
  });

  it('only a company admin can do it', async () => {
    await assertFails(provision({ who: 'cust1' }));
    await assertFails(provision({ who: 'techUid' }));
  });

  it('cannot overwrite a profile that already exists', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'techUid'), {
        id: 'techUid',
        fullName: 'Existing customer',
        email: TECH_EMAIL,
        role: 'customer',
        isActive: true,
        createdAt: now,
      });
    });
    await assertFails(provision());
  });
});

describe('the retired invite/claim flow is closed', () => {
  // The registering person themself, with a left-over pending invitation.
  const selfDb = () =>
    env.authenticatedContext('techUid', { email: TECH_EMAIL, email_verified: true }).firestore();

  beforeEach(async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'technicianInvites', TECH_EMAIL), {
        email: TECH_EMAIL,
        fullName: 'Tech One',
        phone: '0912345678',
        companyId: 'c1',
        status: 'pending',
        createdAt: now,
      }),
    );
  });

  it('self-registration can never create a technician profile or record', async () => {
    const db = selfDb();
    const claimed = {
      id: 'techUid',
      fullName: 'Tech One',
      email: TECH_EMAIL,
      role: 'technician',
      companyId: 'c1',
      phone: '0912345678',
      isActive: true,
      createdAt: serverTimestamp(),
    };
    await assertFails(setDoc(doc(db, 'users', 'techUid'), claimed));
    await assertFails(
      setDoc(doc(db, 'technicians', 'techUid'), techRecord()),
    );
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', 'techUid'), claimed);
    batch.set(doc(db, 'technicians', 'techUid'), techRecord());
    batch.update(doc(db, 'technicianInvites', TECH_EMAIL), {
      status: 'claimed',
      claimedAt: serverTimestamp(),
      claimedBy: 'techUid',
    });
    await assertFails(batch.commit());
  });

  it('the invited person cannot read or claim the invitation', async () => {
    await assertFails(getDoc(doc(selfDb(), 'technicianInvites', TECH_EMAIL)));
    await assertFails(
      updateDoc(doc(selfDb(), 'technicianInvites', TECH_EMAIL), {
        status: 'claimed',
        claimedAt: serverTimestamp(),
        claimedBy: 'techUid',
      }),
    );
  });

  it('a company admin can no longer create invitations', async () => {
    await assertFails(
      setDoc(doc(as('adminC1'), 'technicianInvites', 'new@x.test'), {
        email: 'new@x.test',
        fullName: 'New',
        phone: '1',
        companyId: 'c1',
        status: 'pending',
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('self-registration still creates an ordinary customer', async () => {
    await assertSucceeds(
      setDoc(doc(selfDb(), 'users', 'techUid'), {
        id: 'techUid',
        fullName: 'Tech One',
        email: TECH_EMAIL,
        role: 'customer',
        isActive: true,
        createdAt: serverTimestamp(),
      }),
    );
  });
});

describe('technician first-login password flag', () => {
  beforeEach(async () => {
    await assertSucceeds(provision());
  });

  const clear = (extra: Record<string, unknown> = {}) =>
    updateDoc(doc(as('techUid'), 'users', 'techUid'), {
      mustChangePassword: false,
      updatedAt: serverTimestamp(),
      ...extra,
    });

  it('the technician can clear the flag after choosing a password', async () => {
    await assertSucceeds(clear());
    await env.withSecurityRulesDisabled(async (ctx) => {
      const profile = (await getDoc(doc(ctx.firestore(), 'users', 'techUid'))).data();
      expect(profile?.mustChangePassword).toBe(false);
      expect(profile?.role).toBe('technician');
      expect(profile?.companyId).toBe('c1');
    });
  });

  it('clearing the flag cannot change anything else', async () => {
    await assertFails(clear({ role: 'company_admin' }));
    await assertFails(clear({ companyId: 'c2' }));
    await assertFails(clear({ isActive: false }));
  });

  it('the flag can never be set back to true', async () => {
    await assertSucceeds(clear());
    await assertFails(
      updateDoc(doc(as('techUid'), 'users', 'techUid'), {
        mustChangePassword: true,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('nobody else can clear it', async () => {
    await assertFails(
      updateDoc(doc(as('adminC1'), 'users', 'techUid'), {
        mustChangePassword: false,
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('company payment accounts', () => {
  const account = (n = 1, extra: Record<string, unknown> = {}) => ({
    bankName: `Bank ${n}`,
    accountName: 'ABC Technology',
    accountNumber: `12345${n}`,
    phoneNumber: '+249912345678',
    ...extra,
  });

  const save = (who: string, companyId: string, accounts: unknown) =>
    updateDoc(doc(as(who), 'companies', companyId), {
      paymentAccounts: accounts,
      updatedAt: serverTimestamp(),
    });

  it('the company admin can save, replace and clear their accounts', async () => {
    await assertSucceeds(save('adminC1', 'c1', [account(1), account(2)]));
    await assertSucceeds(save('adminC1', 'c1', [account(3)]));
    await assertSucceeds(save('adminC1', 'c1', []));
  });

  it('allows a blank phone number and Arabic text', async () => {
    await assertSucceeds(
      save('adminC1', 'c1', [
        account(1, { bankName: 'بنك الخرطوم (بنكك)', accountName: 'شركة أبناء السودان', phoneNumber: '' }),
      ]),
    );
  });

  it('customers can read them', async () => {
    await assertSucceeds(save('adminC1', 'c1', [account(1)]));
    const company = (await assertSucceeds(getDoc(doc(as('cust1'), 'companies', 'c1')))).data();
    expect(company?.paymentAccounts).toHaveLength(1);
  });

  it('allows at most 5 accounts', async () => {
    await assertSucceeds(save('adminC1', 'c1', [1, 2, 3, 4, 5].map((n) => account(n))));
    await assertFails(save('adminC1', 'c1', [1, 2, 3, 4, 5, 6].map((n) => account(n))));
  });

  it('refuses malformed accounts', async () => {
    await assertFails(save('adminC1', 'c1', 'not a list'));
    await assertFails(save('adminC1', 'c1', ['not a map']));
    await assertFails(save('adminC1', 'c1', [account(1, { bankName: '' })]));
    await assertFails(save('adminC1', 'c1', [account(1, { accountNumber: '' })]));
    await assertFails(save('adminC1', 'c1', [account(1, { accountNumber: 12345 })]));
    await assertFails(save('adminC1', 'c1', [account(1, { extra: 'x' })]));
    await assertFails(save('adminC1', 'c1', [account(1), account(2, { bankName: '' })]));
  });

  it("nobody else can change a company's accounts", async () => {
    await assertFails(save('adminC2', 'c1', [account(1)]));
    await assertFails(save('cust1', 'c1', [account(1)]));
  });
});
