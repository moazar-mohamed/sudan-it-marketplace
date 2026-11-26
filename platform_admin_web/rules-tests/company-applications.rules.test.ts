/*
 * A company asks to join (company_applications/{uid}): sent from the person's
 * own verified customer account, one per account, read by its sender and
 * Platform Admin, decided only by Platform Admin (a rejection gives a reason),
 * and sent again after a rejection. Local emulator only (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

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

const email = (uid: string) => `${uid}@x.test`;
const as = (uid: string, verified = true) =>
  env.authenticatedContext(uid, { email: email(uid), email_verified: verified }).firestore();
const put = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));

beforeEach(async () => {
  await env.clearFirestore();
  const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
    put(`users/${id}`, { id, fullName: id, email: email(id), role, isActive: true, ...extra });
  await user('cust1', 'customer');
  await user('cust2', 'customer');
  await user('custOff', 'customer', { isActive: false });
  await user('ca1', 'company_admin', { companyId: 'c1' });
  await user('tech1', 'technician', { companyId: 'c1' });
  await user('pa', 'platform_admin');
});

const application = (uid: string, extra: Record<string, unknown> = {}) => ({
  id: uid,
  applicantId: uid,
  applicantEmail: email(uid),
  companyName: 'Nile Networks',
  contactName: 'Amna Ali',
  phone: '+249912345678',
  cityId: 'khartoum',
  registrationNumber: 'CR-2026-1144',
  about: 'Networking and CCTV installation.',
  status: 'pending',
  decisionNote: '',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

const send = (uid: string, extra: Record<string, unknown> = {}, verified = true) =>
  setDoc(doc(as(uid, verified), 'company_applications', uid), application(uid, extra));

const decide = (status: string, decisionNote: string, uid = 'pa') =>
  updateDoc(doc(as(uid), 'company_applications', 'cust1'), {
    status,
    decisionNote,
    decidedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

describe('sending a request to join', () => {
  it('a verified customer sends one for their own account', async () => {
    await assertSucceeds(send('cust1'));
  });

  it('only from a verified, active customer account', async () => {
    await assertFails(send('cust1', {}, false));
    for (const uid of ['custOff', 'ca1', 'tech1', 'pa']) await assertFails(send(uid));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'company_applications', 'x'), application('x')));
  });

  it("never in someone else's name or with another e-mail", async () => {
    await assertFails(setDoc(doc(as('cust1'), 'company_applications', 'cust2'), application('cust2')));
    await assertFails(send('cust1', { applicantEmail: 'boss@x.test' }));
  });

  it('a second request over a pending one is refused', async () => {
    await assertSucceeds(send('cust1'));
    await assertFails(send('cust1', { companyName: 'Other name' }));
  });

  it.each([
    ['a one-letter company name', { companyName: 'N' }],
    ['a company name of 121 characters', { companyName: 'N'.repeat(121) }],
    ['an empty contact name', { contactName: '  ' }],
    ['a local phone number', { phone: '0912345678' }],
    ['a city that is not on the list', { cityId: 'atlantis' }],
    ['no registration number', { registrationNumber: ' ' }],
    ['a registration number of 61 characters', { registrationNumber: '1'.repeat(61) }],
    ['an about text of 501 characters', { about: 'a'.repeat(501) }],
    ['a request that says it is already approved', { status: 'approved' }],
    ['a decision note written by the sender', { decisionNote: 'approve me' }],
    ['an extra field', { isActive: true }],
    ['the phone clock as its time', { createdAt: new Date() }],
  ])('refuses %s', async (_, extra) => {
    await assertFails(send('cust1', extra));
  });
});

describe('who reads requests', () => {
  it('the sender reads their own, even before sending (it does not exist yet)', async () => {
    await assertSucceeds(getDoc(doc(as('cust1'), 'company_applications', 'cust1')));
    await assertSucceeds(send('cust1'));
    await assertSucceeds(getDoc(doc(as('cust1'), 'company_applications', 'cust1')));
  });

  it("nobody else reads one, and only Platform Admin lists them", async () => {
    await assertSucceeds(send('cust1'));
    await assertFails(getDoc(doc(as('cust2'), 'company_applications', 'cust1')));
    await assertFails(getDoc(doc(as('ca1'), 'company_applications', 'cust1')));
    await assertFails(getDocs(collection(as('cust1'), 'company_applications')));
    await assertSucceeds(getDoc(doc(as('pa'), 'company_applications', 'cust1')));
    await assertSucceeds(getDocs(collection(as('pa'), 'company_applications')));
  });
});

describe('deciding a request', () => {
  beforeEach(async () => {
    await assertSucceeds(send('cust1'));
  });

  it('Platform Admin approves it, or rejects it with a reason', async () => {
    await assertSucceeds(decide('approved', ''));
  });

  it('a rejection must say why', async () => {
    await assertFails(decide('rejected', '  '));
    await assertSucceeds(decide('rejected', 'The registration number does not match the certificate.'));
  });

  it('nobody else decides, not even the sender', async () => {
    for (const uid of ['cust1', 'cust2', 'ca1']) await assertFails(decide('approved', '', uid));
  });

  it('a decided request is not decided again, and its details stay', async () => {
    await assertSucceeds(decide('approved', ''));
    await assertFails(decide('rejected', 'Changed my mind.'));
    await assertFails(
      updateDoc(doc(as('pa'), 'company_applications', 'cust1'), { companyName: 'Other', updatedAt: serverTimestamp() }),
    );
  });

  it('after a rejection the sender corrects it and sends it again; not after an approval', async () => {
    await assertSucceeds(decide('rejected', 'Wrong number.'));
    await assertSucceeds(send('cust1', { registrationNumber: 'CR-2026-1145' }));
    await assertSucceeds(decide('approved', ''));
    await assertFails(send('cust1', { companyName: 'Again' }));
  });

  it('nobody deletes a request', async () => {
    await assertFails(deleteDoc(doc(as('cust1'), 'company_applications', 'cust1')));
    await assertFails(deleteDoc(doc(as('pa'), 'company_applications', 'cust1')));
  });
});
