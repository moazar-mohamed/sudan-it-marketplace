/*
 * A customer can message a company from a product or service page before
 * ordering anything ("Contact"): one conversation per customer per product
 * (`chats/{uid}_product_{productId}`) or per company service
 * (`chats/{uid}_service_{companyServiceId}`), told apart from an order's or a
 * service request's by `productId` / `companyServiceId`. Local emulator only
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
  serverTimestamp,
  setDoc,
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

const product = (id: string, companyId: string, name: string) => ({
  id,
  companyId,
  companyName: companyId,
  name,
  imageUrl: '',
  price: 100,
  currency: 'SDG',
  stockCount: 5,
  inStock: true,
  description: 'd',
  specifications: {},
  isDeliveryAvailable: true,
  isInstallationAvailable: false,
  installationPrice: null,
  createdAt: now,
  updatedAt: now,
});

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const put = (path: string, data: Record<string, unknown>) => setDoc(doc(db, path), data);
    for (const u of [
      user('cust1', 'customer'),
      user('cust2', 'customer'),
      user('custOff', 'customer', { isActive: false }),
      user('ca1', 'company_admin', { companyId: 'c1' }),
      user('ca2', 'company_admin', { companyId: 'c2' }),
      user('tech1', 'technician', { companyId: 'c1' }),
      user('pa1', 'platform_admin'),
    ]) {
      await put(`users/${u.id}`, u);
    }
    for (const [id, status] of [
      ['c1', 'active'],
      ['c2', 'active'],
      ['cOff', 'inactive'],
    ]) {
      await put(`companies/${id}`, { name: `Company ${id}`, status, rating: 0, reviewCount: 0, createdAt: now });
    }
    await put('products/p1', product('p1', 'c1', 'Router'));
    await put('products/p2', product('p2', 'c2', 'Switch'));
    await put('products/pOff', product('pOff', 'cOff', 'Old stock'));
    await put('services/svc1', {
      id: 'svc1', categoryId: 'cat1', name: 'Network setup', description: '', isActive: true, createdAt: now,
    });
    const link = (id: string, companyId: string, extra: Record<string, unknown> = {}) =>
      put(`company_services/${id}`, { id, companyId, serviceId: 'svc1', isActive: true, createdAt: now, ...extra });
    await link('c1_svc1', 'c1', { price: 15000 });
    await link('c1_svc2', 'c1', { isActive: false });
    await link('cOff_svc1', 'cOff');
  });
}

beforeEach(seed);

/** The conversation the app writes for a question about a product. */
const productChat = (customerId: string, productId: string, extra: Record<string, unknown> = {}) => ({
  id: `${customerId}_product_${productId}`,
  serviceRequestId: null,
  orderId: null,
  productId,
  customerId,
  companyId: 'c1',
  customerName: customerId,
  companyName: 'Company c1',
  serviceName: '',
  productName: 'Router',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

/** The conversation the app writes for a question about a company service. */
const serviceChat = (customerId: string, linkId: string, extra: Record<string, unknown> = {}) => ({
  id: `${customerId}_service_${linkId}`,
  serviceRequestId: null,
  orderId: null,
  companyServiceId: linkId,
  customerId,
  companyId: 'c1',
  customerName: customerId,
  companyName: 'Company c1',
  serviceName: 'Network setup',
  productName: '',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

const open = (db: Firestore, data: { id: string } & Record<string, unknown>) =>
  setDoc(doc(db, 'chats', data.id), data);

/** A message plus the conversation's last-message update. */
function sendMessage(db: Firestore, chatId: string, senderId: string, role: 'customer' | 'company') {
  const messageRef = doc(collection(db, 'chats', chatId, 'messages'));
  const text = 'Is it still available?';
  const batch = writeBatch(db);
  batch.set(messageRef, {
    id: messageRef.id,
    senderId,
    senderRole: role,
    senderName: senderId,
    text,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, 'chats', chatId), {
    lastMessageId: messageRef.id,
    lastMessageText: text,
    lastMessageAt: serverTimestamp(),
    lastMessageSenderRole: role,
    updatedAt: serverTimestamp(),
    [role === 'customer' ? 'customerLastReadAt' : 'companyLastReadAt']: serverTimestamp(),
  });
  return batch.commit();
}

async function stored(id: string): Promise<Record<string, unknown> | undefined> {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), 'chats', id))).data();
  });
  return data;
}

