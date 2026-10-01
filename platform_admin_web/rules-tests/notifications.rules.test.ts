/*
 * What a notification may contain and who may send, read and delete it
 * (SEC-003). Local emulator only (npm run test:rules); every user is a fake
 * identity.
 *
 * A notification carries no text of its own: a `type` from a fixed list (each
 * kind of sender has its own types) and the order's product name, which must
 * equal the order's. There is one per order and type (its id is fixed), a
 * deactivated account cannot send any, and only its recipient may delete it.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
      setDoc(doc(db, 'users', id), {
        id,
        fullName: id,
        email: `${id}@x.test`,
        role,
        isActive: true,
        createdAt: now,
        ...extra,
      });
    await user('cust1', 'customer');
    await user('cust2', 'customer');
    await user('custOff', 'customer', { isActive: false });
    await user('ca1', 'company_admin', { companyId: 'c1' });
    await user('ca1b', 'company_admin', { companyId: 'c1' });
    await user('caOff', 'company_admin', { companyId: 'c1', isActive: false });
    await user('ca2', 'company_admin', { companyId: 'c2' });
    await user('tech1', 'technician', { companyId: 'c1' });
    await user('tech2', 'technician', { companyId: 'c1' });
    await user('pa1', 'platform_admin');
    for (const id of ['c1', 'c2']) {
      await setDoc(doc(db, 'companies', id), { name: id, status: 'active', createdAt: now });
    }
    for (const [id, uid] of [['t1', 'tech1'], ['t2', 'tech2']]) {
      await setDoc(doc(db, 'technicians', id), {
        id,
        companyId: 'c1',
        email: `${uid}@x.test`,
        fullName: id,
        phone: '1',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    const order = (id: string, extra: Record<string, unknown> = {}) =>
      setDoc(doc(db, 'orders', id), {
        id,
        customerId: 'cust1',
        companyId: 'c1',
        productId: 'p1',
        productName: 'Router',
        orderStatus: 'processing',
        paymentStatus: 'pending_verification',
        technicianId: 't1',
        createdAt: now,
        ...extra,
      });
    await order('o1');
    await order('o2', { customerId: 'cust2', companyId: 'c2', technicianId: null });
    await order('oOff', { customerId: 'custOff' });
    // An order whose product name is longer than any real product's.
    await order('oLong', { productName: 'x'.repeat(201) });
  });
});

type Recipient = 'customer' | 'company_admin' | 'technician';

/** Who each kind of notification about order o1 is addressed to. */
const RECIPIENT: Record<Recipient, string> = { customer: 'cust1', company_admin: 'c1', technician: 't1' };

const idFor = (orderId: string, type: string, recipientType: Recipient, recipientId: string) =>
  recipientType === 'technician' ? `${orderId}_${type}_${recipientId}` : `${orderId}_${type}`;

interface Options {
  orderId?: string;
  recipientId?: string;
  /** The document id; defaults to the one the rules require. */
  id?: string;
  /** Fields changed or added on the otherwise correct notification. */
  fields?: Record<string, unknown>;
  /** Fields left out. */
  omit?: string[];
}

/** A correct notification of [type] to [recipientType], as the app writes it, with [options] applied. */
function send(uid: string, type: string, recipientType: Recipient, options: Options = {}) {
  const orderId = options.orderId ?? 'o1';
  const recipientId = options.recipientId ?? RECIPIENT[recipientType];
  const id = options.id ?? idFor(orderId, type, recipientType, recipientId);
  const data: Record<string, unknown> = {
    id,
    recipientType,
    recipientId,
    orderId,
    type,
    productName: 'Router',
    isRead: false,
    createdAt: serverTimestamp(),
    senderId: uid,
    ...options.fields,
  };
  for (const key of options.omit ?? []) delete data[key];
  return setDoc(doc(as(uid), 'notifications', id), data);
}

async function stored(id: string): Promise<Record<string, unknown> | undefined> {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), 'notifications', id))).data();
  });
  return data;
}

