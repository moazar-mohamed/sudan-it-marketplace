/*
 * Who may place an order, what names it carries and how long its texts may be
 * (ORD-1, ORD-2, ORD-3, and the server time on a receipt attachment).
 * Local emulator only (npm run test:rules); every user is a fake identity.
 *
 *  - Only an active customer places an order.
 *  - The product name and the company name of an order are the product's own;
 *    the customer chooses neither.
 *  - Every text of an order, and its id, has a length limit.
 *
 * A refusal here is always checked against the same order without the one
 * thing under test (`refusedOnlyFor`), so a test cannot pass because of some
 * other missing piece such as an absent profile or a wrong price.
 *
 * Orders are placed through the app's checkout (support/checkout.ts): with
 * their receipt and a step of the customer's quota, taking no stock.
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
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { placeOrder } from './support/checkout';

let env: RulesTestEnvironment;

const now = new Date();
/** Keep in step with CheckoutScreen._standardDeliveryFee and firestore.rules. */
const DELIVERY_FEE = 15000;
const PRODUCT_NAME = 'Router AX3000';
const COMPANY_NAME = 'Alpha Tech';
const STOCK = 50;

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

/** Every account here has confirmed its e-mail (placing an order needs it). */
const as = (uid: string) => env.authenticatedContext(uid, { email_verified: true }).firestore();
const text = (length: number, letter = 'a') => letter.repeat(length);

const product = (id: string, extra: Data = {}): Data => ({
  id,
  companyId: 'c1',
  companyName: COMPANY_NAME,
  name: PRODUCT_NAME,
  imageUrl: '',
  price: 100,
  currency: 'SDG',
  stockCount: STOCK,
  inStock: true,
  description: 'd',
  specifications: {},
  isDeliveryAvailable: true,
  isInstallationAvailable: true,
  installationPrice: 5000,
  createdAt: now,
  updatedAt: now,
  ...extra,
});

/** A correct delivery order for p1: 2 x 100 + the delivery fee. */
const order = (id: string, extra: Data = {}): Data => ({
  id,
  customerId: 'cust1',
  companyId: 'c1',
  companyName: COMPANY_NAME,
  productId: 'p1',
  productName: PRODUCT_NAME,
  quantity: 2,
  unitPrice: 100,
  productSubtotal: 200,
  installationSelected: false,
  installationFee: 0,
  deliveryFee: DELIVERY_FEE,
  totalAmount: 200 + DELIVERY_FEE,
  deliveryAddress: 'Street 15, Khartoum',
  contactPhone: '+249912345678',
  deliveryMethod: 'delivery',
  customerName: 'Customer One',
  paymentStatus: 'pending_verification',
  orderStatus: 'processing',
  stockReserved: false,
  receiptFileName: 'receipt.jpg',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

/** The same order without the given fields. */
const without = (data: Data, ...keys: string[]): Data =>
  Object.fromEntries(Object.entries(data).filter(([key]) => !keys.includes(key)));

const LONG_TECHNICIAN_ID = text(129, 't');

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const user = (id: string, fields: Data) =>
      setDoc(doc(db, 'users', id), { id, fullName: id, email: `${id}@x.test`, createdAt: now, ...fields });
    await user('cust1', { role: 'customer', isActive: true });
    await user('cust2', { role: 'customer', isActive: true });
    await user('custNoFlag', { role: 'customer' }); // a profile written before isActive existed
    await user('custOff', { role: 'customer', isActive: false });
    await user('noRole', { isActive: true });
    await user('ca1', { role: 'company_admin', isActive: true, companyId: 'c1' });
    await user('tech1', { role: 'technician', isActive: true, companyId: 'c1' });
    await user('pa1', { role: 'platform_admin', isActive: true });
    // 'ghost1' signs in but has no users document at all.
    await setDoc(doc(db, 'companies', 'c1'), {
      name: COMPANY_NAME,
      status: 'active',
      rating: 0,
      reviewCount: 0,
      createdAt: now,
    });
    for (const id of ['t1', LONG_TECHNICIAN_ID]) {
      await setDoc(doc(db, 'technicians', id), {
        id,
        companyId: 'c1',
        email: 'tech1@x.test',
        fullName: 'Tech One',
        phone: '1',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    for (const p of [
      product('p1'),
      product('pOther', { name: 'Switch 24 ports' }),
      product('pNoCompany', { companyName: '' }),
      product('pName200', { name: text(200, 'N') }),
      product('pCompany200', { companyName: text(200, 'C') }),
      // Written before the limits existed: they cannot be created today.
      product('pName201', { name: text(201, 'N') }),
      product('pCompany201', { companyName: text(201, 'C') }),
    ]) {
      await setDoc(doc(db, 'products', p.id as string), p);
    }
    // Orders that already exist, for the two update branches.
    const stored = (id: string, extra: Data = {}) =>
      setDoc(doc(db, 'orders', id), { ...order(id), createdAt: now, updatedAt: now, ...extra });
    await stored('o1');
    await stored('oInstall', { installationSelected: true, installationFee: 5000, totalAmount: 5200 + DELIVERY_FEE });
  });
});

/** Reads bypass the rules so assertions see the stored truth. */
async function stored(path: string): Promise<Data | undefined> {
  let data: Data | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path))).data();
  });
  return data;
}

