/*
 * Every order gets a conversation with its company (`chats/{orderId}`, told
 * apart from a service request's by `orderId` instead of `serviceRequestId`):
 * written together with a brand-new order (one transaction, like a receipt),
 * or on its own for an order placed before this existed. Local emulator only
 * (npm run test:rules); every user is a fake identity.
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

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const u of [
      user('cust1', 'customer'),
      user('cust2', 'customer'),
      user('ca1', 'company_admin', { companyId: 'c1' }),
      user('ca2', 'company_admin', { companyId: 'c2' }),
      user('tech1', 'technician', { companyId: 'c1' }),
      user('pa1', 'platform_admin'),
    ]) {
      await setDoc(doc(db, 'users', u.id), u);
    }
    for (const id of ['c1', 'c2']) {
      await setDoc(doc(db, 'companies', id), {
        name: id,
        status: 'active',
        rating: 0,
        reviewCount: 0,
        createdAt: now,
      });
    }
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
    // A pre-existing order (placed before every order got a conversation).
    await setDoc(doc(db, 'orders', 'old1'), {
      ...orderData('old1', 'cust1'),
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'orders', 'old2'), {
      ...orderData('old2', 'cust2'),
      createdAt: now,
      updatedAt: now,
    });
  });
}

const orderData = (id: string, customerId: string, extra: Record<string, unknown> = {}) => ({
  id,
  customerId,
  companyId: 'c1',
  companyName: 'Nile Tech',
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
  customerName: 'Amna',
  paymentStatus: 'pending_verification',
  orderStatus: 'processing',
  receiptFileName: null,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

/** The order-chat fields the app writes, for one of [orderData]'s orders. */
const chatFor = (order: ReturnType<typeof orderData>, extra: Record<string, unknown> = {}) => ({
  id: order.id,
  orderId: order.id,
  customerId: order.customerId,
  companyId: order.companyId,
  customerName: order.customerName,
  companyName: order.companyName,
  productName: order.productName,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

/** Order + its conversation, in one transaction (as the app places an order). */
function placeOrderWithChat(
  db: Firestore,
  order: ReturnType<typeof orderData>,
  chatExtra: Record<string, unknown> = {},
) {
  return runTransaction(db, async (tx) => {
    const productRef = doc(db, 'products', 'p1');
    const snap = await tx.get(productRef);
    const available = (snap.data()?.stockCount as number | undefined) ?? 50;
    tx.update(productRef, { stockCount: available - 1, lastOrderId: order.id, updatedAt: serverTimestamp() });
    tx.set(doc(db, 'orders', order.id), order);
    tx.set(doc(db, 'chats', order.id), chatFor(order, chatExtra));
  });
}

/** The same two writes (order + chat) as one plain batch. */
function batchOrderWithChat(
  db: Firestore,
  order: ReturnType<typeof orderData>,
  chatExtra: Record<string, unknown> = {},
) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'products', 'p1'), {
    stockCount: 49,
    lastOrderId: order.id,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'orders', order.id), order);
  batch.set(doc(db, 'chats', order.id), chatFor(order, chatExtra));
  return batch.commit();
}

/** Starting a conversation for an order that already exists (the lazy path). */
const startChat = (db: Firestore, orderId: string, data: Record<string, unknown>) =>
  setDoc(doc(db, 'chats', orderId), data);

/** A message plus the conversation's last-message update. */
function sendMessage(
  db: Firestore,
  chatId: string,
  senderId: string,
  role: 'customer' | 'company',
  opts: { message?: Record<string, unknown>; chat?: Record<string, unknown> } = {},
) {
  const messageRef = doc(collection(db, 'chats', chatId, 'messages'));
  const text = 'Where is my order?';
  const batch = writeBatch(db);
  batch.set(messageRef, {
    id: messageRef.id,
    senderId,
    senderRole: role,
    senderName: senderId,
    text,
    createdAt: serverTimestamp(),
    ...opts.message,
  });
  batch.update(doc(db, 'chats', chatId), {
    lastMessageId: messageRef.id,
    lastMessageText: (opts.message?.text as string | undefined) ?? text,
    lastMessageAt: serverTimestamp(),
    lastMessageSenderRole: role,
    updatedAt: serverTimestamp(),
    [role === 'customer' ? 'customerLastReadAt' : 'companyLastReadAt']: serverTimestamp(),
    ...opts.chat,
  });
  return batch.commit();
}

async function stored(path: string, id: string): Promise<Record<string, unknown> | undefined> {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path, id))).data();
  });
  return data;
}

beforeEach(seed);

