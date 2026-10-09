/*
 * Platform Admin tells people what it did, in the same batch that does it:
 * a cancelled order reaches the customer and the company; a hidden or shown
 * product reaches its company. What a notification says must be true of the
 * order or product as the batch leaves it. And the per-kind push switches a
 * person keeps on their own profile. Local emulator only (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, increment, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
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

const as = (uid: string) => env.authenticatedContext(uid, { email_verified: true }).firestore();
const put = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));

beforeEach(async () => {
  await env.clearFirestore();
  const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
    put(`users/${id}`, { id, fullName: id, email: `${id}@x.test`, role, isActive: true, createdAt: new Date(), ...extra });
  await user('pa', 'platform_admin');
  await user('cust1', 'customer');
  await user('cust2', 'customer');
  await user('ca1', 'company_admin', { companyId: 'c1' });
  await user('ca2', 'company_admin', { companyId: 'c2' });
  for (const id of ['c1', 'c2']) {
    await put(`companies/${id}`, { name: id, status: 'active', rating: 0, reviewCount: 0, createdAt: new Date() });
  }
  await put('products/p1', {
    id: 'p1',
    companyId: 'c1',
    companyName: 'c1',
    name: 'Router',
    price: 100,
    stockCount: 10,
    inStock: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await put('orders/o1', {
    id: 'o1',
    customerId: 'cust1',
    companyId: 'c1',
    productId: 'p1',
    productName: 'Router',
    quantity: 2,
    orderStatus: 'processing',
    paymentStatus: 'confirmed',
    stockReserved: true,
    totalAmount: 215000,
    createdAt: new Date(Date.now() - 48 * 3_600_000),
    updatedAt: new Date(Date.now() - 48 * 3_600_000),
  });
});

const orderNotice = (type: string, recipientType: string, recipientId: string, extra: Record<string, unknown> = {}) => ({
  id: `o1_${type}`,
  recipientType,
  recipientId,
  orderId: 'o1',
  type,
  productName: 'Router',
  isRead: false,
  createdAt: serverTimestamp(),
  senderId: 'pa',
  ...extra,
});

/** The admin's real cancellation batch, with the two notices in it. */
function cancelWithNotices(uid = 'pa', mutate: (n: ReturnType<typeof orderNotice>[]) => void = () => undefined) {
  const db = as(uid);
  const batch = writeBatch(db);
  batch.update(doc(db, 'products', 'p1'), {
    stockCount: increment(2),
    lastReleasedOrderId: 'o1',
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'orders', 'o1'), {
    orderStatus: 'cancelled',
    cancelReason: 'admin',
    cancelledAt: serverTimestamp(),
    stockReleased: true,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'admin_audit_log', 'a1'), {
    actorId: uid,
    actorName: 'Admin',
    action: 'order.cancel',
    targetType: 'order',
    targetId: 'o1',
    targetName: 'Router',
    detail: 'reason',
    createdAt: serverTimestamp(),
  });
  const notices = [
    orderNotice('order_cancelled_by_admin', 'customer', 'cust1'),
    orderNotice('order_cancelled_by_admin_company', 'company_admin', 'c1'),
  ];
  mutate(notices);
  for (const n of notices) batch.set(doc(db, 'notifications', n.id), n);
  return batch.commit();
}

describe('cancelling an order', () => {
  it('tells the customer and the company in the same batch as the cancellation, stock and activity entry', async () => {
    await assertSucceeds(cancelWithNotices());
  });

  it('cannot tell a different customer or company than the order\'s', async () => {
    await assertFails(cancelWithNotices('pa', (n) => (n[0].recipientId = 'cust2')));
    await assertFails(cancelWithNotices('pa', (n) => (n[1].recipientId = 'c2')));
  });

  it('cannot carry a name that is not the order\'s product', async () => {
    await assertFails(cancelWithNotices('pa', (n) => (n[0].productName = 'Free money')));
  });

  it('needs the order to be cancelled by the admin in the same batch', async () => {
    const db = as('pa');
    // The notice alone: the order is still processing.
    await assertFails(
      setDoc(doc(db, 'notifications', 'o1_order_cancelled_by_admin'), orderNotice('order_cancelled_by_admin', 'customer', 'cust1')),
    );
  });

  it('must be signed with the admin\'s own id and the server time', async () => {
    await assertFails(cancelWithNotices('pa', (n) => (n[0].senderId = 'cust1')));
    await assertFails(cancelWithNotices('pa', (n) => (n[0].createdAt = new Date('2020-01-01') as never)));
  });

  it('is not open to a company or a customer (they have their own notices)', async () => {
    for (const uid of ['ca1', 'cust1']) {
      await assertFails(
        setDoc(
          doc(as(uid), 'notifications', 'o1_order_cancelled_by_admin'),
          orderNotice('order_cancelled_by_admin', 'customer', 'cust1', { senderId: uid }),
        ),
      );
    }
  });

  it('carries no text of its own', async () => {
    await assertFails(cancelWithNotices('pa', (n) => Object.assign(n[0], { body: 'Pay me' })));
  });
});

