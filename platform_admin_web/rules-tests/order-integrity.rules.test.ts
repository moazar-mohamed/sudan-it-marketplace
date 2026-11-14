/*
 * Orders only for real products of the ordered, active company (SEC-002).
 * Local emulator only (npm run test:rules); every user is a fake identity.
 *
 * A new order must name a product document that belongs to the company the
 * order is sent to, that company must exist and be active, and the product
 * must have at least the ordered quantity. The stock itself is taken when
 * that company confirms the payment, for that same product. So nobody can
 * take another company's stock, order from a deleted, deactivated or made-up
 * company, or order a product that has no document.
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
  serverTimestamp,
  setDoc,
  type Firestore,
  type Transaction,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { confirmPayment, placeOrder } from './support/checkout';

let env: RulesTestEnvironment;

const now = new Date();
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

const product = (id: string, companyId: string, stockCount: number, extra: Record<string, unknown> = {}) => ({
  id,
  companyId,
  companyName: companyId,
  name: 'Router',
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

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [id, role, companyId] of [
      ['cust1', 'customer'],
      ['cust2', 'customer'],
      ['pa1', 'platform_admin'],
      ['ca1', 'company_admin', 'c1'],
      // A second device of company c1 (another admin account).
      ['ca1b', 'company_admin', 'c1'],
    ]) {
      await setDoc(doc(db, 'users', id), {
        id,
        fullName: id,
        email: `${id}@x.test`,
        role,
        isActive: true,
        ...(companyId ? { companyId } : {}),
        createdAt: now,
      });
    }
    const company = (id: string, status?: string) =>
      setDoc(doc(db, 'companies', id), {
        name: id,
        ...(status ? { status } : {}),
        rating: 0,
        reviewCount: 0,
        createdAt: now,
      });
    await company('c1', 'active');
    await company('c2', 'active');
    await company('cOff', 'inactive');
    await company('cPending', 'pending');
    await company('cRejected', 'rejected');
    await company('cLegacy'); // no stored status counts as active
    for (const p of [
      product('p1', 'c1', 3),
      product('p2', 'c2', 5),
      product('pOff', 'cOff', 5),
      product('pPending', 'cPending', 5),
      product('pRejected', 'cRejected', 5),
      product('pLegacy', 'cLegacy', 5),
      product('pHidden', 'c1', 5, { inStock: false }),
      product('pGhost', 'ghost', 5), // a product naming a company that does not exist
    ]) {
      await setDoc(doc(db, 'products', p.id), p);
    }
  });
});

/** A correctly priced delivery order (100 per unit + the delivery fee). */
const orderFor = (
  id: string,
  productId: string,
  companyId: string,
  quantity = 1,
  customerId = 'cust1',
): Record<string, unknown> => ({
  id,
  customerId,
  companyId,
  companyName: companyId,
  productId,
  productName: 'Router',
  quantity,
  unitPrice: 100,
  productSubtotal: 100 * quantity,
  installationSelected: false,
  installationFee: 0,
  deliveryFee: DELIVERY_FEE,
  totalAmount: 100 * quantity + DELIVERY_FEE,
  deliveryAddress: 'Street',
  contactPhone: '0911111111',
  deliveryMethod: 'delivery',
  customerName: 'Customer',
  paymentStatus: 'pending_verification',
  orderStatus: 'processing',
  stockReserved: false,
  receiptFileName: 'receipt.jpg',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

/** The app's checkout transaction: the order, its receipt and a quota step (no stock taken). */
function place(order: Record<string, unknown>, also?: (tx: Transaction, db: Firestore) => void) {
  const uid = order.customerId as string;
  return placeOrder(as(uid), uid, order, { also });
}

/** Reads bypass the rules so assertions see the stored truth. */
async function stored(path: string): Promise<Record<string, unknown> | undefined> {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path))).data();
  });
  return data;
}

async function orderCount(): Promise<number> {
  let count = -1;
  await env.withSecurityRulesDisabled(async (ctx) => {
    count = (await getDocs(collection(ctx.firestore(), 'orders'))).size;
  });
  return count;
}

describe('a correct order still goes through', () => {
  it('a product of the ordered active company: its stock is taken when that company confirms the payment', async () => {
    await assertSucceeds(place(orderFor('o1', 'p1', 'c1', 2)));
    expect((await stored('products/p1'))!.stockCount).toBe(3);
    await assertSucceeds(confirmPayment(as('ca1'), 'o1'));
    expect((await stored('products/p1'))!.stockCount).toBe(1);
  });

  it('a company with no stored status counts as active', async () => {
    await assertSucceeds(place(orderFor('o1', 'pLegacy', 'cLegacy')));
  });

  it('ordering exactly the remaining stock, then confirming it, leaves 0', async () => {
    await assertSucceeds(place(orderFor('o1', 'p1', 'c1', 3)));
    await assertSucceeds(confirmPayment(as('ca1'), 'o1'));
    expect((await stored('products/p1'))!.stockCount).toBe(0);
  });
});

