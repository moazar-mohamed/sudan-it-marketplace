/*
 * Ratings: a customer rates their own completed order or service request
 * once, and the same batch moves the running averages in `ratings/`. The
 * company replies, the customer edits for 7 days, and Platform Admin hides an
 * abusive review. Local emulator only (npm run test:rules).
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
  type Firestore,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
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

const read = async (path: string) => {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path))).data();
  });
  return data;
};

beforeEach(async () => {
  await env.clearFirestore();
  const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
    put(`users/${id}`, { id, fullName: id, email: `${id}@x.test`, role, isActive: true, ...extra });
  await user('cust1', 'customer');
  await user('cust2', 'customer');
  await user('ca1', 'company_admin', { companyId: 'c1' });
  await user('ca2', 'company_admin', { companyId: 'c2' });
  await user('pa', 'platform_admin');
  for (const id of ['c1', 'c2']) {
    await put(`companies/${id}`, { name: `Company ${id}`, status: 'active', rating: 0, reviewCount: 0, createdAt: now });
  }
  const order = (id: string, customerId: string, orderStatus: string) =>
    put(`orders/${id}`, {
      id, customerId, companyId: 'c1', productId: 'p1', productName: 'Laptop', quantity: 1, orderStatus,
    });
  await order('o1', 'cust1', 'completed');
  await order('o2', 'cust1', 'processing');
  await order('o3', 'cust2', 'completed');
  await put('service_requests/r1', {
    id: 'r1', customerId: 'cust1', companyId: 'c1', companyServiceId: 'c1_svc1', status: 'completed',
  });
  await put('service_requests/r2', {
    id: 'r2', customerId: 'cust1', companyId: 'c1', companyServiceId: 'c1_svc1', status: 'in_progress',
  });
});

type Opts = {
  stars?: number;
  sourceType?: 'order' | 'service_request';
  targetId?: string;
  keys?: string[];
  sum?: number;
  count?: number;
  extra?: Record<string, unknown>;
};

/** A new review plus the two ratings it moves, in one batch. */
function rate(db: Firestore, id: string, o: Opts = {}) {
  const stars = o.stars ?? 5;
  const sourceType = o.sourceType ?? 'order';
  const targetType = sourceType === 'order' ? 'product' : 'service';
  const targetId = o.targetId ?? (sourceType === 'order' ? 'p1' : 'c1_svc1');
  const batch = writeBatch(db);
  batch.set(doc(db, 'reviews', id), {
    id,
    sourceType,
    customerId: 'cust1',
    authorName: 'Cust O.',
    companyId: 'c1',
    companyName: 'Company c1',
    targetType,
    targetId,
    targetName: 'Laptop',
    stars,
    tags: ['quality'],
    comment: 'Good',
    hidden: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...o.extra,
  });
  for (const key of o.keys ?? ['company_c1', `${targetType}_${targetId}`]) {
    batch.set(
      doc(db, 'ratings', key),
      {
        companyId: 'c1',
        sum: increment(o.sum ?? stars),
        count: increment(o.count ?? 1),
        lastReviewId: id,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
  return batch.commit();
}

/** Changes the stars (and the averages by the difference). */
function restar(db: Firestore, id: string, from: number, to: number, keys = ['company_c1', 'product_p1']) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'reviews', id), { stars: to, updatedAt: serverTimestamp() });
  for (const key of keys) {
    batch.set(
      doc(db, 'ratings', key),
      { companyId: 'c1', sum: increment(to - from), lastReviewId: id, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
  return batch.commit();
}

function moderate(
  db: Firestore,
  id: string,
  hidden: boolean,
  stars: number,
  keys = ['company_c1', 'product_p1'],
) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'reviews', id), { hidden });
  for (const key of keys) {
    batch.set(
      doc(db, 'ratings', key),
      {
        companyId: 'c1',
        sum: increment(hidden ? -stars : stars),
        count: increment(hidden ? -1 : 1),
        lastReviewId: id,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
  return batch.commit();
}

describe('rating an order or a service request', () => {
  it('lets the customer rate their completed order and moves both averages', async () => {
    await assertSucceeds(rate(as('cust1'), 'o1', { stars: 4 }));
    expect(await read('ratings/company_c1')).toMatchObject({ sum: 4, count: 1 });
    expect(await read('ratings/product_p1')).toMatchObject({ sum: 4, count: 1 });
  });

  it('adds to averages that already exist', async () => {
    await put('ratings/company_c1', { companyId: 'c1', sum: 9, count: 2, lastReviewId: 'x', updatedAt: now });
    await assertSucceeds(rate(as('cust1'), 'o1', { stars: 3 }));
    expect(await read('ratings/company_c1')).toMatchObject({ sum: 12, count: 3 });
  });

  it('lets the customer rate a completed service request', async () => {
    await assertSucceeds(rate(as('cust1'), 'r1', { sourceType: 'service_request' }));
    expect(await read('ratings/service_c1_svc1')).toMatchObject({ sum: 5, count: 1 });
  });

  it('refuses an order or request that is not completed', async () => {
    await assertFails(rate(as('cust1'), 'o2'));
    await assertFails(rate(as('cust1'), 'r2', { sourceType: 'service_request' }));
  });

  it("refuses someone else's order", async () => {
    await assertFails(rate(as('cust1'), 'o3'));
    await assertFails(rate(as('cust2'), 'o1', { extra: { customerId: 'cust2' } }));
  });

  it('refuses a product the order is not for', async () => {
    await assertFails(rate(as('cust1'), 'o1', { targetId: 'p2' }));
  });

  it('refuses stars outside one to five and unknown tags', async () => {
    await assertFails(rate(as('cust1'), 'o1', { stars: 6 }));
    await assertFails(rate(as('cust1'), 'o1', { stars: 0 }));
    await assertFails(rate(as('cust1'), 'o1', { extra: { tags: ['cheap'] } }));
  });

  it('refuses a review that does not move both averages', async () => {
    await assertFails(rate(as('cust1'), 'o1', { keys: ['company_c1'] }));
    await assertFails(rate(as('cust1'), 'o1', { keys: [] }));
  });

  it('refuses averages that do not match the stars', async () => {
    await assertFails(rate(as('cust1'), 'o1', { stars: 2, sum: 5 }));
    await assertFails(rate(as('cust1'), 'o1', { count: 2 }));
  });

  it('refuses rating the same order twice', async () => {
    await assertSucceeds(rate(as('cust1'), 'o1'));
    await assertFails(rate(as('cust1'), 'o1'));
  });

  it('refuses a review that arrives with a reply or already hidden', async () => {
    await assertFails(rate(as('cust1'), 'o1', { extra: { reply: 'x' } }));
    await assertFails(rate(as('cust1'), 'o1', { extra: { hidden: true } }));
  });

  it('refuses moving an average without a new review', async () => {
    await assertSucceeds(rate(as('cust1'), 'o1'));
    await assertFails(
      setDoc(
        doc(as('cust1'), 'ratings', 'company_c1'),
        { companyId: 'c1', sum: increment(5), count: increment(1), lastReviewId: 'o1', updatedAt: serverTimestamp() },
        { merge: true },
      ),
    );
  });
});

describe('editing a review', () => {
  beforeEach(async () => {
    await assertSucceeds(rate(as('cust1'), 'o1', { stars: 2 }));
  });

  it('lets the customer change the stars, moving the averages by the difference', async () => {
    await assertSucceeds(restar(as('cust1'), 'o1', 2, 5));
    expect(await read('ratings/company_c1')).toMatchObject({ sum: 5, count: 1 });
    expect(await read('ratings/product_p1')).toMatchObject({ sum: 5, count: 1 });
  });

  it('lets the customer change only the comment', async () => {
    await assertSucceeds(
      updateDoc(doc(as('cust1'), 'reviews', 'o1'), { comment: 'Better now', updatedAt: serverTimestamp() }),
    );
  });

  it('refuses new stars without moving the averages, or by the wrong amount', async () => {
    await assertFails(
      updateDoc(doc(as('cust1'), 'reviews', 'o1'), { stars: 5, updatedAt: serverTimestamp() }),
    );
    await assertFails(restar(as('cust1'), 'o1', 1, 5));
  });

  it('refuses editing after seven days', async () => {
    const old = Timestamp.fromDate(new Date(Date.now() - 8 * 24 * 3600 * 1000));
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), 'reviews', 'o1'), { createdAt: old }),
    );
    await assertFails(
      updateDoc(doc(as('cust1'), 'reviews', 'o1'), { comment: 'Late', updatedAt: serverTimestamp() }),
    );
  });

  it("refuses anyone else editing the customer's words", async () => {
    await assertFails(
      updateDoc(doc(as('cust2'), 'reviews', 'o1'), { comment: 'x', updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(as('ca1'), 'reviews', 'o1'), { comment: 'x', updatedAt: serverTimestamp() }),
    );
  });
});

