/*
 * Services a company creates itself. Platform Admin still owns the shared
 * catalogue (services without `ownerCompanyId`); a company admin may also
 * create, edit and switch off services owned by their own company, in an
 * existing active category, and can never touch the catalogue or another
 * company's services. Local emulator only (npm run test:rules).
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

const serviceFields = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  categoryId: 'active1',
  name: `Service ${id}`,
  description: 'd',
  isActive: true,
  ...extra,
});

const createService = (uid: string, id: string, extra: Record<string, unknown> = {}) =>
  setDoc(doc(as(uid), 'services', id), {
    ...serviceFields(id, extra),
    createdAt: serverTimestamp(),
  });

const editService = (uid: string, id: string, patch: Record<string, unknown>) =>
  updateDoc(doc(as(uid), 'services', id), patch);

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
      setDoc(doc(db, 'users', id), {
        id,
        fullName: id,
        email: `${id}@x.test`,
        role,
        isActive: true,
        createdAt: now,
        ...extra,
      });
    await user('admin', 'platform_admin');
    await user('cust1', 'customer');
    await user('ca1', 'company_admin', { companyId: 'c1' });
    await user('ca2', 'company_admin', { companyId: 'c2' });
    for (const id of ['c1', 'c2']) {
      await setDoc(doc(db, 'companies', id), {
        name: id,
        status: 'active',
        rating: 0,
        reviewCount: 0,
        createdAt: now,
      });
    }
    const category = (id: string, isActive: boolean) =>
      setDoc(doc(db, 'categories', id), {
        id,
        name: id,
        description: '',
        iconName: '',
        isActive,
        createdAt: now,
      });
    await category('active1', true);
    await category('active2', true);
    await category('inactive1', false);
    await setDoc(doc(db, 'services', 'catalogue1'), { ...serviceFields('catalogue1'), createdAt: now });
    await setDoc(doc(db, 'services', 'own1'), {
      ...serviceFields('own1', { ownerCompanyId: 'c1' }),
      createdAt: now,
    });
    await setDoc(doc(db, 'services', 'own2'), {
      ...serviceFields('own2', { ownerCompanyId: 'c2' }),
      createdAt: now,
    });
  });
});

describe('a company admin creating a service of their own', () => {
  it('can create one owned by their company in an active category', async () => {
    await assertSucceeds(createService('ca1', 'new1', { ownerCompanyId: 'c1' }));
  });

  it('cannot create one owned by another company', async () => {
    await assertFails(createService('ca1', 'bad1', { ownerCompanyId: 'c2' }));
  });

  it('cannot create a catalogue service (no owner)', async () => {
    await assertFails(createService('ca1', 'bad2'));
    await assertFails(createService('ca1', 'bad3', { ownerCompanyId: null }));
  });

  it('cannot use an inactive or missing category', async () => {
    await assertFails(createService('ca1', 'bad4', { ownerCompanyId: 'c1', categoryId: 'inactive1' }));
    await assertFails(createService('ca1', 'bad5', { ownerCompanyId: 'c1', categoryId: 'nope' }));
  });

  it('cannot create one that starts inactive', async () => {
    await assertFails(createService('ca1', 'bad6', { ownerCompanyId: 'c1', isActive: false }));
  });

  it('can then offer it through a company_services link', async () => {
    await assertSucceeds(createService('ca1', 'new2', { ownerCompanyId: 'c1' }));
    await assertSucceeds(
      setDoc(doc(as('ca1'), 'company_services', 'c1_new2'), {
        id: 'c1_new2',
        companyId: 'c1',
        serviceId: 'new2',
        isActive: true,
        price: 500,
        note: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('a customer cannot create services', async () => {
    await assertFails(createService('cust1', 'bad7', { ownerCompanyId: 'c1' }));
  });
});

describe('Platform Admin keeps the catalogue', () => {
  it('creates a catalogue service with no owner', async () => {
    await assertSucceeds(createService('admin', 'cat2'));
  });

  it('cannot create a service on behalf of a company', async () => {
    await assertFails(createService('admin', 'cat3', { ownerCompanyId: 'c1' }));
  });

  it('can still edit and switch off any service, including company ones', async () => {
    await assertSucceeds(editService('admin', 'catalogue1', { isActive: false }));
    await assertSucceeds(editService('admin', 'own1', { isActive: false }));
  });
});

describe('a company admin editing services', () => {
  it('can edit their own service', async () => {
    await assertSucceeds(editService('ca1', 'own1', { name: 'Renamed', description: 'new' }));
  });

  it('can switch their own service off', async () => {
    await assertSucceeds(editService('ca1', 'own1', { isActive: false }));
  });

  it('can move their own service to another active category, not an inactive one', async () => {
    await assertSucceeds(editService('ca1', 'own1', { categoryId: 'active2' }));
    await assertFails(editService('ca1', 'own1', { categoryId: 'inactive1' }));
  });

  it('can never change the owner', async () => {
    await assertFails(editService('ca1', 'own1', { ownerCompanyId: 'c2' }));
    await assertFails(editService('ca1', 'own1', { ownerCompanyId: null }));
  });

  it('cannot edit a catalogue service', async () => {
    await assertFails(editService('ca1', 'catalogue1', { name: 'Hijack' }));
    await assertFails(editService('ca1', 'catalogue1', { isActive: false }));
  });

  it("cannot edit another company's service", async () => {
    await assertFails(editService('ca1', 'own2', { name: 'Hijack' }));
    await assertFails(editService('ca1', 'own2', { isActive: false }));
  });

  it('cannot delete a service', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    await assertFails(deleteDoc(doc(as('ca1'), 'services', 'own1')));
  });
});
