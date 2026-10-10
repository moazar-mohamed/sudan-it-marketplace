/*
 * Firestore security-rules tests for a company's pickup points: up to five
 * places customers can collect orders from, each with a name, an optional
 * address and an optional map point. Local emulator only (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const now = new Date();
    await setDoc(doc(db, 'users', 'ca1'), {
      id: 'ca1',
      fullName: 'Admin 1',
      email: 'ca1@x.test',
      role: 'company_admin',
      companyId: 'c1',
      isActive: true,
      createdAt: now,
    });
    await setDoc(doc(db, 'users', 'ca2'), {
      id: 'ca2',
      fullName: 'Admin 2',
      email: 'ca2@x.test',
      role: 'company_admin',
      companyId: 'c2',
      isActive: true,
      createdAt: now,
    });
    await setDoc(doc(db, 'users', 'admin'), {
      id: 'admin',
      fullName: 'Platform Admin',
      email: 'admin@x.test',
      role: 'platform_admin',
      isActive: true,
      createdAt: now,
    });
    for (const id of ['c1', 'c2']) {
      await setDoc(doc(db, 'companies', id), {
        name: `Company ${id}`,
        logoUrl: '',
        description: 'd',
        city: 'Khartoum',
        address: 'Street 1',
        phone: '1',
        email: 'e@x.test',
        pickupAddress: '',
        rating: 0,
        reviewCount: 0,
        status: 'active',
        createdAt: now,
      });
    }
  });
});

const as = (uid: string) => env.authenticatedContext(uid, { email_verified: true }).firestore();
const save = (uid: string, companyId: string, extra: object) =>
  updateDoc(doc(as(uid), 'companies', companyId), { ...extra, updatedAt: serverTimestamp() });

const point = (extra: object = {}) => ({ name: 'Khartoum branch', address: 'Street 9', ...extra });

describe('Company pickup points', () => {
  it('the company admin saves points with and without a map point', async () => {
    await assertSucceeds(
      save('ca1', 'c1', {
        pickupAddress: 'Khartoum branch — Street 9',
        pickupPoints: [point(), point({ name: 'Warehouse', address: '', latitude: 15.5, longitude: 32.5 })],
      }),
    );
  });

  it('clearing the points (back to the company location) is allowed', async () => {
    await assertSucceeds(save('ca1', 'c1', { pickupAddress: '', pickupPoints: [] }));
  });

  it('five points are accepted, six are not', async () => {
    const five = Array.from({ length: 5 }, (_, i) => point({ name: `P${i}` }));
    await assertSucceeds(save('ca1', 'c1', { pickupAddress: 'x', pickupPoints: five }));
    await assertFails(
      save('ca1', 'c1', { pickupAddress: 'x', pickupPoints: [...five, point({ name: 'P6' })] }),
    );
  });

  it('a point needs a name', async () => {
    await assertFails(save('ca1', 'c1', { pickupAddress: 'x', pickupPoints: [point({ name: '' })] }));
    await assertFails(
      save('ca1', 'c1', { pickupAddress: 'x', pickupPoints: [{ address: 'Street 9' }] }),
    );
  });

  it('refuses over-long text, wrong types, extra keys and half a map point', async () => {
    const bad = (extra: object) =>
      assertFails(save('ca1', 'c1', { pickupAddress: 'x', pickupPoints: [point(extra)] }));
    await bad({ name: 'n'.repeat(61) });
    await bad({ address: 'a'.repeat(201) });
    await bad({ name: 5 });
    await bad({ note: 'extra' });
    await bad({ latitude: 15.5 });
    await bad({ latitude: 95, longitude: 32.5 });
    await assertFails(save('ca1', 'c1', { pickupAddress: 'x', pickupPoints: 'Street' }));
  });

  it('another company\'s admin cannot change them', async () => {
    await assertFails(save('ca2', 'c1', { pickupAddress: 'x', pickupPoints: [point()] }));
  });

  it('Platform Admin can create a company with points, and bad points are refused', async () => {
    const base = {
      name: 'New Co',
      logoUrl: '',
      description: '',
      city: 'Khartoum',
      address: 'Street',
      phone: '1',
      email: 'n@x.test',
      pickupAddress: 'Branch — Street 9',
      serviceCityIds: [],
      rating: 0,
      reviewCount: 0,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await assertSucceeds(
      setDoc(doc(as('admin'), 'companies', 'new1'), {
        ...base,
        pickupPoints: [{ name: 'Branch', address: 'Street 9' }],
      }),
    );
    await assertFails(
      setDoc(doc(as('admin'), 'companies', 'new2'), {
        ...base,
        pickupPoints: [{ name: '', address: 'Street 9' }],
      }),
    );
  });
});
