/*
 * Product stock / inventory: security rules plus real concurrent transactions.
 * Local emulator only (npm run test:rules); every user is a fake identity.
 *
 * `stockCount` is the number of physical units left, an order consumes its
 * quantity, and stock is reserved when the order is placed by a transaction
 * that lowers the product's stockCount together with creating the order.
 * `reserve()` below performs the same steps as the Flutter order data source.
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
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
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

async function seed(products: Record<string, unknown>[] = []) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
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
  productName: 'Router',
  quantity,
  unitPrice: 100,
  productSubtotal: 100 * quantity,
  installationSelected: false,
  installationFee: 0,
  deliveryFee: 0,
  totalAmount: 100 * quantity,
  deliveryAddress: 'Customer street',
  contactPhone: '0911111111',
  deliveryMethod: 'delivery',
  customerName: 'Customer',
  paymentStatus: 'pending_verification',
  orderStatus: 'processing',
  receiptFileName: 'r.jpg',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

class OutOfStock extends Error {}

/**
 * Same steps as the app's order transaction: read, check, lower stock, create
 * order. When a concurrent buyer changes the stock first, Firestore refuses
 * the commit (the rules see the newer stock). The app then re-reads the
 * product: not enough left means "out of stock", otherwise it retries with a
 * fresh read. This mirrors that loop.
 */
async function reserve(
  db: Firestore,
  uid: string,
  orderId: string,
  quantity: number,
  productId = 'p1',
) {
  const productRef = doc(db, 'products', productId);
  const outOfStock = (available: number) =>
    new OutOfStock(`only ${available} left, wanted ${quantity}`);
  for (let attempt = 1; ; attempt++) {
    try {
      return await runTransaction(
        db,
        async (tx) => {
          const snap = await tx.get(productRef);
          const available = (snap.data()?.stockCount as number | undefined) ?? 0;
          if (available <= 0 || quantity > available || quantity < 1) {
            throw outOfStock(available);
          }
          tx.update(productRef, {
            stockCount: available - quantity,
            lastOrderId: orderId,
            updatedAt: serverTimestamp(),
          });
          tx.set(doc(db, 'orders', orderId), newOrder(orderId, uid, quantity, productId));
        },
        { maxAttempts: 30 },
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== 'permission-denied' && code !== 'aborted') {
        throw error;
      }
      const remaining = (await getDoc(productRef)).data()?.stockCount as number;
      if (remaining < quantity) {
        throw outOfStock(remaining);
      }
      if (attempt >= 4) {
        throw error;
      }
    }
  }
}

// Reads bypass the rules so assertions see the stored truth.
async function stockOf(id = 'p1'): Promise<number | undefined> {
  let stock: number | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    stock = (await getDoc(doc(ctx.firestore(), 'products', id))).data()?.stockCount;
  });
  return stock;
}

async function orderCount(): Promise<number> {
  let count = -1;
  await env.withSecurityRulesDisabled(async (ctx) => {
    count = (await getDocs(collection(ctx.firestore(), 'orders'))).size;
  });
  return count;
}

describe('stock is consumed by order quantity', () => {
  beforeEach(() => seed([product('p1', 10)]));

  it('stock 10 + an order of quantity 2 leaves 8', async () => {
    await reserve(as('cust1'), 'cust1', 'o1', 2);
    expect(await stockOf()).toBe(8);
  });

  it('stock 10 + orders of quantity 2 and 3 leaves 5 (not 8)', async () => {
    await reserve(as('cust1'), 'cust1', 'o1', 2);
    await reserve(as('cust2'), 'cust2', 'o2', 3);
    expect(await stockOf()).toBe(5);
  });

  it('orders totalling the whole stock leave 0', async () => {
    await reserve(as('cust1'), 'cust1', 'o1', 2);
    await reserve(as('cust2'), 'cust2', 'o2', 3);
    await reserve(as('cust3'), 'cust3', 'o3', 5);
    expect(await stockOf()).toBe(0);
  });
});

describe('never oversells', () => {
  beforeEach(() => seed([product('p1', 3)]));

  it('stock 3 + quantity 4 is rejected and stock stays 3', async () => {
    await expect(reserve(as('cust1'), 'cust1', 'o1', 4)).rejects.toBeInstanceOf(OutOfStock);
    expect(await stockOf()).toBe(3);
    expect(await orderCount()).toBe(0);
  });

  it('stock 3 + quantity 2 succeeds and leaves 1', async () => {
    await reserve(as('cust1'), 'cust1', 'o1', 2);
    expect(await stockOf()).toBe(1);
  });

  it('stock 3 + quantity 3 succeeds and leaves exactly 0, then a further order is rejected', async () => {
    await reserve(as('cust1'), 'cust1', 'o1', 3);
    expect(await stockOf()).toBe(0);
    await expect(reserve(as('cust2'), 'cust2', 'o2', 1)).rejects.toBeInstanceOf(OutOfStock);
    expect(await stockOf()).toBe(0);
  });

  it('rules refuse to drive stock negative even if a client skips its own check', async () => {
    const db = as('cust1');
    const batch = writeBatch(db);
    batch.update(doc(db, 'products', 'p1'), {
      stockCount: -1,
      lastOrderId: 'o1',
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'orders', 'o1'), newOrder('o1', 'cust1', 4));
    await assertFails(batch.commit());
    expect(await stockOf()).toBe(3);
  });
});

