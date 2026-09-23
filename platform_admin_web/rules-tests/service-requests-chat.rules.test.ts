/*
 * Standalone services: company_services price/note, service_requests and
 * their chats (chats/{requestId} + messages). Only the request's customer and
 * the admins of its company can read or write a request, its conversation and
 * its messages. Local emulator only (npm run test:rules).
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
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

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

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const put = (path: string, data: Record<string, unknown>) =>
      setDoc(doc(db, path), data);
    await put('users/cust1', user('cust1', 'customer'));
    await put('users/cust2', user('cust2', 'customer'));
    await put('users/custOff', user('custOff', 'customer', { isActive: false }));
    await put('users/ca1', user('ca1', 'company_admin', { companyId: 'c1' }));
    await put('users/ca2', user('ca2', 'company_admin', { companyId: 'c2' }));
    await put('users/caOff', user('caOff', 'company_admin', { companyId: 'cOff' }));
    await put('users/pa', user('pa', 'platform_admin'));
    await put('users/paOff', user('paOff', 'platform_admin', { isActive: false }));
    await put('users/tech1', user('tech1', 'technician', { companyId: 'c1' }));
    for (const [id, status] of [
      ['c1', 'active'],
      ['c2', 'active'],
      ['cOff', 'inactive'],
    ]) {
      await put(`companies/${id}`, { name: `Company ${id}`, status, rating: 0, reviewCount: 0, createdAt: now });
    }
    await put('categories/cat1', {
      id: 'cat1', name: 'IT', description: '', iconName: '', isActive: true, createdAt: now,
    });
    for (const id of ['svc1', 'svc2', 'svc3']) {
      await put(`services/${id}`, {
        id, categoryId: 'cat1', name: `Service ${id}`, description: '', isActive: true, createdAt: now,
      });
    }
    const link = (id: string, companyId: string, serviceId: string, extra: Record<string, unknown> = {}) =>
      put(`company_services/${id}`, {
        id, companyId, serviceId, isActive: true, createdAt: now, ...extra,
      });
    await link('c1_svc1', 'c1', 'svc1', { price: 15000, note: 'On site' });
    await link('c1_svc2', 'c1', 'svc2'); // no price at all
    await link('c1_svc3', 'c1', 'svc3', { isActive: false });
    await link('cOff_svc1', 'cOff', 'svc1');

    // An existing request + conversation between cust1 and c1.
    await put('service_requests/r1', {
      ...requestFields('r1', 'cust1', 'c1_svc1', { price: 15000 }),
      createdAt: now,
      updatedAt: now,
    });
    await put('chats/r1', {
      id: 'r1',
      serviceRequestId: 'r1',
      customerId: 'cust1',
      companyId: 'c1',
      customerName: 'cust1',
      companyName: 'Company c1',
      serviceName: 'Service svc1',
      createdAt: now,
      updatedAt: now,
    });
    await put('chats/r1/messages/m0', {
      id: 'm0', senderId: 'cust1', senderRole: 'customer', senderName: 'cust1', text: 'Hi', createdAt: now,
    });
  });
});

function requestFields(
  id: string,
  customerId: string,
  companyServiceId: string,
  extra: Record<string, unknown> = {},
) {
  const [companyId, serviceId] = companyServiceId.split('_');
  return {
    id,
    customerId,
    customerName: customerId,
    companyId,
    companyName: `Company ${companyId}`,
    companyServiceId,
    serviceId,
    serviceName: `Service ${serviceId}`,
    price: null,
    details: 'Please install Office on 3 PCs',
    address: 'Khartoum 2',
    latitude: null,
    longitude: null,
    contactPhone: '+249912345678',
    status: 'pending',
    ...extra,
  };
}

/** The customer's batch: request + its conversation, as the app writes it. */
function sendRequest(
  db: Firestore,
  id: string,
  customerId: string,
  companyServiceId: string,
  opts: {
    request?: Record<string, unknown>;
    chat?: Record<string, unknown>;
    withRequest?: boolean;
    withChat?: boolean;
  } = {},
) {
  const fields = requestFields(id, customerId, companyServiceId, opts.request);
  const batch = writeBatch(db);
  if (opts.withRequest !== false) {
    batch.set(doc(db, 'service_requests', id), {
      ...fields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  if (opts.withChat !== false) {
    batch.set(doc(db, 'chats', id), {
      id,
      serviceRequestId: id,
      customerId: fields.customerId,
      companyId: fields.companyId,
      customerName: fields.customerName,
      companyName: fields.companyName,
      serviceName: fields.serviceName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...opts.chat,
    });
  }
  return batch.commit();
}

/** A message plus the conversation's last-message update, as the app sends it. */
function sendMessage(
  db: Firestore,
  senderId: string,
  role: 'customer' | 'company',
  opts: { message?: Record<string, unknown>; chat?: Record<string, unknown>; chatId?: string; skipChat?: boolean } = {},
) {
  const chatId = opts.chatId ?? 'r1';
  const messageRef = doc(collection(db, 'chats', chatId, 'messages'));
  const text = 'Hello there';
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
  if (!opts.skipChat) {
    batch.update(doc(db, 'chats', chatId), {
      lastMessageId: messageRef.id,
      lastMessageText: (opts.message?.text as string | undefined) ?? text,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderRole: role,
      updatedAt: serverTimestamp(),
      [role === 'customer' ? 'customerLastReadAt' : 'companyLastReadAt']: serverTimestamp(),
      ...opts.chat,
    });
  }
  return batch.commit();
}

describe('company_services: optional price and note', () => {
  const add = (uid: string, companyId: string, serviceId: string, extra: Record<string, unknown> = {}) =>
    setDoc(doc(as(uid), 'company_services', `${companyId}_${serviceId}`), {
      id: `${companyId}_${serviceId}`,
      companyId,
      serviceId,
      isActive: true,
      price: null,
      note: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...extra,
    });

  it('a company offers a service with or without a price', async () => {
    await assertSucceeds(add('ca2', 'c2', 'svc1'));
    await assertSucceeds(add('ca2', 'c2', 'svc2', { price: 5000, note: 'Remote' }));
  });

  it('a price is never 0, negative or text', async () => {
    await assertFails(add('ca2', 'c2', 'svc1', { price: 0 }));
    await assertFails(add('ca2', 'c2', 'svc1', { price: -1 }));
    await assertFails(add('ca2', 'c2', 'svc1', { price: '100' }));
  });

  it('a company cannot add a service for another company', async () => {
    await assertFails(add('ca1', 'c2', 'svc1'));
    await assertFails(add('cust1', 'c2', 'svc1'));
  });

  it('the company edits its own price/note and can clear the price', async () => {
    const ref = doc(as('ca1'), 'company_services', 'c1_svc1');
    await assertSucceeds(updateDoc(ref, { price: 20000, note: 'x', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { price: null, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { price: 0, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { price: 100 })); // no updatedAt stamp
    await assertFails(
      updateDoc(doc(as('ca2'), 'company_services', 'c1_svc1'), { price: 1, updatedAt: serverTimestamp() }),
    );
  });

  it('company, service and creation date cannot be changed', async () => {
    const ref = doc(as('ca1'), 'company_services', 'c1_svc1');
    await assertFails(updateDoc(ref, { companyId: 'c2', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { serviceId: 'svc2', updatedAt: serverTimestamp() }));
  });
});

describe('service_requests: creating a request', () => {
  it('a customer sends a request together with its conversation', async () => {
    await assertSucceeds(sendRequest(as('cust1'), 'n1', 'cust1', 'c1_svc1', { request: { price: 15000 } }));
  });

  it('a request for a service with no price carries no price', async () => {
    await assertSucceeds(sendRequest(as('cust1'), 'n2', 'cust1', 'c1_svc2'));
    await assertFails(sendRequest(as('cust1'), 'n3', 'cust1', 'c1_svc2', { request: { price: 0 } }));
  });

  it('the price must be the company\'s current price', async () => {
    await assertFails(sendRequest(as('cust1'), 'n4', 'cust1', 'c1_svc1', { request: { price: 1 } }));
    await assertFails(sendRequest(as('cust1'), 'n5', 'cust1', 'c1_svc1'));
  });

  it('a request needs its conversation, and a conversation needs its request', async () => {
    await assertFails(
      sendRequest(as('cust1'), 'n6', 'cust1', 'c1_svc1', { request: { price: 15000 }, withChat: false }),
    );
    await assertFails(sendRequest(as('cust1'), 'n7', 'cust1', 'c1_svc1', { withRequest: false }));
  });

  it('the conversation must name the request\'s own participants', async () => {
    await assertFails(
      sendRequest(as('cust1'), 'n8', 'cust1', 'c1_svc1', {
        request: { price: 15000 },
        chat: { companyId: 'c2' },
      }),
    );
  });

  it('no request to an inactive company or through an inactive offer', async () => {
    await assertFails(sendRequest(as('cust1'), 'n9', 'cust1', 'cOff_svc1'));
    await assertFails(sendRequest(as('cust1'), 'n10', 'cust1', 'c1_svc3'));
  });

  it('only an active customer can send a request, for themself', async () => {
    await assertFails(sendRequest(as('cust2'), 'n11', 'cust1', 'c1_svc2'));
    await assertFails(sendRequest(as('custOff'), 'n12', 'custOff', 'c1_svc2'));
    await assertFails(sendRequest(as('ca1'), 'n13', 'ca1', 'c1_svc2'));
    await assertFails(sendRequest(as('pa'), 'n14', 'pa', 'c1_svc2'));
    await assertFails(sendRequest(anon(), 'n15', 'cust1', 'c1_svc2'));
  });

  it('a request starts pending and carries only request fields', async () => {
    await assertFails(sendRequest(as('cust1'), 'n16', 'cust1', 'c1_svc2', { request: { status: 'accepted' } }));
    await assertFails(sendRequest(as('cust1'), 'n17', 'cust1', 'c1_svc2', { request: { productId: 'p1' } }));
    await assertFails(sendRequest(as('cust1'), 'n18', 'cust1', 'c1_svc2', { request: { details: '' } }));
    await assertFails(sendRequest(as('cust1'), 'n19', 'cust1', 'c1_svc2', { request: { contactPhone: '' } }));
  });

  it('a request never touches the orders collection', async () => {
    await assertFails(
      setDoc(doc(as('cust1'), 'orders', 'r-as-order'), {
        ...requestFields('r-as-order', 'cust1', 'c1_svc1'),
        createdAt: serverTimestamp(),
      }),
    );
  });
});

describe('service_requests: who can read', () => {
  it('only the customer, the company it was sent to and Platform Admin', async () => {
    await assertSucceeds(getDoc(doc(as('cust1'), 'service_requests', 'r1')));
    await assertSucceeds(getDoc(doc(as('ca1'), 'service_requests', 'r1')));
    await assertSucceeds(getDoc(doc(as('pa'), 'service_requests', 'r1')));
    await assertFails(getDoc(doc(as('cust2'), 'service_requests', 'r1')));
    await assertFails(getDoc(doc(as('ca2'), 'service_requests', 'r1')));
    await assertFails(getDoc(doc(as('tech1'), 'service_requests', 'r1')));
    await assertFails(getDoc(doc(as('paOff'), 'service_requests', 'r1')));
    await assertFails(getDoc(doc(anon(), 'service_requests', 'r1')));
  });

  it('Platform Admin lists every request, read-only, like orders', async () => {
    await assertSucceeds(getDocs(collection(as('pa'), 'service_requests')));
    await assertFails(getDocs(collection(as('paOff'), 'service_requests')));
    await assertFails(getDocs(collection(as('tech1'), 'service_requests')));
    await assertFails(
      updateDoc(doc(as('pa'), 'service_requests', 'r1'), { status: 'cancelled', updatedAt: serverTimestamp() }),
    );
    await assertFails(deleteDoc(doc(as('pa'), 'service_requests', 'r1')));
    await assertFails(
      setDoc(doc(as('pa'), 'service_requests', 'rPa'), {
        ...requestFields('rPa', 'pa', 'c1_svc1', { price: 15000 }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('lists are limited to your own requests / your own company', async () => {
    const byCustomer = (uid: string, customerId: string) =>
      getDocs(query(collection(as(uid), 'service_requests'), where('customerId', '==', customerId)));
    const byCompany = (uid: string, companyId: string) =>
      getDocs(query(collection(as(uid), 'service_requests'), where('companyId', '==', companyId)));
    await assertSucceeds(byCustomer('cust1', 'cust1'));
    await assertFails(byCustomer('cust2', 'cust1'));
    await assertSucceeds(byCompany('ca1', 'c1'));
    await assertFails(byCompany('ca2', 'c1'));
    await assertFails(getDocs(collection(as('cust1'), 'service_requests')));
    await assertFails(getDocs(collection(anon(), 'service_requests')));
  });
});

describe('service_requests: status lifecycle', () => {
  const setStatus = (uid: string, status: string, extra: Record<string, unknown> = {}) =>
    updateDoc(doc(as(uid), 'service_requests', 'r1'), { status, updatedAt: serverTimestamp(), ...extra });
  const force = (status: string) =>
    env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), 'service_requests', 'r1'), { status }),
    );

  it('the customer may cancel only while pending', async () => {
    await assertFails(setStatus('cust1', 'accepted'));
    await assertSucceeds(setStatus('cust1', 'cancelled'));
    await force('accepted');
    await assertFails(setStatus('cust1', 'cancelled'));
  });

  it('another customer cannot cancel it', async () => {
    await assertFails(setStatus('cust2', 'cancelled'));
  });

  it('the company moves it pending -> accepted -> in_progress -> completed', async () => {
    await assertFails(setStatus('ca1', 'completed'));
    await assertSucceeds(setStatus('ca1', 'accepted'));
    await assertFails(setStatus('ca1', 'pending'));
    await assertSucceeds(setStatus('ca1', 'in_progress'));
    await assertSucceeds(setStatus('ca1', 'completed'));
    await assertFails(setStatus('ca1', 'in_progress'));
  });

  it('the company may reject a pending request, which is final', async () => {
    await assertSucceeds(setStatus('ca1', 'rejected'));
    await assertFails(setStatus('ca1', 'accepted'));
  });

  it('another company, a technician or Platform Admin cannot change it', async () => {
    await assertFails(setStatus('ca2', 'accepted'));
    await assertFails(setStatus('tech1', 'accepted'));
    await assertFails(setStatus('pa', 'accepted'));
  });

  it('only the status changes, and a request is never deleted', async () => {
    await assertFails(setStatus('ca1', 'accepted', { price: 1 }));
    await assertFails(setStatus('cust1', 'cancelled', { details: 'changed' }));
    await assertFails(deleteDoc(doc(as('cust1'), 'service_requests', 'r1')));
    await assertFails(deleteDoc(doc(as('ca1'), 'service_requests', 'r1')));
  });
});

describe('chats: conversations and messages', () => {
  it('only the two participants can read the conversation and its messages', async () => {
    for (const uid of ['cust1', 'ca1']) {
      await assertSucceeds(getDoc(doc(as(uid), 'chats', 'r1')));
      await assertSucceeds(getDocs(collection(as(uid), 'chats', 'r1', 'messages')));
    }
    for (const uid of ['cust2', 'ca2', 'tech1', 'pa']) {
      await assertFails(getDoc(doc(as(uid), 'chats', 'r1')));
      await assertFails(getDocs(collection(as(uid), 'chats', 'r1', 'messages')));
    }
    await assertFails(getDoc(doc(anon(), 'chats', 'r1')));
    await assertFails(getDocs(collection(anon(), 'chats', 'r1', 'messages')));
  });

  it('Platform Admin and technicians get no chat access at all', async () => {
    for (const uid of ['pa', 'paOff', 'tech1']) {
      await assertFails(getDocs(collection(as(uid), 'chats')));
      await assertFails(getDocs(query(collection(as(uid), 'chats'), where('companyId', '==', 'c1'))));
      await assertFails(getDoc(doc(as(uid), 'chats', 'r1', 'messages', 'm0')));
      await assertFails(getDocs(collection(as(uid), 'chats', 'r1', 'messages')));
      await assertFails(
        updateDoc(doc(as(uid), 'chats', 'r1'), { companyLastReadAt: serverTimestamp() }),
      );
      await assertFails(deleteDoc(doc(as(uid), 'chats', 'r1')));
    }
    await assertFails(sendMessage(as('pa'), 'pa', 'company'));
    await assertFails(sendMessage(as('pa'), 'pa', 'customer'));
  });

  it('conversation lists are limited to your own / your company\'s', async () => {
    await assertSucceeds(getDocs(query(collection(as('cust1'), 'chats'), where('customerId', '==', 'cust1'))));
    await assertFails(getDocs(query(collection(as('cust2'), 'chats'), where('customerId', '==', 'cust1'))));
    await assertSucceeds(getDocs(query(collection(as('ca1'), 'chats'), where('companyId', '==', 'c1'))));
    await assertFails(getDocs(query(collection(as('ca2'), 'chats'), where('companyId', '==', 'c1'))));
  });

  it('the customer and the company can both send text messages', async () => {
    await assertSucceeds(sendMessage(as('cust1'), 'cust1', 'customer'));
    await assertSucceeds(sendMessage(as('ca1'), 'ca1', 'company'));
  });

  it('outsiders cannot write into the conversation', async () => {
    await assertFails(sendMessage(as('cust2'), 'cust2', 'customer'));
    await assertFails(sendMessage(as('ca2'), 'ca2', 'company'));
    await assertFails(sendMessage(as('tech1'), 'tech1', 'company'));
    await assertFails(sendMessage(anon(), 'cust1', 'customer'));
  });

  it('a sender cannot pretend to be the other side or someone else', async () => {
    await assertFails(sendMessage(as('cust1'), 'cust1', 'company'));
    await assertFails(sendMessage(as('ca1'), 'ca1', 'customer'));
    await assertFails(sendMessage(as('cust1'), 'ca1', 'customer'));
  });

  it('a message must be real text of at most 2000 characters', async () => {
    await assertFails(sendMessage(as('cust1'), 'cust1', 'customer', { message: { text: '' } }));
    await assertFails(sendMessage(as('cust1'), 'cust1', 'customer', { message: { text: 'x'.repeat(2001) } }));
    await assertSucceeds(sendMessage(as('cust1'), 'cust1', 'customer', { message: { text: 'x'.repeat(2000) } }));
    await assertFails(sendMessage(as('cust1'), 'cust1', 'customer', { message: { imageUrl: 'http://x' } }));
  });

  it('a message and the conversation\'s last message are written together', async () => {
    await assertFails(sendMessage(as('cust1'), 'cust1', 'customer', { skipChat: true }));
    await assertFails(sendMessage(as('cust1'), 'cust1', 'customer', { chat: { lastMessageText: 'something else' } }));
    await assertFails(
      updateDoc(doc(as('cust1'), 'chats', 'r1'), {
        lastMessageId: 'ghost',
        lastMessageText: 'x',
        lastMessageAt: serverTimestamp(),
        lastMessageSenderRole: 'customer',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('each side marks only its own read position, at server time', async () => {
    await assertSucceeds(updateDoc(doc(as('cust1'), 'chats', 'r1'), { customerLastReadAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as('ca1'), 'chats', 'r1'), { companyLastReadAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('cust1'), 'chats', 'r1'), { companyLastReadAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('ca1'), 'chats', 'r1'), { customerLastReadAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('cust1'), 'chats', 'r1'), { customerLastReadAt: new Date(2000, 0, 1) }));
    await assertFails(updateDoc(doc(as('cust2'), 'chats', 'r1'), { customerLastReadAt: serverTimestamp() }));
  });

  it('participants and names of a conversation cannot be changed', async () => {
    await assertFails(updateDoc(doc(as('ca1'), 'chats', 'r1'), { companyId: 'c2' }));
    await assertFails(updateDoc(doc(as('cust1'), 'chats', 'r1'), { customerId: 'cust2' }));
  });

  it('messages and conversations are never edited or deleted', async () => {
    await assertFails(updateDoc(doc(as('cust1'), 'chats', 'r1', 'messages', 'm0'), { text: 'edited' }));
    await assertFails(deleteDoc(doc(as('cust1'), 'chats', 'r1', 'messages', 'm0')));
    await assertFails(deleteDoc(doc(as('ca1'), 'chats', 'r1')));
  });

  it('a conversation cannot be opened without a brand-new request', async () => {
    await assertFails(
      setDoc(doc(as('cust1'), 'chats', 'r1-copy'), {
        id: 'r1-copy',
        serviceRequestId: 'r1-copy',
        customerId: 'cust1',
        companyId: 'c1',
        customerName: 'cust1',
        companyName: 'Company c1',
        serviceName: 'Service svc1',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});
