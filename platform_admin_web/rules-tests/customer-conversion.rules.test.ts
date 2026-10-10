/*
 * Platform Admin turns a customer's account into the admin of a new company.
 * One batch carries the company, its registration document, the profile's new
 * role and link, the notice the person reads, and the activity entry; the rules
 * check the batch as a whole. Local emulator only (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { companyDocumentData } from '../src/data/companyDocuments';
import {
  ConvertCustomerError,
  convertCustomerToCompany,
  type ConvertCompanyInput,
  type ConvertDeps,
} from '../src/data/convertCustomer';

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

const as = (uid: string) => env.authenticatedContext(uid, { email_verified: true }).firestore();
const put = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));
async function read(path: string) {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path))).data();
  });
  return data;
}

beforeEach(async () => {
  await env.clearFirestore();
  const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
    put(`users/${id}`, { id, fullName: `Name ${id}`, email: `${id}@x.test`, role, isActive: true, createdAt: now, ...extra });
  await user('pa', 'platform_admin');
  await user('pa2', 'platform_admin');
  await user('cust1', 'customer', { phone: '+249911111111', cityId: 'khartoum' });
  await user('cust2', 'customer');
  await user('custOff', 'customer', { isActive: false });
  await user('ca1', 'company_admin', { companyId: 'c1' });
  await user('tech1', 'technician', { companyId: 'c1' });
  await put('companies/c1', { name: 'Existing Co', email: 'cust1@x.test', status: 'active', rating: 0, reviewCount: 0, createdAt: now });
});

const image = {
  bytes: new Uint8Array(2048).fill(7),
  contentType: 'image/jpeg' as const,
  width: 1200,
  height: 1600,
  fileName: 'licence.jpg',
};

const input = (extra: Partial<ConvertCompanyInput> = {}): ConvertCompanyInput => ({
  name: 'Nile Systems',
  description: 'IT shop',
  city: 'Khartoum',
  serviceCityIds: [],
  address: 'Street 1',
  latitude: null,
  longitude: null,
  phone: '+249911111111',
  pickupAddress: '',
  registrationNumber: 'CR-2024-0091',
  registrationDocument: image,
  ...extra,
});

const customer = (id = 'cust1', extra: Partial<{ fullName: string; email: string; isActive: boolean }> = {}) => ({
  id,
  fullName: `Name ${id}`,
  email: `${id}@x.test`,
  isActive: true,
  ...extra,
});

function deps(uid = 'pa'): ConvertDeps {
  const db = as(uid);
  return {
    db,
    adminId: uid,
    resolveLogo: async () => '',
    stageAudit: (batch, entry) =>
      batch.set(doc(collection(db, 'admin_audit_log')), {
        actorId: uid,
        actorName: 'Admin',
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        targetName: entry.targetName ?? '',
        ...(entry.detail ? { detail: entry.detail } : {}),
        createdAt: serverTimestamp(),
      }),
  };
}

describe('the dashboard conversion', () => {
  it('makes the company, its registration, the new role, the notice and the entry together', async () => {
    const done = await convertCustomerToCompany(customer(), input(), deps());

    const profile = await read('users/cust1');
    expect(profile).toMatchObject({ role: 'company_admin', companyId: done.companyId, fullName: 'Name cust1', cityId: 'khartoum' });
    // No temporary password step: they keep the one they have.
    expect(profile).not.toHaveProperty('mustChangePassword');

    const company = await read(`companies/${done.companyId}`);
    expect(company).toMatchObject({ name: 'Nile Systems', email: 'cust1@x.test', status: 'active', rating: 0 });
    expect((await read(`company_documents/${done.companyId}`))?.registrationNumber).toBe('CR-2024-0091');

    const notice = await read(`notifications/${done.noticeId}`);
    expect(notice).toMatchObject({
      type: 'account_converted_to_company',
      recipientType: 'company_admin',
      recipientId: done.companyId,
      userId: 'cust1',
      productName: 'Nile Systems',
      isRead: false,
      senderId: 'pa',
    });
  });

  it('the person then reads the notice and their company as its admin', async () => {
    const done = await convertCustomerToCompany(customer(), input(), deps());
    await assertSucceeds(getDoc(doc(as('cust1'), 'notifications', done.noticeId)));
    await assertSucceeds(getDoc(doc(as('cust1'), 'companies', done.companyId)));
    // Another company's admin, and another customer, do not read it.
    await assertFails(getDoc(doc(as('ca1'), 'notifications', done.noticeId)));
    await assertFails(getDoc(doc(as('cust2'), 'notifications', done.noticeId)));
  });

  it('refuses while the customer has an order or a service request in progress, and writes nothing', async () => {
    await put('orders/o1', { id: 'o1', customerId: 'cust1', companyId: 'c1', productName: 'Router', orderStatus: 'processing', createdAt: now });
    await put('service_requests/s1', { id: 's1', customerId: 'cust1', companyId: 'c1', serviceName: 'Setup', status: 'pending', createdAt: now });
    const attempt = convertCustomerToCompany(customer(), input(), deps());
    await expect(attempt).rejects.toBeInstanceOf(ConvertCustomerError);
    await attempt.catch((error: ConvertCustomerError) => {
      expect(error.code).toBe('convert/open-work');
      expect(error.work?.orders.map((o) => o.id)).toEqual(['o1']);
      expect(error.work?.requests.map((r) => r.id)).toEqual(['s1']);
    });
    expect((await read('users/cust1'))?.role).toBe('customer');
  });

  it('finished orders and requests do not block it', async () => {
    await put('orders/o1', { id: 'o1', customerId: 'cust1', companyId: 'c1', productName: 'Router', orderStatus: 'completed', createdAt: now });
    await put('orders/o2', { id: 'o2', customerId: 'cust1', companyId: 'c1', productName: 'Switch', orderStatus: 'cancelled', createdAt: now });
    await put('service_requests/s1', { id: 's1', customerId: 'cust1', companyId: 'c1', serviceName: 'Setup', status: 'completed', createdAt: now });
    await put('service_requests/s2', { id: 's2', customerId: 'cust1', companyId: 'c1', serviceName: 'Setup', status: 'rejected', createdAt: now });
    await expect(convertCustomerToCompany(customer(), input(), deps())).resolves.toBeTruthy();
  });

  it('needs the registration number and document, and an email', async () => {
    await expect(
      convertCustomerToCompany(customer(), input({ registrationDocument: null }), deps()),
    ).rejects.toMatchObject({ code: 'convert/registration-required' });
    await expect(
      convertCustomerToCompany(customer('cust1', { email: 'nope' }), input(), deps()),
    ).rejects.toMatchObject({ code: 'convert/invalid-email' });
  });

  it('needs only the name and the registration: everything else may be left empty', async () => {
    const done = await convertCustomerToCompany(
      customer('cust2'),
      input({ description: '', city: '', address: '', phone: '', pickupAddress: '', serviceCityIds: [] }),
      deps(),
    );
    expect(await read(`companies/${done.companyId}`)).toMatchObject({
      name: 'Nile Systems',
      email: 'cust2@x.test',
      status: 'active',
      description: '',
      city: '',
      address: '',
      phone: '',
    });
    expect((await read('users/cust2'))?.role).toBe('company_admin');
  });

  it('converts a deactivated customer too, and the account comes out active', async () => {
    const done = await convertCustomerToCompany(customer('custOff'), input(), deps());
    expect(await read('users/custOff')).toMatchObject({
      role: 'company_admin',
      companyId: done.companyId,
      isActive: true,
    });
  });
});

/** The batch built by hand, so each rule can be broken on its own. */
interface Raw {
  actor?: string;
  uid?: string;
  companyId?: string;
  companyEmail?: string;
  companyStatus?: string;
  withDocument?: boolean;
  userPatch?: Record<string, unknown>;
  notice?: Record<string, unknown> | null;
}