const stockOf = async (productId: string) => (await stored(`products/${productId}`))?.stockCount;

/**
 * The app's checkout transaction: the order, its receipt and a step of the
 * customer's quota (the product is never written). With `full`, also the
 * order's conversation, exactly as the app writes them together.
 */
function place(data: Data, options: { uid?: string; full?: boolean } = {}) {
  const uid = options.uid ?? (data.customerId as string);
  return placeOrder(as(uid), uid, data, { chat: options.full });
}

/**
 * [bad] is refused and leaves nothing behind, while [good] - the same order
 * without the one thing under test - is accepted. So the refusal is caused by
 * that one thing and by nothing else in the fixture.
 */
async function refusedOnlyFor(bad: Data, good: Data) {
  const productId = bad.productId as string;
  const quotaPath = `order_quota/${bad.customerId as string}`;
  const before = await stockOf(productId);
  const quotaBefore = await stored(quotaPath);
  await assertFails(place(bad));
  expect(await stored(`orders/${bad.id as string}`)).toBeUndefined();
  expect(await stored(quotaPath)).toEqual(quotaBefore);
  expect(await stockOf(productId)).toBe(before);
  await assertSucceeds(place(good));
}

describe('the ordinary order still goes through', () => {
  it('the whole checkout in one transaction: order, receipt, conversation and quota, then its notification', async () => {
    const id = 'hmrvlrj3xk'; // what the app generates: 10 characters
    await assertSucceeds(place(order(id), { full: true }));
    // Placing an order takes no stock: the company's payment confirmation does.
    expect(await stockOf('p1')).toBe(STOCK);
    expect(await stored(`orders/${id}`)).toMatchObject({
      customerId: 'cust1',
      companyId: 'c1',
      productName: PRODUCT_NAME,
      companyName: COMPANY_NAME,
      totalAmount: 200 + DELIVERY_FEE,
    });
    expect(await stored(`order_receipts/${id}`)).toMatchObject({ orderId: id });
    expect(await stored(`chats/${id}`)).toMatchObject({ productName: PRODUCT_NAME, companyName: COMPANY_NAME });
    await assertSucceeds(
      setDoc(doc(as('cust1'), 'notifications', `${id}_new_order`), {
        id: `${id}_new_order`,
        recipientType: 'company_admin',
        recipientId: 'c1',
        orderId: id,
        type: 'new_order',
        productName: PRODUCT_NAME,
        isRead: false,
        createdAt: serverTimestamp(),
        senderId: 'cust1',
      }),
    );
  });

  it('a pickup order', async () => {
    await assertSucceeds(
      place(order('n1', { deliveryMethod: 'pickup', deliveryFee: 0, totalAmount: 200, deliveryAddress: 'Pickup: Main branch' })),
    );
  });

  it('an order with installation', async () => {
    await assertSucceeds(
      place(order('n2', { installationSelected: true, installationFee: 5000, totalAmount: 5200 + DELIVERY_FEE })),
    );
  });

  it('a Firestore auto id (20 characters)', async () => {
    await assertSucceeds(place(order(text(20, 'i'))));
  });

  it('a product that stores no company name: the order carries none either', async () => {
    await assertSucceeds(place(order('n3', { productId: 'pNoCompany', companyName: '' })));
    await assertSucceeds(place(without(order('n4', { productId: 'pNoCompany' }), 'companyName')));
  });

  it('two customers order the same product one after the other', async () => {
    await assertSucceeds(place(order('n5')));
    await assertSucceeds(place(order('n6', { customerId: 'cust2' })));
    expect(await stockOf('p1')).toBe(STOCK);
  });
});

