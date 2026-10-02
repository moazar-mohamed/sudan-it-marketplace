/*
 * Stock is taken when the company confirms the payment, not when the customer
 * orders (ORD-4). Local emulator only (npm run test:rules); every user is a
 * fake identity.
 *
 *  - An order is placed with its receipt, by an active customer whose e-mail
 *    is verified, within their quota of 5 orders in any 24 hours. It takes no
 *    stock and the customer never writes the product.
 *  - A stored receipt is only the customer's claim. The company alone
 *    confirms the payment, and that one write takes the stock: only the
 *    order's own company, only for a Processing order still waiting, with
 *    its receipt stored, for a product of the same company that still covers
 *    it, lowered by exactly the order's quantity.
 *  - Nothing moves on to Out for Delivery or Completed before that.
 *  - The company cancels a Processing order before or after the payment is
 *    confirmed; stock goes back only for an order that took it, and once.
 *  - Orders placed before this change keep working (they took their stock
 *    when they were placed).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
  type TokenOptions,
} from '@firebase/rules-unit-testing';
import {
  Bytes,
  Timestamp,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
  type Transaction,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ORDERS_PER_DAY,
  OutOfStock,
  QuotaReached,
  confirmPayment,
  confirmPaymentAsTheApp,
  confirmPaymentBlind,
  placeOrder,
  receiptFor,
  type ConfirmOptions,
  type PlaceOptions,
} from './support/checkout';

let env: RulesTestEnvironment;

const HOUR = 60 * 60 * 1000;
/** Keep in step with CheckoutScreen._standardDeliveryFee and firestore.rules. */
const DELIVERY_FEE = 15000;
const NAMES: Record<string, string> = { c1: 'Alpha Tech', c2: 'Beta Net' };
/** Product id -> [company, stock]. */
const PRODUCTS: Record<string, [string, number]> = {
  p1: ['c1', 10],
  p2: ['c1', 10],
  pOne: ['c1', 1],
  pThree: ['c1', 3],
  pBig: ['c1', 1000],
};
const CUSTOMERS = ['cust1', 'cust2', 'cust3', 'cust4', 'cust5', 'cust6'];

type Data = Record<string, unknown>;

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

/** Every account here has confirmed its e-mail unless a test says otherwise. */
const as = (uid: string, token: TokenOptions = { email_verified: true }) =>
  env.authenticatedContext(uid, token).firestore();
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR);

const productDoc = (id: string, extra: Data = {}): Data => {
  const [companyId, stockCount] = PRODUCTS[id];
  return {
    id,
    companyId,
    companyName: NAMES[companyId],
    name: 'Router',
    imageUrl: '',
    price: 100,
    currency: 'SDG',
    stockCount,
    inStock: true,
    description: 'd',
    specifications: {},
    isDeliveryAvailable: true,
    isInstallationAvailable: true,
    installationPrice: 5000,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  };
};

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const user = (id: string, fields: Data) =>
      setDoc(doc(db, 'users', id), { id, fullName: id, email: `${id}@x.test`, createdAt: new Date(), ...fields });
    for (const id of CUSTOMERS) {
      await user(id, { role: 'customer', isActive: true });
    }
    await user('custOff', { role: 'customer', isActive: false });
    await user('noRole', { isActive: true });
    await user('ca1', { role: 'company_admin', isActive: true, companyId: 'c1' });
    // A second device of the same company (another admin account of c1).
    await user('ca1b', { role: 'company_admin', isActive: true, companyId: 'c1' });
    await user('ca2', { role: 'company_admin', isActive: true, companyId: 'c2' });
    await user('tech1', { role: 'technician', isActive: true, companyId: 'c1' });
    await user('pa1', { role: 'platform_admin', isActive: true });
    // 'ghost1' signs in but has no users document at all.
    for (const id of ['c1', 'c2']) {
      await setDoc(doc(db, 'companies', id), { name: NAMES[id], status: 'active', rating: 0, reviewCount: 0, createdAt: new Date() });
    }
    await setDoc(doc(db, 'technicians', 't1'), {
      id: 't1',
      companyId: 'c1',
      email: 'tech1@x.test',
      fullName: 'Tech One',
      phone: '1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    for (const id of Object.keys(PRODUCTS)) {
      await setDoc(doc(db, 'products', id), productDoc(id));
    }
  });
}

beforeEach(seed);

/** A correctly priced delivery order, as the app writes it. */
const order = (id: string, uid: string, productId: string, quantity: number, extra: Data = {}): Data => {
  const companyId = PRODUCTS[productId]?.[0] ?? 'c1';
  return {
    id,
    customerId: uid,
    companyId,
    companyName: NAMES[companyId],
    productId,
    productName: 'Router',
    quantity,
    unitPrice: 100,
    productSubtotal: 100 * quantity,
    installationSelected: false,
    installationFee: 0,
    deliveryFee: DELIVERY_FEE,
    totalAmount: 100 * quantity + DELIVERY_FEE,
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
    ...extra,
  };
};

interface Place extends PlaceOptions {
  token?: TokenOptions;
  extra?: Data;
}

/** The app's checkout: [uid] orders [quantity] of [productId]. */
const place = (uid: string, id: string, productId: string, quantity: number, options: Place = {}) =>
  placeOrder(as(uid, options.token), uid, order(id, uid, productId, quantity, options.extra), options);

/** The app's payment confirmation by the company admin [uid]. */
const confirm = (uid: string, orderId: string, options: ConfirmOptions = {}) =>
  confirmPayment(as(uid), orderId, options);

/**
 * The app's cancellation: stock goes back only for an order that took it and
 * whose product is still its company's. [release] forces what is claimed.
 */
function cancel(uid: string, orderId: string, reason = 'company', release?: boolean) {
  const db = as(uid);
  return runTransaction(db, async (tx) => {
    const orderRef = doc(db, 'orders', orderId);
    const o = (await tx.get(orderRef)).data()!;
    const productRef = doc(db, 'products', o.productId as string);
    const p = await tx.get(productRef);
    // As the app (OrderModel): a missing stockReserved means the stock was taken.
    const gives = release ?? (o.stockReserved !== false && p.exists() && p.data()!.companyId === o.companyId);
    if (gives && p.exists()) {
      tx.update(productRef, {
        stockCount: (p.data()!.stockCount as number) + (o.quantity as number),
        lastReleasedOrderId: orderId,
        updatedAt: serverTimestamp(),
      });
    }
    tx.update(orderRef, {
      orderStatus: 'cancelled',
      cancelReason: reason,
      cancelledAt: serverTimestamp(),
      stockReleased: gives,
      updatedAt: serverTimestamp(),
    });
  });
}

/** Writes with the rules off: a state the app could have left, or one from before this change. */
const raw = (fn: (db: Firestore) => Promise<unknown>) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore());
  });
const setOrder = (id: string, fields: Data) => raw((db) => updateDoc(doc(db, 'orders', id), fields));

/** Reads bypass the rules so assertions see the stored truth. */
async function stored(path: string): Promise<Data | undefined> {
  let data: Data | undefined;
  await raw(async (db) => {
    data = (await getDoc(doc(db, path))).data();
  });
  return data;
}
const stockOf = async (productId: string) => (await stored(`products/${productId}`))?.stockCount;

/** A refused checkout leaves nothing behind: no order, receipt, conversation or quota step. */
async function nothingStored(orderId: string, uid = 'cust1') {
  expect(await stored(`orders/${orderId}`)).toBeUndefined();
  expect(await stored(`order_receipts/${orderId}`)).toBeUndefined();
  expect(await stored(`chats/${orderId}`)).toBeUndefined();
  expect(await stored(`order_quota/${uid}`)).toBeUndefined();
}