/** Every notification the app sends: [sender, type, recipient kind]. */
const APP_NOTIFICATIONS: [string, string, Recipient][] = [
  ['cust1', 'new_order', 'company_admin'],
  ['cust1', 'new_review', 'company_admin'],
  ['ca1', 'payment_confirmed', 'customer'],
  ['ca1', 'out_for_delivery', 'customer'],
  ['ca1', 'order_completed', 'customer'],
  ['ca1', 'review_reply', 'customer'],
  ['tech1', 'out_for_delivery', 'customer'],
  ['tech1', 'order_completed', 'customer'],
  ['ca1', 'technician_assigned', 'technician'],
];

describe('every notification the app sends today is accepted', () => {
  for (const [uid, type, recipientType] of APP_NOTIFICATIONS) {
    it(`${uid} -> ${recipientType}: ${type}`, async () => {
      await assertSucceeds(send(uid, type, recipientType));
      const id = idFor('o1', type, recipientType, RECIPIENT[recipientType]);
      const saved = (await stored(id))!;
      expect(saved.type).toBe(type);
      expect(saved.productName).toBe('Router');
      expect(saved.title).toBeUndefined();
      expect(saved.body).toBeUndefined();
    });
  }
});

describe('the type comes from a fixed list', () => {
  it('an unknown type is refused, whoever sends it', async () => {
    for (const type of ['system_alert', 'promo', 'NEW_ORDER', 'new_order ', '']) {
      await assertFails(send('cust1', type, 'company_admin'));
      await assertFails(send('ca1', type, 'customer'));
      await assertFails(send('tech1', type, 'customer'));
      await assertFails(send('ca1', type, 'technician'));
    }
  });

  it('a type that is not text is refused', async () => {
    await assertFails(send('cust1', 'new_order', 'company_admin', { fields: { type: 7 } }));
    await assertFails(send('cust1', 'new_order', 'company_admin', { omit: ['type'] }));
  });

  it('each kind of sender has only its own types', async () => {
    // The customer cannot speak for the company.
    for (const type of ['payment_confirmed', 'out_for_delivery', 'order_completed', 'review_reply', 'technician_assigned']) {
      await assertFails(send('cust1', type, 'company_admin'));
    }
    // The company cannot send the customer's types to the customer, nor an assignment.
    for (const type of ['new_order', 'new_review', 'technician_assigned']) {
      await assertFails(send('ca1', type, 'customer'));
    }
    // The technician only reports delivery and completion.
    for (const type of ['payment_confirmed', 'review_reply', 'new_order', 'new_review', 'technician_assigned']) {
      await assertFails(send('tech1', type, 'customer'));
    }
    // A technician is only ever told about an assignment.
    for (const type of ['new_order', 'payment_confirmed', 'out_for_delivery', 'order_completed']) {
      await assertFails(send('ca1', type, 'technician'));
    }
  });
});

describe('no free text can be stored', () => {
  it('a title or a body is refused, even beside a correct notification', async () => {
    await assertFails(send('cust1', 'new_order', 'company_admin', { fields: { title: 'Payment confirmed by the bank' } }));
    await assertFails(send('cust1', 'new_order', 'company_admin', { fields: { body: 'Deliver the order today' } }));
    await assertFails(
      send('cust1', 'new_order', 'company_admin', {
        fields: { title: 'New order received', body: 'A new order for "Router" was placed and is awaiting payment verification.' },
      }),
    );
    await assertFails(send('ca1', 'payment_confirmed', 'customer', { fields: { body: 'x' } }));
  });

  it('any other extra field is refused', async () => {
    await assertFails(send('cust1', 'new_order', 'company_admin', { fields: { link: 'https://example.invalid' } }));
    await assertFails(send('cust1', 'new_order', 'company_admin', { fields: { message: 'hello' } }));
  });

  it("the product name must be the order's own", async () => {
    await assertFails(send('cust1', 'new_order', 'company_admin', { fields: { productName: 'Call this number now' } }));
    await assertFails(send('cust1', 'new_order', 'company_admin', { fields: { productName: 'Router ' } }));
    await assertFails(send('cust1', 'new_order', 'company_admin', { fields: { productName: '' } }));
    await assertFails(send('cust1', 'new_order', 'company_admin', { fields: { productName: 5 } }));
    await assertFails(send('cust1', 'new_order', 'company_admin', { omit: ['productName'] }));
    await assertFails(send('ca1', 'payment_confirmed', 'customer', { fields: { productName: 'Refund issued' } }));
  });

  it('a huge text is refused in every field', async () => {
    const huge = 'A'.repeat(900000);
    await assertFails(send('cust1', 'new_order', 'company_admin', { fields: { productName: huge } }));
    await assertFails(send('cust1', 'new_order', 'company_admin', { fields: { title: huge } }));
    await assertFails(send('cust1', 'new_order', 'company_admin', { fields: { body: huge } }));
    await assertFails(send('cust1', 'new_order', 'company_admin', { fields: { type: huge } }));
  });

  it("an order whose own product name is over 200 characters gets no notification", async () => {
    await assertFails(
      send('cust1', 'new_order', 'company_admin', { orderId: 'oLong', fields: { productName: 'x'.repeat(201) } }),
    );
  });

  it('it starts unread, stamped with the server time', async () => {
    await assertFails(send('cust1', 'new_order', 'company_admin', { fields: { isRead: true } }));
    await assertFails(send('cust1', 'new_order', 'company_admin', { fields: { createdAt: new Date(Date.now() - 3600 * 1000) } }));
  });
});

