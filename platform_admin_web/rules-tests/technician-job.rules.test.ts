/*
 * What a technician can do on their own jobs: switch their availability, write
 * notes only the company can read, and talk to the company in a conversation
 * the customer cannot see (`jobChats/{orderId}`). Local emulator only
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
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
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

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const u of [
      user('cust1', 'customer'),
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
      contactPhone: '0911111111',
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
    await setDoc(doc(db, 'orders', 'o2'), order('o2', 'tech2'));
  });
});

describe('technician availability', () => {
  it('lets a technician switch their own availability', async () => {
    await assertSucceeds(
      updateDoc(doc(as('tech1'), 'technicians', 'tech1'), {
        isAvailable: false,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('keeps everything else on the record out of their hands', async () => {
    const db = as('tech1');
    await assertFails(
      updateDoc(doc(db, 'technicians', 'tech1'), {
        isAvailable: false,
        fullName: 'Someone else',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(db, 'technicians', 'tech1'), {
        isActive: false,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('refuses another technician and a non-boolean', async () => {
    await assertFails(
      updateDoc(doc(as('tech1'), 'technicians', 'tech2'), {
        isAvailable: false,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as('tech1'), 'technicians', 'tech1'), {
        isAvailable: 'no',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as('cust1'), 'technicians', 'tech1'), {
        isAvailable: false,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('still lets the company edit a record that carries the flag', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'technicians', 'tech1'), { isAvailable: false });
    });
    await assertSucceeds(
      setDoc(doc(as('ca1'), 'technicians', 'tech1'), {
        ...technicianRecord('tech1'),
        fullName: 'Renamed',
        isAvailable: false,
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('technician notes', () => {
  const note = (over: Record<string, unknown> = {}) => ({
    id: 'n1',
    orderId: 'o1',
    companyId: 'c1',
    technicianId: 'tech1',
    authorId: 'tech1',
    authorName: 'Name tech1',
    kind: 'note',
    text: 'Cable was too short, brought another.',
    createdAt: serverTimestamp(),
    ...over,
  });

  it('is written by the assigned technician', async () => {
    await assertSucceeds(setDoc(doc(as('tech1'), 'orders', 'o1', 'technicianNotes', 'n1'), note()));
    await assertSucceeds(
      setDoc(
        doc(as('tech1'), 'orders', 'o1', 'technicianNotes', 'n2'),
        note({ id: 'n2', kind: 'completion' }),
      ),
    );
  });

  it('is refused for another technician, the company, and the customer', async () => {
    await assertFails(setDoc(doc(as('tech2'), 'orders', 'o1', 'technicianNotes', 'n1'), note()));
    await assertFails(
      setDoc(doc(as('ca1'), 'orders', 'o1', 'technicianNotes', 'n1'), note({ authorId: 'ca1' })),
    );
    await assertFails(
      setDoc(doc(as('cust1'), 'orders', 'o1', 'technicianNotes', 'n1'), note({ authorId: 'cust1' })),
    );
  });

  it('must be about its own order, by its author, and short', async () => {
    const db = as('tech1');
    await assertFails(setDoc(doc(db, 'orders', 'o1', 'technicianNotes', 'n1'), note({ authorId: 'tech2' })));
    await assertFails(setDoc(doc(db, 'orders', 'o1', 'technicianNotes', 'n1'), note({ companyId: 'c2' })));
    await assertFails(setDoc(doc(db, 'orders', 'o1', 'technicianNotes', 'n1'), note({ text: '' })));
    await assertFails(
      setDoc(doc(db, 'orders', 'o1', 'technicianNotes', 'n1'), note({ text: 'x'.repeat(501) })),
    );
    await assertFails(setDoc(doc(db, 'orders', 'o1', 'technicianNotes', 'n1'), note({ kind: 'secret' })));
  });

  it('is read by the technician, the company and Platform Admin, never the customer', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'orders', 'o1', 'technicianNotes', 'n1'), {
        ...note(),
        createdAt: now,
      });
    });
    await assertSucceeds(getDoc(doc(as('tech1'), 'orders', 'o1', 'technicianNotes', 'n1')));
    await assertSucceeds(getDoc(doc(as('ca1'), 'orders', 'o1', 'technicianNotes', 'n1')));
    await assertSucceeds(getDoc(doc(as('pa1'), 'orders', 'o1', 'technicianNotes', 'n1')));
    await assertSucceeds(getDocs(collection(as('ca1'), 'orders', 'o1', 'technicianNotes')));
    await assertFails(getDoc(doc(as('cust1'), 'orders', 'o1', 'technicianNotes', 'n1')));
    await assertFails(getDocs(collection(as('cust1'), 'orders', 'o1', 'technicianNotes')));
    await assertFails(getDoc(doc(as('ca2'), 'orders', 'o1', 'technicianNotes', 'n1')));
    await assertFails(getDoc(doc(as('tech2'), 'orders', 'o1', 'technicianNotes', 'n1')));
  });

  it('can be taken back only by its author', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'orders', 'o1', 'technicianNotes', 'n1'), {
        ...note(),
        createdAt: now,
      });
    });
    await assertFails(deleteDoc(doc(as('ca1'), 'orders', 'o1', 'technicianNotes', 'n1')));
    await assertFails(
      updateDoc(doc(as('tech1'), 'orders', 'o1', 'technicianNotes', 'n1'), { text: 'changed' }),
    );
    await assertSucceeds(deleteDoc(doc(as('tech1'), 'orders', 'o1', 'technicianNotes', 'n1')));
  });
});

describe('job conversation', () => {
  /** The first message and the conversation, in one batch like the app. */
  async function send(
    db: Firestore,
    orderId: string,
    role: 'technician' | 'company',
    senderId: string,
    text: string,
    first: boolean,
    over: Record<string, unknown> = {},
  ) {
    const messageRef = doc(collection(db, 'jobChats', orderId, 'messages'));
    const chatRef = doc(db, 'jobChats', orderId);
    const readKey = role === 'company' ? 'companyLastReadAt' : 'technicianLastReadAt';
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
      senderName: role === 'technician' ? 'Name tech1' : '',
      text,
      createdAt: serverTimestamp(),
    });
    if (first) {
      batch.set(chatRef, {
        id: orderId,
        orderId,
        companyId: 'c1',
        technicianId: 'tech1',
        technicianName: 'Name tech1',
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

  it('is started by the technician and answered by the company', async () => {
    await assertSucceeds(send(as('tech1'), 'o1', 'technician', 'tech1', 'Customer is not home', true));
    await assertSucceeds(send(as('ca1'), 'o1', 'company', 'ca1', 'We will call them', false));
    await assertSucceeds(send(as('tech1'), 'o1', 'technician', 'tech1', 'Thanks', false));
  });

  it('can also be started by the company', async () => {
    await assertSucceeds(send(as('ca1'), 'o1', 'company', 'ca1', 'Any news?', true));
  });

  it('is closed to the customer, other companies, other technicians and Platform Admin', async () => {
    await assertSucceeds(send(as('tech1'), 'o1', 'technician', 'tech1', 'Hello', true));
    for (const who of ['cust1', 'ca2', 'tech2', 'pa1']) {
      await assertFails(getDoc(doc(as(who), 'jobChats', 'o1')));
      await assertFails(getDocs(collection(as(who), 'jobChats', 'o1', 'messages')));
    }
    await assertSucceeds(getDoc(doc(as('tech1'), 'jobChats', 'o1')));
    await assertSucceeds(getDoc(doc(as('ca1'), 'jobChats', 'o1')));
    await assertSucceeds(getDocs(collection(as('ca1'), 'jobChats', 'o1', 'messages')));
  });

  it('refuses a stranger writing into it', async () => {
    await assertFails(send(as('cust1'), 'o1', 'technician', 'cust1', 'Hi', true));
    await assertFails(send(as('tech2'), 'o1', 'technician', 'tech2', 'Hi', true));
    await assertFails(send(as('ca2'), 'o1', 'company', 'ca2', 'Hi', true));
  });

  it('keeps the conversation tied to its own order and sides', async () => {
    await assertFails(
      send(as('tech1'), 'o1', 'technician', 'tech1', 'Hi', true, { companyId: 'c2' }),
    );
    await assertFails(
      send(as('tech1'), 'o1', 'technician', 'tech1', 'Hi', true, { technicianId: 'tech2' }),
    );
    // Speaking as the other side.
    await assertFails(send(as('tech1'), 'o1', 'company', 'tech1', 'Hi', true));
    // Someone else's id on the message.
    await assertFails(send(as('tech1'), 'o1', 'technician', 'ca1', 'Hi', true));
  });

  it('lets each side move only its own read marker, and messages are never edited', async () => {
    await assertSucceeds(send(as('tech1'), 'o1', 'technician', 'tech1', 'Hello', true));
    await assertSucceeds(
      updateDoc(doc(as('ca1'), 'jobChats', 'o1'), { companyLastReadAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(as('ca1'), 'jobChats', 'o1'), { technicianLastReadAt: serverTimestamp() }),
    );
    await assertFails(updateDoc(doc(as('ca1'), 'jobChats', 'o1'), { companyId: 'c2' }));
    const messages = await getDocs(collection(as('ca1'), 'jobChats', 'o1', 'messages'));
    await assertFails(updateDoc(messages.docs[0].ref, { text: 'edited' }));
    await assertFails(deleteDoc(messages.docs[0].ref));
  });
});
