/*
 * What the company web panel adds to a product and to a cancelled order.
 * Local emulator only (npm run test:rules); every user is a fake identity.
 *
 * Product (all optional, so every older document stays valid):
 *   status               published | draft | archived (absent = published)
 *   sku                  text of at most 60 characters
 *   lowStockThreshold    whole number 0..100000
 *   imageUrls            a list of at most 5 (imageUrl stays the first picture)
 *   specificationsOrder  a list of at most 50 (the order specifications show in)
 * A draft or archived product cannot be ordered.
 *
 * Order: the company may add a short `cancelNote` with its cancellation, and
 * once a PAID order is cancelled it may record the refund (`refundedAt`) once.
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
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { placeOrder } from './support/checkout';

let env: RulesTestEnvironment;
type Data = Record<string, unknown>;
const DELIVERY_FEE = 15000;

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

const productFields = (id: string, extra: Data = {}): Data => ({
  id,
  companyId: 'c1',
  companyName: 'Alpha Tech',
  name: `Product ${id}`,
  imageUrl: '',
  price: 100,
  currency: 'SDG',
  stockCount: 5,
  inStock: true,
  description: 'd',
  specifications: {},
  isDeliveryAvailable: true,
  isInstallationAvailable: false,
  installationPrice: null,
  ...extra,
});

const create = (uid: string, id: string, extra: Data = {}) =>
  setDoc(doc(as(uid), 'products', id), {
    ...productFields(id, extra),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

const edit = (uid: string, id: string, fields: Data) =>
  updateDoc(doc(as(uid), 'products', id), { ...fields, updatedAt: serverTimestamp() });

const raw = (fn: (db: Firestore) => Promise<unknown>) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore());
  });

beforeEach(async () => {
  await env.clearFirestore();
  await raw(async (db) => {
    const user = (id: string, fields: Data) =>
      setDoc(doc(db, 'users', id), { id, fullName: id, email: `${id}@x.test`, isActive: true, createdAt: new Date(), ...fields });
    await user('cust1', { role: 'customer' });
    await user('ca1', { role: 'company_admin', companyId: 'c1' });
    await user('ca2', { role: 'company_admin', companyId: 'c2' });
    await user('pa1', { role: 'platform_admin' });
    // c1 carries the name its products show (a product names its company as the company names itself).
    for (const id of ['c1', 'c2']) {
      await setDoc(doc(db, 'companies', id), { name: id === 'c1' ? 'Alpha Tech' : id, status: 'active', rating: 0, reviewCount: 0, createdAt: new Date() });
    }
    // An older product: none of the new fields.
    await setDoc(doc(db, 'products', 'old'), { ...productFields('old'), createdAt: new Date(), updatedAt: new Date() });
  });
});

describe('product fields', () => {
  it('accepts every new field on a new product', async () => {
    await assertSucceeds(
      create('ca1', 'p1', {
        status: 'draft',
        sku: 'HP-450G9',
        lowStockThreshold: 5,
        imageUrls: ['https://a.test/1.jpg', 'https://a.test/2.jpg'],
        specificationsOrder: ['CPU', 'RAM'],
      }),
    );
  });

  it('still accepts a product with none of them', async () => {
    await assertSucceeds(create('ca1', 'p1'));
  });

  it('accepts each status', async () => {
    for (const status of ['published', 'draft', 'archived']) {
      await assertSucceeds(create('ca1', `p-${status}`, { status }));
    }
  });

  it('refuses an unknown status', async () => {
    await assertFails(create('ca1', 'p1', { status: 'hidden' }));
    await assertFails(create('ca1', 'p2', { status: 1 }));
  });

  it('keeps the sku to 60 characters of text', async () => {
    await assertSucceeds(create('ca1', 'p1', { sku: 'x'.repeat(60) }));
    await assertFails(create('ca1', 'p2', { sku: 'x'.repeat(61) }));
    await assertFails(create('ca1', 'p3', { sku: 5 }));
  });

  it('keeps the low-stock threshold a whole number 0..100000', async () => {
    await assertSucceeds(create('ca1', 'p1', { lowStockThreshold: 0 }));
    await assertSucceeds(create('ca1', 'p2', { lowStockThreshold: 100000 }));
    await assertSucceeds(create('ca1', 'p3', { lowStockThreshold: null }));
    await assertFails(create('ca1', 'p4', { lowStockThreshold: -1 }));
    await assertFails(create('ca1', 'p5', { lowStockThreshold: 2.5 }));
    await assertFails(create('ca1', 'p6', { lowStockThreshold: 100001 }));
    await assertFails(create('ca1', 'p7', { lowStockThreshold: '3' }));
  });

  it('keeps the pictures to a list of five', async () => {
    const urls = (n: number) => Array.from({ length: n }, (_, i) => `https://a.test/${i}.jpg`);
    await assertSucceeds(create('ca1', 'p1', { imageUrls: urls(5) }));
    await assertFails(create('ca1', 'p2', { imageUrls: urls(6) }));
    await assertFails(create('ca1', 'p3', { imageUrls: 'https://a.test/1.jpg' }));
  });

  it('keeps the specification order to a list of fifty', async () => {
    const keys = (n: number) => Array.from({ length: n }, (_, i) => `k${i}`);
    await assertSucceeds(create('ca1', 'p1', { specificationsOrder: keys(50) }));
    await assertFails(create('ca1', 'p2', { specificationsOrder: keys(51) }));
    await assertFails(create('ca1', 'p3', { specificationsOrder: 'a,b' }));
  });

  it('refuses a field it does not know', async () => {
    await assertFails(create('ca1', 'p1', { somethingElse: true }));
  });

  it('lets the company change one new field and leaves the rest alone', async () => {
    await assertSucceeds(edit('ca1', 'old', { status: 'archived' }));
    await assertSucceeds(edit('ca1', 'old', { sku: 'A-1', lowStockThreshold: 4 }));
    await assertSucceeds(edit('ca1', 'old', { price: 120 }));
  });

  it('refuses a bad change to a new field', async () => {
    await assertFails(edit('ca1', 'old', { status: 'gone' }));
    await assertFails(edit('ca1', 'old', { lowStockThreshold: -5 }));
  });

  it('is the owning company only', async () => {
    await assertFails(edit('ca2', 'old', { status: 'archived' }));
    await assertFails(edit('cust1', 'old', { status: 'archived' }));
    await assertFails(edit('pa1', 'old', { status: 'archived' }));
  });

  it('changes the stock by a transaction that touches no other field', async () => {
    const db = as('ca1');
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        const ref = doc(db, 'products', 'old');
        const snap = await tx.get(ref);
        tx.update(ref, { stockCount: (snap.data()!.stockCount as number) + 5, updatedAt: serverTimestamp() });
      }),
    );
  });
});

describe('ordering a product that is off sale', () => {
  const order = (id: string, productId: string): Data => ({
    id,
    customerId: 'cust1',
    companyId: 'c1',
    companyName: 'Alpha Tech',
    productId,
    productName: `Product ${productId}`,
    quantity: 1,
    unitPrice: 100,
    productSubtotal: 100,
    installationSelected: false,
    installationFee: 0,
    deliveryFee: DELIVERY_FEE,
    totalAmount: 100 + DELIVERY_FEE,
    deliveryAddress: 'Street 15',
    contactPhone: '+249912345678',
    deliveryMethod: 'delivery',
    customerName: 'Customer',
    paymentStatus: 'pending_verification',
    orderStatus: 'processing',
    receiptFileName: 'receipt.jpg',
    stockReserved: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const place = (id: string, productId: string) => placeOrder(as('cust1'), 'cust1', order(id, productId));

  beforeEach(async () => {
    await raw(async (db) => {
      for (const status of ['published', 'draft', 'archived']) {
        await setDoc(doc(db, 'products', `s-${status}`), { ...productFields(`s-${status}`, { status }), createdAt: new Date(), updatedAt: new Date() });
      }
    });
  });

  it('orders a product with no status (older document)', async () => {
    await assertSucceeds(place('o-old', 'old'));
  });

  it('orders a published product', async () => {
    await assertSucceeds(place('o-pub', 's-published'));
  });

  it('refuses a draft product', async () => {
    await assertFails(place('o-draft', 's-draft'));
  });

  it('refuses an archived product', async () => {
    await assertFails(place('o-arch', 's-archived'));
  });
});

describe('cancelling an order with a note, and the refund mark', () => {
  const stored = (id: string, extra: Data = {}): Data => ({
    id,
    customerId: 'cust1',
    companyId: 'c1',
    companyName: 'Alpha Tech',
    productId: 'old',
    productName: 'Router',
    quantity: 1,
    unitPrice: 100,
    productSubtotal: 100,
    installationSelected: false,
    installationFee: 0,
    deliveryFee: DELIVERY_FEE,
    totalAmount: 100 + DELIVERY_FEE,
    deliveryAddress: 'Street',
    contactPhone: '0911111111',
    deliveryMethod: 'delivery',
    customerName: 'Customer',
    paymentStatus: 'pending_verification',
    orderStatus: 'processing',
    receiptFileName: 'receipt.jpg',
    stockReserved: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  });
  const seed = (id: string, extra: Data = {}) => raw((db) => setDoc(doc(db, 'orders', id), stored(id, extra)));

  const cancel = (uid: string, id: string, extra: Data = {}) =>
    updateDoc(doc(as(uid), 'orders', id), {
      orderStatus: 'cancelled',
      cancelReason: 'company',
      cancelledAt: serverTimestamp(),
      stockReleased: false,
      updatedAt: serverTimestamp(),
      ...extra,
    });

  it('cancels with a note', async () => {
    await seed('o1');
    await assertSucceeds(cancel('ca1', 'o1', { cancelNote: 'المبلغ لا يطابق قيمة الطلب' }));
  });

  it('cancels without a note, as before', async () => {
    await seed('o1');
    await assertSucceeds(cancel('ca1', 'o1'));
  });

  it('keeps the note to 300 characters of text', async () => {
    await seed('o1');
    await seed('o2');
    await seed('o3');
    await assertSucceeds(cancel('ca1', 'o1', { cancelNote: 'x'.repeat(300) }));
    await assertFails(cancel('ca1', 'o2', { cancelNote: 'x'.repeat(301) }));
    await assertFails(cancel('ca1', 'o3', { cancelNote: 5 }));
  });

  it('lets no other field ride along with the cancellation', async () => {
    await seed('o1');
    await assertFails(cancel('ca1', 'o1', { cancelNote: 'ok', totalAmount: 1 }));
  });

  it('is the order company only', async () => {
    await seed('o1');
    await assertFails(cancel('ca2', 'o1', { cancelNote: 'x' }));
    await assertFails(cancel('cust1', 'o1', { cancelNote: 'x' }));
  });

  it('records the refund of a paid, cancelled order once', async () => {
    await seed('paid', { paymentStatus: 'confirmed', orderStatus: 'cancelled', cancelReason: 'company', cancelledAt: new Date(), stockReleased: false });
    const mark = (uid: string, extra: Data = {}) =>
      updateDoc(doc(as(uid), 'orders', 'paid'), { refundedAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });
    await assertFails(mark('ca2'));
    await assertFails(mark('cust1'));
    await assertFails(mark('ca1', { totalAmount: 1 }));
    await assertSucceeds(mark('ca1'));
    await assertFails(mark('ca1'));
  });

  it('refuses a refund mark where there is nothing to refund', async () => {
    await seed('unpaid', { orderStatus: 'cancelled', cancelReason: 'company', cancelledAt: new Date(), stockReleased: false });
    await seed('open', { paymentStatus: 'confirmed' });
    const mark = (id: string) => updateDoc(doc(as('ca1'), 'orders', id), { refundedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    await assertFails(mark('unpaid'));
    await assertFails(mark('open'));
  });

  it('refuses a refund time that is not the server time', async () => {
    await seed('paid', { paymentStatus: 'confirmed', orderStatus: 'cancelled', cancelReason: 'company', cancelledAt: new Date(), stockReleased: false });
    await assertFails(updateDoc(doc(as('ca1'), 'orders', 'paid'), { refundedAt: new Date(2020, 1, 1), updatedAt: serverTimestamp() }));
  });
});

describe('telling the customer the company cancelled their order', () => {
  const order = (id: string, extra: Data = {}): Data => ({
    id, customerId: 'cust1', companyId: 'c1', companyName: 'Alpha Tech', productId: 'old', productName: 'Router', quantity: 1,
    unitPrice: 100, productSubtotal: 100, installationSelected: false, installationFee: 0, deliveryFee: DELIVERY_FEE,
    totalAmount: 100 + DELIVERY_FEE, deliveryAddress: 'Street', contactPhone: '0911111111', deliveryMethod: 'delivery',
    customerName: 'Customer', paymentStatus: 'pending_verification', orderStatus: 'processing', receiptFileName: 'receipt.jpg',
    stockReserved: false, createdAt: new Date(), updatedAt: new Date(), ...extra,
  });
  const notice = (id: string, extra: Data = {}): Data => ({
    id: `${id}_order_cancelled_by_company`, recipientType: 'customer', recipientId: 'cust1', orderId: id,
    type: 'order_cancelled_by_company', productName: 'Router', isRead: false, createdAt: serverTimestamp(), senderId: 'ca1', ...extra,
  });
  const cancelWithNotice = (uid: string, id: string, cancel: Data = {}, n: Data = {}, noticeId = `${id}_order_cancelled_by_company`) => {
    const db = as(uid);
    const batch = writeBatch(db);
    batch.update(doc(db, 'orders', id), { orderStatus: 'cancelled', cancelReason: 'company', cancelledAt: serverTimestamp(), stockReleased: false, updatedAt: serverTimestamp(), ...cancel });
    batch.set(doc(db, 'notifications', noticeId), { ...notice(id), ...n, id: noticeId });
    return batch.commit();
  };
  const seed = (id: string, extra: Data = {}) => raw((db) => setDoc(doc(db, 'orders', id), order(id, extra)));

  it('is written with the cancellation, by hand or as expired', async () => {
    await seed('o1');
    await seed('o2', { createdAt: new Date(Date.now() - 25 * 3600_000) });
    await assertSucceeds(cancelWithNotice('ca1', 'o1'));
    await assertSucceeds(cancelWithNotice('ca1', 'o2', { cancelReason: 'expired' }));
  });

  it('is written for a paid order too', async () => {
    await seed('o1', { paymentStatus: 'confirmed' });
    await assertSucceeds(cancelWithNotice('ca1', 'o1'));
  });

  it('is refused on its own while the order is not cancelled', async () => {
    await seed('o1');
    await assertFails(setDoc(doc(as('ca1'), 'notifications', 'o1_order_cancelled_by_company'), notice('o1')));
  });

  it('is refused when the order was cancelled by someone else', async () => {
    await seed('o1');
    await assertFails(cancelWithNotice('ca1', 'o1', { cancelReason: 'admin' }));
  });

  it('goes only to the order customer, with the order product name', async () => {
    await seed('o1');
    await seed('o2');
    await seed('o3');
    await assertFails(cancelWithNotice('ca1', 'o1', {}, { recipientId: 'cust2' }));
    await assertFails(cancelWithNotice('ca1', 'o2', {}, { productName: 'Something else' }));
    await assertFails(cancelWithNotice('ca1', 'o3', {}, { recipientType: 'company_admin' }));
  });

  it('is the order company only, and signed as its sender', async () => {
    await seed('o1');
    await seed('o2');
    await assertFails(cancelWithNotice('ca2', 'o1'));
    await assertFails(cancelWithNotice('ca1', 'o2', {}, { senderId: 'ca2' }));
  });

  it('has one fixed id and holds no other field', async () => {
    await seed('o1');
    await seed('o2');
    await assertFails(cancelWithNotice('ca1', 'o1', {}, {}, 'anything-else'));
    await assertFails(cancelWithNotice('ca1', 'o2', {}, { text: 'free text' }));
  });

  it('cannot be written twice', async () => {
    await seed('o1');
    await assertSucceeds(cancelWithNotice('ca1', 'o1'));
    await assertFails(setDoc(doc(as('ca1'), 'notifications', 'o1_order_cancelled_by_company'), notice('o1')));
  });

  it('is read by the customer it was written for', async () => {
    await seed('o1');
    await assertSucceeds(cancelWithNotice('ca1', 'o1'));
    const { getDoc } = await import('firebase/firestore');
    await assertSucceeds(getDoc(doc(as('cust1'), 'notifications', 'o1_order_cancelled_by_company')));
  });
});