describe('concurrent purchases cannot oversell', () => {
  it('two customers racing for the last unit: exactly one wins', async () => {
    await seed([product('p1', 1)]);
    const results = await Promise.allSettled([
      reserve(as('cust1'), 'cust1', 'oA', 1),
      reserve(as('cust2'), 'cust2', 'oB', 1),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(OutOfStock);
    expect(await stockOf()).toBe(0);
    expect(await orderCount()).toBe(1);
  });

  it('many customers racing for 3 units: exactly 3 orders, stock ends at 0', async () => {
    await seed([product('p1', 3)]);
    const buyers = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'];
    const results = await Promise.allSettled(
      buyers.map((uid) => reserve(as(uid), uid, `o_${uid}`, 1)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    for (const r of results) {
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(OutOfStock);
      }
    }
    expect(await stockOf()).toBe(0);
    expect(await orderCount()).toBe(3);
  });

  it('racing multi-unit orders never total more than the stock', async () => {
    await seed([product('p1', 5)]);
    const wants = [2, 2, 2, 2];
    const results = await Promise.allSettled(
      wants.map((q, i) => reserve(as(`m${i}`), `m${i}`, `o_m${i}`, q)),
    );
    const sold = results.filter((r) => r.status === 'fulfilled').length * 2;
    expect(sold).toBe(4);
    expect(await stockOf()).toBe(1);
  });
});

describe('rules stop stock being changed without a matching order', () => {
  beforeEach(() => seed([product('p1', 10), product('p_off', 10, { inStock: false })]));

  it('a plain order for a real product (no stock reservation) is refused', async () => {
    await assertFails(setDoc(doc(as('cust1'), 'orders', 'o1'), newOrder('o1', 'cust1', 1)));
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

  it('stock cannot be lowered by more than the order quantity', async () => {
    const db = as('cust1');
    const batch = writeBatch(db);
    batch.update(doc(db, 'products', 'p1'), {
      stockCount: 5,
      lastOrderId: 'o1',
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'orders', 'o1'), newOrder('o1', 'cust1', 2));
    await assertFails(batch.commit());
    expect(await stockOf()).toBe(10);
  });

  it('stock cannot be raised by a customer', async () => {
    const db = as('cust1');
    const batch = writeBatch(db);
    batch.update(doc(db, 'products', 'p1'), {
      stockCount: 50,
      lastOrderId: 'o1',
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'orders', 'o1'), newOrder('o1', 'cust1', 1));
    await assertFails(batch.commit());
  });

  it('a customer cannot change price or availability alongside a reservation', async () => {
    const db = as('cust1');
    const batch = writeBatch(db);
    batch.update(doc(db, 'products', 'p1'), {
      stockCount: 9,
      price: 1,
      lastOrderId: 'o1',
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'orders', 'o1'), newOrder('o1', 'cust1', 1));
    await assertFails(batch.commit());
  });

  it('an existing order cannot be replayed to lower stock again', async () => {
    await reserve(as('cust1'), 'cust1', 'o1', 1);
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

  it('another customer cannot claim someone else\'s order to lower stock', async () => {
    const db = as('cust2');
    const batch = writeBatch(db);
    batch.update(doc(db, 'products', 'p1'), {
      stockCount: 9,
      lastOrderId: 'o1',
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'orders', 'o1'), newOrder('o1', 'cust1', 1));
    await assertFails(batch.commit());
  });

  it('a product marked unavailable cannot be ordered', async () => {
    await assertFails(reserve(as('cust1'), 'cust1', 'o1', 1, 'p_off'));
  });

  it('demo catalogue products (no document) can still be ordered without stock tracking', async () => {
    await assertSucceeds(setDoc(doc(as('cust1'), 'orders', 'o_demo'), newOrder('o_demo', 'cust1', 2, 'p3')));
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

  it('selling the last unit hides the product, restocking 0 -> 20 brings it back', async () => {
    await reserve(as('cust1'), 'cust1', 'o1', 10, 'p_stock');
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
