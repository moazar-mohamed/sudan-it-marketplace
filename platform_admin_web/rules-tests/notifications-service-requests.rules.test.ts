/*
 * Notifications about a service request (the same rules as for an order, see
 * notifications.rules.test.ts): a `type` from a fixed list, each kind of
 * sender with its own types, the request's own service name as the only text,
 * one notification per request and type (its id is fixed), and only the two
 * sides of the request involved. Local emulator only (npm run test:rules);
 * every user is a fake identity.
 *
 * Between the customer who sent the request and the company it was sent to:
 *   the customer      -> its company:  new_service_request, service_request_cancelled
 *   the company admin -> the customer: service_request_accepted, _rejected,
 *                                      _in_progress, _completed
 * Technicians have none.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
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
    await user('ca1', 'company_admin', { companyId: 'c1' });
    await user('caOff', 'company_admin', { companyId: 'c1', isActive: false });
    await user('ca2', 'company_admin', { companyId: 'c2' });
    await user('tech1', 'technician', { companyId: 'c1' });
    await user('pa1', 'platform_admin');
    for (const id of ['c1', 'c2']) {
      await setDoc(doc(db, 'companies', id), { name: id, status: 'active', createdAt: now });
    }
    await setDoc(doc(db, 'service_requests', 'sr1'), {
      id: 'sr1',
      customerId: 'cust1',
      companyId: 'c1',
      serviceName: 'Network setup',
      status: 'pending',
      createdAt: now,
    });
    // A request whose service name is longer than any real one.
    await setDoc(doc(db, 'service_requests', 'srLong'), {
      id: 'srLong',
      customerId: 'cust1',
      companyId: 'c1',
      serviceName: 'x'.repeat(201),
      status: 'pending',
      createdAt: now,
    });
  });
});

type Recipient = 'customer' | 'company_admin' | 'technician';

/** Who each kind of notification about request sr1 is addressed to. */
const RECIPIENT: Record<Recipient, string> = {
  customer: 'cust1',
  company_admin: 'c1',
  technician: 't1',
};

interface Options {
  requestId?: string;
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
  const serviceRequestId = options.requestId ?? 'sr1';
  const recipientId = options.recipientId ?? RECIPIENT[recipientType];
  const id = options.id ?? `${serviceRequestId}_${type}`;
  const data: Record<string, unknown> = {
    id,
    recipientType,
    recipientId,
    serviceRequestId,
    type,
    productName: 'Network setup',
    isRead: false,
    createdAt: serverTimestamp(),
    senderId: uid,
    ...options.fields,
  };
  for (const key of options.omit ?? []) delete data[key];
  return setDoc(doc(as(uid), 'notifications', id), data);
}

const ANSWERS = [
  'service_request_accepted',
  'service_request_rejected',
  'service_request_in_progress',
  'service_request_completed',
];

describe('who may send what about a service request', () => {
  it('the customer tells the company about a new or a cancelled request', async () => {
    await assertSucceeds(send('cust1', 'new_service_request', 'company_admin'));
    await assertSucceeds(send('cust1', 'service_request_cancelled', 'company_admin'));
  });

  it("the company's admin answers the customer", async () => {
    for (const type of ANSWERS) {
      await assertSucceeds(send('ca1', type, 'customer'));
    }
  });

  it('each side only sends its own kinds', async () => {
    // A customer cannot answer for the company ...
    for (const type of ANSWERS) {
      await assertFails(send('cust1', type, 'customer'));
    }
    // ... a company cannot file or cancel a request for the customer ...
    await assertFails(send('ca1', 'new_service_request', 'company_admin'));
    await assertFails(send('ca1', 'service_request_cancelled', 'company_admin'));
    // ... and nobody invents a kind, or borrows an order's.
    await assertFails(send('cust1', 'free_money', 'company_admin'));
    await assertFails(send('cust1', 'new_order', 'company_admin'));
    await assertFails(send('ca1', 'payment_confirmed', 'customer'));
  });

  it("not about someone else's request, nor to another company or customer", async () => {
    // cust2 does not own sr1.
    await assertFails(send('cust2', 'new_service_request', 'company_admin'));
    // Addressed to a company that was not asked.
    await assertFails(send('cust1', 'new_service_request', 'company_admin', { recipientId: 'c2' }));
    // Another company's admin cannot answer for c1.
    await assertFails(send('ca2', 'service_request_accepted', 'customer'));
    // Another customer as the recipient of the company's answer.
    await assertFails(send('ca1', 'service_request_accepted', 'customer', { recipientId: 'cust2' }));
  });

  it('a technician has no service request notifications', async () => {
    await assertFails(send('ca1', 'service_request_accepted', 'technician'));
    await assertFails(send('tech1', 'service_request_accepted', 'customer'));
    await assertFails(send('tech1', 'service_request_accepted', 'technician'));
  });

  it('a deactivated account cannot send', async () => {
    await assertFails(send('caOff', 'service_request_accepted', 'customer'));
  });
});

describe('what it contains', () => {
  it('about an order or a request, never both and never neither', async () => {
    await assertFails(send('cust1', 'new_service_request', 'company_admin', { fields: { orderId: 'o1' } }));
    await assertFails(
      send('cust1', 'new_service_request', 'company_admin', { omit: ['serviceRequestId'] }),
    );
  });

  it("the only text is the request's own service name", async () => {
    await assertFails(
      send('cust1', 'new_service_request', 'company_admin', { fields: { productName: 'Click this link' } }),
    );
    await assertFails(send('cust1', 'new_service_request', 'company_admin', { omit: ['productName'] }));
    // No title or body of its own.
    await assertFails(
      send('cust1', 'new_service_request', 'company_admin', { fields: { title: 'Alert', body: 'Call me' } }),
    );
  });

  it('a service name longer than 200 characters is refused', async () => {
    await assertFails(
      send('cust1', 'new_service_request', 'company_admin', {
        requestId: 'srLong',
        fields: { productName: 'x'.repeat(201) },
      }),
    );
  });

  it('there is one per request and type: the id is fixed, and a repeat is an edit', async () => {
    await assertFails(
      send('cust1', 'new_service_request', 'company_admin', { id: 'anything-i-like' }),
    );
    await assertSucceeds(send('cust1', 'new_service_request', 'company_admin'));
    // Sending the same thing again would overwrite the first: refused.
    await assertFails(send('cust1', 'new_service_request', 'company_admin'));
  });

  it('the request must exist', async () => {
    await assertFails(send('cust1', 'new_service_request', 'company_admin', { requestId: 'missing' }));
  });
});

describe('who can read and delete it', () => {
  it('its recipient reads it; nobody else does', async () => {
    await assertSucceeds(send('cust1', 'new_service_request', 'company_admin'));
    await assertSucceeds(getDoc(doc(as('ca1'), 'notifications', 'sr1_new_service_request')));
    await assertFails(getDoc(doc(as('ca2'), 'notifications', 'sr1_new_service_request')));
    await assertFails(getDoc(doc(as('cust2'), 'notifications', 'sr1_new_service_request')));
  });

  it('only its recipient may delete it, never its sender', async () => {
    await assertSucceeds(send('ca1', 'service_request_accepted', 'customer'));
    const path = ['notifications', 'sr1_service_request_accepted'] as const;
    await assertFails(deleteDoc(doc(as('ca1'), ...path)));
    await assertFails(deleteDoc(doc(as('cust2'), ...path)));
    await assertSucceeds(deleteDoc(doc(as('cust1'), ...path)));
  });
});
