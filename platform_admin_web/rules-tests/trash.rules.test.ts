/*
 * The trash: Platform Admin moves a company or a category tree out of the
 * lists without deleting anything, and brings it back. Only the markers and
 * the status change; nobody else can set them. Local emulator only
 * (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, deleteField, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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
const put = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));

const categoryDoc = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  nameAr: '',
  nameEn: '',
  parentId: null,
  ancestorIds: [],
  deletionPending: false,
  sortOrder: 0,
  description: '',
  iconName: '',
  color: '',
  isActive: true,
  createdAt: new Date('2026-01-01'),
  ...extra,
});

beforeEach(async () => {
  await env.clearFirestore();
  await put('users/pa', { id: 'pa', fullName: 'Admin', email: 'pa@x.test', role: 'platform_admin', isActive: true });
  await put('users/ca1', { id: 'ca1', fullName: 'Co', email: 'ca@x.test', role: 'company_admin', isActive: true, companyId: 'c1' });
  await put('companies/c1', { name: 'Alpha', status: 'active', createdAt: new Date('2026-01-01') });
  await put('companies/c2', { name: 'Beta', status: 'pending', createdAt: new Date('2026-01-01') });
  await put('categories/net', categoryDoc('net'));
  await put('categories/rou', categoryDoc('rou', { parentId: 'net', ancestorIds: ['net'] }));
});

const trashCompany = (id: string, before: string, extra: Record<string, unknown> = {}) =>
  updateDoc(doc(as('pa'), 'companies', id), {
    status: 'inactive',
    statusBeforeTrash: before,
    trashedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  });

describe('moving a company to the trash', () => {
  it('works for an active company and records what it was', async () => {
    await assertSucceeds(trashCompany('c1', 'active'));
  });

  it('works for a pending company too', async () => {
    await assertSucceeds(trashCompany('c2', 'pending'));
  });

  it('must become inactive', async () => {
    await assertFails(trashCompany('c1', 'active', { status: 'active' }));
  });

  it('must record the status it really had', async () => {
    await assertFails(trashCompany('c1', 'pending'));
  });

  it('is stamped with the server time, not a time the client chose', async () => {
    await assertFails(trashCompany('c1', 'active', { trashedAt: new Date('2020-01-01') }));
  });

  it('changes nothing else: no name, no cities', async () => {
    await assertFails(trashCompany('c1', 'active', { name: 'Renamed' }));
    await assertFails(trashCompany('c1', 'active', { serviceCityIds: [] }));
  });

  it('is not open to the company itself or to a signed-in stranger', async () => {
    const data = {
      status: 'inactive',
      statusBeforeTrash: 'active',
      trashedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await assertFails(updateDoc(doc(as('ca1'), 'companies', 'c1'), data));
    await assertFails(updateDoc(doc(as('nobody'), 'companies', 'c1'), data));
  });
});

describe('bringing a company back', () => {
  beforeEach(async () => {
    await put('companies/c1', {
      name: 'Alpha',
      status: 'inactive',
      statusBeforeTrash: 'active',
      trashedAt: new Date('2026-03-01'),
      createdAt: new Date('2026-01-01'),
    });
  });

  it('returns it with the status it had and clears the markers', async () => {
    await assertSucceeds(
      updateDoc(doc(as('pa'), 'companies', 'c1'), {
        status: 'active',
        trashedAt: deleteField(),
        statusBeforeTrash: deleteField(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('cannot come back with a different status than it had', async () => {
    await assertFails(
      updateDoc(doc(as('pa'), 'companies', 'c1'), {
        status: 'rejected',
        trashedAt: deleteField(),
        statusBeforeTrash: deleteField(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('cannot keep the old status marker around', async () => {
    await assertFails(
      updateDoc(doc(as('pa'), 'companies', 'c1'), {
        status: 'active',
        trashedAt: deleteField(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('can then be deleted for good, as before (it is inactive)', async () => {
    await assertSucceeds(deleteDoc(doc(as('pa'), 'companies', 'c1')));
  });
});

describe('moving a category to the trash', () => {
  const trash = (id: string, extra: Record<string, unknown> = {}) =>
    updateDoc(doc(as('pa'), 'categories', id), {
      isActive: false,
      trashedAt: serverTimestamp(),
      trashRootId: 'net',
      activeBeforeTrash: true,
      ...extra,
    });

  it('switches the category off and stamps it, with the category the trash started from', async () => {
    await assertSucceeds(trash('net'));
    await assertSucceeds(trash('rou'));
  });

  it('is stamped with the server time', async () => {
    await assertFails(trash('net', { trashedAt: new Date('2020-01-01') }));
  });

  it('cannot carry a marker of the wrong type', async () => {
    await assertFails(trash('net', { activeBeforeTrash: 'yes' }));
    await assertFails(trash('net', { trashRootId: 42 }));
  });

  it('cannot add other fields or move the category in the same write', async () => {
    await assertFails(trash('net', { owner: 'someone' }));
    await assertFails(trash('net', { parentId: 'rou' }));
  });

  it('is not open to a company admin', async () => {
    await assertFails(
      updateDoc(doc(as('ca1'), 'categories', 'net'), { isActive: false, trashedAt: serverTimestamp(), trashRootId: 'net' }),
    );
  });

  it('a new category cannot be created already in the trash', async () => {
    await assertFails(
      setDoc(doc(as('pa'), 'categories', 'fresh'), {
        ...categoryDoc('fresh'),
        createdAt: serverTimestamp(),
        trashedAt: serverTimestamp(),
      }),
    );
  });
});

describe('bringing a category back', () => {
  beforeEach(async () => {
    await put(
      'categories/net',
      categoryDoc('net', { isActive: false, trashedAt: new Date('2026-04-01'), trashRootId: 'net', activeBeforeTrash: true }),
    );
  });

  it('removes the markers and returns each category to how active it was', async () => {
    await assertSucceeds(
      updateDoc(doc(as('pa'), 'categories', 'net'), {
        isActive: true,
        trashedAt: deleteField(),
        trashRootId: deleteField(),
        activeBeforeTrash: deleteField(),
      }),
    );
  });

  it('a trashed category can still be deleted for good once it is marked for deletion', async () => {
    await assertSucceeds(updateDoc(doc(as('pa'), 'categories', 'net'), { deletionPending: true }));
    await assertSucceeds(deleteDoc(doc(as('pa'), 'categories', 'net')));
  });

  it('a trashed category is not a place a product can be filed in (it is inactive)', async () => {
    await put('users/co2', { id: 'co2', fullName: 'Co2', email: 'co2@x.test', role: 'company_admin', isActive: true, companyId: 'c1' });
    await assertFails(
      setDoc(doc(as('co2'), 'products', 'p1'), {
        id: 'p1',
        companyId: 'c1',
        name: 'Router',
        categoryId: 'net',
        price: 10,
        stock: 1,
      }),
    );
  });
});