describe("no order can take another company's stock", () => {
  // Both orders carry the product's own names (p1 stores the company name
  // 'c1'), so they are refused for the company they are sent to and not for
  // a name that does not match the product.
  it('a product of company c1 ordered under company c2 is refused', async () => {
    await assertFails(place({ ...orderFor('o1', 'p1', 'c2'), companyName: 'c1' }));
    expect((await stored('products/p1'))!.stockCount).toBe(3);
    expect(await orderCount()).toBe(0);
  });

  it('a product of company c1 ordered under a made-up company is refused', async () => {
    await assertFails(place({ ...orderFor('o1', 'p1', 'ghost-co', 3), companyName: 'c1' }));
    expect((await stored('products/p1'))!.stockCount).toBe(3);
  });

  it('a product that names a company which does not exist is refused', async () => {
    await assertFails(place(orderFor('o1', 'pGhost', 'ghost')));
    expect((await stored('products/pGhost'))!.stockCount).toBe(5);
  });
});

describe('the company must exist and be active', () => {
  for (const [label, productId, companyId] of [
    ['deactivated', 'pOff', 'cOff'],
    ['pending', 'pPending', 'cPending'],
    ['rejected', 'pRejected', 'cRejected'],
  ]) {
    it(`a ${label} company takes no orders`, async () => {
      await assertFails(place(orderFor('o1', productId, companyId)));
      expect((await stored(`products/${productId}`))!.stockCount).toBe(5);
    });
  }

  it('a deleted company takes no orders, and its past orders stay', async () => {
    await assertSucceeds(place(orderFor('old', 'p1', 'c1')));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), 'companies', 'c1'));
    });
    await assertFails(place(orderFor('o1', 'p1', 'c1')));
    expect(await stored('orders/o1')).toBeUndefined();
    expect((await stored('products/p1'))!.stockCount).toBe(3);
    // Order history is permanent: still there, still readable, never deletable.
    await assertSucceeds(getDoc(doc(as('cust1'), 'orders', 'old')));
    await assertFails(deleteDoc(doc(as('cust1'), 'orders', 'old')));
    await assertFails(deleteDoc(doc(as('pa1'), 'orders', 'old')));
    expect(await stored('orders/old')).toBeTruthy();
  });
});

describe('the product must be a real, available document', () => {
  it('a product id with no document is refused', async () => {
    await assertFails(place(orderFor('o1', 'nope', 'c1')));
    expect(await orderCount()).toBe(0);
  });

  it('a product marked unavailable is refused', async () => {
    await assertFails(place(orderFor('o1', 'pHidden', 'c1')));
  });

  it('an order that takes the stock itself, the old way, is refused', async () => {
    await assertFails(
      place(orderFor('o1', 'p1', 'c1'), (tx, db) =>
        tx.update(doc(db, 'products', 'p1'), { stockCount: 2, lastOrderId: 'o1', updatedAt: serverTimestamp() }),
      ),
    );
    expect(await orderCount()).toBe(0);
    expect((await stored('products/p1'))!.stockCount).toBe(3);
  });
});

describe('the quantity must fit the stock', () => {
  it('more than the stock is refused', async () => {
    await assertFails(place(orderFor('o1', 'p1', 'c1', 4)));
    expect((await stored('products/p1'))!.stockCount).toBe(3);
  });

  it('zero is refused', async () => {
    await assertFails(place(orderFor('o1', 'p1', 'c1', 0)));
  });

  it('a negative quantity is refused (it would raise the stock)', async () => {
    await assertFails(place(orderFor('o1', 'p1', 'c1', -2)));
    expect((await stored('products/p1'))!.stockCount).toBe(3);
  });
});

describe('two customers racing for the last unit', () => {
  it('both orders are placed; confirmed at once, exactly one wins and the stock ends at 0', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'products', 'p1'), product('p1', 'c1', 1));
    });
    await assertSucceeds(place(orderFor('oA', 'p1', 'c1', 1, 'cust1')));
    await assertSucceeds(place(orderFor('oB', 'p1', 'c1', 1, 'cust2')));
    expect(await orderCount()).toBe(2);
    const results = await Promise.allSettled([confirmPayment(as('ca1'), 'oA'), confirmPayment(as('ca1b'), 'oB')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await stored('products/p1'))!.stockCount).toBe(0);
    const confirmed = [await stored('orders/oA'), await stored('orders/oB')].filter(
      (o) => o!.paymentStatus === 'confirmed',
    );
    expect(confirmed).toHaveLength(1);
  });
});
