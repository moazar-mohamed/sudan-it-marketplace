/*
 * Payment receipts stored in Firestore (`order_receipts/{orderId}`): one
 * immutable compressed JPEG per order, as a native `bytes` field.
 * Local emulator only (npm run test:rules); every user is a fake identity.
 *
 * `placeOrderWithReceipt()` performs the same steps as the Flutter order data
 * source: ONE transaction that lowers the product's stock, creates the order
 * and creates the receipt.
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
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteCompanyCascade } from '../src/data/deleteCompany';

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
const anon = () => env.unauthenticatedContext().firestore();

const user = (id: string, role: string, extra: Record<string, unknown> = {}) => ({
  id,
  fullName: id,
  email: `${id}@x.test`,
  role,
  isActive: true,
  createdAt: now,
  ...extra,
});

async function seed(companyStatus = 'active') {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const u of [
      user('cust1', 'customer'),
      user('cust2', 'customer'),
      user('custOff', 'customer', { isActive: false }),
      user('ca1', 'company_admin', { companyId: 'c1' }),
      user('ca2', 'company_admin', { companyId: 'c2' }),
      user('caNoCompany', 'company_admin'),
      user('tech1', 'technician', { companyId: 'c1' }),
      user('techOther', 'technician', { companyId: 'c2' }),
      user('pa1', 'platform_admin'),
    ]) {
      await setDoc(doc(db, 'users', u.id), u);
    }
    for (const id of ['c1', 'c2']) {
      await setDoc(doc(db, 'companies', id), {
        name: id,
        status: id === 'c1' ? companyStatus : 'active',
        rating: 0,
        reviewCount: 0,
        createdAt: now,
      });
    }
    await setDoc(doc(db, 'technicians', 't1'), {
      id: 't1',
      companyId: 'c1',
      email: 'tech1@x.test',
      fullName: 'Tech One',
      isActive: true,
      createdAt: now,
    });
    await setDoc(doc(db, 'products', 'p1'), {
      id: 'p1',
      companyId: 'c1',
      companyName: 'c1',
      name: 'Router',
      imageUrl: '',
      price: 100,
      currency: 'SDG',
      stockCount: 50,
      inStock: true,
      description: 'd',
      specifications: {},
      isDeliveryAvailable: true,
      isInstallationAvailable: false,
      installationPrice: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

const orderData = (id: string, customerId: string, extra: Record<string, unknown> = {}) => ({
  id,
  customerId,
  companyId: 'c1',
  companyName: 'c1',
  productId: 'p1',
  productName: 'Router',
  quantity: 1,
  unitPrice: 100,
  productSubtotal: 100,
  installationSelected: false,
  installationFee: 0,
  deliveryFee: 0,
  totalAmount: 100,
  deliveryAddress: 'Street',
  contactPhone: '0911111111',
  deliveryMethod: 'delivery',
  customerName: 'Customer',
  paymentStatus: 'pending_verification',
  orderStatus: 'processing',
  receiptFileName: 'receipt.jpg',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

const receiptData = (
  orderId: string,
  customerId: string,
  size = 300_000,
  extra: Record<string, unknown> = {},
) => ({
  orderId,
  customerId,
  companyId: 'c1',
  fileName: 'receipt.jpg',
  contentType: 'image/jpeg',
  image: Bytes.fromUint8Array(new Uint8Array(size).fill(7)),
  sizeBytes: size,
  width: 1080,
  height: 1920,
  createdAt: serverTimestamp(),
  ...extra,
});

/** Stock reservation + order + receipt in ONE transaction (as the app does). */
function placeOrderWithReceipt(
  db: Firestore,
  uid: string,
  orderId: string,
  receipt: Record<string, unknown> = receiptData(orderId, uid),
) {
  const productRef = doc(db, 'products', 'p1');
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(productRef);
    const available = snap.data()!.stockCount as number;
    tx.update(productRef, {
      stockCount: available - 1,
      lastOrderId: orderId,
      updatedAt: serverTimestamp(),
    });
    tx.set(doc(db, 'orders', orderId), orderData(orderId, uid));
    tx.set(doc(db, 'order_receipts', orderId), receipt);
  });
}

/** The same steps as one plain batch. */
function batchOrderWithReceipt(db: Firestore, uid: string, orderId: string, receipt: Record<string, unknown>) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'products', 'p1'), {
    stockCount: 49,
    lastOrderId: orderId,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'orders', orderId), orderData(orderId, uid));
  batch.set(doc(db, 'order_receipts', orderId), receipt);
  return batch.commit();
}

/** Reads bypass the rules so assertions see the stored truth. */
async function stored(path: string, id: string): Promise<Record<string, unknown> | undefined> {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path, id))).data();
  });
  return data;
}

