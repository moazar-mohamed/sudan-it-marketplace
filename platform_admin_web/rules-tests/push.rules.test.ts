/*
 * Push notifications: each user registers their own phones
 * (users/{uid}.fcmTokens), a notification names who created it (senderId,
 * so the push relay only sends it for them), and the relay's send log
 * (push_log) is closed to the app. Local emulator only (npm run test:rules);
 * every user is a fake identity.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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
    for (const u of [
      user('cust1', 'customer'),
      user('cust2', 'customer'),
      user('ca1', 'company_admin', { companyId: 'c1' }),
      user('tech1', 'technician', { companyId: 'c1' }),
      user('pa1', 'platform_admin'),
    ]) {
      await setDoc(doc(db, 'users', u.id), u);
    }
    await setDoc(doc(db, 'companies', 'c1'), { name: 'c1', status: 'active', createdAt: now });
    await setDoc(doc(db, 'orders', 'o1'), {
      id: 'o1',
      customerId: 'cust1',
      companyId: 'c1',
      productId: 'p1',
      productName: 'Router',
      createdAt: now,
    });
    await setDoc(doc(db, 'push_log', 'n_old'), { kind: 'notification', by: 'cust1' });
    for (const [id, customerId] of [
      ['sr1', 'cust1'],
      ['sr2', 'cust2'],
    ]) {
      await setDoc(doc(db, 'service_requests', id), {
        id,
        customerId,
        companyId: 'c1',
        serviceName: 'Network setup',
        status: 'pending',
        createdAt: now,
      });
    }
  });
});

/** The one new_order notification of order o1 (its id is fixed by the rules). */
const NEW_ORDER_ID = 'o1_new_order';
const newOrderNotification = (extra: Record<string, unknown> = {}) => ({
  id: NEW_ORDER_ID,
  recipientType: 'company_admin',
  recipientId: 'c1',
  orderId: 'o1',
  type: 'new_order',
  productName: 'Router',
  isRead: false,
  createdAt: serverTimestamp(),
  ...extra,
});
const send = (uid: string, extra: Record<string, unknown> = {}) =>
  setDoc(doc(as(uid), 'notifications', NEW_ORDER_ID), newOrderNotification(extra));

describe('registering the phones that receive pushes', () => {
  it('every kind of user saves their own device tokens', async () => {
    for (const uid of ['cust1', 'ca1', 'tech1', 'pa1']) {
      await assertSucceeds(updateDoc(doc(as(uid), 'users', uid), { fcmTokens: [`phone-${uid}`] }));
    }
    await assertSucceeds(updateDoc(doc(as('cust1'), 'users', 'cust1'), { fcmTokens: [] }));
  });

  it("never someone else's, and nothing else rides along", async () => {
    await assertFails(updateDoc(doc(as('cust2'), 'users', 'cust1'), { fcmTokens: ['mine'] }));
    await assertFails(updateDoc(doc(as('cust1'), 'users', 'cust1'), { fcmTokens: ['a'], role: 'company_admin' }));
    await assertFails(updateDoc(doc(as('ca1'), 'users', 'ca1'), { fcmTokens: ['a'], companyId: 'c2' }));
  });

  it('a short list only', async () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `phone-${i}`);
    await assertFails(updateDoc(doc(as('cust1'), 'users', 'cust1'), { fcmTokens: eleven }));
    await assertFails(updateDoc(doc(as('cust1'), 'users', 'cust1'), { fcmTokens: 'phone' }));
    await assertSucceeds(updateDoc(doc(as('cust1'), 'users', 'cust1'), { fcmTokens: eleven.slice(0, 10) }));
  });
});

describe('a notification names who created it', () => {
  it('the creator may sign it with their own id', async () => {
    await assertSucceeds(send('cust1', { senderId: 'cust1' }));
  });

  it("but not with someone else's", async () => {
    await assertFails(send('cust1', { senderId: 'ca1' }));
  });

  it('one left unsigned is still stored (the relay never pushes it)', async () => {
    await assertSucceeds(send('cust1'));
  });
});