describe('placing an order', () => {
  it('without a receipt it is refused: none at all, a name with no receipt document, or a receipt under another name', async () => {
    await assertFails(place('cust1', 'o1', 'p1', 2, { receipt: null, extra: { receiptFileName: null }, maxAttempts: 1 }));
    await nothingStored('o1');
    await assertFails(place('cust1', 'o1', 'p1', 2, { receipt: null, maxAttempts: 1 }));
    await nothingStored('o1');
    await assertFails(
      place('cust1', 'o1', 'p1', 2, {
        receipt: receiptFor(order('o1', 'cust1', 'p1', 2), { fileName: 'other.jpg' }),
        maxAttempts: 1,
      }),
    );
    await nothingStored('o1');
    await assertFails(place('cust1', 'o1', 'p1', 2, { extra: { receiptFileName: '' }, maxAttempts: 1 }));
    await nothingStored('o1');
    // The same order with its receipt goes through.
    await assertSucceeds(place('cust1', 'o1', 'p1', 2));
  });

  it("a receipt is only the customer's claim: a one-byte image is stored, the payment stays pending and no stock is taken", async () => {
    const tiny = { image: Bytes.fromUint8Array(new Uint8Array([1])), sizeBytes: 1, width: 1, height: 1 };
    await assertSucceeds(place('cust1', 'o1', 'p1', 2, { receipt: receiptFor(order('o1', 'cust1', 'p1', 2), tiny) }));
    expect(await stored('orders/o1')).toMatchObject({ paymentStatus: 'pending_verification', stockReserved: false });
    expect(await stockOf('p1')).toBe(10);
  });

  it('an ordinary order is waiting for payment verification and has taken no stock', async () => {
    await assertSucceeds(place('cust1', 'o1', 'p1', 2));
    expect(await stored('orders/o1')).toMatchObject({
      orderStatus: 'processing',
      paymentStatus: 'pending_verification',
      stockReserved: false,
      receiptFileName: 'receipt.jpg',
    });
    expect(await stored('order_receipts/o1')).toMatchObject({ fileName: 'receipt.jpg', customerId: 'cust1' });
    expect(await stockOf('p1')).toBe(10);
  });

  it('the product document is left exactly as it was', async () => {
    const before = await stored('products/p1');
    await assertSucceeds(place('cust1', 'o1', 'p1', 2, { chat: true }));
    expect(await stored('products/p1')).toEqual(before);
  });

  it('the old checkout, which also lowered the stock, is refused', async () => {
    const lowerStock = (tx: Transaction, db: Firestore) =>
      tx.update(doc(db, 'products', 'p1'), { stockCount: 8, lastOrderId: 'o1', updatedAt: serverTimestamp() });
    await assertFails(place('cust1', 'o1', 'p1', 2, { also: lowerStock, maxAttempts: 1 }));
    await nothingStored('o1');
    expect(await stockOf('p1')).toBe(10);
  });

  it('a customer can never write a product: not its stock, alone or with an order of their own', async () => {
    for (const stockCount of [0, 8, 9, 50]) {
      await assertFails(
        updateDoc(doc(as('cust1'), 'products', 'p1'), { stockCount, lastOrderId: 'x', updatedAt: serverTimestamp() }),
      );
    }
    await assertSucceeds(place('cust1', 'o1', 'p1', 2));
    await assertFails(
      updateDoc(doc(as('cust1'), 'products', 'p1'), { stockCount: 8, lastOrderId: 'o1', updatedAt: serverTimestamp() }),
    );
    expect(await stockOf('p1')).toBe(10);
  });

  it('an order cannot say it took stock, nor leave it unsaid', async () => {
    await assertFails(place('cust1', 'o1', 'p1', 2, { extra: { stockReserved: true }, maxAttempts: 1 }));
    await assertFails(place('cust1', 'o1', 'p1', 2, { extra: { stockReserved: null }, maxAttempts: 1 }));
    const withoutMarker = order('o1', 'cust1', 'p1', 2);
    delete withoutMarker.stockReserved;
    await assertFails(placeOrder(as('cust1'), 'cust1', withoutMarker, { maxAttempts: 1 }));
    await nothingStored('o1');
    await assertSucceeds(place('cust1', 'o1', 'p1', 2));
  });

  it('more than the stock right now is refused; exactly the stock is accepted and takes nothing', async () => {
    await assertFails(place('cust1', 'o1', 'p1', 11, { maxAttempts: 1 }));
    await nothingStored('o1');
    await assertSucceeds(place('cust1', 'o1', 'p1', 10));
    expect(await stockOf('p1')).toBe(10);
  });

  it('a product marked unavailable, or with no document, cannot be ordered', async () => {
    await raw((db) => updateDoc(doc(db, 'products', 'p1'), { inStock: false }));
    await assertFails(place('cust1', 'o1', 'p1', 1, { maxAttempts: 1 }));
    await assertFails(place('cust1', 'o2', 'no-such-product', 1, { maxAttempts: 1 }));
    await assertSucceeds(place('cust1', 'o3', 'p2', 1));
  });

  it('the price (SEC-001) and the names (ORD-1) still come from the product', async () => {
    await assertFails(
      place('cust1', 'o1', 'p1', 2, { extra: { unitPrice: 1, productSubtotal: 2, totalAmount: 2 + DELIVERY_FEE }, maxAttempts: 1 }),
    );
    await assertFails(place('cust1', 'o1', 'p1', 2, { extra: { productName: 'Gift card' }, maxAttempts: 1 }));
    await assertFails(place('cust1', 'o1', 'p1', 2, { extra: { companyName: 'Ministry' }, maxAttempts: 1 }));
    await nothingStored('o1');
    await assertSucceeds(place('cust1', 'o1', 'p1', 2));
  });

  it('the whole checkout (order, receipt, conversation, quota), then its "new order" notification', async () => {
    await assertSucceeds(place('cust1', 'o1', 'p1', 2, { chat: true }));
    expect(await stored('chats/o1')).toMatchObject({ orderId: 'o1', productName: 'Router' });
    expect(await stored('order_quota/cust1')).toMatchObject({ next: 1, lastOrderId: 'o1' });
    await assertSucceeds(
      setDoc(doc(as('cust1'), 'notifications', 'o1_new_order'), {
        id: 'o1_new_order',
        recipientType: 'company_admin',
        recipientId: 'c1',
        orderId: 'o1',
        type: 'new_order',
        productName: 'Router',
        isRead: false,
        createdAt: serverTimestamp(),
        senderId: 'cust1',
      }),
    );
  });
});

