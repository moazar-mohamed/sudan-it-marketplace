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
    await setDoc(doc(db, 'service_requests', 'sr1'), {
      id: 'sr1',
      customerId: 'cust1',
      companyId: 'c1',
      serviceName: 'Network setup',
      status: 'pending',
      createdAt: now,
    });
  });
});

const newOrderNotification = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  recipientType: 'company_admin',
  recipientId: 'c1',
  orderId: 'o1',
  type: 'new_order',
  title: 'New order received',
  body: 'A new order for "Router" was placed and is awaiting payment verification.',
  isRead: false,
  createdAt: serverTimestamp(),
  ...extra,
});

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
    await assertSucceeds(setDoc(doc(as('cust1'), 'notifications', 'n1'), newOrderNotification('n1', { senderId: 'cust1' })));
  });

  it("but not with someone else's", async () => {
    await assertFails(setDoc(doc(as('cust1'), 'notifications', 'n2'), newOrderNotification('n2', { senderId: 'ca1' })));
  });

  it('older app versions that do not sign it keep working', async () => {
    await assertSucceeds(setDoc(doc(as('cust1'), 'notifications', 'n3'), newOrderNotification('n3')));
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

const serviceRequestNotification = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  recipientType: 'company_admin',
  recipientId: 'c1',
  serviceRequestId: 'sr1',
  type: 'new_service_request',
  title: 'New service request',
  body: 'A customer requested "Network setup".',
  isRead: false,
  createdAt: serverTimestamp(),
  senderId: 'cust1',
  ...extra,
});

const withoutKey = (data: Record<string, unknown>, key: string) => {
  const { [key]: _removed, ...rest } = data;
  return rest;
};

describe('service request notifications', () => {
  it('the customer tells the company about a new or a cancelled request', async () => {
    await assertSucceeds(setDoc(doc(as('cust1'), 'notifications', 's1'), serviceRequestNotification('s1')));
    await assertSucceeds(
      setDoc(
        doc(as('cust1'), 'notifications', 's2'),
        serviceRequestNotification('s2', { type: 'service_request_cancelled' }),
      ),
    );
  });

  it("the company's admin answers the customer", async () => {
    for (const type of [
      'service_request_accepted',
      'service_request_rejected',
      'service_request_in_progress',
      'service_request_completed',
    ]) {
      await assertSucceeds(
        setDoc(
          doc(as('ca1'), 'notifications', `a_${type}`),
          serviceRequestNotification(`a_${type}`, {
            recipientType: 'customer',
            recipientId: 'cust1',
            type,
            senderId: 'ca1',
          }),
        ),
      );
    }
  });

  it('the recipient sees it; nobody else does', async () => {
    await assertSucceeds(setDoc(doc(as('cust1'), 'notifications', 's1'), serviceRequestNotification('s1')));
    await assertSucceeds(getDoc(doc(as('ca1'), 'notifications', 's1')));
    await assertFails(getDoc(doc(as('cust2'), 'notifications', 's1')));
  });

  it("not about someone else's request, nor to another company or customer", async () => {
    // cust2 does not own sr1.
    await assertFails(
      setDoc(doc(as('cust2'), 'notifications', 'x1'), serviceRequestNotification('x1', { senderId: 'cust2' })),
    );
    // Addressed to a company that was not asked.
    await assertFails(
      setDoc(doc(as('cust1'), 'notifications', 'x2'), serviceRequestNotification('x2', { recipientId: 'c2' })),
    );
    // Another customer as the recipient of the company's answer.
    await assertFails(
      setDoc(
        doc(as('ca1'), 'notifications', 'x3'),
        serviceRequestNotification('x3', {
          recipientType: 'customer',
          recipientId: 'cust2',
          type: 'service_request_accepted',
          senderId: 'ca1',
        }),
      ),
    );
  });

  it('each side only sends its own kinds of notification', async () => {
    // A customer cannot answer for the company ...
    await assertFails(
      setDoc(
        doc(as('cust1'), 'notifications', 'y1'),
        serviceRequestNotification('y1', {
          recipientType: 'customer',
          recipientId: 'cust1',
          type: 'service_request_completed',
        }),
      ),
    );
    // ... a company cannot file a request for the customer ...
    await assertFails(
      setDoc(doc(as('ca1'), 'notifications', 'y2'), serviceRequestNotification('y2', { senderId: 'ca1' })),
    );
    // ... and nobody invents a kind.
    await assertFails(
      setDoc(doc(as('cust1'), 'notifications', 'y3'), serviceRequestNotification('y3', { type: 'free_money' })),
    );
  });

  it('a technician has no service request notifications', async () => {
    await assertFails(
      setDoc(
        doc(as('ca1'), 'notifications', 'z1'),
        serviceRequestNotification('z1', {
          recipientType: 'technician',
          recipientId: 't1',
          type: 'service_request_accepted',
          senderId: 'ca1',
        }),
      ),
    );
  });

  it('about an order or a request, never both and never neither', async () => {
    const both = serviceRequestNotification('w1', { orderId: 'o1' });
    await assertFails(setDoc(doc(as('cust1'), 'notifications', 'w1'), both));
    const neither = withoutKey(serviceRequestNotification('w2'), 'serviceRequestId');
    await assertFails(setDoc(doc(as('cust1'), 'notifications', 'w2'), neither));
    // An order notification still works as before.
    await assertSucceeds(setDoc(doc(as('cust1'), 'notifications', 'w3'), newOrderNotification('w3', { senderId: 'cust1' })));
  });
});
