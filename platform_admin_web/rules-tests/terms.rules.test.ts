/*
 * The terms and conditions (platform_settings/terms): everyone reads them, even
 * before signing in; only an active Platform Admin publishes them (version 1,
 * then the same number for a correction or the next one for a new version);
 * a person accepts the published version on their own profile, at sign-up or
 * later, with the server time. Local emulator only (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
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

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const put = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));

beforeEach(async () => {
  await env.clearFirestore();
  const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
    put(`users/${id}`, { id, fullName: id, email: `${id}@x.test`, role, isActive: true, ...extra });
  await user('pa', 'platform_admin');
  await user('pa_off', 'platform_admin', { isActive: false });
  await user('cust1', 'customer');
  await user('cust2', 'customer');
});

const TERMS = 'platform_settings/terms';
const published = (version = 1) =>
  put(TERMS, { version, textAr: 'نص', textEn: 'Text', updatedAt: Timestamp.now(), updatedBy: 'pa' });
const terms = (extra: Record<string, unknown> = {}) => ({
  version: 1,
  textAr: 'الشروط',
  textEn: 'Terms',
  updatedAt: serverTimestamp(),
  updatedBy: 'pa',
  ...extra,
});

describe('reading the terms', () => {
  it('is open to everyone, signed in or not, by id only', async () => {
    await published();
    await assertSucceeds(getDoc(doc(anon(), TERMS)));
    await assertSucceeds(getDoc(doc(as('cust1'), TERMS)));
    await assertFails(getDocs(collection(as('cust1'), 'platform_settings')));
  });
});

describe('publishing the terms', () => {
  it('lets an active Platform Admin publish version 1', async () => {
    await assertSucceeds(setDoc(doc(as('pa'), TERMS), terms()));
  });

  it('refuses everyone else', async () => {
    await assertFails(setDoc(doc(as('cust1'), TERMS), terms({ updatedBy: 'cust1' })));
    await assertFails(setDoc(doc(as('pa_off'), TERMS), terms({ updatedBy: 'pa_off' })));
    await assertFails(setDoc(doc(anon(), TERMS), terms()));
  });

  it('starts at version 1', async () => {
    await assertFails(setDoc(doc(as('pa'), TERMS), terms({ version: 2 })));
    await assertFails(setDoc(doc(as('pa'), TERMS), terms({ version: 0 })));
    await assertFails(setDoc(doc(as('pa'), TERMS), terms({ version: 1.5 })));
  });

  it('keeps the number for a correction and goes up by one for a new version, never more or less', async () => {
    await published(3);
    await assertSucceeds(setDoc(doc(as('pa'), TERMS), terms({ version: 3, textAr: 'تصحيح' })));
    await assertSucceeds(setDoc(doc(as('pa'), TERMS), terms({ version: 4 })));
    await assertFails(setDoc(doc(as('pa'), TERMS), terms({ version: 6 })));
    await assertFails(setDoc(doc(as('pa'), TERMS), terms({ version: 3 })));
  });

  it('needs the exact fields, the server time and the admin themself', async () => {
    await assertFails(setDoc(doc(as('pa'), TERMS), terms({ extra: 1 })));
    await assertFails(setDoc(doc(as('pa'), TERMS), terms({ updatedAt: Timestamp.fromDate(new Date('2020-01-01')) })));
    await assertFails(setDoc(doc(as('pa'), TERMS), terms({ updatedBy: 'cust1' })));
    await assertFails(setDoc(doc(as('pa'), TERMS), terms({ textEn: 7 })));
  });

  it('limits the size and needs some words', async () => {
    await assertSucceeds(setDoc(doc(as('pa'), TERMS), terms({ textEn: '' })));
    await assertFails(setDoc(doc(as('pa'), TERMS), terms({ textAr: '', textEn: '' })));
    await assertFails(setDoc(doc(as('pa'), TERMS), terms({ textAr: 'ا'.repeat(50001) })));
  });

  it('is never deleted', async () => {
    await published();
    await assertFails(deleteDoc(doc(as('pa'), TERMS)));
  });
});

describe('accepting the terms on an existing profile', () => {
  const accept = (uid: string, extra: Record<string, unknown> = {}) =>
    updateDoc(doc(as(uid), `users/${uid}`), { termsVersion: 1, termsAcceptedAt: serverTimestamp(), ...extra });

  it('records the published version with the server time', async () => {
    await published(1);
    await assertSucceeds(accept('cust1'));
  });

  it('is refused while nothing is published', async () => {
    await assertFails(accept('cust1'));
  });

  it('only counts for the version that is published', async () => {
    await published(2);
    await assertFails(accept('cust1'));
    await assertSucceeds(accept('cust1', { termsVersion: 2 }));
    await assertFails(accept('cust1', { termsVersion: 3 }));
  });

  it('asks again after a new version', async () => {
    await published(1);
    await assertSucceeds(accept('cust1'));
    await published(2);
    await assertFails(accept('cust1'));
    await assertSucceeds(accept('cust1', { termsVersion: 2 }));
  });

  it('needs both fields, the server time and the owner', async () => {
    await published(1);
    await assertFails(updateDoc(doc(as('cust1'), 'users/cust1'), { termsVersion: 1 }));
    await assertFails(updateDoc(doc(as('cust1'), 'users/cust1'), { termsAcceptedAt: serverTimestamp() }));
    await assertFails(accept('cust1', { termsAcceptedAt: Timestamp.fromDate(new Date('2020-01-01')) }));
    await assertFails(updateDoc(doc(as('cust2'), 'users/cust1'), { termsVersion: 1, termsAcceptedAt: serverTimestamp() }));
  });

  it('carries nothing else with it', async () => {
    await published(1);
    await assertFails(accept('cust1', { role: 'platform_admin' }));
    await assertFails(accept('cust1', { isActive: false }));
  });
});

describe('accepting the terms when signing up', () => {
  const newProfile = (uid: string, extra: Record<string, unknown> = {}) => ({
    id: uid,
    fullName: 'New',
    email: `${uid}@x.test`,
    role: 'customer',
    isActive: true,
    createdAt: serverTimestamp(),
    ...extra,
  });

  it('accepts the published version in the profile itself', async () => {
    await published(1);
    await assertSucceeds(setDoc(doc(as('new1'), 'users/new1'), newProfile('new1', { termsVersion: 1, termsAcceptedAt: serverTimestamp() })));
  });

  it('does not require it (the mobile app signs up without)', async () => {
    await published(1);
    await assertSucceeds(setDoc(doc(as('new1'), 'users/new1'), newProfile('new1')));
  });

  it('refuses another version, a half record or a made-up time', async () => {
    await published(1);
    await assertFails(setDoc(doc(as('new1'), 'users/new1'), newProfile('new1', { termsVersion: 2, termsAcceptedAt: serverTimestamp() })));
    await assertFails(setDoc(doc(as('new1'), 'users/new1'), newProfile('new1', { termsVersion: 1 })));
    await assertFails(setDoc(doc(as('new1'), 'users/new1'), newProfile('new1', { termsAcceptedAt: serverTimestamp() })));
    await assertFails(setDoc(doc(as('new1'), 'users/new1'), newProfile('new1', { termsVersion: 1, termsAcceptedAt: Timestamp.fromDate(new Date('2020-01-01')) })));
  });
});
