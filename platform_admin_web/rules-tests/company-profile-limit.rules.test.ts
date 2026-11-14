/*
 * A company's profile update must stay under the rules' 1000-expression limit
 * even in its heaviest shapes: five payment accounts and five pickup points
 * (each with a map point), one list changed while the other is stored.
 * Local emulator only (npm run test:rules).
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
import { afterAll, beforeAll, describe, it } from 'vitest';

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

const account = (n: number) => ({ bankName: `Bank ${n}`, accountName: `Name ${n}`, accountNumber: `${n}000` });
const point = (n: number, withMapPoint = true) => ({
  name: `Point ${n}`,
  address: `Street ${n}`,
  ...(withMapPoint ? { latitude: 15 + n / 100, longitude: 32 + n / 100 } : {}),
});
const five = <T,>(make: (n: number) => T) => [1, 2, 3, 4, 5].map(make);

async function seed(existing: Record<string, unknown> = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', 'ca1'), {
      id: 'ca1', fullName: 'Admin', email: 'a@x.test', role: 'company_admin', companyId: 'c1', isActive: true, createdAt: new Date(),
    });
    await setDoc(doc(db, 'companies', 'c1'), {
      name: 'Co', logoUrl: '', description: '', city: '', address: '', phone: '', pickupAddress: '',
      status: 'active', rating: 0, reviewCount: 0, createdAt: new Date(), ...existing,
    });
  });
}

const saveAccounts = (paymentAccounts: unknown) =>
  setDoc(doc(env.authenticatedContext('ca1', { email_verified: true }).firestore(), 'company_payment', 'c1'), {
    companyId: 'c1',
    paymentAccounts,
    updatedAt: serverTimestamp(),
  });

const save = (changes: Record<string, unknown>) =>
  updateDoc(doc(env.authenticatedContext('ca1', { email_verified: true }).firestore(), 'companies', 'c1'), {
    ...changes,
    updatedAt: serverTimestamp(),
  });

describe('the heaviest company profile updates', () => {
  it('five pickup points with map points', async () => {
    await seed();
    await assertSucceeds(save({ pickupPoints: five((n) => point(n)), pickupAddress: 'Point 1' }));
  });

  it('five payment accounts (their own document), on a company that has five pickup points', async () => {
    await seed({ pickupPoints: five((n) => point(n)), pickupAddress: 'Point 1' });
    await assertSucceeds(saveAccounts(five(account)));
  });

  it('a plain edit of a company with five pickup points', async () => {
    await seed({ pickupPoints: five((n) => point(n)), pickupAddress: 'Point 1' });
    await assertSucceeds(save({ description: 'New description', phone: '0911111111' }));
  });

  it('the bank accounts can no longer be put on the public company document', async () => {
    await seed();
    await assertFails(save({ paymentAccounts: five(account) }));
  });

  // Changing five accounts AND five pickup points in a single write is over
  // the limit. The app never does: payment accounts have their own screen and
  // write only `paymentAccounts`; pickup points are saved with the profile.
});

describe('what is changed is still checked', () => {
  it('a bad pickup point is refused', async () => {
    await seed();
    await assertFails(save({ pickupPoints: [{ name: '' }] }));
    await assertFails(save({ pickupPoints: [{ address: 'No name' }] }));
    await assertFails(save({ pickupPoints: [{ name: 'Far', latitude: 120, longitude: 32 }] }));
    await assertFails(save({ pickupPoints: [{ name: 'Half', latitude: 15 }] }));
    await assertFails(save({ pickupPoints: [{ name: 'Extra', note: 'x' }] }));
    await assertFails(save({ pickupPoints: [{ name: 'Typed', address: 5 }] }));
    await assertFails(save({ pickupPoints: ['not a map'] }));
    await assertFails(save({ pickupPoints: [1, 2, 3, 4, 5, 6].map((n) => point(n, false)) }));
  });

  it('a bad payment account is refused', async () => {
    await seed({ pickupPoints: five((n) => point(n)) });
    await assertFails(saveAccounts([account(1), { ...account(2), bankName: '' }]));
    await assertFails(saveAccounts([1, 2, 3, 4, 5, 6].map(account)));
    await assertFails(saveAccounts('not a list'));
  });
});