describe("an order carries its product's own names, never the customer's", () => {
  it('a made-up product name is refused', async () => {
    await refusedOnlyFor(order('f1', { productName: 'Gift card 500000 SDG - call +249 900 000 000' }), order('f1'));
  });

  it('a made-up company name is refused', async () => {
    await refusedOnlyFor(order('f2', { companyName: 'Ministry of Finance' }), order('f2'));
  });

  it('both made up at once are refused', async () => {
    await refusedOnlyFor(order('f3', { productName: 'Anything', companyName: 'Anyone' }), order('f3'));
  });

  it('the product name cannot be left out', async () => {
    await refusedOnlyFor(without(order('f4'), 'productName'), order('f4'));
  });

  it('the company name cannot be left out when the product has one', async () => {
    await refusedOnlyFor(without(order('f5'), 'companyName'), order('f5'));
  });

  it.each([
    ['other letter case', { productName: PRODUCT_NAME.toLowerCase() }],
    ['a trailing space', { productName: `${PRODUCT_NAME} ` }],
    ['a leading space', { productName: ` ${PRODUCT_NAME}` }],
    ['an empty product name', { productName: '' }],
    ['a product name that is not text', { productName: 5 }],
    ['a null product name', { productName: null }],
    ['company name in other letter case', { companyName: COMPANY_NAME.toUpperCase() }],
    ['company name with a trailing space', { companyName: `${COMPANY_NAME} ` }],
    ['an empty company name', { companyName: '' }],
    ['a company name that is not text', { companyName: 5 }],
    ['a null company name', { companyName: null }],
  ])('the match is exact: %s is refused', async (_label, change) => {
    await refusedOnlyFor(order('f6', change), order('f6'));
  });

  it("another product's name is refused", async () => {
    await refusedOnlyFor(order('f7', { productName: 'Switch 24 ports' }), order('f7'));
  });

  it('a product with no company name takes no invented one', async () => {
    await refusedOnlyFor(
      order('f8', { productId: 'pNoCompany', companyName: COMPANY_NAME }),
      order('f8', { productId: 'pNoCompany', companyName: '' }),
    );
  });

  it('after a rename, the old name is refused and the new one accepted', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'products', 'p1'), { name: 'Router AX3000 v2' });
    });
    // What a checkout opened before the rename still shows.
    await refusedOnlyFor(order('f9'), order('f9', { productName: 'Router AX3000 v2' }));
  });

  it('a refused forgery changes nothing: the honest order that follows is stored under the real names', async () => {
    await assertFails(place(order('f10', { productName: 'Forged', companyName: 'Forged Co' }), { full: true }));
    expect(await stored('orders/f10')).toBeUndefined();
    expect(await stored('chats/f10')).toBeUndefined();
    expect(await stored('order_receipts/f10')).toBeUndefined();
    expect(await stored('order_quota/cust1')).toBeUndefined();
    expect(await stockOf('p1')).toBe(STOCK);

    await assertSucceeds(place(order('f10'), { full: true }));
    expect(await stored('orders/f10')).toMatchObject({ productName: PRODUCT_NAME, companyName: COMPANY_NAME });
    expect(await stored('chats/f10')).toMatchObject({ productName: PRODUCT_NAME, companyName: COMPANY_NAME });
  });

  it('nobody can rewrite the names afterwards', async () => {
    for (const uid of ['cust1', 'ca1', 'pa1']) {
      await assertFails(updateDoc(doc(as(uid), 'orders', 'o1'), { productName: 'Other', updatedAt: serverTimestamp() }));
      await assertFails(updateDoc(doc(as(uid), 'orders', 'o1'), { companyName: 'Other', updatedAt: serverTimestamp() }));
    }
  });
});