const productNotice = (type: string, extra: Record<string, unknown> = {}) => ({
  id: 'pn1',
  recipientType: 'company_admin',
  recipientId: 'c1',
  productId: 'p1',
  type,
  productName: 'Router',
  isRead: false,
  createdAt: serverTimestamp(),
  senderId: 'pa',
  ...extra,
});

function hideWithNotice(mutate: (n: ReturnType<typeof productNotice>) => void = () => undefined, hidden = true) {
  const db = as('pa');
  const batch = writeBatch(db);
  batch.update(doc(db, 'products', 'p1'), { hidden, hiddenReason: hidden ? 'Counterfeit item' : '' });
  const notice = productNotice(hidden ? 'product_hidden' : 'product_shown');
  mutate(notice);
  batch.set(doc(db, 'notifications', notice.id), notice);
  return batch.commit();
}

describe('hiding and showing a product', () => {
  it('tells the company that owns it, in the same batch', async () => {
    await assertSucceeds(hideWithNotice());
  });

  it('says it is shown again, when it is', async () => {
    await put('products/p1', {
      id: 'p1', companyId: 'c1', companyName: 'c1', name: 'Router', price: 100, stockCount: 10, inStock: true,
      hidden: true, hiddenReason: 'x', createdAt: new Date(), updatedAt: new Date(),
    });
    await assertSucceeds(hideWithNotice(() => undefined, false));
  });

  it('cannot say hidden when it was shown, or the other way round', async () => {
    await assertFails(hideWithNotice((n) => (n.type = 'product_shown')));
    await assertFails(hideWithNotice((n) => (n.type = 'product_hidden'), false));
  });

  it('goes to the company that owns the product, no other', async () => {
    await assertFails(hideWithNotice((n) => (n.recipientId = 'c2')));
  });

  it('cannot name another product, or address a customer', async () => {
    await assertFails(hideWithNotice((n) => (n.productName = 'Something else')));
    await assertFails(hideWithNotice((n) => Object.assign(n, { recipientType: 'customer', recipientId: 'cust1' })));
  });

  it('is not open to a company', async () => {
    await assertFails(
      setDoc(doc(as('ca1'), 'notifications', 'pn1'), productNotice('product_hidden', { senderId: 'ca1' })),
    );
  });

  it('the company reads it, a customer and another company do not', async () => {
    await assertSucceeds(hideWithNotice());
    await assertSucceeds(getDoc(doc(as('ca1'), 'notifications', 'pn1')));
    await assertFails(getDoc(doc(as('ca2'), 'notifications', 'pn1')));
    await assertFails(getDoc(doc(as('cust1'), 'notifications', 'pn1')));
  });
});

describe('the kinds of phone notification a person wants', () => {
  const prefs = (uid: string, value: Record<string, unknown>) =>
    updateDoc(doc(as(uid), 'users', uid), { pushPrefs: value });

  it('anyone signed in sets their own, one yes/no per kind', async () => {
    for (const uid of ['cust1', 'ca1', 'pa']) {
      await assertSucceeds(prefs(uid, { orders: false, chat: true, serviceRequests: true, reports: false }));
    }
    await assertSucceeds(prefs('cust1', { cityAnnouncements: false, platform: true }));
  });

  it('nothing but yes/no for the known kinds', async () => {
    await assertFails(prefs('cust1', { orders: 'no' }));
    await assertFails(prefs('cust1', { everything: false }));
    await assertFails(prefs('cust1', 'off'));
  });

  it('cannot ride along with another field, or change another person\'s', async () => {
    await assertFails(updateDoc(doc(as('cust1'), 'users', 'cust1'), { pushPrefs: { orders: false }, role: 'platform_admin' }));
    await assertFails(updateDoc(doc(as('cust1'), 'users', 'cust2'), { pushPrefs: { orders: false } }));
  });
});
