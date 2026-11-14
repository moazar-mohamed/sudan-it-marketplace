/*
 * Platform Admin's moderation: hide a product from customers (with a reason)
 * or show it again, end a running offer, and cancel a stuck order with the
 * reason 'admin' (the stock goes back exactly as for the company's own
 * cancellation). Local emulator only (npm run test:rules).
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
  increment,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { adminCancellationPlan } from '../src/data/moderation';
import { placeOrder } from './support/checkout';

let env: RulesTestEnvironment;
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

const as = (uid: string) => env.authenticatedContext(uid, { email_verified: true }).firestore();

const stored = async (path: string) => {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path))).data();
  });
  return data;
};

const product = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  companyId: 'c1',
  companyName: 'c1',
  name: 'Router',
  imageUrl: '',
  price: 100,
  currency: 'SDG',
  stockCount: 10,
  inStock: true,
  description: 'd',
  specifications: {},
  isDeliveryAvailable: true,
  isInstallationAvailable: true,
  installationPrice: 50,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...extra,
});

const storedOrder = (id: string, extra: Record<string, unknown> = {}) => ({
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
  stockReserved: false,
  createdAt: new Date(Date.now() - 48 * 3_600_000),
  updatedAt: new Date(Date.now() - 48 * 3_600_000),
  ...extra,
});

const put = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));

beforeEach(async () => {
  await env.clearFirestore();
  const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
    put(`users/${id}`, { id, fullName: id, email: `${id}@x.test`, role, isActive: true, createdAt: new Date(), ...extra });
  await user('pa', 'platform_admin');
  await user('pa_off', 'platform_admin', { isActive: false });
  await user('cust1', 'customer');
  await user('ca1', 'company_admin', { companyId: 'c1' });
  await user('ca2', 'company_admin', { companyId: 'c2' });
  for (const id of ['c1', 'c2']) {
    await put(`companies/${id}`, { name: id, status: 'active', rating: 0, reviewCount: 0, createdAt: new Date() });
  }
  await put('products/p1', product('p1'));
});

const ref = (db: ReturnType<typeof as>, id = 'p1') => doc(db, 'products', id);

describe('hiding a product', () => {
  it('lets Platform Admin hide it with a reason and show it again', async () => {
    await assertSucceeds(updateDoc(ref(as('pa')), { hidden: true, hiddenReason: 'Counterfeit item' }));
    expect(await stored('products/p1')).toMatchObject({ hidden: true, hiddenReason: 'Counterfeit item', price: 100, stockCount: 10 });
    await assertSucceeds(updateDoc(ref(as('pa')), { hidden: false, hiddenReason: '' }));
    expect(await stored('products/p1')).toMatchObject({ hidden: false, hiddenReason: '' });
  });

  it('needs a reason to hide, and no reason once shown', async () => {
    await assertFails(updateDoc(ref(as('pa')), { hidden: true }));
    await assertFails(updateDoc(ref(as('pa')), { hidden: true, hiddenReason: '' }));
    await assertFails(updateDoc(ref(as('pa')), { hidden: true, hiddenReason: 'x'.repeat(201) }));
    await assertSucceeds(updateDoc(ref(as('pa')), { hidden: true, hiddenReason: 'x'.repeat(200) }));
    await assertFails(updateDoc(ref(as('pa')), { hidden: false, hiddenReason: 'still here' }));
    await assertFails(updateDoc(ref(as('pa')), { hidden: 'yes', hiddenReason: 'r' }));
  });

  it('changes nothing else on the product', async () => {
    await assertFails(updateDoc(ref(as('pa')), { hidden: true, hiddenReason: 'r', price: 1 }));
    await assertFails(updateDoc(ref(as('pa')), { hidden: true, hiddenReason: 'r', stockCount: 0 }));
    await assertFails(updateDoc(ref(as('pa')), { name: 'Renamed' }));
    await assertFails(updateDoc(ref(as('pa')), { stockCount: 99 }));
    await assertFails(updateDoc(ref(as('pa')), { hidden: true, hiddenReason: 'r', companyId: 'c2' }));
  });

  it('is for an active Platform Admin only', async () => {
    for (const uid of ['pa_off', 'cust1', 'ca1', 'ca2']) {
      await assertFails(updateDoc(ref(as(uid)), { hidden: true, hiddenReason: 'r' }));
    }
    expect((await stored('products/p1'))!.hidden).toBeUndefined();
  });

  it('cannot be undone or applied by the company', async () => {
    await assertSucceeds(updateDoc(ref(as('pa')), { hidden: true, hiddenReason: 'Counterfeit item' }));
    const edit = (extra: Record<string, unknown>) => updateDoc(ref(as('ca1')), { updatedAt: serverTimestamp(), ...extra });
    await assertFails(edit({ hidden: false, hiddenReason: '' }));
    await assertFails(edit({ hidden: false }));
    await assertFails(edit({ hiddenReason: 'changed' }));
    // ...but the company still edits everything else on its hidden product.
    await assertSucceeds(edit({ price: 120, stockCount: 7 }));
    expect(await stored('products/p1')).toMatchObject({ hidden: true, hiddenReason: 'Counterfeit item', price: 120 });
  });

  it('cannot be set by a company on a new product', async () => {
    const create = (id: string, extra: Record<string, unknown>) =>
      setDoc(ref(as('ca1'), id), product(id, { createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra }));
    await assertSucceeds(create('p_new', {}));
    await assertFails(create('p_new2', { hidden: true, hiddenReason: 'self' }));
    await assertFails(create('p_new3', { hiddenReason: 'self' }));
  });

  it('keeps a hidden product from being ordered, and lets it be ordered again once shown', async () => {
    const order = (id: string) => ({
      ...storedOrder(id),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(updateDoc(ref(as('pa')), { hidden: true, hiddenReason: 'Counterfeit item' }));
    await assertFails(placeOrder(as('cust1'), 'cust1', order('o_hidden'), { maxAttempts: 1 }));
    await assertSucceeds(updateDoc(ref(as('pa')), { hidden: false, hiddenReason: '' }));
    await assertSucceeds(placeOrder(as('cust1'), 'cust1', order('o_shown')));
  });

  it('leaves the orders already placed for it alone', async () => {
    await put('orders/o_old', storedOrder('o_old'));
    await assertSucceeds(updateDoc(ref(as('pa')), { hidden: true, hiddenReason: 'r' }));
    expect((await stored('orders/o_old'))!.orderStatus).toBe('processing');
  });
});

describe('ending an offer', () => {
  const offerEnd = Timestamp.fromDate(new Date(Date.now() + 3 * 86_400_000));
  beforeEach(async () => {
    await put('products/p1', product('p1', { offerPrice: 80, offerEndsAt: offerEnd, offerBadge: 'discount' }));
  });

  it('clears the price, the end time and the badge together', async () => {
    await assertSucceeds(
      updateDoc(ref(as('pa')), { offerPrice: deleteField(), offerEndsAt: deleteField(), offerBadge: deleteField() }),
    );
    const after = (await stored('products/p1'))!;
    expect(after.offerPrice).toBeUndefined();
    expect(after.price).toBe(100);
  });

  it('also accepts them set to null', async () => {
    await assertSucceeds(updateDoc(ref(as('pa')), { offerPrice: null, offerEndsAt: null, offerBadge: null }));
  });

  it('refuses a half-ended offer, a changed offer or a new one', async () => {
    await assertFails(updateDoc(ref(as('pa')), { offerPrice: null }));
    await assertFails(updateDoc(ref(as('pa')), { offerPrice: 50 }));
    await assertFails(updateDoc(ref(as('pa')), { offerPrice: null, offerEndsAt: null, offerBadge: 'special' }));
  });

  it('is for Platform Admin, not for anyone else through this path', async () => {
    await assertFails(updateDoc(ref(as('cust1')), { offerPrice: null, offerEndsAt: null, offerBadge: null }));
    await assertFails(updateDoc(ref(as('pa_off')), { offerPrice: null, offerEndsAt: null, offerBadge: null }));
  });

  it('can be done together with hiding', async () => {
    await assertSucceeds(
      updateDoc(ref(as('pa')), { hidden: true, hiddenReason: 'r', offerPrice: null, offerEndsAt: null, offerBadge: null }),
    );
  });
});

/** The admin's cancellation: the order, and the stock in the same batch when the order took it. */
function adminCancel(uid: string, orderId: string, options: { reason?: string; stockDelta?: number; skipProduct?: boolean; released?: boolean } = {}) {
  const db = as(uid);
  const batch = writeBatch(db);
  return getDoc(doc(db, 'orders', orderId)).then(async (snap) => {
    const order = snap.data()!;
    const productRef = doc(db, 'products', order.productId as string);
    const productSnap = await getDoc(productRef);
    // The decision is the app's own (src/data/moderation.ts), not a copy of it.
    const { returnsStock: returns, quantity } = adminCancellationPlan(order, productSnap.data());
    if (returns && !options.skipProduct) {
      batch.update(productRef, {
        stockCount: increment(options.stockDelta ?? quantity),
        lastReleasedOrderId: orderId,
        updatedAt: serverTimestamp(),
      });
    }
    batch.update(doc(db, 'orders', orderId), {
      orderStatus: 'cancelled',
      cancelReason: options.reason ?? 'admin',
      cancelledAt: serverTimestamp(),
      stockReleased: options.released ?? (returns && !options.skipProduct),
      updatedAt: serverTimestamp(),
    });
    return batch.commit();
  });
}

