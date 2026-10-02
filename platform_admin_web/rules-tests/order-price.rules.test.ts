/*
 * Order prices come from the product, never from the customer (SEC-001).
 * Local emulator only (npm run test:rules); every user is a fake identity.
 *
 * The app computes an order's money fields from the product it shows, and
 * the rules recompute them from the product document when the order is
 * placed: unit price (the offer price while an offer runs, judged by the
 * server's clock), subtotal = unit price x quantity, the product's own flat
 * installation price when installation is chosen, the standard delivery fee
 * for Delivery (0 for Pickup), and total = subtotal + installation + delivery.
 * Any other value is refused, and so is ordering a product that has no price.
 * The company later confirms the payment at the order's own price.
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
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { confirmPayment, placeOrder } from './support/checkout';

let env: RulesTestEnvironment;

const now = new Date();
const DAY = 24 * 60 * 60 * 1000;
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

const product = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  companyId: 'c1',
  companyName: 'c1',
  name: 'Router',
  imageUrl: '',
  price: 1500,
  currency: 'SDG',
  stockCount: 50,
  inStock: true,
  description: 'd',
  specifications: {},
  isDeliveryAvailable: true,
  isInstallationAvailable: true,
  installationPrice: 2500,
  createdAt: now,
  updatedAt: now,
  ...extra,
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', 'cust1'), {
      id: 'cust1',
      fullName: 'Customer',
      email: 'cust1@x.test',
      role: 'customer',
      isActive: true,
      createdAt: now,
    });
    await setDoc(doc(db, 'users', 'ca1'), {
      id: 'ca1',
      fullName: 'Admin',
      email: 'ca1@x.test',
      role: 'company_admin',
      companyId: 'c1',
      isActive: true,
      createdAt: now,
    });
    await setDoc(doc(db, 'companies', 'c1'), {
      name: 'c1',
      status: 'active',
      rating: 0,
      reviewCount: 0,
      createdAt: now,
    });
    for (const p of [
      product('p1'),
      product('noInstall', { isInstallationAvailable: false, installationPrice: null }),
      product('cents', { price: 99.99 }),
      product('unpriced', { price: null }),
      product('offer', { price: 1000, offerPrice: 800, offerEndsAt: null, offerBadge: 'discount' }),
      product('offerSoon', {
        price: 1000,
        offerPrice: 800,
        offerEndsAt: new Date(Date.now() + DAY),
        offerBadge: 'limited',
      }),
      product('offerOver', {
        price: 1000,
        offerPrice: 800,
        offerEndsAt: new Date(Date.now() - DAY),
        offerBadge: 'limited',
      }),
    ]) {
      await setDoc(doc(db, 'products', p.id), p);
    }
  });
});

interface OrderOptions {
  pickup?: boolean;
  installationFee?: number;
  extra?: Record<string, unknown>;
}

/**
 * An order whose money fields are computed the way the app computes them
 * (CheckoutScreen), from the given unit price. [extra] overrides any field.
 */
function orderFor(
  id: string,
  productId: string,
  unitPrice: number,
  quantity: number,
  { pickup = false, installationFee = 0, extra = {} }: OrderOptions = {},
): Record<string, unknown> {
  const productSubtotal = unitPrice * quantity;
  const deliveryFee = pickup ? 0 : DELIVERY_FEE;
  return {
    id,
    customerId: 'cust1',
    companyId: 'c1',
    companyName: 'c1',
    productId,
    productName: 'Router',
    quantity,
    unitPrice,
    productSubtotal,
    installationSelected: installationFee > 0,
    installationFee,
    deliveryFee,
    totalAmount: productSubtotal + installationFee + deliveryFee,
    deliveryAddress: pickup ? 'Pickup: Company 1 shop' : 'Street',
    contactPhone: '0911111111',
    deliveryMethod: pickup ? 'pickup' : 'delivery',
    customerName: 'Customer',
    paymentStatus: 'pending_verification',
    orderStatus: 'processing',
    stockReserved: false,
    receiptFileName: 'receipt.jpg',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  };
}

/**
 * The app's checkout transaction: the order with its receipt and a step of
 * the customer's quota. No stock is taken until the payment is confirmed.
 */
function place(order: Record<string, unknown>) {
  return placeOrder(as('cust1'), 'cust1', order);
}

/** Reads bypass the rules so assertions see the stored truth. */
async function stored(path: string): Promise<Record<string, unknown> | undefined> {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path))).data();
  });
  return data;
}