describe("the relay's send log", () => {
  it('is closed to every app user', async () => {
    for (const uid of ['cust1', 'ca1', 'pa1']) {
      await assertFails(getDoc(doc(as(uid), 'push_log', 'n_old')));
      await assertFails(setDoc(doc(as(uid), 'push_log', 'n_new'), { kind: 'notification', by: uid }));
    }
  });
});

// A service request notification has no text of its own either: its `type`
// says what happened and `productName` is the service's name, which must be
// the request's own. Its id is fixed: `{serviceRequestId}_{type}`.
const srId = (type: string, requestId = 'sr1') => `${requestId}_${type}`;
const serviceRequestNotification = (extra: Record<string, unknown> = {}) => {
  const data: Record<string, unknown> = {
    recipientType: 'company_admin',
    recipientId: 'c1',
    serviceRequestId: 'sr1',
    type: 'new_service_request',
    productName: 'Network setup',
    isRead: false,
    createdAt: serverTimestamp(),
    senderId: 'cust1',
    ...extra,
  };
  return { id: srId(String(data.type), String(data.serviceRequestId)), ...data };
};
const sendRequest = (uid: string, data: Record<string, unknown>) =>
  setDoc(doc(as(uid), 'notifications', String(data.id)), data);

/** [bad] is refused and [good], the same thing with only the fault removed, is stored. */
async function refusedOnlyFor(uid: string, bad: Record<string, unknown>, good: Record<string, unknown>) {
  await assertFails(sendRequest(uid, bad));
  await assertSucceeds(sendRequest(uid, good));
}

const withoutKey = (data: Record<string, unknown>, key: string) => {
  const rest = { ...data };
  delete rest[key];
  return rest;
};

const answer = (type: string, extra: Record<string, unknown> = {}) =>
  serviceRequestNotification({ recipientType: 'customer', recipientId: 'cust1', type, senderId: 'ca1', ...extra });

