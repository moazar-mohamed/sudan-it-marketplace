/*
 * A Platform Admin's own profile: the name can be changed (as before), and the
 * stored email can be brought in line with the address they are signed in with
 * (after confirming a change through the link Firebase sends) and with nothing
 * else. Local emulator only (npm run test:rules).
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

const as = (uid: string, email: string) => env.authenticatedContext(uid, { email }).firestore();
const put = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));

beforeEach(async () => {
  await env.clearFirestore();
  const user = (id: string, role: string, email: string) =>
    put(`users/${id}`, { id, fullName: id, email, role, isActive: true, createdAt: new Date('2026-01-01') });
  await user('pa', 'platform_admin', 'old@x.test');
  await user('pa2', 'platform_admin', 'two@x.test');
  await user('cust1', 'customer', 'cust@x.test');
});

describe('the admin\'s name', () => {
  it('can be changed by the admin', async () => {
    await assertSucceeds(
      updateDoc(doc(as('pa', 'old@x.test'), 'users', 'pa'), { fullName: 'New Name', updatedAt: serverTimestamp() }),
    );
  });
});

describe('the admin\'s email, after a confirmed change', () => {
  it('is brought in line with the address they are signed in with', async () => {
    await assertSucceeds(
      updateDoc(doc(as('pa', 'new@x.test'), 'users', 'pa'), { email: 'new@x.test', updatedAt: serverTimestamp() }),
    );
  });

  it('ignores the case of the address', async () => {
    await assertSucceeds(updateDoc(doc(as('pa', 'new@x.test'), 'users', 'pa'), { email: 'New@X.test' }));
  });

  it('cannot be set to an address they are not signed in with', async () => {
    await assertFails(updateDoc(doc(as('pa', 'old@x.test'), 'users', 'pa'), { email: 'someone@else.test' }));
  });

  it('cannot carry anything else along', async () => {
    await assertFails(updateDoc(doc(as('pa', 'new@x.test'), 'users', 'pa'), { email: 'new@x.test', role: 'customer' }));
    await assertFails(updateDoc(doc(as('pa', 'new@x.test'), 'users', 'pa'), { email: 'new@x.test', isActive: false }));
  });

  it('is not open for another admin\'s profile, or for a customer\'s own', async () => {
    await assertFails(updateDoc(doc(as('pa2', 'new@x.test'), 'users', 'pa'), { email: 'new@x.test' }));
    await assertFails(updateDoc(doc(as('cust1', 'new@x.test'), 'users', 'cust1'), { email: 'new@x.test' }));
  });
});