describe('a correctly priced order is placed', () => {
  it('delivery, 2 units: 1500 x 2 + 15000 delivery = 18000', async () => {
    await assertSucceeds(place(orderFor('o1', 'p1', 1500, 2)));
    const order = (await stored('orders/o1'))!;
    expect(order.productSubtotal).toBe(3000);
    expect(order.totalAmount).toBe(18000);
    // Nothing is taken until the company confirms the payment.
    expect((await stored('products/p1'))!.stockCount).toBe(50);
  });

  it('pickup has no delivery fee', async () => {
    await assertSucceeds(place(orderFor('o1', 'p1', 1500, 3, { pickup: true })));
    expect((await stored('orders/o1'))!.totalAmount).toBe(4500);
  });

  it('installation adds the product installation price once (not per unit)', async () => {
    await assertSucceeds(place(orderFor('o1', 'p1', 1500, 3, { installationFee: 2500 })));
    expect((await stored('orders/o1'))!.totalAmount).toBe(4500 + 2500 + DELIVERY_FEE);
  });

  it('a price with cents matches the app arithmetic exactly (99.99 x 3)', async () => {
    await assertSucceeds(place(orderFor('o1', 'cents', 99.99, 3)));
    expect((await stored('orders/o1'))!.productSubtotal).toBe(99.99 * 3);
  });

  it('an offer with no end date is sold at the offer price', async () => {
    await assertSucceeds(place(orderFor('o1', 'offer', 800, 1)));
  });

  it('an offer that ends in the future is sold at the offer price', async () => {
    await assertSucceeds(place(orderFor('o1', 'offerSoon', 800, 2)));
  });

  it('an offer that has ended is sold at the normal price', async () => {
    await assertSucceeds(place(orderFor('o1', 'offerOver', 1000, 1)));
  });

  it('an order from an app version that sends no deliveryMethod counts as delivery', async () => {
    const order = orderFor('o1', 'p1', 1500, 1);
    delete order.deliveryMethod;
    await assertSucceeds(place(order));
  });
});

describe('the customer cannot choose the product price', () => {
  it('a lower unit price is refused and no stock is taken', async () => {
    await assertFails(place(orderFor('o1', 'p1', 1, 2)));
    expect((await stored('products/p1'))!.stockCount).toBe(50);
    expect(await stored('orders/o1')).toBeUndefined();
  });

  it('a higher unit price is refused', async () => {
    await assertFails(place(orderFor('o1', 'p1', 1600, 1)));
  });

  it('the normal price is refused while an offer runs', async () => {
    await assertFails(place(orderFor('o1', 'offerSoon', 1000, 1)));
  });

  it('an ended offer price is refused (the server clock decides, not the phone)', async () => {
    await assertFails(place(orderFor('o1', 'offerOver', 800, 1)));
  });

  it('the offer price of an offer that never existed is refused', async () => {
    await assertFails(place(orderFor('o1', 'p1', 1200, 1)));
  });
});

describe('subtotal, fees and total must add up', () => {
  it('a subtotal that is not unit price x quantity is refused', async () => {
    await assertFails(
      place(orderFor('o1', 'p1', 1500, 3, { extra: { productSubtotal: 1500, totalAmount: 1500 + DELIVERY_FEE } })),
    );
  });

  it('a total below the sum is refused', async () => {
    await assertFails(place(orderFor('o1', 'p1', 1500, 1, { extra: { totalAmount: 1 } })));
  });

  it('a total above the sum is refused', async () => {
    await assertFails(place(orderFor('o1', 'p1', 1500, 1, { extra: { totalAmount: 1500 + DELIVERY_FEE + 1 } })));
  });

  it('installation chosen with a lower fee is refused', async () => {
    await assertFails(place(orderFor('o1', 'p1', 1500, 1, { installationFee: 100 })));
  });

  it('installation chosen for free (fee 0) is refused', async () => {
    await assertFails(
      place(orderFor('o1', 'p1', 1500, 1, { extra: { installationSelected: true, installationFee: 0 } })),
    );
  });

  it('an installation fee without choosing installation is refused', async () => {
    await assertFails(
      place(orderFor('o1', 'p1', 1500, 1, { installationFee: 2500, extra: { installationSelected: false } })),
    );
  });

  it('installation on a product that does not offer it is refused', async () => {
    await assertFails(
      place(orderFor('o1', 'noInstall', 1500, 1, { extra: { installationSelected: true, installationFee: 0 } })),
    );
  });

  it('delivery without the delivery fee is refused', async () => {
    const order = orderFor('o1', 'p1', 1500, 1, { extra: { deliveryFee: 0 } });
    order.totalAmount = 1500;
    await assertFails(place(order));
  });

  it('a different delivery fee is refused', async () => {
    const order = orderFor('o1', 'p1', 1500, 1, { extra: { deliveryFee: 5 } });
    order.totalAmount = 1505;
    await assertFails(place(order));
  });

  it('pickup with a delivery fee is refused', async () => {
    const order = orderFor('o1', 'p1', 1500, 1, { pickup: true, extra: { deliveryFee: DELIVERY_FEE } });
    order.totalAmount = 1500 + DELIVERY_FEE;
    await assertFails(place(order));
  });
});