describe('an order id has a length limit', () => {
  it('36 characters is accepted', async () => {
    await assertSucceeds(place(order(text(36, 'i'))));
  });

  it.each([37, 1400])('%i characters is refused', async (length) => {
    await refusedOnlyFor(order(text(length, 'i')), order(text(36, 'i')));
  });
});

describe('every text of a new order has a length limit', () => {
  it.each([
    ['customerName', 120],
    ['deliveryAddress', 500],
    ['contactPhone', 30],
    ['receiptFileName', 100],
  ])('%s: %i characters is accepted, one more and 900,000 are refused', async (field, max) => {
    await assertSucceeds(place(order('s1', { [field]: text(max) })));
    await refusedOnlyFor(order('s2', { [field]: text(max + 1) }), order('s2', { [field]: text(max) }));
    await refusedOnlyFor(order('s3', { [field]: text(900000) }), order('s3'));
  });

  it('the limit counts characters, not bytes: 500 Arabic letters fit, 501 do not', async () => {
    await refusedOnlyFor(order('s4', { deliveryAddress: text(501, 'ش') }), order('s4', { deliveryAddress: text(500, 'ش') }));
  });

  it('a product name of 200 characters (the most a product may have) is accepted', async () => {
    await assertSucceeds(place(order('s5', { productId: 'pName200', productName: text(200, 'N') })));
  });

  it('a company name of 200 characters is accepted', async () => {
    await assertSucceeds(place(order('s6', { productId: 'pCompany200', companyName: text(200, 'C') })));
  });

  it('201 characters is refused even when it IS the product name', async () => {
    // Refused for the length alone: the same order for the 200-character product goes through.
    await refusedOnlyFor(
      order('s7', { productId: 'pName201', productName: text(201, 'N') }),
      order('s7', { productId: 'pName200', productName: text(200, 'N') }),
    );
    await refusedOnlyFor(
      order('s8', { productId: 'pCompany201', companyName: text(201, 'C') }),
      order('s8', { productId: 'pCompany200', companyName: text(200, 'C') }),
    );
  });

  it.each(['productName', 'companyName'])('%s of 900,000 characters is refused', async (field) => {
    await refusedOnlyFor(order('s9', { [field]: text(900000) }), order('s9'));
  });

  it('an order without a receipt name is refused: every order now comes with its receipt', async () => {
    await refusedOnlyFor(order('s10', { receiptFileName: null }), order('s10'));
    await refusedOnlyFor(without(order('s11'), 'receiptFileName'), order('s11'));
  });

  it('no order can come close to the size of a whole document any more', async () => {
    // Every text at its limit at once: the order stays a few kilobytes.
    await assertSucceeds(
      place(
        order(text(36, 'i'), {
          productId: 'pName200',
          productName: text(200, 'N'),
          customerName: text(120),
          deliveryAddress: text(500),
          contactPhone: text(30, '9'),
          receiptFileName: text(100),
        }),
      ),
    );
    const size = JSON.stringify(await stored(`orders/${text(36, 'i')}`)).length;
    expect(size).toBeLessThan(2500);
  });
});

