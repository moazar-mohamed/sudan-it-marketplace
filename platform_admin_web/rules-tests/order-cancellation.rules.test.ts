/*
 * Cancelling orders and giving their stock back (SEC-002, ORD-4).
 * Local emulator only (npm run test:rules); every user is a fake identity.
 *
 * Only the order's company cancels, and only while the order is Processing:
 * by hand at any time, before or after its payment is confirmed; as expired
 * once 24 hours (server time) have passed without the payment being
 * verified; or as out of stock (see order-stock-at-confirmation). Cancelled
 * is final. An order that took its stock (stockReserved) gives exactly its
 * quantity back to its product in the same write, once; any other order, or
 * one whose product is gone, is cancelled without touching stock.
 *
 * An order takes its stock when the company confirms its payment. Most
 * orders stored below are older ones, placed before that: they took their
 * stock when they were placed (stockReserved true, or no stockReserved field
 * at all; payment still pending), and they must keep cancelling correctly.
 * Orders placed now are in 'orders placed now' and in
 * order-stock-at-confirmation.rules.test.ts.
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
  Bytes,
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { confirmPayment, placeOrder } from './support/checkout';

let env: RulesTestEnvironment;

const HOUR = 60 * 60 * 1000;
/** Keep in step with CheckoutScreen._standardDeliveryFee and firestore.rules. */
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

/** Every account here has confirmed its e-mail (placing an order needs it). */
const as = (uid: string) => env.authenticatedContext(uid, { email_verified: true }).firestore();

const product = (id: string, stockCount = 10) => ({
  id,
  companyId: 'c1',
  companyName: 'c1',
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
  installationPrice: 50,
  createdAt: new Date(),
  updatedAt: new Date(),
});

/**
 * A stored order (written with the rules off), placed [ageMs] ago. By default
 * an older order that took its stock when it was placed (stockReserved true)
 * and whose payment is still waiting.
 */
const storedOrder = (id: string, extra: Record<string, unknown> = {}, ageMs = 0) => ({
  id,
  customerId: 'cust1',
  companyId: 'c1',
  companyName: 'c1',
  productId: 'p1',
  productName: 'Router',
  quantity: 2,
  unitPrice: 100,
  productSubtotal: 200,
  installationSelected: false,
  installationFee: 0,
  deliveryFee: DELIVERY_FEE,
  totalAmount: 200 + DELIVERY_FEE,
  deliveryAddress: 'Street',
  contactPhone: '0911111111',
  deliveryMethod: 'delivery',
  customerName: 'Customer',
  paymentStatus: 'pending_verification',
  orderStatus: 'processing',
  receiptFileName: 'receipt.jpg',
  stockReserved: true,
  createdAt: new Date(Date.now() - ageMs),
  updatedAt: new Date(Date.now() - ageMs),
  ...extra,
});

async function seedOrder(id: string, extra: Record<string, unknown> = {}, ageMs = 0) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'orders', id), storedOrder(id, extra, ageMs));
  });
}

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
        createdAt: new Date(),
        ...extra,
      });
    await user('cust1', 'customer');
    await user('ca1', 'company_admin', { companyId: 'c1' });
    await user('ca2', 'company_admin', { companyId: 'c2' });
    await user('tech1', 'technician', { companyId: 'c1' });
    await user('pa1', 'platform_admin');
    for (const id of ['c1', 'c2']) {
      await setDoc(doc(db, 'companies', id), {
        name: id,
        status: 'active',
        rating: 0,
        reviewCount: 0,
        createdAt: new Date(),
      });
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
    await setDoc(doc(db, 'products', 'p1'), product('p1'));
  });
});

interface CancelOptions {
  reason?: string;
  /** How much stock to give back; defaults to the order's quantity. */
  stockDelta?: number;
  /** The stockReleased value to write; defaults to what the app writes. */
  released?: boolean;
  /** Skip the product write even when the app would make it. */
  skipProduct?: boolean;
  /** Give stock back even when the app would not (an order that took none). */
  forceProduct?: boolean;
  /** Extra fields written on the order with the cancellation. */
  extra?: Record<string, unknown>;
}