function raw(options: Raw = {}) {
  const {
    actor = 'pa',
    uid = 'cust1',
    companyId = 'cNew',
    companyEmail = `${uid}@x.test`,
    companyStatus = 'active',
    withDocument = true,
    userPatch = {},
    notice = {},
  } = options;
  const db = as(actor);
  const batch = writeBatch(db);
  if (companyId !== 'c1') {
    batch.set(doc(db, 'companies', companyId), {
      name: 'Nile Systems',
      logoUrl: '',
      description: '',
      city: '',
      address: '',
      phone: '',
      email: companyEmail,
      pickupAddress: '',
      rating: 0,
      reviewCount: 0,
      status: companyStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  if (withDocument) {
    batch.set(doc(db, 'company_documents', companyId), companyDocumentData(companyId, 'CR-1', image));
  }
  batch.update(doc(db, 'users', uid), {
    role: 'company_admin',
    companyId,
    updatedAt: serverTimestamp(),
    ...userPatch,
  });
  if (notice) {
    batch.set(doc(db, 'notifications', `${companyId}_account_converted_to_company`), {
      id: `${companyId}_account_converted_to_company`,
      recipientType: 'company_admin',
      recipientId: companyId,
      userId: uid,
      type: 'account_converted_to_company',
      productName: 'Nile Systems',
      isRead: false,
      createdAt: serverTimestamp(),
      senderId: actor,
      ...notice,
    });
  }
  return batch.commit();
}

describe('the profile change', () => {
  it('is allowed in the shape the dashboard writes', async () => {
    await assertSucceeds(raw());
  });

  it('is not open to anyone but an active Platform Admin', async () => {
    await assertFails(raw({ actor: 'cust1' }));
    await assertFails(raw({ actor: 'cust2', uid: 'cust1' }));
    await assertFails(raw({ actor: 'ca1' }));
    await assertFails(raw({ actor: 'tech1' }));
  });

  it('a customer cannot promote themselves, even to a company that is theirs to create', async () => {
    const db = as('cust1');
    await assertFails(updateDoc(doc(db, 'users', 'cust1'), { role: 'company_admin', companyId: 'c1' }));
    await assertFails(updateDoc(doc(db, 'users', 'cust1'), { role: 'platform_admin' }));
  });

  it('cannot attach the customer to a company that already exists', async () => {
    await assertFails(raw({ companyId: 'c1', notice: null, withDocument: false }));
  });

  it('needs the company to carry the account\'s own email', async () => {
    await assertFails(raw({ companyEmail: 'someone.else@x.test' }));
    await assertSucceeds(raw({ uid: 'cust2', companyId: 'cB', companyEmail: 'CUST2@x.test' }));
  });

  it('needs an active company and its registration document in the same batch', async () => {
    await assertFails(raw({ companyStatus: 'pending' }));
    await assertFails(raw({ withDocument: false }));
  });

  it('changes the role and the link only', async () => {
    await assertFails(raw({ userPatch: { fullName: 'Renamed' } }));
    await assertFails(raw({ userPatch: { isActive: false } }));
    await assertFails(raw({ userPatch: { email: 'new@x.test' } }));
    await assertFails(raw({ userPatch: { mustChangePassword: true } }));
    await assertFails(raw({ userPatch: { role: 'platform_admin' } }));
  });

  it('only turns a customer, never another kind of account', async () => {
    await assertFails(raw({ uid: 'pa2', companyId: 'cX', notice: null }));
    await assertFails(raw({ uid: 'ca1', companyId: 'cY', notice: null }));
    await assertFails(raw({ uid: 'tech1', companyId: 'cZ', notice: null }));
  });

  it('a deactivated customer is converted only if the account comes out active', async () => {
    await assertFails(raw({ uid: 'custOff', companyId: 'cW' }));
    await assertSucceeds(raw({ uid: 'custOff', companyId: 'cW', userPatch: { isActive: true } }));
  });

  it('does not let the admin convert their own profile', async () => {
    await assertFails(raw({ uid: 'pa', companyId: 'cSelf' }));
  });
});

describe('the notice', () => {
  it('goes to the new company, with the company\'s own name', async () => {
    await assertFails(raw({ notice: { productName: 'Free money' } }));
    await assertFails(raw({ notice: { recipientId: 'c1' } }));
    await assertFails(raw({ notice: { userId: 'cust2' } }));
    await assertFails(raw({ notice: { recipientType: 'customer' } }));
  });

  it('carries no text of its own and is signed with the admin and the server time', async () => {
    await assertFails(raw({ notice: { body: 'Pay me' } }));
    await assertFails(raw({ notice: { senderId: 'cust1' } }));
    await assertFails(raw({ notice: { createdAt: new Date('2020-01-01') } }));
    await assertFails(raw({ notice: { isRead: true } }));
  });

  it('cannot be written without the conversion: the person is still a customer', async () => {
    const db = as('pa');
    await assertFails(
      setDoc(doc(db, 'notifications', 'c1_account_converted_to_company'), {
        id: 'c1_account_converted_to_company',
        recipientType: 'company_admin',
        recipientId: 'c1',
        userId: 'cust1',
        type: 'account_converted_to_company',
        productName: 'Existing Co',
        isRead: false,
        createdAt: serverTimestamp(),
        senderId: 'pa',
      }),
    );
  });
});
