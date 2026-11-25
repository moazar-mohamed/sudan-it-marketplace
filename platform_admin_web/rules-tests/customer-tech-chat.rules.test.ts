/*
 * The conversation between an order's customer and the technician the company
 * sent for it (`customerTechChats/{orderId}`): open from the assignment until
 * the order is completed or cancelled, readable by the order's company, closed
 * to everyone else. Local emulator only (npm run test:rules); every user is a
 * fake identity.
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

const as = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@x.test` }).firestore();

const user = (id: string, role: string, extra: Record<string, unknown> = {}) => ({
  id,
  fullName: id,
  email: `${id}@x.test`,
  role,
  isActive: true,
  createdAt: now,
  ...extra,
});

const technicianRecord = (id: string, companyId = 'c1') => ({
  id,
  uid: id,
  companyId,
  fullName: `Name ${id}`,
  phone: '0911111111',
  email: `${id}@x.test`,
  isActive: true,
  createdAt: now,
  updatedAt: now,
});

async function setOrder(id: string, over: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'orders', id), over);
  });
}

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const u of [
      user('cust1', 'customer'),
      user('cust2', 'customer'),
      user('ca1', 'company_admin', { companyId: 'c1' }),
      user('ca2', 'company_admin', { companyId: 'c2' }),
      user('tech1', 'technician', { companyId: 'c1' }),
      user('tech2', 'technician', { companyId: 'c1' }),
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
    await setDoc(doc(db, 'technicians', 'tech1'), technicianRecord('tech1'));
    await setDoc(doc(db, 'technicians', 'tech2'), technicianRecord('tech2'));
    const order = (id: string, technicianId: string | null) => ({
      id,
      customerId: 'cust1',
      companyId: 'c1',
      companyName: 'Nile Tech',
      productId: 'p1',
      productName: 'Router',
      quantity: 1,
      unitPrice: 100,
      productSubtotal: 100,
      installationSelected: true,
      installationFee: 50,
      deliveryFee: 15000,
      totalAmount: 15150,
      deliveryAddress: 'Street',
      contactPhone: '+249911111111',
      deliveryMethod: 'delivery',
      customerName: 'Amna',
      paymentStatus: 'confirmed',
      orderStatus: 'processing',
      technicianId,
      technicianName: technicianId ? `Name ${technicianId}` : null,
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'orders', 'o1'), order('o1', 'tech1'));
    await setDoc(doc(db, 'orders', 'o3'), order('o3', null));
  });
});

/** A message and the conversation, in one batch like the apps. */
async function send(
  db: Firestore,
  orderId: string,
  role: 'customer' | 'technician',
  senderId: string,
  text: string,
  first: boolean,
  over: Record<string, unknown> = {},
) {
  const messageRef = doc(collection(db, 'customerTechChats', orderId, 'messages'));
  const chatRef = doc(db, 'customerTechChats', orderId);
  const readKey = role === 'customer' ? 'customerLastReadAt' : 'technicianLastReadAt';
  const last = {
    lastMessageId: messageRef.id,
    lastMessageText: text,
    lastMessageAt: serverTimestamp(),
    lastMessageSenderRole: role,
    updatedAt: serverTimestamp(),
    [readKey]: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(messageRef, {
    id: messageRef.id,
    senderId,
    senderRole: role,
    senderName: role === 'technician' ? 'Name tech1' : 'Amna',
    text,
    createdAt: serverTimestamp(),
  });
  if (first) {
    batch.set(chatRef, {
      id: orderId,
      orderId,
      companyId: 'c1',
      customerId: 'cust1',
      productName: 'Router',
      createdAt: serverTimestamp(),
      ...last,
      ...over,
    });
  } else {
    batch.update(chatRef, { ...last, ...over });
  }
  return batch.commit();
}

describe('customer and technician conversation', () => {
  it('is started by either side and answered by the other', async () => {
    await assertSucceeds(send(as('cust1'), 'o1', 'customer', 'cust1', 'When will you come?', true));
    await assertSucceeds(send(as('tech1'), 'o1', 'technician', 'tech1', 'In one hour', false));
    await assertSucceeds(send(as('cust1'), 'o1', 'customer', 'cust1', 'Thanks', false));
  });

  it('can be started by the technician', async () => {
    await assertSucceeds(send(as('tech1'), 'o1', 'technician', 'tech1', 'I am on my way', true));
  });

  it('does not exist before a technician is assigned', async () => {
    await assertFails(send(as('cust1'), 'o3', 'customer', 'cust1', 'Hello?', true));
  });

  it('is read by its two sides and the company, and closed to everyone else', async () => {
    await assertSucceeds(send(as('cust1'), 'o1', 'customer', 'cust1', 'Hello', true));
    for (const who of ['cust1', 'tech1', 'ca1']) {
      await assertSucceeds(getDoc(doc(as(who), 'customerTechChats', 'o1')));
      await assertSucceeds(getDocs(collection(as(who), 'customerTechChats', 'o1', 'messages')));
    }
    for (const who of ['cust2', 'ca2', 'tech2', 'pa1']) {
      await assertFails(getDoc(doc(as(who), 'customerTechChats', 'o1')));
      await assertFails(getDocs(collection(as(who), 'customerTechChats', 'o1', 'messages')));
    }
  });

  it('lets the customer and the company list their own conversations only', async () => {
    await assertSucceeds(send(as('cust1'), 'o1', 'customer', 'cust1', 'Hello', true));
    await assertSucceeds(
      getDocs(query(collection(as('cust1'), 'customerTechChats'), where('customerId', '==', 'cust1'))),
    );
    await assertSucceeds(
      getDocs(query(collection(as('ca1'), 'customerTechChats'), where('companyId', '==', 'c1'))),
    );
    await assertFails(
      getDocs(query(collection(as('cust2'), 'customerTechChats'), where('customerId', '==', 'cust1'))),
    );
    await assertFails(getDocs(collection(as('tech1'), 'customerTechChats')));
  });

  it('lets the company read but never write', async () => {
    await assertFails(send(as('ca1'), 'o1', 'technician', 'ca1', 'Hi', true));
    await assertSucceeds(send(as('cust1'), 'o1', 'customer', 'cust1', 'Hello', true));
    await assertFails(send(as('ca1'), 'o1', 'technician', 'ca1', 'Hi', false));
    await assertFails(
      updateDoc(doc(as('ca1'), 'customerTechChats', 'o1'), { technicianLastReadAt: serverTimestamp() }),
    );
  });

  it('refuses a stranger writing into it', async () => {
    await assertFails(send(as('cust2'), 'o1', 'customer', 'cust2', 'Hi', true));
    await assertFails(send(as('tech2'), 'o1', 'technician', 'tech2', 'Hi', true));
    await assertFails(send(as('pa1'), 'o1', 'customer', 'pa1', 'Hi', true));
  });

  it('keeps the conversation tied to its own order and sides', async () => {
    await assertFails(send(as('cust1'), 'o1', 'customer', 'cust1', 'Hi', true, { companyId: 'c2' }));
    await assertFails(send(as('cust1'), 'o1', 'customer', 'cust1', 'Hi', true, { customerId: 'cust2' }));
    await assertFails(send(as('cust1'), 'o1', 'customer', 'cust1', 'Hi', true, { productName: 'Other' }));
    await assertFails(send(as('cust1'), 'o1', 'customer', 'cust1', 'Hi', true, { technicianPhone: '0911' }));
    // Speaking as the other side.
    await assertFails(send(as('cust1'), 'o1', 'technician', 'cust1', 'Hi', true));
    await assertFails(send(as('tech1'), 'o1', 'customer', 'tech1', 'Hi', true));
    // Someone else's id on the message.
    await assertFails(send(as('tech1'), 'o1', 'technician', 'cust1', 'Hi', true));
  });

  it('follows the job when the company gives it to another technician', async () => {
    await assertSucceeds(send(as('tech1'), 'o1', 'technician', 'tech1', 'Hello', true));
    await setOrder('o1', { technicianId: 'tech2', technicianName: 'Name tech2' });
    await assertFails(getDoc(doc(as('tech1'), 'customerTechChats', 'o1')));
    await assertFails(send(as('tech1'), 'o1', 'technician', 'tech1', 'Still me', false));
    await assertSucceeds(getDocs(collection(as('tech2'), 'customerTechChats', 'o1', 'messages')));
    await assertSucceeds(send(as('tech2'), 'o1', 'technician', 'tech2', 'I took over', false));
  });

  it('closes for writing once the order is completed or cancelled, and stays readable', async () => {
    await assertSucceeds(send(as('cust1'), 'o1', 'customer', 'cust1', 'Hello', true));
    for (const status of ['completed', 'cancelled']) {
      await setOrder('o1', { orderStatus: status });
      await assertFails(send(as('cust1'), 'o1', 'customer', 'cust1', 'One more', false));
      await assertFails(send(as('tech1'), 'o1', 'technician', 'tech1', 'One more', false));
      await assertSucceeds(getDocs(collection(as('cust1'), 'customerTechChats', 'o1', 'messages')));
      await assertSucceeds(
        updateDoc(doc(as('tech1'), 'customerTechChats', 'o1'), { technicianLastReadAt: serverTimestamp() }),
      );
    }
  });

  it('refuses a message from a deactivated customer', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users', 'cust1'), { isActive: false });
    });
    await assertFails(send(as('cust1'), 'o1', 'customer', 'cust1', 'Hi', true));
  });

  it('lets each side move only its own read marker, and messages are never edited', async () => {
    await assertSucceeds(send(as('tech1'), 'o1', 'technician', 'tech1', 'Hello', true));
    await assertSucceeds(
      updateDoc(doc(as('cust1'), 'customerTechChats', 'o1'), { customerLastReadAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(as('cust1'), 'customerTechChats', 'o1'), { technicianLastReadAt: serverTimestamp() }),
    );
    await assertFails(updateDoc(doc(as('cust1'), 'customerTechChats', 'o1'), { companyId: 'c2' }));
    const messages = await getDocs(collection(as('cust1'), 'customerTechChats', 'o1', 'messages'));
    await assertFails(updateDoc(messages.docs[0].ref, { text: 'edited' }));
    await assertFails(deleteDoc(messages.docs[0].ref));
  });
});