/** The app's cancellation transaction (FirestoreOrdersRemoteDataSource.cancelOrder). */
function cancel(uid: string, orderId: string, options: CancelOptions = {}) {
  const db = as(uid);
  return runTransaction(db, async (tx) => {
    const orderRef = doc(db, 'orders', orderId);
    const order = (await tx.get(orderRef)).data()!;
    const productRef = doc(db, 'products', order.productId as string);
    const productSnap = await tx.get(productRef);
    // As the app: only the order's own company's product gets stock back, and
    // only for an order that took it (a missing field means it did).
    const reserved =
      order.stockReserved !== false &&
      productSnap.exists() &&
      productSnap.data()!.companyId === order.companyId;
    if ((reserved && !options.skipProduct) || options.forceProduct) {
      tx.update(productRef, {
        stockCount:
          (productSnap.data()!.stockCount as number) +
          (options.stockDelta ?? (order.quantity as number)),
        lastReleasedOrderId: orderId,
        updatedAt: serverTimestamp(),
      });
    }
    tx.update(orderRef, {
      orderStatus: 'cancelled',
      cancelReason: options.reason ?? 'company',
      cancelledAt: serverTimestamp(),
      stockReleased: options.released ?? (reserved && !options.skipProduct),
      updatedAt: serverTimestamp(),
      ...options.extra,
    });
  });
}

/** Reads bypass the rules so assertions see the stored truth. */
async function stored(path: string): Promise<Record<string, unknown> | undefined> {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path))).data();
  });
  return data;
}

const stock = async () => (await stored('products/p1'))!.stockCount;

describe('the company cancels an unverified Processing order that took its stock (placed before this change)', () => {
  it('the order becomes cancelled and exactly its quantity goes back to stock', async () => {
    await seedOrder('o1');
    await assertSucceeds(cancel('ca1', 'o1'));
    const order = (await stored('orders/o1'))!;
    expect(order.orderStatus).toBe('cancelled');
    expect(order.cancelReason).toBe('company');
    expect(order.stockReleased).toBe(true);
    expect(order.paymentStatus).toBe('pending_verification');
    expect(await stock()).toBe(12);
    expect((await stored('products/p1'))!.lastReleasedOrderId).toBe('o1');
  });
});

describe('orders placed now', () => {
  /** A real order of 3 units through the app's checkout: it takes no stock. */
  const placeReal = () =>
    placeOrder(as('cust1'), 'cust1', {
      ...storedOrder('real'),
      quantity: 3,
      productSubtotal: 300,
      totalAmount: 300 + DELIVERY_FEE,
      stockReserved: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

  it('end to end: cancelled before its payment is confirmed, it gives nothing back (it took nothing)', async () => {
    await assertSucceeds(placeReal());
    expect(await stock()).toBe(10);
    await assertFails(cancel('ca1', 'real', { released: true, stockDelta: 3, forceProduct: true }));
    await assertSucceeds(cancel('ca1', 'real'));
    expect(await stored('orders/real')).toMatchObject({ orderStatus: 'cancelled', stockReleased: false });
    expect(await stock()).toBe(10);
  });

  it('end to end: its payment confirmed (taking 3 units), then cancelled, the 3 go back once', async () => {
    await assertSucceeds(placeReal());
    await assertSucceeds(confirmPayment(as('ca1'), 'real'));
    expect(await stock()).toBe(7);
    await assertSucceeds(cancel('ca1', 'real'));
    expect(await stored('orders/real')).toMatchObject({ orderStatus: 'cancelled', stockReleased: true, paymentStatus: 'confirmed' });
    expect(await stock()).toBe(10);
    await assertFails(cancel('ca1', 'real'));
    expect(await stock()).toBe(10);
  });
});

describe('after the payment is confirmed, the company may still cancel while Processing', () => {
  it('an order whose payment was confirmed is cancelled and its stock goes back once', async () => {
    await seedOrder('o1', { paymentStatus: 'confirmed' });
    await assertSucceeds(cancel('ca1', 'o1'));
    expect(await stored('orders/o1')).toMatchObject({ orderStatus: 'cancelled', stockReleased: true, paymentStatus: 'confirmed' });
    expect(await stock()).toBe(12);
    await assertFails(cancel('ca1', 'o1'));
    expect(await stock()).toBe(12);
  });

  it('but not as expired, and not as out of stock', async () => {
    await seedOrder('o1', { paymentStatus: 'confirmed' }, 72 * HOUR);
    await assertFails(cancel('ca1', 'o1', { reason: 'expired' }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'products', 'p1'), { stockCount: 0 });
    });
    await assertFails(cancel('ca1', 'o1', { reason: 'out_of_stock' }));
    expect((await stored('orders/o1'))!.orderStatus).toBe('processing');
  });

  it('nor while keeping its stock', async () => {
    await seedOrder('o1', { paymentStatus: 'confirmed' });
    await assertFails(cancel('ca1', 'o1', { skipProduct: true, released: false }));
    expect(await stock()).toBe(10);
  });
});

