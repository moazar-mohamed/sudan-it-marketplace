/*
 * Firestore security-rules tests for users/{uid}.language.
 * Local emulator only (npm run test:rules): every user below is a fake
 * identity inside the emulator, nothing touches the real Firebase project.
 *
 * Every signed-in user may change ONLY their own `language`, only to a
 * supported value ('en' / 'ar'), and never together with another field.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let env: RulesTestEnvironment;

const ROLES: [string, string, object][] = [
  ['cust', 'customer', {}],
  ['ca', 'company_admin', { companyId: 'c1' }],
  ['tech', 'technician', { companyId: 'c1' }],
  ['admin', 'platform_admin', {}],
];

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [id, role, extra] of ROLES) {
      await setDoc(doc(db, 'users', id), {
        id,
        fullName: `Name ${id}`,
        email: `${id}@x.test`,
        role,
        isActive: true,
        createdAt: new Date(),
        ...extra,
      });
    }
    // A user who already chose a language.
    await setDoc(doc(db, 'users', 'cust_ar'), {
      id: 'cust_ar',
      fullName: 'Arabic user',
      email: 'ar@x.test',
      role: 'customer',
      isActive: true,
      createdAt: new Date(),
      language: 'ar',
    });
  });
}

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
beforeEach(seed);

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const readLanguage = async (uid: string) => {
  let language: unknown;
  await env.withSecurityRulesDisabled(async (ctx) => {
    language = (await getDoc(doc(ctx.firestore(), 'users', uid))).data()?.language;
  });
  return language;
};

describe('own language preference', () => {
  for (const [id, role] of ROLES) {
    it(`${role} can set their own language to ar and back to en`, async () => {
      await assertSucceeds(updateDoc(doc(as(id), 'users', id), { language: 'ar' }));
      expect(await readLanguage(id)).toBe('ar');
      await assertSucceeds(updateDoc(doc(as(id), 'users', id), { language: 'en' }));
      expect(await readLanguage(id)).toBe('en');
    });
  }

  it('an existing user with no language field can add one (no migration needed)', async () => {
    expect(await readLanguage('cust')).toBeUndefined();
    await assertSucceeds(updateDoc(doc(as('cust'), 'users', 'cust'), { language: 'ar' }));
  });

  it('rejects an unsupported language value', async () => {
    for (const bad of ['fr', 'AR', '', 'ar-SD', 1, null, true]) {
      await assertFails(updateDoc(doc(as('cust'), 'users', 'cust'), { language: bad }));
    }
  });

  it('cannot remove the field or replace it with a map', async () => {
    await assertFails(updateDoc(doc(as('cust_ar'), 'users', 'cust_ar'), { language: deleteField() }));
    await assertFails(updateDoc(doc(as('cust'), 'users', 'cust'), { language: { code: 'ar' } }));
  });

  it('cannot ride along with any other field', async () => {
    const d = doc(as('cust'), 'users', 'cust');
    await assertFails(updateDoc(d, { language: 'ar', role: 'platform_admin' }));
    // (Re-sending an unchanged value is not an edit, so only a real change is tested.)
    await assertFails(updateDoc(d, { language: 'ar', isActive: false }));
    await assertFails(updateDoc(d, { language: 'ar', fullName: 'Renamed' }));
    await assertFails(updateDoc(d, { language: 'ar', companyId: 'c1' }));
    await assertFails(updateDoc(d, { language: 'ar', email: 'other@x.test' }));
  });

  it('nobody can change another user\'s language', async () => {
    await assertFails(updateDoc(doc(as('cust'), 'users', 'ca'), { language: 'ar' }));
    await assertFails(updateDoc(doc(as('ca'), 'users', 'cust'), { language: 'ar' }));
    await assertFails(updateDoc(doc(as('tech'), 'users', 'cust'), { language: 'ar' }));
    expect(await readLanguage('cust')).toBeUndefined();
  });

  it('a Platform Admin cannot change another user\'s language either', async () => {
    await assertFails(updateDoc(doc(as('admin'), 'users', 'cust'), { language: 'ar' }));
    await assertFails(updateDoc(doc(as('admin'), 'users', 'ca'), { language: 'ar' }));
  });

  it('a signed-out visitor cannot write it', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(updateDoc(doc(anon, 'users', 'cust'), { language: 'ar' }));
  });

  it('language cannot be smuggled in through a full document overwrite', async () => {
    await assertFails(
      setDoc(doc(as('cust'), 'users', 'cust'), {
        id: 'cust',
        fullName: 'Name cust',
        email: 'cust@x.test',
        role: 'customer',
        isActive: true,
        createdAt: new Date(),
        language: 'ar',
      }),
    );
  });
});

describe('existing profile rules are unchanged', () => {
  it('a customer can still edit their own name and phone', async () => {
    await assertSucceeds(
      updateDoc(doc(as('cust'), 'users', 'cust'), { fullName: 'New Name', phone: '0911', updatedAt: new Date() }),
    );
  });

  it('a customer still cannot change their role or activate themselves as an admin', async () => {
    await assertFails(updateDoc(doc(as('cust'), 'users', 'cust'), { role: 'platform_admin' }));
    await assertFails(updateDoc(doc(as('cust'), 'users', 'cust'), { isActive: false }));
  });

  it('the language of a user is readable by that user only', async () => {
    await assertSucceeds(getDoc(doc(as('cust_ar'), 'users', 'cust_ar')));
    await assertFails(getDoc(doc(as('cust'), 'users', 'cust_ar')));
  });
});