describe('the company confirms the payment: the stock is taken in that same write', () => {
  it('confirming takes exactly the ordered quantity and marks the order', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await assertSucceeds(confirm('ca1', 'o1'));
    expect(await stored('orders/o1')).toMatchObject({ paymentStatus: 'confirmed', stockReserved: true, orderStatus: 'processing' });
    expect(await stored('products/p1')).toMatchObject({ stockCount: 8, lastOrderId: 'o1' });
  });

  it('a second confirmation is refused, through the app and as a blind write', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await confirm('ca1', 'o1');
    await assertFails(confirm('ca1', 'o1', { maxAttempts: 1 }));
    await assertFails(confirmPaymentBlind(as('ca1'), 'o1', 'p1', 6));
    expect(await stockOf('p1')).toBe(8);
  });

  it('a write that changes nothing on the order is refused (it cannot pass for a confirmation)', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await assertFails(updateDoc(doc(as('ca1'), 'orders', 'o1'), { updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('ca1'), 'orders', 'o1'), { orderStatus: 'processing', updatedAt: serverTimestamp() }));
    await confirm('ca1', 'o1');
    // Confirmed already: an order write that changes nothing, riding along
    // with the company's own stock edit, does not count as a second one.
    const db = as('ca1');
    const batch = writeBatch(db);
    batch.update(doc(db, 'products', 'p1'), { stockCount: 6, lastOrderId: 'o1', updatedAt: serverTimestamp() });
    batch.update(doc(db, 'orders', 'o1'), { paymentStatus: 'confirmed', updatedAt: serverTimestamp() });
    await assertFails(batch.commit());
    expect(await stockOf('p1')).toBe(8);
  });

  it('a cancelled order cannot be confirmed', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await cancel('ca1', 'o1');
    await assertFails(confirm('ca1', 'o1', { maxAttempts: 1 }));
    expect(await stockOf('p1')).toBe(10);
    expect((await stored('orders/o1'))!.paymentStatus).toBe('pending_verification');
  });

  it('a completed order cannot be confirmed (one completed before this change, payment still pending)', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await setOrder('o1', { orderStatus: 'completed' });
    await assertFails(confirm('ca1', 'o1', { maxAttempts: 1 }));
    await setOrder('o1', { orderStatus: 'out_for_delivery' });
    await assertFails(confirm('ca1', 'o1', { maxAttempts: 1 }));
    expect(await stockOf('p1')).toBe(10);
  });

  it('an order with no stored receipt cannot be confirmed; once the receipt is stored it can', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await raw((db) => deleteDoc(doc(db, 'order_receipts', 'o1')));
    await assertFails(confirm('ca1', 'o1', { maxAttempts: 1 }));
    expect(await stockOf('p1')).toBe(10);
    // The customer stores the receipt of this order (the attach path).
    await assertSucceeds(setDoc(doc(as('cust1'), 'order_receipts', 'o1'), receiptFor(order('o1', 'cust1', 'p1', 2))));
    await assertSucceeds(confirm('ca1', 'o1'));
    expect(await stockOf('p1')).toBe(8);
  });

  it("taking another product's stock is refused", async () => {
    await place('cust1', 'o1', 'p1', 2);
    await assertFails(confirm('ca1', 'o1', { productId: 'p2', maxAttempts: 1 }));
    expect(await stockOf('p1')).toBe(10);
    expect(await stockOf('p2')).toBe(10);
  });

  it('a product that now belongs to another company cannot be used, by either company', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await raw((db) => updateDoc(doc(db, 'products', 'p1'), { companyId: 'c2', companyName: NAMES.c2 }));
    await assertFails(confirm('ca1', 'o1', { skipAppChecks: true, maxAttempts: 1 }));
    await assertFails(confirmPaymentBlind(as('ca1'), 'o1', 'p1', 8));
    await assertFails(confirmPaymentBlind(as('ca2'), 'o1', 'p1', 8));
    expect(await stockOf('p1')).toBe(10);
    expect((await stored('orders/o1'))!.paymentStatus).toBe('pending_verification');
  });

  it('taking the wrong amount is refused (less or more than the quantity)', async () => {
    await place('cust1', 'o1', 'p1', 2);
    for (const take of [0, 1, 3, -2]) {
      await assertFails(confirm('ca1', 'o1', { take, maxAttempts: 1 }));
    }
    expect(await stockOf('p1')).toBe(10);
  });

  it('nothing else on the order may change: price, total, quantity, status, customer', async () => {
    await place('cust1', 'o1', 'p1', 2);
    for (const extra of [
      { totalAmount: 1 },
      { unitPrice: 1 },
      { quantity: 1 },
      { orderStatus: 'out_for_delivery' },
      { customerId: 'cust2' },
      { receiptFileName: 'other.jpg' },
      { stockReserved: false },
      { updatedAt: new Date() },
      // The stock write must come with the payment marked confirmed, nothing else.
      { paymentStatus: 'pending_verification' },
      { paymentStatus: 'refunded' },
    ]) {
      await assertFails(confirm('ca1', 'o1', { extra, maxAttempts: 1 }));
    }
    expect(await stockOf('p1')).toBe(10);
  });

  it('one stock write confirms one order: two confirmations sharing a single deduction are refused', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await place('cust2', 'o2', 'p1', 2);
    const db = as('ca1');
    const batch = writeBatch(db);
    batch.update(doc(db, 'products', 'p1'), { stockCount: 8, lastOrderId: 'o2', updatedAt: serverTimestamp() });
    for (const id of ['o1', 'o2']) {
      batch.update(doc(db, 'orders', id), { paymentStatus: 'confirmed', stockReserved: true, updatedAt: serverTimestamp() });
    }
    await assertFails(batch.commit());
    expect(await stockOf('p1')).toBe(10);
    // The stock write must name the order it is for.
    const named = writeBatch(db);
    named.update(doc(db, 'products', 'p1'), { stockCount: 8, lastOrderId: 'o2', updatedAt: serverTimestamp() });
    named.update(doc(db, 'orders', 'o1'), { paymentStatus: 'confirmed', stockReserved: true, updatedAt: serverTimestamp() });
    await assertFails(named.commit());
    // The same write naming o1 goes through.
    await assertSucceeds(confirmPaymentBlind(db, 'o1', 'p1', 8));
  });

  it('confirming without taking the stock is refused, and so is the old paymentStatus-only update', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await assertFails(confirm('ca1', 'o1', { noStock: true, maxAttempts: 1 }));
    await assertFails(updateDoc(doc(as('ca1'), 'orders', 'o1'), { paymentStatus: 'confirmed', updatedAt: serverTimestamp() }));
    expect((await stored('orders/o1'))!.paymentStatus).toBe('pending_verification');
  });

  it('a payment cannot be confirmed along with another change (a technician assignment) without taking the stock', async () => {
    await place('cust1', 'o1', 'p1', 2, { extra: { installationSelected: true, installationFee: 5000, totalAmount: 5200 + DELIVERY_FEE } });
    const assign = { technicianId: 't1', technicianName: 'Tech One', updatedAt: serverTimestamp() };
    await assertFails(updateDoc(doc(as('ca1'), 'orders', 'o1'), { ...assign, paymentStatus: 'confirmed' }));
    // ...nor with the stock taken in the same write: a confirmation changes nothing else.
    await assertFails(confirm('ca1', 'o1', { extra: { technicianId: 't1', technicianName: 'Tech One' }, maxAttempts: 1 }));
    expect(await stored('orders/o1')).toMatchObject({ paymentStatus: 'pending_verification', stockReserved: false });
    // Each on its own goes through.
    await assertSucceeds(updateDoc(doc(as('ca1'), 'orders', 'o1'), assign));
    await assertSucceeds(confirm('ca1', 'o1'));
  });

  it("a price change after the order does not block the confirmation: the order keeps its own price", async () => {
    await place('cust1', 'o1', 'p1', 2);
    await raw((db) => updateDoc(doc(db, 'products', 'p1'), { price: 150 }));
    await assertSucceeds(confirm('ca1', 'o1'));
    expect(await stored('orders/o1')).toMatchObject({ paymentStatus: 'confirmed', unitPrice: 100, totalAmount: 200 + DELIVERY_FEE });
    // Even a product that has lost its price since.
    await place('cust2', 'o2', 'p2', 1);
    await raw((db) => updateDoc(doc(db, 'products', 'p2'), { price: null }));
    await assertSucceeds(confirm('ca1', 'o2'));
  });

  it("only the order's own company confirms it", async () => {
    await place('cust1', 'o1', 'p1', 2);
    for (const uid of ['ca2', 'tech1', 'pa1', 'cust1', 'cust2']) {
      await assertFails(confirmPaymentBlind(as(uid), 'o1', 'p1', 8));
    }
    expect(await stockOf('p1')).toBe(10);
    // The same blind writes from the order's company go through.
    await assertSucceeds(confirmPaymentBlind(as('ca1'), 'o1', 'p1', 8));
  });

  it('when the stock no longer covers the order nothing is written; after restocking it can be confirmed', async () => {
    await place('cust1', 'o1', 'p1', 5);
    await raw((db) => updateDoc(doc(db, 'products', 'p1'), { stockCount: 3 }));
    await expect(confirm('ca1', 'o1')).rejects.toBeInstanceOf(OutOfStock);
    // A modified client that skips the check: the stock would go to -2.
    await assertFails(confirm('ca1', 'o1', { skipAppChecks: true, maxAttempts: 1 }));
    // ...or would stop at 0 instead of taking the whole quantity.
    await assertFails(confirmPaymentBlind(as('ca1'), 'o1', 'p1', 0));
    expect(await stockOf('p1')).toBe(3);
    expect(await stored('orders/o1')).toMatchObject({ paymentStatus: 'pending_verification', stockReserved: false });

    await assertSucceeds(updateDoc(doc(as('ca1'), 'products', 'p1'), { stockCount: 7, updatedAt: serverTimestamp() }));
    await assertSucceeds(confirm('ca1', 'o1'));
    expect(await stockOf('p1')).toBe(2);
  });

  it('two devices confirm two orders for the LAST unit at once: exactly one is confirmed, every time', async () => {
    const rounds = 8;
    for (let round = 0; round < rounds * 2; round++) {
      await seed();
      await place('cust1', 'w1', 'pOne', 1);
      await place('cust2', 'w2', 'pOne', 1);
      if (round < rounds) {
        await Promise.allSettled([confirm('ca1', 'w1'), confirm('ca1b', 'w2')]);
      } else {
        await Promise.allSettled([
          confirmPaymentBlind(as('ca1'), 'w1', 'pOne', 0),
          confirmPaymentBlind(as('ca1b'), 'w2', 'pOne', 0),
        ]);
      }
      const confirmed = [await stored('orders/w1'), await stored('orders/w2')].filter(
        (o) => o!.paymentStatus === 'confirmed',
      );
      expect(confirmed).toHaveLength(1);
      expect(confirmed[0]!.stockReserved).toBe(true);
      expect(await stockOf('pOne')).toBe(0);
    }
  }, 120_000);

  it('six orders for 3 units, all confirmed at once: exactly 3 are confirmed and the stock ends at 0', async () => {
    for (let i = 1; i <= 6; i++) {
      await place(CUSTOMERS[i - 1], `m${i}`, 'pThree', 1);
    }
    // Without any retry, a confirmation may be refused against the newer stock:
    // never more than 3 go through, and the stock always matches them.
    const plain = await Promise.allSettled(
      [1, 2, 3, 4, 5, 6].map((i) => confirm(i % 2 ? 'ca1' : 'ca1b', `m${i}`, { maxAttempts: 30 })),
    );
    const plainConfirmed = plain.filter((r) => r.status === 'fulfilled').length;
    expect(plainConfirmed).toBeGreaterThan(0);
    expect(plainConfirmed).toBeLessThanOrEqual(3);
    expect(await stockOf('pThree')).toBe(3 - plainConfirmed);

    // With the app's retry: exactly 3, and every other one ends out of stock.
    await seed();
    for (let i = 1; i <= 6; i++) {
      await place(CUSTOMERS[i - 1], `m${i}`, 'pThree', 1);
    }
    const results = await Promise.allSettled(
      [1, 2, 3, 4, 5, 6].map((i) => confirmPaymentAsTheApp(as(i % 2 ? 'ca1' : 'ca1b'), `m${i}`)),
    );
    for (const r of results) {
      if (r.status === 'rejected') expect(r.reason).toBeInstanceOf(OutOfStock);
    }
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    expect(await stockOf('pThree')).toBe(0);
    const orders = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => stored(`orders/m${i}`)));
    expect(orders.filter((o) => o!.paymentStatus === 'confirmed')).toHaveLength(3);
    expect(orders.filter((o) => o!.stockReserved === true)).toHaveLength(3);
  }, 60_000);
});