describe('only the company cancels', () => {
  for (const uid of ['cust1', 'ca2', 'tech1', 'pa1']) {
    it(`${uid} cannot cancel, and no stock moves`, async () => {
      await seedOrder('o1', { installationSelected: true, installationFee: 50, technicianId: 't1', technicianName: 'Tech One', totalAmount: 250 + DELIVERY_FEE });
      await assertFails(cancel(uid, 'o1'));
      expect((await stored('orders/o1'))!.orderStatus).toBe('processing');
      expect(await stock()).toBe(10);
    });
  }
});

/**
 * The cancellation's two writes WITHOUT reading anything first, so only the
 * update rules on the order and the product can refuse them (the helper above
 * reads the order first, and another company's admin is already refused that
 * read).
 */
function blindCancel(uid: string, orderId: string, stockAfter: number) {
  const db = as(uid);
  const batch = writeBatch(db);
  batch.update(doc(db, 'products', 'p1'), {
    stockCount: stockAfter,
    lastReleasedOrderId: orderId,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'orders', orderId), {
    orderStatus: 'cancelled',
    cancelReason: 'company',
    cancelledAt: serverTimestamp(),
    stockReleased: true,
    updatedAt: serverTimestamp(),
  });
  return batch.commit();
}

describe('the update rules themselves refuse everyone but the company (no read first)', () => {
  beforeEach(() =>
    seedOrder('o1', { installationSelected: true, installationFee: 50, technicianId: 't1', technicianName: 'Tech One', totalAmount: 250 + DELIVERY_FEE }),
  );

  it("the same blind writes succeed for the order's own company (control)", async () => {
    await assertSucceeds(blindCancel('ca1', 'o1', 12));
    expect(await stock()).toBe(12);
  });

  for (const uid of ['ca2', 'cust1', 'tech1', 'pa1']) {
    it(`${uid}: refused by the order and product update rules`, async () => {
      await assertFails(blindCancel(uid, 'o1', 12));
      expect((await stored('orders/o1'))!.orderStatus).toBe('processing');
      expect(await stock()).toBe(10);
    });
  }
});

/**
 * A cancellation that gives no stock back is ONE write, on the order document
 * alone: nothing is read first and the product is never written. So only the
 * order's own update rule (isCompanyOrderCancellation, and its
 * isCompanyAdminOf check) can refuse it; the product rules are not consulted.
 */
function blindOrderOnlyCancel(uid: string, orderId: string) {
  return updateDoc(doc(as(uid), 'orders', orderId), {
    orderStatus: 'cancelled',
    cancelReason: 'company',
    cancelledAt: serverTimestamp(),
    stockReleased: false,
    updatedAt: serverTimestamp(),
  });
}

