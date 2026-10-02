/*
 * Product stock / inventory: security rules plus real concurrent transactions.
 * Local emulator only (npm run test:rules); every user is a fake identity.
 *
 * `stockCount` is the number of physical units left. Placing an order takes
 * none: the stock is taken when the company confirms the order's payment, by
 * one transaction that lowers the product's stockCount by the order's
 * quantity together with confirming it. placeOrder() and confirmPayment()
 * (support/checkout.ts) perform the same steps as the Flutter order data
 * source; confirmPaymentAsTheApp() adds the app's retry after a refusal.
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
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type Transaction,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OutOfStock, confirmPayment, confirmPaymentAsTheApp, placeOrder } from './support/checkout';

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

/** Every account here has confirmed its e-mail (placing an order needs it). */
const as = (uid: string) => env.authenticatedContext(uid, { email_verified: true }).firestore();

const product = (id: string, stockCount: number, extra: Record<string, unknown> = {}) => ({
  id,
  companyId: 'c1',
  companyName: 'Company 1',
  name: `Product ${id}`,
  imageUrl: '',
  price: 100,
  currency: 'SDG',
  stockCount,
  inStock: true,
  description: 'd',
  specifications: {},
  isDeliveryAvailable: true,
  isInstallationAvailable: false,
  installationPrice: null,
  createdAt: now,
  updatedAt: now,
  ...extra,
});

/** Every buyer in this file: only an active customer may place an order. */
const CUSTOMERS = ['cust1', 'cust2', 'cust3', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'm0', 'm1', 'm2', 'm3'];

async function seed(products: Record<string, unknown>[] = []) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const id of CUSTOMERS) {
      await setDoc(doc(db, 'users', id), {
        id,
        fullName: id,
        email: `${id}@x.test`,
        role: 'customer',
        isActive: true,
        createdAt: now,
      });
    }
    await setDoc(doc(db, 'users', 'ca1'), {
      id: 'ca1',
      fullName: 'Admin',
      email: 'ca1@x.test',
      role: 'company_admin',
      isActive: true,
      companyId: 'c1',
      createdAt: now,
    });
    await setDoc(doc(db, 'companies', 'c1'), {
      name: 'Company 1',
      status: 'active',
      rating: 0,
      reviewCount: 0,
      createdAt: now,
    });
    for (const p of products) {
      await setDoc(doc(db, 'products', p.id as string), p);
    }
  });
}

const newOrder = (
  id: string,
  customerId: string,
  quantity: number,
  productId = 'p1',
): Record<string, unknown> => ({
  id,
  customerId,
  companyId: 'c1',
  companyName: 'Company 1',
  productId,
  // An order carries its product's own name (orderNamesMatchProduct).
  productName: `Product ${productId}`,
  quantity,
  unitPrice: 100,
  productSubtotal: 100 * quantity,
  installationSelected: false,
  installationFee: 0,
  // Delivery costs the standard fee (standardDeliveryFee in firestore.rules).
  deliveryFee: 15000,
  totalAmount: 100 * quantity + 15000,
  deliveryAddress: 'Customer street',
  contactPhone: '0911111111',
  deliveryMethod: 'delivery',
  customerName: 'Customer',
  paymentStatus: 'pending_verification',
  orderStatus: 'processing',
  stockReserved: false,
  receiptFileName: 'r.jpg',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

/** [uid] orders [quantity] of [productId] through the app's checkout (no stock taken). */
const order = (uid: string, orderId: string, quantity: number, productId = 'p1') =>
  placeOrder(as(uid), uid, newOrder(orderId, uid, quantity, productId));

/**
 * The company confirms the payment of [orderId] the way its app does. When
 * another confirmation takes the stock first, Firestore refuses this commit
 * (the rules see the newer stock); the app then tries again with fresh
 * reads: not enough left means "out of stock".
 */
const confirmAsTheApp = (orderId: string) => confirmPaymentAsTheApp(as('ca1'), orderId);

/** Reads bypass the rules so assertions see the stored truth. */
async function stored(path: string): Promise<Record<string, unknown> | undefined> {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path))).data();
  });
  return data;
}

async function stockOf(id = 'p1'): Promise<number | undefined> {
  return (await stored(`products/${id}`))?.stockCount as number | undefined;
}

async function orderCount(): Promise<number> {
  let count = -1;
  await env.withSecurityRulesDisabled(async (ctx) => {
    count = (await getDocs(collection(ctx.firestore(), 'orders'))).size;
  });
  return count;
}

async function confirmedCount(): Promise<number> {
  let count = -1;
  await env.withSecurityRulesDisabled(async (ctx) => {
    count = (await getDocs(query(collection(ctx.firestore(), 'orders'), where('paymentStatus', '==', 'confirmed')))).size;
  });
  return count;
}

