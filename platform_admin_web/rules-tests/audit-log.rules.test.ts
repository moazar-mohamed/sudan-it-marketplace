/*
 * The activity trail (admin_audit_log): only an active Platform Admin writes an
 * entry, in their own name and with the server's time; nobody edits or deletes
 * one; only Platform Admin reads them. A change and its entry share one batch,
 * so the existing moderation / status rules must still accept that batch.
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
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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
  await put('companies/c1', { name: 'Company c1', status: 'active', rating: 0, reviewCount: 0, createdAt: now });
});

const entry = (actor: string, extra: Record<string, unknown> = {}) => ({
  actorId: actor,
  actorName: 'Mona',
  action: 'company.status',
  targetType: 'company',
  targetId: 'c1',
  targetName: 'Company c1',
  detail: 'inactive',
  createdAt: serverTimestamp(),
  ...extra,
});

const log = (db: ReturnType<typeof as>, id = 'e1') => doc(db, 'admin_audit_log', id);

describe('writing an entry', () => {
  it('lets an active Platform Admin write one in their own name', async () => {
    await assertSucceeds(setDoc(log(as('pa')), entry('pa')));
  });

  it('accepts an entry without a detail', async () => {
    const { detail: _detail, ...rest } = entry('pa');
    void _detail;
    await assertSucceeds(setDoc(log(as('pa')), rest));
  });

  it('refuses an entry written in another admin\'s name', async () => {
    await assertFails(setDoc(log(as('pa')), entry('pa2')));
  });

  it('refuses everyone who is not an active Platform Admin', async () => {
    await assertFails(setDoc(log(as('pa_off')), entry('pa_off')));
    await assertFails(setDoc(log(as('ca1')), entry('ca1')));
    await assertFails(setDoc(log(as('cust1')), entry('cust1')));
    await assertFails(setDoc(log(env.unauthenticatedContext().firestore()), entry('pa')));
  });

  it('refuses a made-up time, an extra field, a missing field or a bad type', async () => {
    await assertFails(setDoc(log(as('pa')), entry('pa', { createdAt: new Date('2020-01-01') })));
    await assertFails(setDoc(log(as('pa')), entry('pa', { extra: 1 })));
    const { targetId: _targetId, ...missing } = entry('pa');
    void _targetId;
    await assertFails(setDoc(log(as('pa')), missing));
    await assertFails(setDoc(log(as('pa')), entry('pa', { targetType: 'invoice' })));
    await assertFails(setDoc(log(as('pa')), entry('pa', { action: '' })));
    await assertFails(setDoc(log(as('pa')), entry('pa', { action: 'x'.repeat(61) })));
    await assertFails(setDoc(log(as('pa')), entry('pa', { targetName: 'n'.repeat(201) })));
    await assertFails(setDoc(log(as('pa')), entry('pa', { detail: 5 })));
  });
});

describe('an entry is permanent', () => {
  beforeEach(async () => {
    await assertSucceeds(setDoc(log(as('pa')), entry('pa')));
  });

  it('cannot be edited or deleted, by its author or anyone else', async () => {
    await assertFails(updateDoc(log(as('pa')), { detail: 'active' }));
    await assertFails(updateDoc(log(as('pa2')), { detail: 'active' }));
    await assertFails(deleteDoc(log(as('pa'))));
    await assertFails(deleteDoc(log(as('pa2'))));
    await assertFails(setDoc(log(as('pa')), entry('pa', { detail: 'active' })));
  });

  it('is read only by an active Platform Admin', async () => {
    await assertSucceeds(getDoc(log(as('pa2'))));
    await assertSucceeds(
      getDocs(query(collection(as('pa'), 'admin_audit_log'), orderBy('createdAt', 'desc'), limit(300))),
    );
    await assertFails(getDoc(log(as('pa_off'))));
    await assertFails(getDoc(log(as('ca1'))));
    await assertFails(getDoc(log(as('cust1'))));
    await assertFails(getDocs(collection(as('cust1'), 'admin_audit_log')));
  });
});

describe('a change and its entry in one batch', () => {
  it('a company status change', async () => {
    const db = as('pa');
    const batch = writeBatch(db);
    batch.update(doc(db, 'companies', 'c1'), { status: 'inactive', updatedAt: serverTimestamp() });
    batch.set(doc(collection(db, 'admin_audit_log')), entry('pa'));
    await assertSucceeds(batch.commit());
  });

  it('is refused whole when the entry is not valid: the change does not happen either', async () => {
    const db = as('pa');
    const batch = writeBatch(db);
    batch.update(doc(db, 'companies', 'c1'), { status: 'inactive', updatedAt: serverTimestamp() });
    batch.set(doc(collection(db, 'admin_audit_log')), entry('pa2'));
    await assertFails(batch.commit());
    await env.withSecurityRulesDisabled(async (ctx) => {
      expect((await getDoc(doc(ctx.firestore(), 'companies', 'c1'))).data()?.status).toBe('active');
    });
  });

  it('hiding a review, with its two rating moves and its entry', async () => {
    await put('reviews/o1', {
      id: 'o1', sourceType: 'order', customerId: 'cust1', companyId: 'c1', targetType: 'product',
      targetId: 'p1', stars: 1, hidden: false, createdAt: now,
    });
    await put('ratings/company_c1', { companyId: 'c1', sum: 1, count: 1, lastReviewId: 'o1', updatedAt: now });
    await put('ratings/product_p1', { companyId: 'c1', sum: 1, count: 1, lastReviewId: 'o1', updatedAt: now });

    const db = as('pa');
    const batch = writeBatch(db);
    batch.update(doc(db, 'reviews', 'o1'), { hidden: true });
    for (const key of ['company_c1', 'product_p1']) {
      batch.set(
        doc(db, 'ratings', key),
        { companyId: 'c1', sum: increment(-1), count: increment(-1), lastReviewId: 'o1', updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
    batch.set(doc(collection(db, 'admin_audit_log')), entry('pa', { action: 'review.hide', targetType: 'review', targetId: 'o1' }));
    await assertSucceeds(batch.commit());
  });

  it('a customer edit and a service create', async () => {
    await put('services/s1', { id: 's1', categoryId: 'k', name: 'Old', description: '', isActive: true, createdAt: now });
    const db = as('pa');
    const batch = writeBatch(db);
    batch.update(doc(db, 'services', 's1'), { name: 'New', description: '', categoryId: 'k' });
    batch.update(doc(db, 'users', 'cust1'), { fullName: 'Cust', phone: '0911', updatedAt: serverTimestamp() });
    batch.set(doc(collection(db, 'admin_audit_log')), entry('pa', { action: 'service.update', targetType: 'service', targetId: 's1' }));
    batch.set(doc(collection(db, 'admin_audit_log')), entry('pa', { action: 'customer.edit', targetType: 'customer', targetId: 'cust1' }));
    await assertSucceeds(batch.commit());
  });
});