describe('the texts written later have limits too', () => {
  const attach = (fields: Data, uid = 'cust1') => updateDoc(doc(as(uid), 'orders', 'o1'), fields);
  const assign = (fields: Data) =>
    updateDoc(doc(as('ca1'), 'orders', 'oInstall'), { updatedAt: serverTimestamp(), ...fields });

  it('a receipt name of 100 characters is accepted, 101 refused', async () => {
    await assertFails(attach({ receiptFileName: text(101), updatedAt: serverTimestamp() }));
    await assertSucceeds(attach({ receiptFileName: text(100), updatedAt: serverTimestamp() }));
  });

  it('a technician name of 120 characters is accepted, 121 refused', async () => {
    await assertFails(assign({ technicianId: 't1', technicianName: text(121) }));
    await assertSucceeds(assign({ technicianId: 't1', technicianName: text(120) }));
  });

  it('a technician id longer than 128 characters is refused', async () => {
    // That technician exists, is active and belongs to the company: only the id length is wrong.
    await assertFails(assign({ technicianId: LONG_TECHNICIAN_ID, technicianName: 'Tech One' }));
    await assertSucceeds(assign({ technicianId: 't1', technicianName: 'Tech One' }));
  });

  it('a cancellation reason is still one of the fixed values, never free text', async () => {
    // o1 took no stock (its payment is not confirmed), so nothing goes back.
    const cancel = (reason: string) =>
      updateDoc(doc(as('ca1'), 'orders', 'o1'), {
        orderStatus: 'cancelled',
        cancelReason: reason,
        cancelledAt: serverTimestamp(),
        stockReleased: false,
        updatedAt: serverTimestamp(),
      });
    await assertFails(cancel(text(900000)));
    await assertFails(cancel('changed my mind'));
    await assertSucceeds(cancel('company'));
  });
});

describe("a receipt attachment is stamped with the server's time", () => {
  const attach = (updatedAt: unknown) =>
    updateDoc(doc(as('cust1'), 'orders', 'o1'), { receiptFileName: 'new.jpg', updatedAt });

  it.each([
    ['the phone clock', new Date()],
    ['a date far in the future', new Date('2099-01-01T00:00:00Z')],
    ['a text', 'not a time'],
    ['a text of 900,000 characters', text(900000)],
    ['a number', 5],
    ['null', null],
    ['nothing (the field removed)', deleteField()],
  ])('%s is refused', async (_label, updatedAt) => {
    await assertFails(attach(updatedAt));
    expect(await stored('orders/o1')).toMatchObject({ receiptFileName: 'receipt.jpg' });
    // The app's own call (server time) is accepted on the very same order.
    await assertSucceeds(attach(serverTimestamp()));
  });

  it('the update cannot be sent without updatedAt at all', async () => {
    await assertFails(updateDoc(doc(as('cust1'), 'orders', 'o1'), { receiptFileName: 'new.jpg' }));
  });
});

describe('only an active customer places an order', () => {
  /** The same correct order, placed by [uid] for themselves. */
  const own = (id: string, uid: string) => order(id, { customerId: uid });

  it('an active customer is accepted', async () => {
    await assertSucceeds(place(own('r1', 'cust1')));
  });

  it('a customer whose profile has no isActive field is accepted', async () => {
    await assertSucceeds(place(own('r2', 'custNoFlag')));
  });

  it.each([
    ['a deactivated customer', 'custOff'],
    ['a company admin (of the very company that sells it)', 'ca1'],
    ['a technician', 'tech1'],
    ['Platform Admin', 'pa1'],
    ['a signed-in account with no users document', 'ghost1'],
    ['a users document with no role', 'noRole'],
  ])('%s is refused', async (_label, uid) => {
    await refusedOnlyFor(own('r3', uid), own('r3', 'cust1'));
  });

  it('a visitor who is not signed in is refused', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, 'orders', 'r4'), order('r4')));
    expect(await stored('orders/r4')).toBeUndefined();
  });

  it('nobody places an order in an active customer\'s name', async () => {
    for (const uid of ['cust2', 'ca1', 'tech1', 'pa1', 'ghost1']) {
      await assertFails(place(order('r5', { customerId: 'cust1' }), { uid }));
    }
    expect(await stored('orders/r5')).toBeUndefined();
  });

  it('a customer is refused while deactivated and accepted again once reactivated', async () => {
    const setActive = (isActive: boolean) =>
      env.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'users', 'cust1'), { isActive });
      });
    await setActive(false);
    await assertFails(place(own('r6', 'cust1')));
    await setActive(true);
    await assertSucceeds(place(own('r6', 'cust1')));
  });

  it('a profile that turns into another role loses the right to order', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users', 'cust2'), { role: 'technician', companyId: 'c1' });
    });
    await refusedOnlyFor(own('r7', 'cust2'), own('r7', 'cust1'));
  });
});