describe('company replies', () => {
  beforeEach(async () => {
    await assertSucceeds(rate(as('cust1'), 'o1'));
  });

  it('lets the company reply and reword its reply', async () => {
    const db = as('ca1');
    await assertSucceeds(updateDoc(doc(db, 'reviews', 'o1'), { reply: 'Thanks', replyAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, 'reviews', 'o1'), { reply: 'Thank you', replyAt: serverTimestamp() }));
  });

  it('refuses another company, an empty reply and changing the stars', async () => {
    await assertFails(
      updateDoc(doc(as('ca2'), 'reviews', 'o1'), { reply: 'Hi', replyAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(as('ca1'), 'reviews', 'o1'), { reply: '', replyAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(as('ca1'), 'reviews', 'o1'), { reply: 'Hi', replyAt: serverTimestamp(), stars: 1 }),
    );
  });

  it('refuses the customer writing the reply', async () => {
    await assertFails(
      updateDoc(doc(as('cust1'), 'reviews', 'o1'), { reply: 'Me', replyAt: serverTimestamp() }),
    );
  });
});

describe('Platform Admin hides a review', () => {
  beforeEach(async () => {
    await assertSucceeds(rate(as('cust1'), 'o1', { stars: 1 }));
  });

  it('takes it out of the averages and puts it back', async () => {
    await assertSucceeds(moderate(as('pa'), 'o1', true, 1));
    expect(await read('ratings/company_c1')).toMatchObject({ sum: 0, count: 0 });
    await assertSucceeds(moderate(as('pa'), 'o1', false, 1));
    expect(await read('ratings/company_c1')).toMatchObject({ sum: 1, count: 1 });
  });

  it('refuses hiding without moving the averages, and anyone but Platform Admin', async () => {
    await assertFails(updateDoc(doc(as('pa'), 'reviews', 'o1'), { hidden: true }));
    await assertFails(moderate(as('ca1'), 'o1', true, 1));
    await assertFails(moderate(as('cust1'), 'o1', true, 1));
  });

  it('stops the customer editing a hidden review', async () => {
    await assertSucceeds(moderate(as('pa'), 'o1', true, 1));
    await assertFails(
      updateDoc(doc(as('cust1'), 'reviews', 'o1'), { comment: 'x', updatedAt: serverTimestamp() }),
    );
  });
});

describe('reading reviews', () => {
  beforeEach(async () => {
    await assertSucceeds(rate(as('cust1'), 'o1'));
    await assertSucceeds(rate(as('cust1'), 'r1', { sourceType: 'service_request' }));
    await assertSucceeds(moderate(as('pa'), 'r1', true, 5, ['company_c1', 'service_c1_svc1']));
  });

  it('shows visible reviews of a product to any signed-in user', async () => {
    const q = query(
      collection(as('cust2'), 'reviews'),
      where('targetId', '==', 'p1'),
      where('hidden', '==', false),
    );
    await assertSucceeds(getDocs(q));
    await assertSucceeds(getDoc(doc(as('cust2'), 'reviews', 'o1')));
  });

  it('keeps a hidden review from other customers but not from its own parties', async () => {
    await assertFails(getDoc(doc(as('cust2'), 'reviews', 'r1')));
    await assertSucceeds(getDoc(doc(as('cust1'), 'reviews', 'r1')));
    await assertSucceeds(getDoc(doc(as('ca1'), 'reviews', 'r1')));
    await assertSucceeds(getDocs(query(collection(as('ca1'), 'reviews'), where('companyId', '==', 'c1'))));
    await assertFails(getDocs(query(collection(as('cust2'), 'reviews'), where('companyId', '==', 'c1'))));
  });

  it('lets a customer ask for a review that does not exist yet', async () => {
    await assertSucceeds(getDoc(doc(as('cust1'), 'reviews', 'o9')));
  });

  it('lets anyone signed in read the averages', async () => {
    await assertSucceeds(getDoc(doc(as('cust2'), 'ratings', 'company_c1')));
    await assertSucceeds(getDocs(collection(as('cust2'), 'ratings')));
  });
});

describe('deleting', () => {
  it('lets Platform Admin remove reviews and averages only of a company that is gone', async () => {
    await assertSucceeds(rate(as('cust1'), 'o1'));
    await assertFails(deleteDoc(doc(as('pa'), 'reviews', 'o1')));
    await assertFails(deleteDoc(doc(as('pa'), 'ratings', 'company_c1')));
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'companies', 'c1')));
    await assertSucceeds(deleteDoc(doc(as('pa'), 'reviews', 'o1')));
    await assertSucceeds(deleteDoc(doc(as('pa'), 'ratings', 'company_c1')));
  });

  it('never lets a customer delete a review', async () => {
    await assertSucceeds(rate(as('cust1'), 'o1'));
    await assertFails(deleteDoc(doc(as('cust1'), 'reviews', 'o1')));
  });
});