describe('service request notifications', () => {
  it('the customer tells the company about a new or a cancelled request', async () => {
    await assertSucceeds(sendRequest('cust1', serviceRequestNotification()));
    await assertSucceeds(sendRequest('cust1', serviceRequestNotification({ type: 'service_request_cancelled' })));
  });

  it("the company's admin answers the customer", async () => {
    for (const type of [
      'service_request_accepted',
      'service_request_rejected',
      'service_request_in_progress',
      'service_request_completed',
    ]) {
      await assertSucceeds(sendRequest('ca1', answer(type)));
    }
  });

  it('the recipient sees it; nobody else does', async () => {
    const data = serviceRequestNotification();
    await assertSucceeds(sendRequest('cust1', data));
    await assertSucceeds(getDoc(doc(as('ca1'), 'notifications', String(data.id))));
    await assertFails(getDoc(doc(as('cust2'), 'notifications', String(data.id))));
  });

  it("not about someone else's request, nor to another company or customer", async () => {
    // cust2 does not own sr1.
    await refusedOnlyFor(
      'cust2',
      serviceRequestNotification({ senderId: 'cust2' }),
      serviceRequestNotification({ senderId: 'cust2', serviceRequestId: 'sr2' }),
    );
    // Addressed to a company that was not asked.
    await refusedOnlyFor(
      'cust1',
      serviceRequestNotification({ recipientId: 'c2' }),
      serviceRequestNotification(),
    );
    // Another customer as the recipient of the company's answer.
    await refusedOnlyFor(
      'ca1',
      answer('service_request_accepted', { recipientId: 'cust2' }),
      answer('service_request_accepted'),
    );
  });

  it('each side only sends its own kinds of notification', async () => {
    // A customer cannot answer for the company ...
    await refusedOnlyFor(
      'cust1',
      serviceRequestNotification({ recipientType: 'customer', recipientId: 'cust1', type: 'service_request_completed' }),
      serviceRequestNotification(),
    );
    // ... a company cannot file a request for the customer ...
    await refusedOnlyFor(
      'ca1',
      serviceRequestNotification({ senderId: 'ca1' }),
      answer('service_request_accepted'),
    );
    // ... a customer cannot send the company a kind that is the company's own to
    // send, nor a company the customer's kind ...
    for (const type of [
      'service_request_accepted',
      'service_request_rejected',
      'service_request_in_progress',
      'service_request_completed',
    ]) {
      await assertFails(sendRequest('cust1', serviceRequestNotification({ type })));
    }
    await refusedOnlyFor(
      'ca1',
      answer('new_service_request'),
      answer('service_request_rejected'),
    );
    // ... and nobody invents a kind.
    await refusedOnlyFor(
      'cust1',
      serviceRequestNotification({ type: 'free_money' }),
      serviceRequestNotification({ type: 'service_request_cancelled' }),
    );
  });

  it('a technician has no service request notifications', async () => {
    await refusedOnlyFor(
      'ca1',
      serviceRequestNotification({
        recipientType: 'technician',
        recipientId: 'tech1',
        type: 'service_request_accepted',
        senderId: 'ca1',
      }),
      answer('service_request_accepted'),
    );
  });

  it('about an order or a request, never both and never neither', async () => {
    await refusedOnlyFor(
      'cust1',
      serviceRequestNotification({ orderId: 'o1' }),
      serviceRequestNotification(),
    );
    const neither = { ...withoutKey(serviceRequestNotification(), 'serviceRequestId'), id: 'none' };
    await assertFails(sendRequest('cust1', neither));
    // An order notification still works as before.
    await assertSucceeds(send('cust1', { senderId: 'cust1' }));
  });

  it("the name in it is the request's own service name", async () => {
    await refusedOnlyFor(
      'cust1',
      serviceRequestNotification({ productName: 'Free money, call this number' }),
      serviceRequestNotification(),
    );
    await refusedOnlyFor(
      'ca1',
      answer('service_request_accepted', { productName: '' }),
      answer('service_request_accepted'),
    );
  });

  it('carries no text of its own', async () => {
    await refusedOnlyFor(
      'cust1',
      serviceRequestNotification({ title: 'New service request', body: 'Call this number' }),
      serviceRequestNotification(),
    );
    await refusedOnlyFor(
      'ca1',
      answer('service_request_accepted', { body: 'Pay me' }),
      answer('service_request_accepted'),
    );
  });

  it('one per request and type: a fixed id, and no second one', async () => {
    await refusedOnlyFor(
      'cust1',
      serviceRequestNotification({ id: 'my-own-id' }),
      serviceRequestNotification(),
    );
    // The same thing again is an edit of the stored one, which is refused.
    await assertFails(sendRequest('cust1', serviceRequestNotification()));
    // Another kind for the same request is another notification.
    await assertSucceeds(sendRequest('cust1', serviceRequestNotification({ type: 'service_request_cancelled' })));
  });

  it('the request id is at most 128 characters', async () => {
    const ok = 'a'.repeat(128);
    const tooLong = 'a'.repeat(129);
    await env.withSecurityRulesDisabled(async (ctx) => {
      for (const id of [ok, tooLong]) {
        await setDoc(doc(ctx.firestore(), 'service_requests', id), {
          id,
          customerId: 'cust1',
          companyId: 'c1',
          serviceName: 'Network setup',
          status: 'pending',
          createdAt: now,
        });
      }
    });
    await refusedOnlyFor(
      'cust1',
      serviceRequestNotification({ serviceRequestId: tooLong }),
      serviceRequestNotification({ serviceRequestId: ok }),
    );
  });

  it('a deactivated account cannot send one', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users', 'cust1'), { isActive: false });
    });
    await assertFails(sendRequest('cust1', serviceRequestNotification()));
  });
});