describe('one notification per order and type', () => {
  it('the same notification cannot be sent twice', async () => {
    await assertSucceeds(send('cust1', 'new_order', 'company_admin'));
    await assertFails(send('cust1', 'new_order', 'company_admin'));
  });

  it('nor under another id', async () => {
    await assertFails(send('cust1', 'new_order', 'company_admin', { id: 'anything-else' }));
    await assertFails(send('cust1', 'new_order', 'company_admin', { id: 'o1_new_order_2' }));
    await assertFails(send('cust1', 'new_order', 'company_admin', { id: 'o1_new_review' }));
    await assertFails(send('ca1', 'technician_assigned', 'technician', { id: 'o1_technician_assigned' }));
  });

  it('twenty-five attempts leave one notification', async () => {
    let accepted = 0;
    for (let i = 0; i < 25; i++) {
      try {
        await send('cust1', 'new_order', 'company_admin');
        accepted++;
      } catch {
        /* refused */
      }
      try {
        await send('cust1', 'new_order', 'company_admin', { id: `n${i}` });
        accepted++;
      } catch {
        /* refused */
      }
    }
    expect(accepted).toBe(1);
  });

  it('the company and the technician share the one delivery notification', async () => {
    await assertSucceeds(send('tech1', 'out_for_delivery', 'customer'));
    await assertFails(send('ca1', 'out_for_delivery', 'customer'));
  });

  it('different types of one order are separate notifications', async () => {
    await assertSucceeds(send('cust1', 'new_order', 'company_admin'));
    await assertSucceeds(send('cust1', 'new_review', 'company_admin'));
  });
});

describe('a deactivated account sends nothing', () => {
  it('a deactivated customer, even for an order of theirs', async () => {
    await assertFails(send('custOff', 'new_order', 'company_admin', { orderId: 'oOff' }));
    await assertFails(send('custOff', 'new_review', 'company_admin', { orderId: 'oOff' }));
  });

  it('a deactivated company admin', async () => {
    await assertFails(send('caOff', 'payment_confirmed', 'customer'));
    await assertFails(send('caOff', 'technician_assigned', 'technician'));
  });
});

describe('only within the order', () => {
  it("a customer cannot use someone else's order, or reach another company", async () => {
    await assertFails(send('cust2', 'new_order', 'company_admin'));
    await assertFails(send('cust1', 'new_order', 'company_admin', { orderId: 'o2', recipientId: 'c2' }));
    await assertFails(send('cust1', 'new_order', 'company_admin', { recipientId: 'c2' }));
    await assertFails(send('cust1', 'new_order', 'company_admin', { orderId: 'missing' }));
  });

  it('a customer cannot notify a customer or a technician', async () => {
    await assertFails(send('cust1', 'order_completed', 'customer'));
    await assertFails(send('cust1', 'order_completed', 'customer', { recipientId: 'cust2' }));
    await assertFails(send('cust1', 'technician_assigned', 'technician'));
  });

  it("another company's admin cannot notify this order's customer or technician", async () => {
    await assertFails(send('ca2', 'payment_confirmed', 'customer'));
    await assertFails(send('ca2', 'technician_assigned', 'technician'));
  });

  it('a company admin cannot notify a customer or technician who is not on the order', async () => {
    await assertFails(send('ca1', 'payment_confirmed', 'customer', { recipientId: 'cust2' }));
    await assertFails(send('ca1', 'payment_confirmed', 'customer', { orderId: 'o2', recipientId: 'cust2' }));
    await assertFails(send('ca1', 'technician_assigned', 'technician', { recipientId: 't2' }));
  });

  it('a technician who is not assigned to the order cannot notify its customer', async () => {
    await assertFails(send('tech2', 'out_for_delivery', 'customer'));
  });

  it('Platform Admin sends nothing', async () => {
    await assertFails(send('pa1', 'new_order', 'company_admin'));
    await assertFails(send('pa1', 'payment_confirmed', 'customer'));
  });

  it("nobody signs it with someone else's id", async () => {
    await assertFails(send('cust1', 'new_order', 'company_admin', { fields: { senderId: 'ca1' } }));
  });
});