describe('a conversation is created together with a brand-new order', () => {
  it('as one transaction (stock reservation + order + chat)', async () => {
    const order = orderData('n1', 'cust1');
    await assertSucceeds(placeOrderWithChat(as('cust1'), order));
    expect(await stored('chats', 'n1')).toMatchObject({ orderId: 'n1', companyId: 'c1', productName: 'Router' });
  });

  it('or as one plain batch', async () => {
    await assertSucceeds(batchOrderWithChat(as('cust1'), orderData('n2', 'cust1')));
    expect(await stored('chats', 'n2')).toBeTruthy();
  });

  it('a chat needs its order: refused alongside one the rules refuse (wrong customer)', async () => {
    await assertFails(batchOrderWithChat(as('cust1'), orderData('n3', 'cust2')));
    expect(await stored('chats', 'n3')).toBeUndefined();
  });

  it('the conversation must name the order\'s own participants', async () => {
    await assertFails(batchOrderWithChat(as('cust1'), orderData('n4', 'cust1'), { companyId: 'c2' }));
    await assertFails(batchOrderWithChat(as('cust1'), orderData('n5', 'cust1'), { productName: 'Something else' }));
  });

  it('the rules do not force a chat on every order (the app always writes one; an old order without one still works)', async () => {
    const db = as('cust1');
    const batch = writeBatch(db);
    batch.update(doc(db, 'products', 'p1'), { stockCount: 49, lastOrderId: 'n6', updatedAt: serverTimestamp() });
    batch.set(doc(db, 'orders', 'n6'), orderData('n6', 'cust1'));
    await assertSucceeds(batch.commit());
    expect(await stored('chats', 'n6')).toBeUndefined();
  });
});

describe('starting a conversation for an order placed before this existed', () => {
  it('the order\'s own customer can start one at any time', async () => {
    await assertSucceeds(startChat(as('cust1'), 'old1', chatFor(orderData('old1', 'cust1'))));
    expect(await stored('chats', 'old1')).toMatchObject({ orderId: 'old1' });
  });

  it('another customer cannot start one for someone else\'s order', async () => {
    await assertFails(startChat(as('cust2'), 'old1', chatFor(orderData('old1', 'cust2'))));
  });

  it('the company cannot start one (only the customer can)', async () => {
    await assertFails(startChat(as('ca1'), 'old1', chatFor(orderData('old1', 'cust1'))));
  });

  it('must still name the order\'s own participants and product', async () => {
    await assertFails(startChat(as('cust1'), 'old1', chatFor(orderData('old1', 'cust1'), { companyName: 'Someone else' })));
  });

  it('refused for an order that does not exist', async () => {
    await assertFails(startChat(as('cust1'), 'ghost', chatFor(orderData('ghost', 'cust1'))));
  });

  it('cannot claim to be for a service request instead', async () => {
    await assertFails(
      setDoc(doc(as('cust1'), 'chats', 'old1'), {
        id: 'old1',
        serviceRequestId: 'old1',
        customerId: 'cust1',
        companyId: 'c1',
        customerName: 'Amna',
        companyName: 'Nile Tech',
        serviceName: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('cannot carry both an orderId and a serviceRequestId, or neither', async () => {
    await assertFails(
      startChat(as('cust1'), 'old1', { ...chatFor(orderData('old1', 'cust1')), serviceRequestId: 'old1' }),
    );
    const { orderId: _orderId, ...noAnchor } = chatFor(orderData('old1', 'cust1'));
    void _orderId;
    await assertFails(startChat(as('cust1'), 'old1', noAnchor));
  });
});

describe('messaging and reading an order\'s conversation', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'chats', 'old1'), chatFor(orderData('old1', 'cust1')));
    });
  });

  it('the customer and the company can both read and send messages', async () => {
    await assertSucceeds(getDoc(doc(as('cust1'), 'chats', 'old1')));
    await assertSucceeds(getDoc(doc(as('ca1'), 'chats', 'old1')));
    await assertSucceeds(sendMessage(as('cust1'), 'old1', 'cust1', 'customer'));
    await assertSucceeds(sendMessage(as('ca1'), 'old1', 'ca1', 'company'));
  });

  it('outsiders, another company, a technician and Platform Admin cannot', async () => {
    for (const uid of ['cust2', 'ca2', 'tech1', 'pa1']) {
      await assertFails(getDoc(doc(as(uid), 'chats', 'old1')));
    }
    await assertFails(getDoc(doc(anon(), 'chats', 'old1')));
    await assertFails(sendMessage(as('cust2'), 'old1', 'cust2', 'customer'));
    await assertFails(sendMessage(as('ca2'), 'old1', 'ca2', 'company'));
  });

  it('conversation lists mix orders and service requests, filtered the same way', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'chats', 'sr1'), {
        id: 'sr1',
        serviceRequestId: 'sr1',
        customerId: 'cust1',
        companyId: 'c1',
        customerName: 'Amna',
        companyName: 'Nile Tech',
        serviceName: 'Installation',
        createdAt: now,
        updatedAt: now,
      });
    });
    const mine = await getDocs(query(collection(as('cust1'), 'chats'), where('customerId', '==', 'cust1')));
    expect(mine.docs.map((d) => d.id).sort()).toEqual(['old1', 'sr1']);
  });

  it('each side marks only its own read position; participants never change', async () => {
    await assertSucceeds(updateDoc(doc(as('cust1'), 'chats', 'old1'), { customerLastReadAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('cust1'), 'chats', 'old1'), { companyLastReadAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('ca1'), 'chats', 'old1'), { companyId: 'c2' }));
  });
});