describe('asking a company about a product before ordering', () => {
  it('a customer opens a conversation about the product, under its fixed id', async () => {
    await assertSucceeds(open(as('cust1'), productChat('cust1', 'p1')));
    expect(await stored('cust1_product_p1')).toMatchObject({
      productId: 'p1',
      customerId: 'cust1',
      companyId: 'c1',
      productName: 'Router',
    });
  });

  it('reading it before it exists is refused like any stranger\'s (the app then creates it)', async () => {
    await assertFails(getDoc(doc(as('cust1'), 'chats', 'cust1_product_p1')));
  });

  it('asking again reopens it: a second create never overwrites the first', async () => {
    await assertSucceeds(open(as('cust1'), productChat('cust1', 'p1')));
    await assertSucceeds(sendMessage(as('cust1'), 'cust1_product_p1', 'cust1', 'customer'));
    await assertFails(open(as('cust1'), productChat('cust1', 'p1')));
    expect(await stored('cust1_product_p1')).toMatchObject({ lastMessageText: 'Is it still available?' });
  });

  it('the id is the caller\'s own, for that very product', async () => {
    // Opening one in another customer's name, or under their id.
    await assertFails(open(as('cust1'), productChat('cust2', 'p1')));
    await assertFails(open(as('cust1'), { ...productChat('cust1', 'p1'), id: 'cust2_product_p1' }));
    // An id that names another product, or no fixed id at all.
    await assertFails(open(as('cust1'), { ...productChat('cust1', 'p1'), id: 'cust1_product_p2' }));
    await assertFails(open(as('cust1'), { ...productChat('cust1', 'p1'), id: 'random1' }));
  });

  it('the product must exist, belong to that company and keep its own name', async () => {
    await assertFails(open(as('cust1'), productChat('cust1', 'ghost')));
    await assertFails(open(as('cust1'), productChat('cust1', 'p2')));
    await assertFails(open(as('cust1'), productChat('cust1', 'p1', { companyId: 'c2' })));
    await assertFails(open(as('cust1'), productChat('cust1', 'p1', { productName: 'Something else' })));
  });

  it('not with a company that has been deactivated', async () => {
    await assertFails(
      open(as('cust1'), productChat('cust1', 'pOff', { companyId: 'cOff', productName: 'Old stock' })),
    );
  });

  it('only an active customer can ask, for themself', async () => {
    await assertFails(open(as('custOff'), productChat('custOff', 'p1')));
    for (const uid of ['ca1', 'ca2', 'tech1', 'pa1']) {
      await assertFails(open(as(uid), productChat(uid, 'p1')));
    }
    await assertFails(open(anon(), productChat('cust1', 'p1')));
  });

  it('it cannot also claim an order, a request or a service', async () => {
    await assertFails(open(as('cust1'), productChat('cust1', 'p1', { orderId: 'o1' })));
    await assertFails(open(as('cust1'), productChat('cust1', 'p1', { serviceRequestId: 'r1' })));
    await assertFails(open(as('cust1'), productChat('cust1', 'p1', { companyServiceId: 'c1_svc1' })));
    await assertFails(open(as('cust1'), productChat('cust1', 'p1', { serviceName: 'Network setup' })));
    await assertFails(open(as('cust1'), productChat('cust1', 'p1', { unexpected: true })));
  });
});

describe('asking a company about its service before requesting it', () => {
  it('a customer opens a conversation about the company\'s offer of a service', async () => {
    await assertSucceeds(open(as('cust1'), serviceChat('cust1', 'c1_svc1')));
    expect(await stored('cust1_service_c1_svc1')).toMatchObject({
      companyServiceId: 'c1_svc1',
      companyId: 'c1',
      serviceName: 'Network setup',
    });
  });

  it('only through an active offer of that company, with an active company', async () => {
    await assertFails(open(as('cust1'), serviceChat('cust1', 'c1_svc2')));
    await assertFails(open(as('cust1'), serviceChat('cust1', 'c1_svc1', { companyId: 'c2' })));
    await assertFails(open(as('cust1'), serviceChat('cust1', 'cOff_svc1', { companyId: 'cOff' })));
    await assertFails(open(as('cust1'), serviceChat('cust1', 'ghost')));
  });

  it('names the service, not a product, under the caller\'s own fixed id', async () => {
    await assertFails(open(as('cust1'), serviceChat('cust1', 'c1_svc1', { serviceName: '' })));
    await assertFails(open(as('cust1'), serviceChat('cust1', 'c1_svc1', { productName: 'Router' })));
    await assertFails(open(as('cust1'), { ...serviceChat('cust1', 'c1_svc1'), id: 'cust2_service_c1_svc1' }));
    await assertFails(open(as('ca1'), serviceChat('ca1', 'c1_svc1')));
  });
});

describe('talking in a question conversation', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'chats', 'cust1_product_p1'), { ...productChat('cust1', 'p1'), createdAt: now, updatedAt: now });
      await setDoc(doc(db, 'chats', 'cust1_service_c1_svc1'), {
        ...serviceChat('cust1', 'c1_svc1'),
        createdAt: now,
        updatedAt: now,
      });
    });
  });

  it('the customer and the company both read it and write in it', async () => {
    for (const id of ['cust1_product_p1', 'cust1_service_c1_svc1']) {
      await assertSucceeds(getDoc(doc(as('cust1'), 'chats', id)));
      await assertSucceeds(getDoc(doc(as('ca1'), 'chats', id)));
      await assertSucceeds(sendMessage(as('cust1'), id, 'cust1', 'customer'));
      await assertSucceeds(sendMessage(as('ca1'), id, 'ca1', 'company'));
    }
  });

  it('outsiders, another company, a technician and Platform Admin cannot', async () => {
    for (const uid of ['cust2', 'ca2', 'tech1', 'pa1']) {
      await assertFails(getDoc(doc(as(uid), 'chats', 'cust1_product_p1')));
    }
    await assertFails(sendMessage(as('cust2'), 'cust1_product_p1', 'cust2', 'customer'));
    await assertFails(sendMessage(as('ca2'), 'cust1_product_p1', 'ca2', 'company'));
  });

  it('shows up in the customer\'s and the company\'s conversation lists', async () => {
    const mine = await getDocs(query(collection(as('cust1'), 'chats'), where('customerId', '==', 'cust1')));
    expect(mine.docs.map((d) => d.id).sort()).toEqual(['cust1_product_p1', 'cust1_service_c1_svc1']);
    const company = await getDocs(query(collection(as('ca1'), 'chats'), where('companyId', '==', 'c1')));
    expect(company.docs.map((d) => d.id).sort()).toEqual(['cust1_product_p1', 'cust1_service_c1_svc1']);
  });
});