describe('stock is consumed by the quantity of confirmed orders', () => {
  beforeEach(() => seed([product('p1', 10)]));

  it('an order waiting for payment verification takes nothing', async () => {
    await order('cust1', 'o1', 2);
    expect(await stockOf()).toBe(10);
  });

  it('stock 10 + a confirmed order of quantity 2 leaves 8', async () => {
    await order('cust1', 'o1', 2);
    await confirmAsTheApp('o1');
    expect(await stockOf()).toBe(8);
  });

  it('stock 10 + confirmed orders of quantity 2 and 3 leaves 5 (not 8)', async () => {
    await order('cust1', 'o1', 2);
    await order('cust2', 'o2', 3);
    await confirmAsTheApp('o1');
    await confirmAsTheApp('o2');
    expect(await stockOf()).toBe(5);
  });

  it('confirmed orders totalling the whole stock leave 0', async () => {
    await order('cust1', 'o1', 2);
    await order('cust2', 'o2', 3);
    await order('cust3', 'o3', 5);
    for (const id of ['o1', 'o2', 'o3']) await confirmAsTheApp(id);
    expect(await stockOf()).toBe(0);
  });
});

describe('never oversells', () => {
  beforeEach(() => seed([product('p1', 3)]));

  it('stock 3 + quantity 4 cannot even be ordered, and stock stays 3', async () => {
    await assertFails(order('cust1', 'o1', 4));
    expect(await stockOf()).toBe(3);
    expect(await orderCount()).toBe(0);
  });

  it('stock 3 + a confirmed quantity 2 leaves 1', async () => {
    await order('cust1', 'o1', 2);
    await confirmAsTheApp('o1');
    expect(await stockOf()).toBe(1);
  });

  it('stock 3 + a confirmed quantity 3 leaves exactly 0, then a further confirmation is refused', async () => {
    await order('cust1', 'o1', 3);
    await order('cust2', 'o2', 1);
    await confirmAsTheApp('o1');
    expect(await stockOf()).toBe(0);
    await expect(confirmAsTheApp('o2')).rejects.toBeInstanceOf(OutOfStock);
    expect(await stockOf()).toBe(0);
    expect((await stored('orders/o2'))!.paymentStatus).toBe('pending_verification');
  });

  it('rules refuse to drive stock negative even if a client skips its own check', async () => {
    await order('cust1', 'o1', 3);
    await order('cust2', 'o2', 2);
    await confirmAsTheApp('o1');
    await assertFails(confirmPayment(as('ca1'), 'o2', { skipAppChecks: true, maxAttempts: 1 }));
    expect(await stockOf()).toBe(0);
  });
});

