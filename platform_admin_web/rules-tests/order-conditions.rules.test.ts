/*
 * ORD-7: the order conditions the app and the site enforce are enforced by the
 * rules too, so a client that skips the checkout screen cannot place:
 *   - a Delivery order for a product its company only hands over at pickup,
 *   - installation with a Pickup order (installation comes only with Delivery),
 *   - an address made of spaces only (with no map point),
 *   - a contact phone that is not in the saved international form.
 * Orders the checkout really sends still go through.
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
import { deleteField, doc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
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
const PRICE = 100000;
const INSTALLATION = 5000;
const COMPANY = 'Alpha Tech';
const PRODUCT = 'Router';

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
    });
    await setDoc(doc(db, 'products/p1'), {
      id: 'p1', companyId: 'c1', companyName: COMPANY, name: PRODUCT, imageUrl: '', price: PRICE,
      currency: 'SDG', stockCount: 20, inStock: true, description: 'd', specifications: {},
      isDeliveryAvailable: true, isInstallationAvailable: true, installationPrice: INSTALLATION,
      createdAt: now, updatedAt: now,
    });
  });
});

async function setProduct(fields: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'products/p1'), fields);
  });
}

interface Shape {
  pickup?: boolean;
  installation?: boolean;
  address?: string;
  map?: boolean;
  phone?: string;
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
    quantity: 1,
    unitPrice: PRICE,
    productSubtotal: PRICE,
    installationSelected: !!shape.installation,
    installationFee,
    deliveryFee,
    totalAmount: PRICE + installationFee + deliveryFee,
    deliveryAddress: shape.address ?? (shape.pickup ? 'Pickup: Main branch' : 'Street 15, Khartoum'),
    contactPhone: shape.phone ?? '+249912345678',
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

const place = (shape: Shape) => placeOrder(as('cust1'), 'cust1', order('ord0000001', shape), { chat: true });

describe('delivery only for a product its company delivers', () => {
  it('refuses Delivery for a pickup-only product', async () => {
    await setProduct({ isDeliveryAvailable: false, isInstallationAvailable: false });
    await assertFails(place({}));
  });

  it('allows Pickup for a pickup-only product', async () => {
    await setProduct({ isDeliveryAvailable: false, isInstallationAvailable: false });
    await assertSucceeds(place({ pickup: true }));
  });

  it('allows Delivery for a product that delivers', async () => {
    await assertSucceeds(place({}));
  });

  it('allows Delivery for a product with no stored delivery flag', async () => {
    await setProduct({ isDeliveryAvailable: deleteField() });
    await assertSucceeds(place({}));
  });
});

describe('installation only with Delivery', () => {
  it('refuses installation with a Pickup order', async () => {
    await assertFails(place({ pickup: true, installation: true }));
  });

  it('allows installation with a Delivery order', async () => {
    await assertSucceeds(place({ installation: true }));
  });
});

describe('an address, not spaces', () => {
  it('refuses an address of spaces with no map point', async () => {
    await assertFails(place({ address: '    ' }));
  });

  it('allows an empty address when a map point is set', async () => {
    await assertSucceeds(place({ address: '', map: true }));
  });

  it('refuses a Pickup order whose address is spaces only', async () => {
    await assertFails(place({ pickup: true, address: '   ' }));
  });
});

describe('the phone in the saved international form', () => {
  it.each([
    ['a local number', '0912345678'],
    ['an empty phone', ''],
    ['a number with a space', '+249 912345678'],
    ['letters', '+249abcdefgh'],
    ['too short', '+123456'],
    ['too long', '+2491234567890123'],
    ['no plus', '249912345678'],
  ])('refuses %s', async (_, phone) => {
    await assertFails(place({ phone }));
  });

  it.each([
    ['a Sudan number', '+249912345678'],
    ['the shortest allowed (7 digits)', '+3524567'],
    ['the longest allowed (15 digits)', '+123456789012345'],
  ])('allows %s', async (_, phone) => {
    await assertSucceeds(place({ phone }));
  });
});
