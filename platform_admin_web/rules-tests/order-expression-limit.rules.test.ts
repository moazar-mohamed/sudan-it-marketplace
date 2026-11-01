/*
 * A new order must stay under the rules' 1000-expression limit in its heaviest
 * shapes: a company that lists its cities, a product on offer, delivery with a
 * map point and installation, written with its receipt, quota step and
 * conversation, as a customer's first order and as a later one (a quota that
 * already exists costs more than a new one). Over the limit the order is
 * refused however correct it is.
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
import { doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { placeOrder } from './support/checkout';

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

/** Keep in step with CheckoutScreen._standardDeliveryFee and firestore.rules. */
const DELIVERY_FEE = 15000;
const PRICE = 310000;
const OFFER = 279000;
const INSTALLATION = 5000;
const COMPANY = 'Alpha Tech';
const PRODUCT = 'Laser Printer';

const as = (uid: string) => env.authenticatedContext(uid, { email_verified: true }).firestore();

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const now = Timestamp.now();
    await setDoc(doc(db, 'users/cust1'), {
      id: 'cust1', fullName: 'Customer One', email: 'c@x.test', role: 'customer', isActive: true,
      cityId: 'khartoum', createdAt: now,
    });
    await setDoc(doc(db, 'companies/c1'), {
      id: 'c1', name: COMPANY, status: 'active', rating: 0, reviewCount: 0,
      serviceCityIds: ['khartoum', 'omdurman', 'bahri'],
    });
    await setDoc(doc(db, 'products/p1'), {
      id: 'p1', companyId: 'c1', companyName: COMPANY, name: PRODUCT, imageUrl: '', price: PRICE,
      offerPrice: OFFER, offerEndsAt: Timestamp.fromMillis(Date.now() + 86400000), offerBadge: 'discount',
      currency: 'SDG', stockCount: 50, inStock: true, description: 'd', specifications: {},
      isDeliveryAvailable: true, isInstallationAvailable: true, installationPrice: INSTALLATION,
      createdAt: now, updatedAt: now,
    });
  });
});

interface Shape {
  installation?: boolean;
  map?: boolean;
  pickup?: boolean;
}

function order(id: string, shape: Shape) {
  const installationFee = shape.installation ? INSTALLATION : 0;
  const deliveryFee = shape.pickup ? 0 : DELIVERY_FEE;
  return {
    id,
    customerId: 'cust1',
    companyId: 'c1',
    companyName: COMPANY,
    productId: 'p1',
    productName: PRODUCT,
    quantity: 2,
    unitPrice: OFFER,
    productSubtotal: OFFER * 2,
    installationSelected: !!shape.installation,
    installationFee,
    deliveryFee,
    totalAmount: OFFER * 2 + installationFee + deliveryFee,
    deliveryAddress: shape.pickup ? 'Pickup: Main branch' : shape.map ? '' : 'Street 15, Khartoum',
    contactPhone: '+249912345678',
    deliveryMethod: shape.pickup ? 'pickup' : 'delivery',
    ...(shape.pickup ? {} : { deliveryCityId: 'khartoum' }),
    ...(shape.map ? { deliveryLatitude: 15.5007, deliveryLongitude: 32.5599 } : {}),
    customerName: 'Customer One',
    paymentStatus: 'pending_verification',
    orderStatus: 'processing',
    stockReserved: false,
    receiptFileName: 'receipt.jpg',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

const place = (id: string, shape: Shape) =>
  placeOrder(as('cust1'), 'cust1', order(id, shape), { chat: true });

const SHAPES: [string, Shape][] = [
  ['pickup', { pickup: true }],
  ['delivery', {}],
  ['delivery with installation', { installation: true }],
  ['delivery with a map point', { map: true }],
  ['delivery with a map point and installation', { map: true, installation: true }],
];

describe('an order stays under the expression limit', () => {
  it.each(SHAPES)('%s, as a first order', async (_, shape) => {
    await assertSucceeds(place('hmrvlrj3x1', shape));
  });

  it.each(SHAPES)('%s, as a second order', async (_, shape) => {
    await assertSucceeds(place('hmrvlrj3x1', {}));
    await assertSucceeds(place('hmrvlrj3x2', shape));
  });

  it('holds through a full quota: all ten orders of a day go through', async () => {
    for (let n = 0; n < 10; n++) {
      await assertSucceeds(place(`hmrvlrj3${String(n).padStart(2, '0')}`, { map: true, installation: true }));
    }
  });
});

describe('the rules still refuse what they refused', () => {
  it('a delivery to a city the company does not serve', async () => {
    const data = { ...order('hmrvlrj3x1', {}), deliveryCityId: 'kassala' };
    await assertFails(placeOrder(as('cust1'), 'cust1', data, { chat: true }));
  });

  it('a wrong total, or half a map point', async () => {
    const wrong = { ...order('hmrvlrj3x1', {}), totalAmount: 1 };
    await assertFails(placeOrder(as('cust1'), 'cust1', wrong, { chat: true }));
    const { deliveryLongitude: _, ...half } = order('hmrvlrj3x1', { map: true });
    await assertFails(placeOrder(as('cust1'), 'cust1', half, { chat: true }));
  });

  it('an order in another customer\'s name', async () => {
    await assertFails(placeOrder(as('cust1'), 'cust1', { ...order('hmrvlrj3x1', {}), customerId: 'cust2' }, { chat: true }));
  });
});