beforeEach(() => seed());

describe('creation: the receipt is committed together with the order', () => {
  it('stock update + order + receipt commit atomically in one transaction', async () => {
    await assertSucceeds(placeOrderWithReceipt(as('cust1'), 'cust1', 'o1'));
    expect((await stored('products', 'p1'))!.stockCount).toBe(49);
    expect((await stored('orders', 'o1'))!.customerId).toBe('cust1');
    const receipt = (await stored('order_receipts', 'o1'))!;
    expect((receipt.image as Bytes).toUint8Array().length).toBe(300_000);
    expect(receipt.contentType).toBe('image/jpeg');
  });

  it('the same three writes commit as a plain batch', async () => {
    await assertSucceeds(batchOrderWithReceipt(as('cust1'), 'cust1', 'o2', receiptData('o2', 'cust1')));
    expect(await stored('order_receipts', 'o2')).toBeTruthy();
  });

  it('a demo-catalogue order (no product document) commits with its receipt', async () => {
    const db = as('cust1');
    const batch = writeBatch(db);
    batch.set(doc(db, 'orders', 'demo1'), orderData('demo1', 'cust1', { productId: 'demo-p' }));
    batch.set(doc(db, 'order_receipts', 'demo1'), receiptData('demo1', 'cust1'));
    await assertSucceeds(batch.commit());
  });

  it('nothing is written when the order cannot be placed (out of stock): no order, no receipt', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'products', 'p1'), { stockCount: 0 });
    });
    await expect(
      runTransaction(as('cust1'), async (tx) => {
        tx.update(doc(as('cust1'), 'products', 'p1'), {
          stockCount: -1,
          lastOrderId: 'oX',
          updatedAt: serverTimestamp(),
        });
        tx.set(doc(as('cust1'), 'orders', 'oX'), orderData('oX', 'cust1'));
        tx.set(doc(as('cust1'), 'order_receipts', 'oX'), receiptData('oX', 'cust1'));
      }),
    ).rejects.toBeTruthy();
    expect(await stored('orders', 'oX')).toBeUndefined();
    expect(await stored('order_receipts', 'oX')).toBeUndefined();
  });

  it('a receipt without its order is refused, and so is an order refused alongside one', async () => {
    await assertFails(setDoc(doc(as('cust1'), 'order_receipts', 'ghost'), receiptData('ghost', 'cust1')));
    // an order the rules refuse (wrong customer) takes its receipt down with it
    await assertFails(
      batchOrderWithReceipt(as('cust1'), 'cust2', 'oBad', receiptData('oBad', 'cust1')),
    );
    expect(await stored('order_receipts', 'oBad')).toBeUndefined();
  });

  it('the receipt can also be added after the order exists (attach path)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'orders', 'o3'), {
        ...orderData('o3', 'cust1'),
        createdAt: now,
        updatedAt: now,
      });
    });
    await assertSucceeds(setDoc(doc(as('cust1'), 'order_receipts', 'o3'), receiptData('o3', 'cust1')));
  });
});

describe('order association', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'orders', 'oc2'), { ...orderData('oc2', 'cust2'), createdAt: now, updatedAt: now });
      await setDoc(doc(db, 'orders', 'oConfirmed'), {
        ...orderData('oConfirmed', 'cust1', { paymentStatus: 'confirmed' }),
        createdAt: now,
        updatedAt: now,
      });
    });
  });

  it("cannot attach a receipt to another customer's order", async () => {
    await assertFails(setDoc(doc(as('cust1'), 'order_receipts', 'oc2'), receiptData('oc2', 'cust1')));
    // even claiming to be the owner in the data
    await assertFails(setDoc(doc(as('cust1'), 'order_receipts', 'oc2'), receiptData('oc2', 'cust2')));
  });

  it('the receipt must name the order\'s own company', async () => {
    await assertFails(
      setDoc(doc(as('cust2'), 'order_receipts', 'oc2'), receiptData('oc2', 'cust2', 1000, { companyId: 'c2' })),
    );
    await assertSucceeds(setDoc(doc(as('cust2'), 'order_receipts', 'oc2'), receiptData('oc2', 'cust2')));
  });

  it('a payment already confirmed cannot receive a new receipt', async () => {
    await assertFails(setDoc(doc(as('cust1'), 'order_receipts', 'oConfirmed'), receiptData('oConfirmed', 'cust1')));
  });

  it('the data must name the document\'s own order', async () => {
    await assertFails(setDoc(doc(as('cust2'), 'order_receipts', 'oc2'), receiptData('other', 'cust2')));
  });

  it('a company admin, technician or Platform Admin can never create one', async () => {
    for (const who of ['ca1', 'tech1', 'pa1']) {
      await assertFails(setDoc(doc(as(who), 'order_receipts', 'oc2'), receiptData('oc2', who)));
    }
  });

  it('a deactivated customer cannot create one', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'orders', 'oOff'), {
        ...orderData('oOff', 'custOff'),
        createdAt: now,
        updatedAt: now,
      });
    });
    await assertFails(setDoc(doc(as('custOff'), 'order_receipts', 'oOff'), receiptData('oOff', 'custOff')));
  });

  it('an anonymous user cannot create one', async () => {
    await assertFails(setDoc(doc(anon(), 'order_receipts', 'oc2'), receiptData('oc2', 'cust2')));
  });
});