describe('concurrent confirmations cannot oversell', () => {
  it('two orders racing for the last unit: exactly one is confirmed', async () => {
    await seed([product('p1', 1)]);
    await order('cust1', 'oA', 1);
    await order('cust2', 'oB', 1);
    const results = await Promise.allSettled([confirmAsTheApp('oA'), confirmAsTheApp('oB')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(OutOfStock);
    expect(await stockOf()).toBe(0);
    expect(await confirmedCount()).toBe(1);
  });

  it('many orders racing for 3 units: exactly 3 confirmed, stock ends at 0', async () => {
    await seed([product('p1', 3)]);
    const buyers = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'];
    for (const uid of buyers) await order(uid, `o_${uid}`, 1);
    const results = await Promise.allSettled(buyers.map((uid) => confirmAsTheApp(`o_${uid}`)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    for (const r of results) {
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(OutOfStock);
      }
    }
    expect(await stockOf()).toBe(0);
    expect(await confirmedCount()).toBe(3);
  });

  it('racing multi-unit confirmations never total more than the stock', async () => {
    await seed([product('p1', 5)]);
    const wants = [2, 2, 2, 2];
    for (const [i, q] of wants.entries()) await order(`m${i}`, `o_m${i}`, q);
    const results = await Promise.allSettled(wants.map((_, i) => confirmAsTheApp(`o_m${i}`)));
    const sold = results.filter((r) => r.status === 'fulfilled').length * 2;
    expect(sold).toBe(4);
    expect(await stockOf()).toBe(1);
  });
});

describe('a customer never writes a product', () => {
  beforeEach(() => seed([product('p1', 10), product('p_off', 10, { inStock: false })]));

  /** The checkout as it used to be: the order lowers the stock itself. */
  const lowerStockWith = (fields: Record<string, unknown>) => (tx: Transaction, db: Firestore) =>
    tx.update(doc(db, 'products', 'p1'), { lastOrderId: 'o1', updatedAt: serverTimestamp(), ...fields });

  it('the old checkout, lowering the stock together with the order, is refused', async () => {
    await assertFails(
      placeOrder(as('cust1'), 'cust1', newOrder('o1', 'cust1', 1), { also: lowerStockWith({ stockCount: 9 }), maxAttempts: 1 }),
    );
    expect(await stockOf()).toBe(10);
    expect(await orderCount()).toBe(0);
  });

  it('a customer cannot lower stock without an order', async () => {
    await assertFails(
      updateDoc(doc(as('cust1'), 'products', 'p1'), {
        stockCount: 0,
        lastOrderId: 'nope',
        updatedAt: serverTimestamp(),
      }),
    );
    expect(await stockOf()).toBe(10);
  });

  it('stock cannot be lowered by more than the order quantity, or raised, with an order', async () => {
    for (const stockCount of [5, 50, -1]) {
      await assertFails(
        placeOrder(as('cust1'), 'cust1', newOrder('o1', 'cust1', 2), { also: lowerStockWith({ stockCount }), maxAttempts: 1 }),
      );
    }
    expect(await stockOf()).toBe(10);
  });

  it('a customer cannot change price or availability alongside an order', async () => {
    await assertFails(
      placeOrder(as('cust1'), 'cust1', newOrder('o1', 'cust1', 1), {
        also: lowerStockWith({ stockCount: 10, price: 1 }),
        maxAttempts: 1,
      }),
    );
    await assertFails(
      placeOrder(as('cust1'), 'cust1', newOrder('o1', 'cust1', 1), {
        also: lowerStockWith({ stockCount: 10, inStock: false }),
        maxAttempts: 1,
      }),
    );
    expect((await stored('products/p1'))!.price).toBe(100);
  });

  it('an existing order, even a confirmed one, cannot be used to lower stock again', async () => {
    await order('cust1', 'o1', 1);
    await confirmAsTheApp('o1');
    expect(await stockOf()).toBe(9);
    await assertFails(
      updateDoc(doc(as('cust1'), 'products', 'p1'), {
        stockCount: 8,
        lastOrderId: 'o1',
        updatedAt: serverTimestamp(),
      }),
    );
    expect(await stockOf()).toBe(9);
  });

  it("another customer cannot claim someone else's order to lower stock", async () => {
    const db = as('cust2');
    const batch = writeBatch(db);
    batch.update(doc(db, 'products', 'p1'), {
      stockCount: 9,
      lastOrderId: 'o1',
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'orders', 'o1'), newOrder('o1', 'cust1', 1));
    await assertFails(batch.commit());
    expect(await stockOf()).toBe(10);
  });

  it('a product marked unavailable cannot be ordered', async () => {
    await assertFails(order('cust1', 'o1', 1, 'p_off'));
    await assertSucceeds(order('cust1', 'o2', 1, 'p1'));
  });

  it('a product with no document (e.g. the demo catalogue) cannot be ordered', async () => {
    await assertFails(order('cust1', 'o_demo', 2, 'p3'));
    expect(await orderCount()).toBe(0);
  });
});

describe('marketplace visibility and restocking', () => {
  beforeEach(() =>
    seed([
      product('p_stock', 10),
      product('p_zero', 0),
      // A legacy product written before stockCount existed.
      (() => {
        return Object.fromEntries(
          Object.entries(product('p_legacy', 0)).filter(([key]) => key !== 'stockCount'),
        );
      })(),
    ]),
  );

  const marketplace = async () =>
    (
      await assertSucceeds(
        getDocs(query(collection(as('cust1'), 'products'), where('stockCount', '>', 0))),
      )
    ).docs.map((d) => d.id);

  it('stock 10 is visible, stock 0 and legacy no-stock products are hidden', async () => {
    expect(await marketplace()).toEqual(['p_stock']);
  });

  it('the zero-stock product is kept (not deleted) and stays visible to its company', async () => {
    const own = await assertSucceeds(
      getDocs(query(collection(as('ca1'), 'products'), where('companyId', '==', 'c1'))),
    );
    expect(own.docs.map((d) => d.id).sort()).toEqual(['p_legacy', 'p_stock', 'p_zero']);
  });

  it('confirming the payment for the last units hides the product, restocking 0 -> 20 brings it back', async () => {
    await order('cust1', 'o1', 10, 'p_stock');
    // Ordered but not paid for yet: still listed.
    expect(await marketplace()).toEqual(['p_stock']);
    await confirmAsTheApp('o1');
    expect(await marketplace()).toEqual([]);
    expect(await stockOf('p_stock')).toBe(0);

    await assertSucceeds(
      updateDoc(doc(as('ca1'), 'products', 'p_stock'), {
        stockCount: 20,
        updatedAt: serverTimestamp(),
      }),
    );
    expect(await marketplace()).toEqual(['p_stock']);
  });

  it('a company admin can restock 0 -> 10 and the product is listed again', async () => {
    await assertSucceeds(
      updateDoc(doc(as('ca1'), 'products', 'p_zero'), {
        stockCount: 10,
        updatedAt: serverTimestamp(),
      }),
    );
    expect((await marketplace()).sort()).toEqual(['p_stock', 'p_zero']);
  });
});