describe('price on request: a product without a price cannot be bought', () => {
  it('a price chosen by the customer is refused', async () => {
    await assertFails(place(orderFor('o1', 'unpriced', 500, 1)));
    expect((await stored('products/unpriced'))!.stockCount).toBe(50);
  });

  it('a price of 0 is refused (a missing price is never free)', async () => {
    await assertFails(place(orderFor('o1', 'unpriced', 0, 1)));
  });
});

describe('invalid values are refused', () => {
  const invalid: [string, Record<string, unknown>][] = [
    ['a negative unit price', { unitPrice: -1500 }],
    ['a zero unit price', { unitPrice: 0, productSubtotal: 0, totalAmount: DELIVERY_FEE }],
    ['a unit price given as text', { unitPrice: '1500' }],
    ['a NaN unit price', { unitPrice: Number.NaN }],
    ['a null total', { totalAmount: null }],
    ['a negative total', { totalAmount: -16500 }],
    ['a total given as text', { totalAmount: '16500' }],
    ['a negative installation fee', { installationFee: -2500 }],
    ['a negative delivery fee', { deliveryFee: -15000 }],
  ];
  for (const [label, extra] of invalid) {
    it(label, async () => {
      await assertFails(place(orderFor('o1', 'p1', 1500, 1, { extra })));
      expect((await stored('products/p1'))!.stockCount).toBe(50);
    });
  }

  it('a zero quantity', async () => {
    await assertFails(place(orderFor('o1', 'p1', 1500, 0)));
  });

  it('a negative quantity', async () => {
    await assertFails(place(orderFor('o1', 'p1', 1500, -2)));
  });

  it('a fractional quantity', async () => {
    await assertFails(place(orderFor('o1', 'p1', 1500, 1.5)));
  });

  it('a quantity given as text', async () => {
    await assertFails(place(orderFor('o1', 'p1', 1500, 1, { extra: { quantity: '1' } })));
  });
});

describe('the manual payment flow', () => {
  it('order and receipt commit together, and the company confirms the payment, taking the stock then', async () => {
    await assertSucceeds(place(orderFor('o1', 'p1', 1500, 2, { installationFee: 2500 })));
    expect(await stored('order_receipts/o1')).toBeTruthy();
    expect((await stored('orders/o1'))!.paymentStatus).toBe('pending_verification');

    await assertSucceeds(confirmPayment(as('ca1'), 'o1'));
    expect((await stored('orders/o1'))!.paymentStatus).toBe('confirmed');
    expect((await stored('products/p1'))!.stockCount).toBe(48);
  });

  it('the payment is confirmed at the order\'s price even after the product price changed', async () => {
    await assertSucceeds(place(orderFor('o1', 'p1', 1500, 2)));
    await assertSucceeds(updateDoc(doc(as('ca1'), 'products', 'p1'), { price: 2000, updatedAt: serverTimestamp() }));
    await assertSucceeds(confirmPayment(as('ca1'), 'o1'));
    expect(await stored('orders/o1')).toMatchObject({ unitPrice: 1500, totalAmount: 3000 + DELIVERY_FEE, paymentStatus: 'confirmed' });
    // The confirmation cannot reprice the order either.
    await assertSucceeds(place(orderFor('o2', 'p1', 2000, 1)));
    await assertFails(
      confirmPayment(as('ca1'), 'o2', { extra: { unitPrice: 1, productSubtotal: 1, totalAmount: 1 + DELIVERY_FEE } }),
    );
  });

  it('a mispriced order is refused together with its receipt', async () => {
    await assertFails(place(orderFor('o1', 'p1', 1, 2)));
    expect(await stored('order_receipts/o1')).toBeUndefined();
  });

  it('the customer still cannot mark their own order as paid', async () => {
    await assertFails(
      place(orderFor('o1', 'p1', 1500, 1, { extra: { paymentStatus: 'confirmed' } })),
    );
  });
});