describe('deleting a notification', () => {
  const TO_COMPANY = 'o1_new_order';
  const TO_CUSTOMER = 'o1_payment_confirmed';
  const TO_TECHNICIAN = 'o1_technician_assigned_t1';

  beforeEach(async () => {
    await assertSucceeds(send('cust1', 'new_order', 'company_admin'));
    await assertSucceeds(send('ca1', 'payment_confirmed', 'customer'));
    await assertSucceeds(send('ca1', 'technician_assigned', 'technician'));
  });

  const remove = (uid: string, id: string) => deleteDoc(doc(as(uid), 'notifications', id));

  it('the customer deletes their own', async () => {
    await assertSucceeds(remove('cust1', TO_CUSTOMER));
    expect(await stored(TO_CUSTOMER)).toBeUndefined();
  });

  it("any admin of the company deletes the company's", async () => {
    await assertSucceeds(remove('ca1b', TO_COMPANY));
    expect(await stored(TO_COMPANY)).toBeUndefined();
  });

  it('the technician deletes their own', async () => {
    await assertSucceeds(remove('tech1', TO_TECHNICIAN));
    expect(await stored(TO_TECHNICIAN)).toBeUndefined();
  });

  it('the sender cannot delete what they sent', async () => {
    await assertFails(remove('cust1', TO_COMPANY));
    await assertFails(remove('ca1', TO_CUSTOMER));
    await assertFails(remove('ca1', TO_TECHNICIAN));
    expect(await stored(TO_COMPANY)).toBeDefined();
    expect(await stored(TO_CUSTOMER)).toBeDefined();
    expect(await stored(TO_TECHNICIAN)).toBeDefined();
  });

  it("nobody else can delete another user's notification", async () => {
    for (const uid of ['cust2', 'ca2', 'tech1', 'tech2', 'pa1']) {
      await assertFails(remove(uid, TO_CUSTOMER));
    }
    for (const uid of ['cust2', 'ca2', 'tech1', 'pa1']) {
      await assertFails(remove(uid, TO_COMPANY));
    }
    for (const uid of ['cust1', 'cust2', 'ca2', 'tech2', 'pa1']) {
      await assertFails(remove(uid, TO_TECHNICIAN));
    }
  });

  it('the recipient still only marks it read, never rewrites it', async () => {
    await assertSucceeds(updateDoc(doc(as('ca1'), 'notifications', TO_COMPANY), { isRead: true }));
    await assertFails(updateDoc(doc(as('ca1'), 'notifications', TO_COMPANY), { type: 'new_review' }));
    await assertFails(updateDoc(doc(as('ca1'), 'notifications', TO_COMPANY), { productName: 'x' }));
    await assertFails(updateDoc(doc(as('cust1'), 'notifications', TO_COMPANY), { productName: 'x' }));
    await assertFails(updateDoc(doc(as('ca1'), 'notifications', TO_COMPANY), { title: 'x' }));
  });

  it('only the recipient reads it', async () => {
    await assertSucceeds(getDoc(doc(as('ca1'), 'notifications', TO_COMPANY)));
    await assertFails(getDoc(doc(as('cust1'), 'notifications', TO_COMPANY)));
    await assertFails(getDoc(doc(as('ca2'), 'notifications', TO_COMPANY)));
    await assertFails(getDoc(doc(as('cust2'), 'notifications', TO_CUSTOMER)));
  });
});