describe("the order's own update rule refuses everyone but its company (order write only, no read first)", () => {
  // tech1 is the order's assigned technician, so every refused caller except
  // company c2 is a party to the order.
  const assigned = {
    installationSelected: true,
    installationFee: 50,
    technicianId: 't1',
    technicianName: 'Tech One',
    totalAmount: 250 + DELIVERY_FEE,
  };

  const cases: { name: string; seed: () => Promise<void> }[] = [
    {
      // It took its stock, but there is no product left to give it back to.
      name: 'an older order with no stockReserved field whose product was deleted',
      seed: () =>
        env.withSecurityRulesDisabled(async (ctx) => {
          const legacy: Record<string, unknown> = storedOrder('o1', assigned);
          delete legacy.stockReserved;
          await setDoc(doc(ctx.firestore(), 'orders', 'o1'), legacy);
          await deleteDoc(doc(ctx.firestore(), 'products', 'p1'));
        }),
    },
    {
      name: 'a reserved order whose product was deleted',
      seed: async () => {
        await seedOrder('o1', assigned);
        await env.withSecurityRulesDisabled(async (ctx) => {
          await deleteDoc(doc(ctx.firestore(), 'products', 'p1'));
        });
      },
    },
  ];

  for (const { name, seed } of cases) {
    describe(name, () => {
      beforeEach(seed);

      it("the order's own company cancels it with this one write (control)", async () => {
        await assertSucceeds(blindOrderOnlyCancel('ca1', 'o1'));
        const order = (await stored('orders/o1'))!;
        expect(order.orderStatus).toBe('cancelled');
        expect(order.stockReleased).toBe(false);
      });

      for (const uid of ['ca2', 'cust1', 'tech1', 'pa1']) {
        it(`${uid}: the same write is refused`, async () => {
          await assertFails(blindOrderOnlyCancel(uid, 'o1'));
          const order = (await stored('orders/o1'))!;
          expect(order.orderStatus).toBe('processing');
          expect(order.cancelReason).toBeUndefined();
        });
      }
    });
  }
});

