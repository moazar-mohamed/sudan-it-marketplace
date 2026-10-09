/*
 * Internal notes: written and read by Platform Admins only, signed with the
 * writer's own id and the server time, removed only by their author. Local
 * emulator only (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
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

beforeEach(async () => {
  await env.clearFirestore();
  const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
    put(`users/${id}`, { id, fullName: id, email: `${id}@x.test`, role, isActive: true, ...extra });
  await user('pa', 'platform_admin');
  await user('pa2', 'platform_admin');
  await user('pa_off', 'platform_admin', { isActive: false });
  await user('cust1', 'customer');
  await user('ca1', 'company_admin', { companyId: 'c1' });
  await put('admin_notes/n1', {
    targetType: 'company',
    targetId: 'c1',
    text: 'Called them',
    authorId: 'pa',
    authorName: 'Admin',
    createdAt: new Date('2026-05-01'),
  });
});

const note = (extra: Record<string, unknown> = {}) => ({
  targetType: 'order',
  targetId: 'o1',
  text: 'Delivery on Sunday',
  authorId: 'pa',
  authorName: 'Admin',
  createdAt: serverTimestamp(),
  ...extra,
});

describe('writing a note', () => {
  it('an active admin writes one signed with their own id', async () => {
    await assertSucceeds(setDoc(doc(as('pa'), 'admin_notes', 'n2'), note()));
  });

  it('cannot sign it as someone else', async () => {
    await assertFails(setDoc(doc(as('pa'), 'admin_notes', 'n2'), note({ authorId: 'pa2' })));
  });

  it('is stamped with the server time', async () => {
    await assertFails(setDoc(doc(as('pa'), 'admin_notes', 'n2'), note({ createdAt: new Date('2020-01-01') })));
  });

  it('is about a company, a customer or an order, and nothing else', async () => {
    for (const targetType of ['company', 'customer', 'order']) {
      await assertSucceeds(setDoc(doc(as('pa'), 'admin_notes', `ok_${targetType}`), note({ targetType })));
    }
    await assertFails(setDoc(doc(as('pa'), 'admin_notes', 'bad'), note({ targetType: 'product' })));
  });

  it('has text, of at most 1000 characters, and no other fields', async () => {
    await assertFails(setDoc(doc(as('pa'), 'admin_notes', 'e'), note({ text: '' })));
    await assertFails(setDoc(doc(as('pa'), 'admin_notes', 'l'), note({ text: 'x'.repeat(1001) })));
    await assertSucceeds(setDoc(doc(as('pa'), 'admin_notes', 'm'), note({ text: 'x'.repeat(1000) })));
    await assertFails(setDoc(doc(as('pa'), 'admin_notes', 'x'), note({ pinned: true })));
  });

  it('nobody but an active admin can write one', async () => {
    for (const uid of ['pa_off', 'cust1', 'ca1']) {
      await assertFails(setDoc(doc(as(uid), 'admin_notes', `n_${uid}`), note({ authorId: uid })));
    }
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'admin_notes', 'anon'), note()));
  });

  it('cannot be edited afterwards, not even by its author', async () => {
    await assertFails(updateDoc(doc(as('pa'), 'admin_notes', 'n1'), { text: 'Changed' }));
  });
});

describe('reading notes', () => {
  it('an admin lists the notes on one record', async () => {
    await assertSucceeds(
      getDocs(
        query(collection(as('pa2'), 'admin_notes'), where('targetType', '==', 'company'), where('targetId', '==', 'c1')),
      ),
    );
  });

  it('no customer, company admin or deactivated admin reads them', async () => {
    for (const uid of ['pa_off', 'cust1', 'ca1']) {
      await assertFails(
        getDocs(
          query(collection(as(uid), 'admin_notes'), where('targetType', '==', 'company'), where('targetId', '==', 'c1')),
        ),
      );
    }
  });
});

describe('removing a note', () => {
  it('its author can', async () => {
    await assertSucceeds(deleteDoc(doc(as('pa'), 'admin_notes', 'n1')));
  });

  it('another admin cannot', async () => {
    await assertFails(deleteDoc(doc(as('pa2'), 'admin_notes', 'n1')));
  });

  it('nobody else can', async () => {
    await assertFails(deleteDoc(doc(as('ca1'), 'admin_notes', 'n1')));
  });
});