describe('size and type', () => {
  const place = (orderId: string, receipt: Record<string, unknown>) =>
    placeOrderWithReceipt(as('cust1'), 'cust1', orderId, receipt);

  it('700,000 bytes is accepted, one more is refused', async () => {
    await assertSucceeds(place('s1', receiptData('s1', 'cust1', 700_000)));
    await assertFails(place('s2', receiptData('s2', 'cust1', 700_001)));
  });

  it('over Firestore\'s own 1 MiB document limit is refused', async () => {
    await expect(place('s3', receiptData('s3', 'cust1', 1_100_000))).rejects.toBeTruthy();
  });

  it('an empty image is refused', async () => {
    await assertFails(place('e1', receiptData('e1', 'cust1', 0, { sizeBytes: 0 })));
  });

  it('only JPEG is accepted', async () => {
    for (const [i, type] of ['image/png', 'image/svg+xml', 'application/pdf', 'IMAGE/JPEG', ''].entries()) {
      await assertFails(place(`t${i}`, receiptData(`t${i}`, 'cust1', 1000, { contentType: type })));
    }
  });

  it('the image must be native bytes, not a base64 string', async () => {
    await assertFails(place('b1', receiptData('b1', 'cust1', 1000, { image: 'AAAA' })));
  });

  it('sizeBytes must equal the real byte length', async () => {
    await assertFails(place('z1', receiptData('z1', 'cust1', 1000, { sizeBytes: 5 })));
    await assertFails(place('z2', receiptData('z2', 'cust1', 1000, { sizeBytes: 1000.5 })));
  });

  it('dimensions must be whole numbers from 1 to 4096', async () => {
    for (const [i, extra] of [
      { width: 0 },
      { width: 4097 },
      { height: 0 },
      { height: 5000 },
      { width: 10.5 },
      { width: '100' },
    ].entries()) {
      await assertFails(place(`d${i}`, receiptData(`d${i}`, 'cust1', 1000, extra)));
    }
    await assertSucceeds(place('dOk', receiptData('dOk', 'cust1', 1000, { width: 4096, height: 1 })));
  });

  it('the file name must be 1 to 100 characters', async () => {
    await assertFails(place('f1', receiptData('f1', 'cust1', 1000, { fileName: '' })));
    await assertFails(place('f2', receiptData('f2', 'cust1', 1000, { fileName: 'x'.repeat(101) })));
    await assertSucceeds(place('f3', receiptData('f3', 'cust1', 1000, { fileName: 'x'.repeat(100) })));
  });

  it('extra or missing fields are refused', async () => {
    await assertFails(place('k1', receiptData('k1', 'cust1', 1000, { note: 'hi' })));
    await assertFails(place('k2', receiptData('k2', 'cust1', 1000, { downloadUrl: 'https://x.test/a.jpg' })));
    const missing: Record<string, unknown> = receiptData('k3', 'cust1', 1000);
    delete missing.width;
    await assertFails(place('k3', missing));
  });

  it('createdAt must be the server time', async () => {
    await assertFails(place('c1', receiptData('c1', 'cust1', 1000, { createdAt: new Date('2020-01-01') })));
  });
});