describe("a product id reused by another company never gets the order's stock", () => {
  // Company c1's reserved order o1 is for its product p1. Company c1 deletes
  // p1, then company c2 creates its own product under the same id p1.
  beforeEach(async () => {
    await seedOrder('o1');
    await assertSucceeds(deleteDoc(doc(as('ca1'), 'products', 'p1')));
    await assertSucceeds(
      setDoc(doc(as('ca2'), 'products', 'p1'), {
        ...product('p1', 5),
        companyId: 'c2',
        companyName: 'c2',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("returning the stock to company c2's product with the cancellation is refused", async () => {
    await assertFails(blindCancel('ca1', 'o1', 7));
    const p1 = (await stored('products/p1'))!;
    expect(p1.companyId).toBe('c2');
    expect(p1.stockCount).toBe(5);
    expect((await stored('orders/o1'))!.orderStatus).toBe('processing');
  });

  it("the stock-return path alone cannot raise company c2's product", async () => {
    await assertFails(
      updateDoc(doc(as('ca1'), 'products', 'p1'), {
        stockCount: 7,
        lastReleasedOrderId: 'o1',
        updatedAt: serverTimestamp(),
      }),
    );
    expect(await stock()).toBe(5);
  });

  it('claiming the stock went back without writing it is refused', async () => {
    await assertFails(cancel('ca1', 'o1', { skipProduct: true, released: true }));
  });

  it('company c1 can still cancel, with no stock change for anyone', async () => {
    await assertSucceeds(cancel('ca1', 'o1'));
    const order = (await stored('orders/o1'))!;
    expect(order.orderStatus).toBe('cancelled');
    expect(order.stockReleased).toBe(false);
    const p1 = (await stored('products/p1'))!;
    expect(p1.companyId).toBe('c2');
    expect(p1.stockCount).toBe(5);
    expect(p1.lastReleasedOrderId).toBeUndefined();
  });
});

describe('what cannot be cancelled', () => {
  it('an order out for delivery', async () => {
    await seedOrder('o1', { orderStatus: 'out_for_delivery', paymentStatus: 'confirmed' });
    await assertFails(cancel('ca1', 'o1'));
  });

  it('a completed order', async () => {
    await seedOrder('o1', { orderStatus: 'completed', paymentStatus: 'confirmed' });
    await assertFails(cancel('ca1', 'o1'));
    expect(await stock()).toBe(10);
  });

  it('an order already cancelled (no second cancellation, no second stock return)', async () => {
    await seedOrder('o1');
    await assertSucceeds(cancel('ca1', 'o1'));
    expect(await stock()).toBe(12);
    await assertFails(cancel('ca1', 'o1'));
    await assertFails(cancel('ca1', 'o1', { reason: 'expired' }));
    expect(await stock()).toBe(12);
  });
});

describe('the stock goes back exactly once, and only when it was reserved', () => {
  it('more than the quantity is refused', async () => {
    await seedOrder('o1');
    await assertFails(cancel('ca1', 'o1', { stockDelta: 3 }));
    expect(await stock()).toBe(10);
  });

  it('less than the quantity is refused', async () => {
    await seedOrder('o1');
    await assertFails(cancel('ca1', 'o1', { stockDelta: 1 }));
  });

  it('a reserved order cannot be cancelled while keeping its stock', async () => {
    await seedOrder('o1');
    await assertFails(cancel('ca1', 'o1', { skipProduct: true, released: false }));
  });

  it('stockReleased cannot be claimed without giving the stock back', async () => {
    await seedOrder('o1');
    await assertFails(cancel('ca1', 'o1', { skipProduct: true, released: true }));
  });

  it('the quantity cannot be changed to return more', async () => {
    await seedOrder('o1');
    await assertFails(cancel('ca1', 'o1', { stockDelta: 5, extra: { quantity: 5 } }));
    expect(await stock()).toBe(10);
  });

  /** An order stored as the app placed it before ORD-4: its stock taken, and no stockReserved field. */
  const seedUnmarked = (id: string) =>
    env.withSecurityRulesDisabled(async (ctx) => {
      const legacy: Record<string, unknown> = storedOrder(id);
      delete legacy.stockReserved;
      await setDoc(doc(ctx.firestore(), 'orders', id), legacy);
    });

  it('an older order without stockReserved took its stock: cancelled, it gives it back once', async () => {
    await seedUnmarked('old');
    await assertSucceeds(cancel('ca1', 'old'));
    expect((await stored('orders/old'))!.stockReleased).toBe(true);
    expect(await stock()).toBe(12);
    await assertFails(cancel('ca1', 'old'));
    expect(await stock()).toBe(12);
  });

  it('an older order without stockReserved cannot be cancelled while keeping its stock', async () => {
    await seedUnmarked('old');
    await assertFails(cancel('ca1', 'old', { skipProduct: true, released: false }));
    await assertFails(cancel('ca1', 'old', { skipProduct: true, released: true }));
    expect((await stored('orders/old'))!.orderStatus).toBe('processing');
    expect(await stock()).toBe(10);
  });

  it('an older order without stockReserved gives back exactly its quantity, never more', async () => {
    await seedUnmarked('old');
    const db = as('ca1');
    const batch = writeBatch(db);
    batch.update(doc(db, 'products', 'p1'), { stockCount: 15, lastReleasedOrderId: 'old', updatedAt: serverTimestamp() });
    batch.update(doc(db, 'orders', 'old'), {
      orderStatus: 'cancelled',
      cancelReason: 'company',
      cancelledAt: serverTimestamp(),
      stockReleased: true,
      updatedAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
    expect(await stock()).toBe(10);
  });

  it('a stored null stockReserved is read the same way as a missing one (taken)', async () => {
    await seedOrder('old', { stockReserved: null });
    await assertSucceeds(cancel('ca1', 'old'));
    expect((await stored('orders/old'))!.stockReleased).toBe(true);
    expect(await stock()).toBe(12);
  });

  it('a reserved order whose product is gone is cancelled without stock', async () => {
    await seedOrder('o1');
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), 'products', 'p1'));
    });
    await assertSucceeds(cancel('ca1', 'o1'));
    expect((await stored('orders/o1'))!.stockReleased).toBe(false);
  });

  it('nobody but the company can use a cancelled order to raise stock again', async () => {
    await seedOrder('o1');
    await assertSucceeds(cancel('ca1', 'o1'));
    await assertFails(
      updateDoc(doc(as('cust1'), 'products', 'p1'), {
        stockCount: 14,
        lastReleasedOrderId: 'o1',
        updatedAt: serverTimestamp(),
      }),
    );
    expect(await stock()).toBe(12);
  });

  it('the cancellation cannot change anything else on the order', async () => {
    await seedOrder('o1');
    await assertFails(cancel('ca1', 'o1', { extra: { totalAmount: 1 } }));
    await assertFails(cancel('ca1', 'o1', { extra: { paymentStatus: 'confirmed' } }));
    await assertFails(cancel('ca1', 'o1', { extra: { cancelledAt: new Date(Date.now() - 48 * HOUR) } }));
    await assertFails(cancel('ca1', 'o1', { reason: 'customer_asked' }));
    expect((await stored('orders/o1'))!.orderStatus).toBe('processing');
  });
});

describe('expiry after 24 hours without payment verification (server time)', () => {
  it('a fresh order cannot be cancelled as expired', async () => {
    await seedOrder('o1');
    await assertFails(cancel('ca1', 'o1', { reason: 'expired' }));
  });

  it('not at 23 hours 59 minutes', async () => {
    await seedOrder('o1', {}, 24 * HOUR - 60 * 1000);
    await assertFails(cancel('ca1', 'o1', { reason: 'expired' }));
    expect(await stock()).toBe(10);
  });

  it('yes after 24 hours, an order that took its stock giving it back', async () => {
    await seedOrder('o1', {}, 24 * HOUR + 60 * 1000);
    await assertSucceeds(cancel('ca1', 'o1', { reason: 'expired' }));
    expect((await stored('orders/o1'))!.cancelReason).toBe('expired');
    expect(await stock()).toBe(12);
  });

  it('yes after 24 hours, an order placed now (it took no stock) giving nothing back', async () => {
    await seedOrder('o1', { stockReserved: false }, 24 * HOUR + 60 * 1000);
    await assertFails(cancel('ca1', 'o1', { reason: 'expired', released: true, forceProduct: true }));
    await assertSucceeds(cancel('ca1', 'o1', { reason: 'expired' }));
    expect(await stored('orders/o1')).toMatchObject({ cancelReason: 'expired', stockReleased: false });
    expect(await stock()).toBe(10);
  });

  it('never once the payment was confirmed, however old', async () => {
    await seedOrder('o1', { paymentStatus: 'confirmed' }, 72 * HOUR);
    await assertFails(cancel('ca1', 'o1', { reason: 'expired' }));
  });

  it('the customer cannot expire it either', async () => {
    await seedOrder('o1', {}, 48 * HOUR);
    await assertFails(cancel('cust1', 'o1', { reason: 'expired' }));
  });
});

describe('a cancelled order is final', () => {
  beforeEach(async () => {
    await seedOrder('o1', { installationSelected: true, installationFee: 50, technicianId: 't1', technicianName: 'Tech One', totalAmount: 250 + DELIVERY_FEE });
    await assertSucceeds(cancel('ca1', 'o1'));
  });

  it('the company cannot confirm its payment or move it on', async () => {
    await assertFails(confirmPayment(as('ca1'), 'o1', { skipAppChecks: true, maxAttempts: 1 }));
    await assertFails(
      updateDoc(doc(as('ca1'), 'orders', 'o1'), { paymentStatus: 'confirmed', updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(as('ca1'), 'orders', 'o1'), { orderStatus: 'out_for_delivery', updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(as('ca1'), 'orders', 'o1'), { orderStatus: 'processing', updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(as('ca1'), 'orders', 'o1'), { technicianId: 't1', technicianName: 'X', updatedAt: serverTimestamp() }),
    );
  });

  it('its technician cannot move it on', async () => {
    await assertFails(
      updateDoc(doc(as('tech1'), 'orders', 'o1'), { orderStatus: 'completed', updatedAt: serverTimestamp() }),
    );
  });

  it('the customer cannot attach a receipt to it', async () => {
    await assertFails(
      updateDoc(doc(as('cust1'), 'orders', 'o1'), { receiptFileName: 'new.jpg', updatedAt: serverTimestamp() }),
    );
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), 'order_receipts', 'o1'));
    });
    await assertFails(
      setDoc(doc(as('cust1'), 'order_receipts', 'o1'), {
        orderId: 'o1',
        customerId: 'cust1',
        companyId: 'c1',
        fileName: 'r.jpg',
        contentType: 'image/jpeg',
        image: Bytes.fromUint8Array(new Uint8Array(100).fill(7)),
        sizeBytes: 100,
        width: 10,
        height: 10,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('it stays readable and can never be deleted', async () => {
    await assertSucceeds(getDoc(doc(as('cust1'), 'orders', 'o1')));
    await assertSucceeds(getDoc(doc(as('ca1'), 'orders', 'o1')));
    await assertSucceeds(getDoc(doc(as('tech1'), 'orders', 'o1')));
    await assertFails(deleteDoc(doc(as('ca1'), 'orders', 'o1')));
    await assertFails(deleteDoc(doc(as('pa1'), 'orders', 'o1')));
  });
});

describe('what a new order may say about itself', () => {
  /**
   * A correctly priced order of 1 unit, placed through the app's checkout
   * (with its receipt and a quota step, taking no stock), with [fields]
   * changed and the [omit] fields left out.
   */
  const place = (fields: Record<string, unknown>, omit: string[] = []) => {
    const order: Record<string, unknown> = {
      ...storedOrder('n1'),
      quantity: 1,
      productSubtotal: 100,
      totalAmount: 100 + DELIVERY_FEE,
      stockReserved: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...fields,
    };
    for (const key of omit) delete order[key];
    return placeOrder(as('cust1'), 'cust1', order);
  };

  it('a correct new order is placed', async () => {
    await assertSucceeds(place({}));
    expect(await stock()).toBe(10);
  });

  it('it must say it took no stock', async () => {
    await assertFails(place({ stockReserved: true }));
    await assertFails(place({}, ['stockReserved']));
    expect(await stored('orders/n1')).toBeUndefined();
    expect(await stock()).toBe(10);
  });

  it('its creation time is the server time, never one the customer picks', async () => {
    await assertFails(place({ createdAt: new Date(Date.now() - 48 * HOUR) }));
    await assertFails(place({ createdAt: new Date(Date.now() + 48 * HOUR) }));
    await assertFails(place({ updatedAt: new Date(Date.now() - 48 * HOUR) }));
  });

  it('it cannot start moved on: Out for Delivery or Completed', async () => {
    // (A cancelled start is refused by the receipt rule as well; these two are not.)
    await assertFails(place({ orderStatus: 'out_for_delivery' }));
    await assertFails(place({ orderStatus: 'completed' }));
    expect(await stored('orders/n1')).toBeUndefined();
    await assertSucceeds(place({}));
  });

  it('it cannot start cancelled or carry cancellation fields', async () => {
    await assertFails(place({ orderStatus: 'cancelled' }));
    await assertFails(place({ stockReleased: true }));
    await assertFails(place({ cancelReason: 'company' }));
    await assertFails(place({ cancelledAt: serverTimestamp() }));
    expect(await stock()).toBe(10);
  });
});

describe('racing writes', () => {
  it('two cancellations of the same order at once: one wins, stock goes back once', async () => {
    await seedOrder('o1');
    const results = await Promise.allSettled([
      cancel('ca1', 'o1'),
      cancel('ca1', 'o1', { reason: 'company' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await stock()).toBe(12);
    expect((await stored('orders/o1'))!.orderStatus).toBe('cancelled');
  });

  it('confirming the payment while it is being cancelled: whatever lands first, the stock always adds up', async () => {
    // An order placed now: confirming takes 2 units, cancelling gives back
    // only what was taken. A confirmation after the cancellation is refused;
    // a cancellation after the confirmation gives the 2 units back.
    for (let round = 0; round < 6; round++) {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'products', 'p1'), product('p1'));
        await setDoc(doc(ctx.firestore(), 'orders', 'o1'), storedOrder('o1', { stockReserved: false }));
        await setDoc(doc(ctx.firestore(), 'order_receipts', 'o1'), {
          orderId: 'o1',
          customerId: 'cust1',
          companyId: 'c1',
          fileName: 'receipt.jpg',
          contentType: 'image/jpeg',
          image: Bytes.fromUint8Array(new Uint8Array(100).fill(7)),
          sizeBytes: 100,
          width: 10,
          height: 10,
          createdAt: new Date(),
        });
      });
      await Promise.allSettled([cancel('ca1', 'o1'), confirmPayment(as('ca1'), 'o1')]);
      const order = (await stored('orders/o1'))!;
      const taken = order.stockReserved === true;
      const released = order.stockReleased === true;
      expect(await stock()).toBe(10 - (taken && !released ? 2 : 0));
      if (order.orderStatus === 'cancelled') {
        expect(order.stockReleased).toBe(taken);
      } else {
        expect(order).toMatchObject({ orderStatus: 'processing', paymentStatus: 'confirmed', stockReserved: true });
      }
    }
  });
});