describe('cancelling', () => {
  it('before the payment: the customer cannot; the company can, and no stock moves', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await assertFails(
      updateDoc(doc(as('cust1'), 'orders', 'o1'), {
        orderStatus: 'cancelled',
        cancelReason: 'company',
        cancelledAt: serverTimestamp(),
        stockReleased: false,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(cancel('ca1', 'o1'));
    expect(await stored('orders/o1')).toMatchObject({ orderStatus: 'cancelled', stockReleased: false });
    expect(await stockOf('p1')).toBe(10);
  });

  it('before the payment: claiming stock back for an order that took none is refused', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await assertFails(cancel('ca1', 'o1', 'company', true));
    expect(await stockOf('p1')).toBe(10);
  });

  it('after the payment: the company cancels and the stock goes back exactly once', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await confirm('ca1', 'o1');
    expect(await stockOf('p1')).toBe(8);
    await assertSucceeds(cancel('ca1', 'o1'));
    expect(await stored('orders/o1')).toMatchObject({ orderStatus: 'cancelled', stockReleased: true, paymentStatus: 'confirmed' });
    expect(await stockOf('p1')).toBe(10);
    await assertFails(cancel('ca1', 'o1'));
    await assertFails(cancel('ca1', 'o1', 'company', true));
    expect(await stockOf('p1')).toBe(10);
  });

  it('after the payment: it cannot be cancelled while keeping the stock', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await confirm('ca1', 'o1');
    await assertFails(cancel('ca1', 'o1', 'company', false));
    expect(await stockOf('p1')).toBe(8);
  });

  it('after the payment: only the company, never the customer, technician or Platform Admin', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await confirm('ca1', 'o1');
    for (const uid of ['cust1', 'tech1', 'pa1', 'ca2']) {
      const db = as(uid);
      const batch = writeBatch(db);
      batch.update(doc(db, 'products', 'p1'), { stockCount: 10, lastReleasedOrderId: 'o1', updatedAt: serverTimestamp() });
      batch.update(doc(db, 'orders', 'o1'), {
        orderStatus: 'cancelled',
        cancelReason: 'company',
        cancelledAt: serverTimestamp(),
        stockReleased: true,
        updatedAt: serverTimestamp(),
      });
      await assertFails(batch.commit());
    }
    expect(await stockOf('p1')).toBe(8);
  });

  it('Out for Delivery and Completed orders cannot be cancelled', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await confirm('ca1', 'o1');
    await assertSucceeds(updateDoc(doc(as('ca1'), 'orders', 'o1'), { orderStatus: 'out_for_delivery', updatedAt: serverTimestamp() }));
    await assertFails(cancel('ca1', 'o1'));
    await assertSucceeds(updateDoc(doc(as('ca1'), 'orders', 'o1'), { orderStatus: 'completed', updatedAt: serverTimestamp() }));
    await assertFails(cancel('ca1', 'o1'));
    expect(await stockOf('p1')).toBe(8);
  });

  it('expired: after 24 hours without verification, with no stock change; never before', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await setOrder('o1', { createdAt: hoursAgo(23) });
    await assertFails(cancel('ca1', 'o1', 'expired'));
    await setOrder('o1', { createdAt: hoursAgo(25) });
    await assertSucceeds(cancel('ca1', 'o1', 'expired'));
    expect(await stored('orders/o1')).toMatchObject({ cancelReason: 'expired', stockReleased: false });
    expect(await stockOf('p1')).toBe(10);
  });

  it('expired: never once the payment is confirmed, however old', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await confirm('ca1', 'o1');
    await setOrder('o1', { createdAt: hoursAgo(72) });
    await assertFails(cancel('ca1', 'o1', 'expired'));
    expect(await stockOf('p1')).toBe(8);
  });

  it('the reason is still one of the fixed values', async () => {
    await place('cust1', 'o1', 'p1', 2);
    for (const reason of ['customer', 'refund', 'OUT_OF_STOCK', '', 'x'.repeat(1000)]) {
      await assertFails(cancel('ca1', 'o1', reason));
    }
    await assertSucceeds(cancel('ca1', 'o1', 'company'));
  });
});