describe('who can read a receipt', () => {
  beforeEach(async () => {
    await placeOrderWithReceipt(as('cust1'), 'cust1', 'o1');
  });
  const get = (db: Firestore) => getDoc(doc(db, 'order_receipts', 'o1'));

  it('the order\'s customer, the owning company\'s admin and Platform Admin can', async () => {
    const snap = await assertSucceeds(get(as('cust1')));
    expect((snap.data()!.image as Bytes).toUint8Array().length).toBe(300_000);
    await assertSucceeds(get(as('ca1')));
    await assertSucceeds(get(as('pa1')));
  });

  it('another customer, another company\'s admin and an anonymous user cannot', async () => {
    await assertFails(get(as('cust2')));
    await assertFails(get(as('ca2')));
    await assertFails(get(anon()));
    await assertFails(get(as('caNoCompany')));
  });

  it('technicians cannot, not even the one assigned to the order', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'orders', 'o1'), {
        technicianId: 't1',
        technicianName: 'Tech One',
        installationSelected: true,
      });
    });
    // the assigned technician can still read the ORDER (existing behaviour)...
    await assertSucceeds(getDoc(doc(as('tech1'), 'orders', 'o1')));
    // ...but never its receipt
    await assertFails(get(as('tech1')));
    await assertFails(get(as('techOther')));
  });

  it('a missing receipt reads as "does not exist" for an authorized reader (legacy orders)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'orders', 'legacy'), {
        ...orderData('legacy', 'cust1'),
        createdAt: now,
        updatedAt: now,
      });
    });
    // the three parties get a clean "does not exist"...
    for (const who of ['cust1', 'ca1', 'pa1']) {
      const snap = await assertSucceeds(getDoc(doc(as(who), 'order_receipts', 'legacy')));
      expect(snap.exists()).toBe(false);
    }
    // ...everybody else is still refused, so nothing is learned about the order
    for (const who of ['cust2', 'ca2', 'tech1']) {
      await assertFails(getDoc(doc(as(who), 'order_receipts', 'legacy')));
    }
    await assertFails(getDoc(doc(anon(), 'order_receipts', 'legacy')));
    // and a receipt for an order that does not exist at all is refused for all
    await assertFails(getDoc(doc(as('cust1'), 'order_receipts', 'no-such-order')));
    await assertFails(getDoc(doc(as('pa1'), 'order_receipts', 'no-such-order')));
  });

  it('nobody can list receipts', async () => {
    for (const who of ['cust1', 'ca1', 'pa1', 'tech1', 'cust2']) {
      await assertFails(getDocs(collection(as(who), 'order_receipts')));
    }
    await assertFails(getDocs(collection(anon(), 'order_receipts')));
  });
});

describe('immutability', () => {
  beforeEach(async () => {
    await placeOrderWithReceipt(as('cust1'), 'cust1', 'o1');
  });

  it('nobody can update or replace a receipt, not even its customer', async () => {
    for (const who of ['cust1', 'ca1', 'pa1', 'cust2', 'tech1']) {
      await assertFails(updateDoc(doc(as(who), 'order_receipts', 'o1'), { fileName: 'x.jpg' }));
    }
    // a "create" over the existing document is an update, and is refused too
    await assertFails(setDoc(doc(as('cust1'), 'order_receipts', 'o1'), receiptData('o1', 'cust1', 500)));
    expect(((await stored('order_receipts', 'o1'))!.image as Bytes).toUint8Array().length).toBe(300_000);
  });

  it('nobody can delete a receipt, including Platform Admin and the company admin', async () => {
    for (const who of ['cust1', 'ca1', 'pa1', 'cust2', 'tech1']) {
      await assertFails(deleteDoc(doc(as(who), 'order_receipts', 'o1')));
    }
    expect(await stored('order_receipts', 'o1')).toBeTruthy();
  });

  it('the payment-verification workflow is unaffected: the company can still confirm the payment', async () => {
    await assertSucceeds(
      updateDoc(doc(as('ca1'), 'orders', 'o1'), {
        paymentStatus: 'confirmed',
        updatedAt: serverTimestamp(),
      }),
    );
    // and the receipt is still there, readable, and now frozen for good
    await assertSucceeds(getDoc(doc(as('ca1'), 'order_receipts', 'o1')));
    await assertFails(deleteDoc(doc(as('ca1'), 'order_receipts', 'o1')));
  });
});

describe('deleting a company never deletes orders or their receipts', () => {
  // Orders are only accepted by an active company; only an inactive one can be deleted.
  async function orderThenDeactivate() {
    await placeOrderWithReceipt(as('cust1'), 'cust1', 'o1');
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'companies', 'c1'), { status: 'inactive' });
    });
  }

  it('the real company cascade leaves the order and its receipt in place', async () => {
    await orderThenDeactivate();

    const summary = await deleteCompanyCascade(as('pa1'), 'c1');

    expect(summary.companyDeleted).toBe(true);
    expect(summary.ordersKept).toBe(1);
    expect(await stored('companies', 'c1')).toBeUndefined();
    expect(await stored('orders', 'o1')).toBeTruthy();
    expect(await stored('order_receipts', 'o1')).toBeTruthy();
    // the customer and Platform Admin still read the receipt afterwards
    await assertSucceeds(getDoc(doc(as('cust1'), 'order_receipts', 'o1')));
    await assertSucceeds(getDoc(doc(as('pa1'), 'order_receipts', 'o1')));
  });

  it('a Platform Admin still cannot delete the receipt of a deleted company\'s order', async () => {
    await orderThenDeactivate();
    await deleteCompanyCascade(as('pa1'), 'c1');
    await assertFails(deleteDoc(doc(as('pa1'), 'order_receipts', 'o1')));
  });
});