describe('cancelling a stuck order', () => {
  it('an unconfirmed order (it took no stock) is cancelled and the stock is untouched', async () => {
    await put('orders/o1', storedOrder('o1'));
    await assertSucceeds(adminCancel('pa', 'o1'));
    expect(await stored('orders/o1')).toMatchObject({ orderStatus: 'cancelled', cancelReason: 'admin', stockReleased: false });
    expect((await stored('products/p1'))!.stockCount).toBe(10);
  });

  it('a confirmed order that took its stock gives exactly its quantity back, once', async () => {
    await put('orders/o2', storedOrder('o2', { paymentStatus: 'confirmed', stockReserved: true }));
    await assertSucceeds(adminCancel('pa', 'o2'));
    expect(await stored('orders/o2')).toMatchObject({ orderStatus: 'cancelled', cancelReason: 'admin', stockReleased: true });
    expect((await stored('products/p1'))!.stockCount).toBe(12);
    await assertFails(adminCancel('pa', 'o2'));
    expect((await stored('products/p1'))!.stockCount).toBe(12);
  });

  it('an order placed before stock moved to the confirmation (no stockReserved field) gives its stock back', async () => {
    const { stockReserved: _stockReserved, ...legacy } = storedOrder('o3');
    void _stockReserved;
    await put('orders/o3', legacy);
    await assertSucceeds(adminCancel('pa', 'o3'));
    expect((await stored('products/p1'))!.stockCount).toBe(12);
  });

  it('refuses giving back the wrong amount, or not giving back what the order took', async () => {
    await put('orders/o4', storedOrder('o4', { paymentStatus: 'confirmed', stockReserved: true }));
    await assertFails(adminCancel('pa', 'o4', { stockDelta: 5 }));
    await assertFails(adminCancel('pa', 'o4', { skipProduct: true, released: true }));
    await assertFails(adminCancel('pa', 'o4', { skipProduct: true, released: false }));
    expect((await stored('products/p1'))!.stockCount).toBe(10);
    expect((await stored('orders/o4'))!.orderStatus).toBe('processing');
  });

  it('refuses claiming stock back for an order that took none', async () => {
    await put('orders/o5', storedOrder('o5'));
    const db = as('pa');
    const batch = writeBatch(db);
    batch.update(doc(db, 'products', 'p1'), { stockCount: increment(2), lastReleasedOrderId: 'o5', updatedAt: serverTimestamp() });
    batch.update(doc(db, 'orders', 'o5'), {
      orderStatus: 'cancelled', cancelReason: 'admin', cancelledAt: serverTimestamp(), stockReleased: true, updatedAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it('only while Processing: never once out for delivery, completed or already cancelled', async () => {
    await put('orders/o6', storedOrder('o6', { orderStatus: 'out_for_delivery', paymentStatus: 'confirmed', stockReserved: true }));
    await put('orders/o7', storedOrder('o7', { orderStatus: 'completed', paymentStatus: 'confirmed', stockReserved: true }));
    await put('orders/o8', storedOrder('o8', { orderStatus: 'cancelled', cancelReason: 'company', stockReleased: false }));
    for (const id of ['o6', 'o7', 'o8']) await assertFails(adminCancel('pa', id));
    expect((await stored('products/p1'))!.stockCount).toBe(10);
  });

  it('uses the reason admin only: not the company\'s reasons, and the company cannot use it', async () => {
    await put('orders/o9', storedOrder('o9'));
    await assertFails(adminCancel('pa', 'o9', { reason: 'company' }));
    await assertFails(adminCancel('pa', 'o9', { reason: 'expired' }));
    await assertFails(adminCancel('ca1', 'o9'));
    await assertFails(adminCancel('cust1', 'o9'));
    await assertFails(adminCancel('pa_off', 'o9'));
    expect((await stored('orders/o9'))!.orderStatus).toBe('processing');
    await assertSucceeds(adminCancel('pa', 'o9'));
  });

  it('changes nothing else on the order, and Platform Admin still cannot edit or delete one', async () => {
    await put('orders/o10', storedOrder('o10'));
    const db = as('pa');
    await assertFails(
      updateDoc(doc(db, 'orders', 'o10'), {
        orderStatus: 'cancelled', cancelReason: 'admin', cancelledAt: serverTimestamp(), stockReleased: false,
        updatedAt: serverTimestamp(), totalAmount: 1,
      }),
    );
    await assertFails(updateDoc(doc(db, 'orders', 'o10'), { paymentStatus: 'confirmed', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'orders', 'o10'), { orderStatus: 'completed', updatedAt: serverTimestamp() }));
  });

  it('is saved together with its activity entry', async () => {
    await put('orders/o11', storedOrder('o11'));
    const db = as('pa');
    const batch = writeBatch(db);
    batch.update(doc(db, 'orders', 'o11'), {
      orderStatus: 'cancelled', cancelReason: 'admin', cancelledAt: serverTimestamp(), stockReleased: false, updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'admin_audit_log', 'e1'), {
      actorId: 'pa', actorName: 'Mona', action: 'order.cancel', targetType: 'order', targetId: 'o11',
      targetName: 'Router', detail: 'Customer asked to cancel', createdAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });

  it('keeps the audit entry for a hidden product', async () => {
    const db = as('pa');
    const batch = writeBatch(db);
    batch.update(doc(db, 'products', 'p1'), { hidden: true, hiddenReason: 'r' });
    batch.set(doc(db, 'admin_audit_log', 'e2'), {
      actorId: 'pa', actorName: 'Mona', action: 'product.hide', targetType: 'product', targetId: 'p1',
      targetName: 'Router', detail: 'r', createdAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });
});

describe('ending the offer on a company service', () => {
  const link = (extra: Record<string, unknown> = {}) => ({
    id: 'l1',
    companyId: 'c1',
    serviceId: 's1',
    isActive: true,
    price: 500,
    note: '',
    offerPrice: 400,
    offerEndsAt: Timestamp.fromDate(new Date(Date.now() + 3 * 86_400_000)),
    offerBadge: 'discount',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  });
  beforeEach(async () => {
    await put('company_services/l1', link());
  });

  const end = (uid: string, extra: Record<string, unknown> = {}) => {
    const db = as(uid);
    const batch = writeBatch(db);
    batch.update(doc(db, 'company_services', 'l1'), {
      offerPrice: null,
      offerEndsAt: null,
      offerBadge: null,
      updatedAt: serverTimestamp(),
      ...extra,
    });
    batch.set(doc(db, 'admin_audit_log', 'e1'), {
      actorId: uid, actorName: 'Mona', action: 'service.endOffer', targetType: 'service', targetId: 'l1',
      targetName: 'Cabling — c1', createdAt: serverTimestamp(),
    });
    return batch.commit();
  };

  it('lets an active Platform Admin end it, with its activity entry in the same batch', async () => {
    await assertSucceeds(end('pa'));
    expect(await stored('company_services/l1')).toMatchObject({ offerPrice: null, offerEndsAt: null, offerBadge: null, price: 500, isActive: true });
  });

  it('refuses a deactivated admin or anyone who is not the company or Platform Admin', async () => {
    await assertFails(end('pa_off'));
    await assertFails(end('cust1'));
    await assertFails(end('ca2'));
  });

  it('cannot change anything else on the link: the price, the note, the switch, or even a new offer', async () => {
    const db = as('pa');
    const edit = (extra: Record<string, unknown>) =>
      updateDoc(doc(db, 'company_services', 'l1'), { updatedAt: serverTimestamp(), ...extra });
    await assertFails(edit({ price: 1 }));
    await assertFails(edit({ isActive: false }));
    await assertFails(edit({ note: 'edited' }));
    await assertFails(edit({ offerPrice: 300 }));
    await assertFails(edit({ offerPrice: null, offerEndsAt: null, offerBadge: null, price: 1 }));
    await assertFails(edit({ offerPrice: null, offerEndsAt: null, offerBadge: null, isActive: false }));
    expect(await stored('company_services/l1')).toMatchObject({ price: 500, isActive: true, offerPrice: 400 });
  });

  it('cannot create a link for a company, and the company still edits its own', async () => {
    const created = { ...link({ id: 'l_new', offerPrice: null, offerEndsAt: null, offerBadge: null }), createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await assertFails(setDoc(doc(as('pa'), 'company_services', 'l_new'), created));
    await assertSucceeds(
      updateDoc(doc(as('ca1'), 'company_services', 'l1'), { price: 600, isActive: false, updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(as('ca2'), 'company_services', 'l1'), { price: 1, updatedAt: serverTimestamp() }),
    );
  });

  it('refuses a half-ended offer and a write without the server time', async () => {
    const db = as('pa');
    await assertFails(updateDoc(doc(db, 'company_services', 'l1'), { offerPrice: null, updatedAt: serverTimestamp() }));
    await assertFails(
      updateDoc(doc(db, 'company_services', 'l1'), { offerPrice: null, offerEndsAt: null, offerBadge: null }),
    );
  });
});