describe("cancelling as out of stock (the company returns the money outside the app)", () => {
  it('refused while the stock still covers the order', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await assertFails(cancel('ca1', 'o1', 'out_of_stock'));
    await raw((db) => updateDoc(doc(db, 'products', 'p1'), { stockCount: 2 }));
    await assertFails(cancel('ca1', 'o1', 'out_of_stock'));
    // One unit short: now it may.
    await raw((db) => updateDoc(doc(db, 'products', 'p1'), { stockCount: 1 }));
    await assertSucceeds(cancel('ca1', 'o1', 'out_of_stock'));
    expect(await stored('orders/o1')).toMatchObject({ cancelReason: 'out_of_stock', stockReleased: false });
    expect(await stockOf('p1')).toBe(1);
  });

  it('refused once the payment is confirmed (the stock was taken)', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await confirm('ca1', 'o1');
    await raw((db) => updateDoc(doc(db, 'products', 'p1'), { stockCount: 0 }));
    await assertFails(cancel('ca1', 'o1', 'out_of_stock'));
  });

  it("only by the order's own company", async () => {
    await place('cust1', 'o1', 'p1', 2);
    await raw((db) => updateDoc(doc(db, 'products', 'p1'), { stockCount: 0 }));
    for (const uid of ['ca2', 'cust1', 'tech1', 'pa1']) {
      await assertFails(
        updateDoc(doc(as(uid), 'orders', 'o1'), {
          orderStatus: 'cancelled',
          cancelReason: 'out_of_stock',
          cancelledAt: serverTimestamp(),
          stockReleased: false,
          updatedAt: serverTimestamp(),
        }),
      );
    }
    await assertSucceeds(cancel('ca1', 'o1', 'out_of_stock'));
  });

  it('a deleted product: the order cannot be confirmed, is cancelled as out of stock, and a paid one gives nothing back', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await place('cust2', 'o2', 'p2', 2);
    await confirm('ca1', 'o2');
    await raw(async (db) => {
      await deleteDoc(doc(db, 'products', 'p1'));
      await deleteDoc(doc(db, 'products', 'p2'));
    });
    await assertFails(confirm('ca1', 'o1', { skipAppChecks: true, maxAttempts: 1 }));
    await assertSucceeds(cancel('ca1', 'o1', 'out_of_stock'));
    // The paid order: claiming a return onto a product that is gone is refused...
    await assertFails(cancel('ca1', 'o2', 'company', true));
    // ...and it is cancelled with nothing given back.
    await assertSucceeds(cancel('ca1', 'o2'));
    expect(await stored('orders/o2')).toMatchObject({ orderStatus: 'cancelled', stockReleased: false });
    expect(await stored('products/p2')).toBeUndefined();
  });

  it('a product id now used by another company: no confirmation, out of stock allowed, and that company gets nothing', async () => {
    await place('cust1', 'o1', 'p1', 2);
    await place('cust2', 'o2', 'p2', 2);
    await confirm('ca1', 'o2');
    await raw(async (db) => {
      for (const p of ['p1', 'p2']) {
        await updateDoc(doc(db, 'products', p), { companyId: 'c2', companyName: NAMES.c2, stockCount: 7 });
      }
    });
    await assertFails(confirm('ca1', 'o1', { skipAppChecks: true, maxAttempts: 1 }));
    await assertSucceeds(cancel('ca1', 'o1', 'out_of_stock'));
    await assertFails(cancel('ca1', 'o2', 'company', true));
    await assertSucceeds(cancel('ca1', 'o2'));
    expect(await stockOf('p1')).toBe(7);
    expect(await stockOf('p2')).toBe(7);
  });
});

describe('orders placed before this change', () => {
  /** An order stored as the app used to write it: its stock taken when it was placed. */
  const legacy = (id: string, extra: Data = {}) =>
    raw(async (db) => {
      await setDoc(doc(db, 'orders', id), {
        ...order(id, 'cust1', 'p1', 3),
        stockReserved: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...extra,
      });
      await setDoc(doc(db, 'order_receipts', id), { ...receiptFor(order(id, 'cust1', 'p1', 3)), createdAt: new Date() });
      await updateDoc(doc(db, 'products', 'p1'), { stockCount: 7 });
    });

  it('an unpaid one that took its stock is confirmed without taking more', async () => {
    await legacy('L1');
    await assertSucceeds(confirm('ca1', 'L1'));
    expect(await stored('orders/L1')).toMatchObject({ paymentStatus: 'confirmed', stockReserved: true });
    expect(await stockOf('p1')).toBe(7);
  });

  it("...and only the order's own company confirms it (no stock write is involved to stop anyone else)", async () => {
    await legacy('L1');
    for (const uid of ['ca2', 'cust1', 'tech1', 'pa1']) {
      await assertFails(
        updateDoc(doc(as(uid), 'orders', 'L1'), { paymentStatus: 'confirmed', updatedAt: serverTimestamp() }),
      );
    }
    expect((await stored('orders/L1'))!.paymentStatus).toBe('pending_verification');
    await assertSucceeds(
      updateDoc(doc(as('ca1'), 'orders', 'L1'), { paymentStatus: 'confirmed', updatedAt: serverTimestamp() }),
    );
  });

  it('...and its confirmation changes nothing but the payment: stockReserved stays true, nothing else moves', async () => {
    await legacy('L1');
    for (const extra of [{ stockReserved: false }, { totalAmount: 1 }, { quantity: 1 }, { receiptFileName: 'x.jpg' }]) {
      await assertFails(confirm('ca1', 'L1', { extra, maxAttempts: 1 }));
    }
    expect(await stored('orders/L1')).toMatchObject({ paymentStatus: 'pending_verification', stockReserved: true });
    expect(await stockOf('p1')).toBe(7);
  });

  it('an unpaid one that took its stock gives it back when cancelled or expired', async () => {
    await legacy('L1');
    await assertSucceeds(cancel('ca1', 'L1'));
    expect(await stockOf('p1')).toBe(10);
    await seed();
    await legacy('L2', { createdAt: hoursAgo(25) });
    await assertSucceeds(cancel('ca1', 'L2', 'expired'));
    expect(await stockOf('p1')).toBe(10);
  });

  it('a paid one gives its stock back once when cancelled', async () => {
    await legacy('L1', { paymentStatus: 'confirmed' });
    await assertSucceeds(cancel('ca1', 'L1'));
    expect(await stockOf('p1')).toBe(10);
    await assertFails(cancel('ca1', 'L1'));
    expect(await stockOf('p1')).toBe(10);
  });

  it('one with no stockReserved field took its stock when it was placed: confirmed without taking more', async () => {
    await legacy('L1');
    await raw((db) => updateDoc(doc(db, 'orders', 'L1'), { stockReserved: deleteField() }));
    await assertSucceeds(confirm('ca1', 'L1'));
    expect((await stored('orders/L1'))!.paymentStatus).toBe('confirmed');
    expect((await stored('orders/L1'))!.stockReserved).toBeUndefined();
    expect(await stockOf('p1')).toBe(7);
  });

  it('one without a receipt cannot be confirmed until its receipt is stored', async () => {
    await legacy('L1', { receiptFileName: null });
    await raw((db) => deleteDoc(doc(db, 'order_receipts', 'L1')));
    await assertFails(confirm('ca1', 'L1', { maxAttempts: 1 }));
    await assertSucceeds(setDoc(doc(as('cust1'), 'order_receipts', 'L1'), receiptFor(order('L1', 'cust1', 'p1', 3))));
    await assertSucceeds(
      updateDoc(doc(as('cust1'), 'orders', 'L1'), { receiptFileName: 'receipt.jpg', updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(confirm('ca1', 'L1'));
    expect(await stockOf('p1')).toBe(7);
  });

  it('one already Out for Delivery with its payment still pending cannot be moved on, confirmed or cancelled', async () => {
    await legacy('L1', { orderStatus: 'out_for_delivery', installationSelected: true, technicianId: 't1', technicianName: 'Tech One' });
    await assertFails(updateDoc(doc(as('ca1'), 'orders', 'L1'), { orderStatus: 'completed', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('tech1'), 'orders', 'L1'), { orderStatus: 'completed', updatedAt: serverTimestamp() }));
    await assertFails(confirm('ca1', 'L1', { maxAttempts: 1 }));
    await assertFails(cancel('ca1', 'L1'));
    expect((await stored('orders/L1'))!.orderStatus).toBe('out_for_delivery');
  });
});

describe('F1: an order with no stockReserved field took its stock when it was placed', () => {
  // The app deployed before ORD-4 lowered the product's stock in the same
  // write that placed the order, and its rules did not allow a stockReserved
  // field at all. So a missing field means "taken": never read as false.

  /** As the deployed app stored it: stock taken when placed (p1 10 -> 7), no stockReserved field. */
  const unmarked = async (id: string, extra: Data = {}) => {
    await raw(async (db) => {
      const data: Data = { ...order(id, 'cust1', 'p1', 3), createdAt: new Date(), updatedAt: new Date(), ...extra };
      delete data.stockReserved;
      await setDoc(doc(db, 'orders', id), data);
      await setDoc(doc(db, 'order_receipts', id), { ...receiptFor(order(id, 'cust1', 'p1', 3)), createdAt: new Date() });
      await updateDoc(doc(db, 'products', 'p1'), { stockCount: 7 });
    });
    expect((await stored(`orders/${id}`))!.stockReserved).toBeUndefined();
  };
  const ROLES = ['cust1', 'ca1', 'tech1'];

  it('its confirmation takes no more stock, and the field stays absent', async () => {
    await unmarked('L1');
    await assertSucceeds(confirm('ca1', 'L1'));
    expect((await stored('orders/L1'))!.paymentStatus).toBe('confirmed');
    expect((await stored('orders/L1'))!.stockReserved).toBeUndefined();
    expect(await stockOf('p1')).toBe(7);
  });

  it('a missing field is never read as false: the write that takes the stock is refused', async () => {
    await unmarked('L1');
    // The ORD-4 confirmation (stock lowered + stockReserved true), with or without a read first.
    await assertFails(confirmPaymentBlind(as('ca1'), 'L1', 'p1', 4));
    await assertFails(confirm('ca1', 'L1', { extra: { stockReserved: true }, maxAttempts: 1 }));
    await assertFails(confirm('ca1', 'L1', { extra: { stockReserved: false }, maxAttempts: 1 }));
    expect(await stored('orders/L1')).toMatchObject({ paymentStatus: 'pending_verification', orderStatus: 'processing' });
    expect((await stored('orders/L1'))!.stockReserved).toBeUndefined();
    expect(await stockOf('p1')).toBe(7);
  });

  it('a second confirmation is refused and takes nothing', async () => {
    await unmarked('L1');
    await assertSucceeds(confirm('ca1', 'L1'));
    await assertFails(confirm('ca1', 'L1', { maxAttempts: 1 }));
    await assertFails(confirmPaymentBlind(as('ca1'), 'L1', 'p1', 4));
    expect(await stockOf('p1')).toBe(7);
  });

  it('cancelled by the company, its stock goes back exactly once', async () => {
    await unmarked('L1');
    await assertSucceeds(cancel('ca1', 'L1'));
    expect(await stored('orders/L1')).toMatchObject({ orderStatus: 'cancelled', stockReleased: true });
    expect(await stockOf('p1')).toBe(10);
    await assertFails(cancel('ca1', 'L1'));
    await assertFails(cancel('ca1', 'L1', 'company', true));
    expect(await stockOf('p1')).toBe(10);
  });

  it('expired after 24 hours, its stock goes back exactly once', async () => {
    await unmarked('L1', { createdAt: hoursAgo(25) });
    await assertSucceeds(cancel('ca1', 'L1', 'expired'));
    expect(await stored('orders/L1')).toMatchObject({ orderStatus: 'cancelled', cancelReason: 'expired', stockReleased: true });
    expect(await stockOf('p1')).toBe(10);
    await assertFails(cancel('ca1', 'L1', 'expired'));
    expect(await stockOf('p1')).toBe(10);
  });

  it('confirmed, then cancelled while Processing: its stock goes back exactly once', async () => {
    await unmarked('L1');
    await assertSucceeds(confirm('ca1', 'L1'));
    await assertSucceeds(cancel('ca1', 'L1'));
    expect(await stored('orders/L1')).toMatchObject({ orderStatus: 'cancelled', stockReleased: true });
    expect(await stockOf('p1')).toBe(10);
    await assertFails(cancel('ca1', 'L1'));
    expect(await stockOf('p1')).toBe(10);
  });

  it('it cannot be cancelled while keeping its stock', async () => {
    await unmarked('L1');
    await assertFails(cancel('ca1', 'L1', 'company', false));
    await assertFails(cancel('ca1', 'L1', 'expired', false));
    expect((await stored('orders/L1'))!.orderStatus).toBe('processing');
    expect(await stockOf('p1')).toBe(7);
  });

  it('nobody can give it a stockReserved field, nor change its createdAt', async () => {
    await unmarked('L1');
    for (const uid of ROLES) {
      for (const value of [true, false, null]) {
        await assertFails(updateDoc(doc(as(uid), 'orders', 'L1'), { stockReserved: value, updatedAt: serverTimestamp() }));
      }
      await assertFails(
        updateDoc(doc(as(uid), 'orders', 'L1'), { createdAt: Timestamp.fromDate(new Date('2030-01-01')), updatedAt: serverTimestamp() }),
      );
    }
    expect((await stored('orders/L1'))!.stockReserved).toBeUndefined();
  });

  it('an ORD-4 order: only the confirmation turns false into true; nobody toggles or removes it', async () => {
    await place('cust1', 'n1', 'p1', 3);
    for (const uid of ROLES) {
      await assertFails(updateDoc(doc(as(uid), 'orders', 'n1'), { stockReserved: true, updatedAt: serverTimestamp() }));
      await assertFails(updateDoc(doc(as(uid), 'orders', 'n1'), { stockReserved: deleteField(), updatedAt: serverTimestamp() }));
      await assertFails(updateDoc(doc(as(uid), 'orders', 'n1'), { stockReserved: null, updatedAt: serverTimestamp() }));
    }
    // The company's confirmation without taking the stock is refused too.
    await assertFails(confirm('ca1', 'n1', { noStock: true, maxAttempts: 1 }));
    expect((await stored('orders/n1'))!.stockReserved).toBe(false);
    expect(await stockOf('p1')).toBe(10);
    await assertSucceeds(confirm('ca1', 'n1'));
    expect((await stored('orders/n1'))!.stockReserved).toBe(true);
    expect(await stockOf('p1')).toBe(7);
    for (const uid of ROLES) {
      await assertFails(updateDoc(doc(as(uid), 'orders', 'n1'), { stockReserved: false, updatedAt: serverTimestamp() }));
      await assertFails(updateDoc(doc(as(uid), 'orders', 'n1'), { stockReserved: deleteField(), updatedAt: serverTimestamp() }));
    }
    expect((await stored('orders/n1'))!.stockReserved).toBe(true);
    expect(await stockOf('p1')).toBe(7);
  });

  it('createdAt plays no part: unmarked orders dated long ago, now or far ahead all count as taken', async () => {
    for (const createdAt of [new Date('2026-09-01T00:00:00Z'), new Date(), new Date('2030-01-01T00:00:00Z')]) {
      await seed();
      await unmarked('L1', { createdAt });
      await assertSucceeds(confirm('ca1', 'L1'));
      expect(await stockOf('p1')).toBe(7);
      await assertSucceeds(cancel('ca1', 'L1'));
      expect(await stockOf('p1')).toBe(10);
    }
    // ...and an ORD-4 order (stockReserved false) takes its stock whatever its date says.
    await seed();
    await place('cust1', 'n1', 'p1', 3);
    await raw((db) => updateDoc(doc(db, 'orders', 'n1'), { createdAt: new Date('2026-09-01T00:00:00Z') }));
    await assertSucceeds(confirm('ca1', 'n1'));
    expect(await stockOf('p1')).toBe(7);
  });

  it('two devices confirm it at once: one goes through, and no stock is taken', async () => {
    for (let round = 0; round < 5; round++) {
      await seed();
      await unmarked('L1');
      const results = await Promise.allSettled([confirm('ca1', 'L1'), confirm('ca1b', 'L1')]);
      expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
      expect((await stored('orders/L1'))!.paymentStatus).toBe('confirmed');
      expect(await stockOf('p1')).toBe(7);
    }
  }, 60_000);

  it('confirmed and cancelled at once: the stock always ends consistent (unmarked and ORD-4 orders)', async () => {
    for (let round = 0; round < 5; round++) {
      // Unmarked: it already holds 3 units (10 -> 7).
      await seed();
      await unmarked('L1');
      await Promise.allSettled([confirm('ca1', 'L1'), cancel('ca1b', 'L1')]);
      const l = (await stored('orders/L1'))!;
      if (l.orderStatus === 'cancelled') {
        expect(l.stockReleased).toBe(true);
        expect(await stockOf('p1')).toBe(10);
      } else {
        expect(l.paymentStatus).toBe('confirmed');
        expect(await stockOf('p1')).toBe(7);
      }

      // ORD-4: it holds nothing until confirmed.
      await seed();
      await place('cust1', 'n1', 'p1', 3);
      await Promise.allSettled([confirm('ca1', 'n1'), cancel('ca1b', 'n1')]);
      const n = (await stored('orders/n1'))!;
      if (n.orderStatus === 'cancelled') {
        // Confirmed first (taken, then given back) or cancelled first (never taken).
        expect(n.stockReleased).toBe(n.stockReserved === true);
        expect(await stockOf('p1')).toBe(10);
      } else {
        expect(n).toMatchObject({ paymentStatus: 'confirmed', stockReserved: true });
        expect(await stockOf('p1')).toBe(7);
      }
    }
  }, 120_000);
});

describe('nothing moves on before the payment is confirmed', () => {
  const move = (uid: string, orderStatus: string) =>
    updateDoc(doc(as(uid), 'orders', 'o1'), { orderStatus, updatedAt: serverTimestamp() });

  beforeEach(async () => {
    await place('cust1', 'o1', 'p1', 2, { extra: { installationSelected: true, installationFee: 5000, totalAmount: 5200 + DELIVERY_FEE } });
  });

  it('the company and the technician are refused while the payment waits', async () => {
    await assertSucceeds(
      updateDoc(doc(as('ca1'), 'orders', 'o1'), { technicianId: 't1', technicianName: 'Tech One', updatedAt: serverTimestamp() }),
    );
    for (const status of ['out_for_delivery', 'completed']) {
      await assertFails(move('ca1', status));
      await assertFails(move('tech1', status));
    }
    expect((await stored('orders/o1'))!.orderStatus).toBe('processing');
  });

  it('once it is confirmed, the company and the technician move it on as before', async () => {
    await assertSucceeds(
      updateDoc(doc(as('ca1'), 'orders', 'o1'), { technicianId: 't1', technicianName: 'Tech One', updatedAt: serverTimestamp() }),
    );
    await confirm('ca1', 'o1');
    await assertSucceeds(move('tech1', 'out_for_delivery'));
    await assertSucceeds(move('ca1', 'completed'));
  });

  it('the company may still assign a technician before the payment is confirmed', async () => {
    await assertSucceeds(
      updateDoc(doc(as('ca1'), 'orders', 'o1'), { technicianId: 't1', technicianName: 'Tech One', updatedAt: serverTimestamp() }),
    );
    expect(await stored('orders/o1')).toMatchObject({ technicianId: 't1', paymentStatus: 'pending_verification' });
  });
});

describe('at most 10 orders per customer in any 24 hours', () => {
  it(`${ORDERS_PER_DAY} orders in a row are accepted, each one a step of the quota`, async () => {
    for (let i = 1; i <= ORDERS_PER_DAY; i++) {
      await assertSucceeds(place('cust1', `q${i}`, 'pBig', 1));
    }
    const quota = (await stored('order_quota/cust1'))!;
    expect(Object.keys(quota).sort()).toEqual([
      'lastOrderId', 'next', 't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9',
    ]);
    expect(quota).toMatchObject({ next: 0, lastOrderId: `q${ORDERS_PER_DAY}` });
  });

  it('one more within 24 hours is refused: by the app, forced past it, or without the quota step', async () => {
    const over = `q${ORDERS_PER_DAY + 1}`;
    for (let i = 1; i <= ORDERS_PER_DAY; i++) await place('cust1', `q${i}`, 'pBig', 1);
    await expect(place('cust1', over, 'pBig', 1)).rejects.toBeInstanceOf(QuotaReached);
    await assertFails(place('cust1', over, 'pBig', 1, { skipAppChecks: true, maxAttempts: 1 }));
    await assertFails(place('cust1', over, 'pBig', 1, { quota: false, maxAttempts: 1 }));
    expect(await stored(`orders/${over}`)).toBeUndefined();
    // Another customer is not affected.
    await assertSucceeds(place('cust2', 'other1', 'pBig', 1));
  });

  it('the window rolls: the oldest of the ten at 23 hours still blocks, at 25 hours it frees one place', async () => {
    const over = `q${ORDERS_PER_DAY + 1}`;
    const overAgain = `q${ORDERS_PER_DAY + 2}`;
    for (let i = 1; i <= ORDERS_PER_DAY; i++) await place('cust1', `q${i}`, 'pBig', 1);
    const slot = `t${(await stored('order_quota/cust1'))!.next as number}`;
    await raw((db) => updateDoc(doc(db, 'order_quota', 'cust1'), { [slot]: Timestamp.fromDate(hoursAgo(23)) }));
    await assertFails(place('cust1', over, 'pBig', 1, { skipAppChecks: true, maxAttempts: 1 }));
    await raw((db) => updateDoc(doc(db, 'order_quota', 'cust1'), { [slot]: Timestamp.fromDate(hoursAgo(25)) }));
    await assertSucceeds(place('cust1', over, 'pBig', 1));
    // Only that one place: the next oldest is recent.
    await assertFails(place('cust1', overAgain, 'pBig', 1, { skipAppChecks: true, maxAttempts: 1 }));
  });

  it('orders cancelled afterwards still count', async () => {
    for (let i = 1; i <= ORDERS_PER_DAY; i++) await place('cust1', `q${i}`, 'pBig', 1);
    await cancel('ca1', 'q1');
    await cancel('ca1', 'q2');
    await assertFails(place('cust1', `q${ORDERS_PER_DAY + 1}`, 'pBig', 1, { skipAppChecks: true, maxAttempts: 1 }));
  });

  it('racing orders never get past the limit', async () => {
    // One more than the limit at once with no retry by the app: some are refused, never more than the limit go through.
    const plain = await Promise.allSettled(
      Array.from({ length: ORDERS_PER_DAY + 1 }, (_, i) => i + 1).map((i) => place('cust1', `r${i}`, 'pBig', 1, { maxAttempts: 30 })),
    );
    const accepted = plain.filter((r) => r.status === 'fulfilled').length;
    expect(accepted).toBeGreaterThan(0);
    expect(accepted).toBeLessThanOrEqual(ORDERS_PER_DAY);
    let orders = 0;
    await raw(async (db) => {
      orders = (await getDocs(collection(db, 'orders'))).size;
    });
    expect(orders).toBe(accepted);
    expect((await stored('order_quota/cust1'))!.next).toBe(accepted % ORDERS_PER_DAY);

    // Twice the limit at once, each retried like the app does after a refusal: exactly the limit.
    const placeRetrying = async (id: string) => {
      for (let attempt = 1; ; attempt++) {
        try {
          return await place('cust2', id, 'pBig', 1, { maxAttempts: 30 });
        } catch (error) {
          if (error instanceof QuotaReached || attempt >= 12) throw error;
        }
      }
    };
    const twice = await Promise.allSettled(
      Array.from({ length: ORDERS_PER_DAY * 2 }, (_, i) => placeRetrying(`s${i}`)),
    );
    expect(twice.filter((r) => r.status === 'fulfilled')).toHaveLength(ORDERS_PER_DAY);

    // Two at once for the last free place: one.
    for (let i = 1; i < ORDERS_PER_DAY; i++) await place('cust3', `u${i}`, 'pBig', 1);
    const last = await Promise.allSettled([
      place('cust3', `u${ORDERS_PER_DAY}`, 'pBig', 1, { skipAppChecks: true, maxAttempts: 30 }),
      place('cust3', `u${ORDERS_PER_DAY + 1}`, 'pBig', 1, { skipAppChecks: true, maxAttempts: 30 }),
    ]);
    expect(last.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  }, 120_000);

  it('the customer cannot edit, reset or delete their quota', async () => {
    await place('cust1', 'q1', 'pBig', 1);
    await place('cust1', 'q2', 'pBig', 1);
    const ref = doc(as('cust1'), 'order_quota', 'cust1');
    await assertFails(updateDoc(ref, { next: 0 }));
    await assertFails(updateDoc(ref, { t0: deleteField() }));
    await assertFails(updateDoc(ref, { t0: Timestamp.fromDate(hoursAgo(48)) }));
    await assertFails(updateDoc(ref, { lastOrderId: 'q9' }));
    await assertFails(deleteDoc(ref));
    await assertFails(setDoc(ref, { t0: serverTimestamp(), next: 1, lastOrderId: 'q2' }));
    // Nor another customer's, nor start one without an order.
    await assertFails(updateDoc(doc(as('cust2'), 'order_quota', 'cust1'), { next: 0 }));
    await assertFails(setDoc(doc(as('cust2'), 'order_quota', 'cust2'), { t0: serverTimestamp(), next: 1, lastOrderId: 'none' }));
    expect(await stored('order_quota/cust1')).toMatchObject({ next: 2, lastOrderId: 'q2' });
  });

  it('an order must step the quota exactly: no old time, no skipped slot, no other slot touched, no stranger fields', async () => {
    await place('cust1', 'q1', 'pBig', 1);
    await place('cust1', 'q2', 'pBig', 1);
    for (const quotaExtra of [
      { t2: Timestamp.fromDate(hoursAgo(48)) },
      { t2: new Date() },
      { next: 4 },
      { next: 2 },
      { t0: deleteField() },
      { t4: serverTimestamp() },
      { lastOrderId: 'q1' },
      { note: 'x' },
    ]) {
      await assertFails(place('cust1', 'q3', 'pBig', 1, { quotaExtra, maxAttempts: 1 }));
    }
    await assertSucceeds(place('cust1', 'q3', 'pBig', 1));
  });

  it("a first order must start the quota at slot t0 with the server's time", async () => {
    for (const quotaExtra of [{ next: 2 }, { t0: new Date() }, { t1: serverTimestamp() }, { next: 0 }, { note: 'x' }]) {
      await assertFails(place('cust1', 'q1', 'pBig', 1, { quotaExtra, maxAttempts: 1 }));
    }
    await assertSucceeds(place('cust1', 'q1', 'pBig', 1));
  });

  it('two orders in one write take one step: refused', async () => {
    const db = as('cust1');
    const batch = writeBatch(db);
    for (const id of ['d1', 'd2']) {
      batch.set(doc(db, 'orders', id), order(id, 'cust1', 'pBig', 1));
      batch.set(doc(db, 'order_receipts', id), receiptFor(order(id, 'cust1', 'pBig', 1)));
    }
    batch.set(doc(db, 'order_quota', 'cust1'), { t0: serverTimestamp(), next: 1, lastOrderId: 'd2' });
    await assertFails(batch.commit());
    await nothingStored('d1');
  });

  it('the quota is readable by its customer and Platform Admin only, and never listed', async () => {
    await place('cust1', 'q1', 'pBig', 1);
    await assertSucceeds(getDoc(doc(as('cust1'), 'order_quota', 'cust1')));
    await assertSucceeds(getDoc(doc(as('pa1'), 'order_quota', 'cust1')));
    for (const uid of ['cust2', 'ca1', 'tech1']) {
      await assertFails(getDoc(doc(as(uid), 'order_quota', 'cust1')));
    }
    await assertFails(getDocs(collection(as('pa1'), 'order_quota')));
    await assertFails(getDocs(collection(as('cust1'), 'order_quota')));
  });
});

describe('who may order', () => {
  it('an e-mail that is not verified is refused, and so is a sign-in with no such claim', async () => {
    await assertFails(place('cust1', 'o1', 'p1', 1, { token: { email_verified: false }, maxAttempts: 1 }));
    await assertFails(place('cust1', 'o1', 'p1', 1, { token: {}, maxAttempts: 1 }));
    await nothingStored('o1');
  });

  it('the same customer with a verified e-mail is accepted', async () => {
    await assertSucceeds(place('cust1', 'o1', 'p1', 1, { token: { email: 'cust1@x.test', email_verified: true } }));
  });

  it.each([
    ['a deactivated customer', 'custOff'],
    ['a company admin (of the very company that sells it)', 'ca1'],
    ['a technician', 'tech1'],
    ['Platform Admin', 'pa1'],
    ['a signed-in account with no users document', 'ghost1'],
    ['a users document with no role', 'noRole'],
  ])('%s is refused, with a verified e-mail', async (_label, uid) => {
    await assertFails(place(uid, 'o1', 'p1', 1, { maxAttempts: 1 }));
    await nothingStored('o1', uid);
    // The same order from an active customer is accepted.
    await assertSucceeds(place('cust1', 'o1', 'p1', 1));
  });
});
