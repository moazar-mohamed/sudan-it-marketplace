// The relay against a fake Google: an in-memory Firestore, a fake sign-in
// service and a fake FCM. Nothing here talks to the network.
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { createRelay } from '../src/relay.js';
import { chatMessageText, orderNotificationText } from '../src/texts.js';

const NOW = Date.parse('2026-09-29T12:00:00Z');
const PROJECT = 'demo-project';

async function testServiceAccount() {
  const { privateKey } = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString('base64')}\n-----END PRIVATE KEY-----\n`;
  return {
    type: 'service_account',
    project_id: PROJECT,
    client_email: 'relay@demo-project.iam.gserviceaccount.com',
    private_key: pem,
    token_uri: 'https://oauth2.googleapis.com/token',
  };
}

// ── A tiny fake of the Google endpoints the relay uses ─────────────────────

function toValue(v) {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { integerValue: String(v) };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
}
const fromValue = (v) =>
  'stringValue' in v ? v.stringValue
    : 'integerValue' in v ? Number(v.integerValue)
      : 'booleanValue' in v ? v.booleanValue
        : 'timestampValue' in v ? new Date(v.timestampValue)
          : 'arrayValue' in v ? (v.arrayValue.values ?? []).map(fromValue)
            : null;

function fakeGoogle() {
  const docs = new Map(); // "collection/id" -> fields (plain values)
  const idTokens = new Map(); // idToken -> uid
  const sent = []; // FCM messages
  const goneTokens = new Set();
  const json = (status, body) => new Response(JSON.stringify(body), { status });
  const prefix = `/v1/projects/${PROJECT}/databases/(default)/documents`;

  async function fetch(input, init = {}) {
    const url = new URL(input);
    const body = init.body && typeof init.body === 'string' && init.body.startsWith('{')
      ? JSON.parse(init.body)
      : null;
    if (url.host === 'oauth2.googleapis.com') {
      return json(200, { access_token: 'access-1', expires_in: 3600 });
    }
    if (url.host === 'identitytoolkit.googleapis.com') {
      const uid = idTokens.get(body.idToken);
      return uid ? json(200, { users: [{ localId: uid }] }) : json(400, { error: { message: 'INVALID_ID_TOKEN' } });
    }
    if (url.host === 'fcm.googleapis.com') {
      const token = body.message.token;
      if (goneTokens.has(token)) {
        return json(404, { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } });
      }
      sent.push(body.message);
      return json(200, { name: 'm1' });
    }
    // Firestore
    const path = decodeURIComponent(url.pathname);
    if (path.endsWith(':runQuery')) {
      const where = body.structuredQuery.where;
      const filters = where.compositeFilter ? where.compositeFilter.filters : [where];
      const collection = body.structuredQuery.from[0].collectionId;
      const rows = [...docs.entries()]
        .filter(([key]) => key.split('/').length === 2 && key.startsWith(`${collection}/`))
        .filter(([, data]) => filters.every((f) => data[f.fieldFilter.field.fieldPath] === fromValue(f.fieldFilter.value)))
        .map(([key, data]) => ({ document: { name: `projects/x${prefix.slice(3)}/${key}`, fields: toValue(data).mapValue.fields } }));
      return json(200, rows.length ? rows : [{ readTime: 'now' }]);
    }
    if (path.endsWith(':commit')) {
      for (const write of body.writes) {
        if (write.update) {
          const key = write.update.name.split('/documents/')[1];
          if (write.currentDocument?.exists === false && docs.has(key)) {
            return json(409, { error: { status: 'ALREADY_EXISTS' } });
          }
          docs.set(key, Object.fromEntries(Object.entries(write.update.fields).map(([k, v]) => [k, fromValue(v)])));
        } else if (write.transform) {
          const key = write.transform.document.split('/documents/')[1];
          const data = docs.get(key);
          for (const t of write.transform.fieldTransforms) {
            const remove = t.removeAllFromArray.values.map(fromValue);
            data[t.fieldPath] = (data[t.fieldPath] ?? []).filter((x) => !remove.includes(x));
          }
        }
      }
      return json(200, {});
    }
    const key = path.slice(prefix.length + 1);
    if (init.method === 'PATCH') {
      const current = docs.get(key) ?? {};
      for (const [k, v] of Object.entries(body.fields)) current[k] = fromValue(v);
      docs.set(key, current);
      return json(200, {});
    }
    const data = docs.get(key);
    return data ? json(200, { fields: toValue(data).mapValue.fields }) : json(404, {});
  }

  return { fetch, docs, idTokens, sent, goneTokens };
}

// ── Fixtures ───────────────────────────────────────────────────────────────

let google;
let relay;
let serviceAccount;
const minutesAgo = (n) => new Date(NOW - n * 60 * 1000);

async function call(body, idToken = 'token-cust1') {
  const response = await relay(new Request('https://relay.test/push', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() };
}

beforeEach(async () => {
  serviceAccount ??= await testServiceAccount();
  google = fakeGoogle();
  relay = createRelay(
    { PROJECT_ID: PROJECT, FIREBASE_API_KEY: 'k', SERVICE_ACCOUNT_JSON: JSON.stringify(serviceAccount) },
    { fetch: google.fetch, now: () => NOW },
  );
  google.idTokens.set('token-cust1', 'cust1');
  google.idTokens.set('token-cust2', 'cust2');
  google.idTokens.set('token-ca1', 'ca1');
  const put = (key, data) => google.docs.set(key, data);
  put('users/cust1', { role: 'customer', language: 'ar', fcmTokens: ['phone-cust1'] });
  put('users/cust2', { role: 'customer', fcmTokens: ['phone-cust2'] });
  put('users/ca1', { role: 'company_admin', companyId: 'c1', language: 'ar', fcmTokens: ['phone-ca1'] });
  put('users/ca1b', { role: 'company_admin', companyId: 'c1', fcmTokens: ['phone-ca1b', 'old-phone'] });
  put('users/ca2', { role: 'company_admin', companyId: 'c2', fcmTokens: ['phone-ca2'] });
  put('users/tech1u', { role: 'technician', companyId: 'c1', fcmTokens: ['phone-tech1'] });
  put('technicians/t1', { companyId: 'c1', uid: 'tech1u', email: 'tech@x.test' });
  put('notifications/n1', {
    recipientType: 'company_admin', recipientId: 'c1', orderId: 'o1', type: 'new_order',
    productName: 'Router', senderId: 'cust1', createdAt: minutesAgo(1),
  });
  put('chats/chat1', {
    customerId: 'cust1', companyId: 'c1', customerName: 'Amna', companyName: 'Nile Tech',
    productId: 'p1', productName: 'Router', serviceName: '',
  });
  put('chats/chat1/messages/m1', { senderId: 'cust1', senderRole: 'customer', text: 'Is it available?', createdAt: minutesAgo(0) });
  put('chats/chat1/messages/m2', { senderId: 'ca1', senderRole: 'company', text: 'Yes!', createdAt: minutesAgo(0) });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('who may ask for a push', () => {
  it('needs a signed-in caller', async () => {
    assert.equal((await call({ notificationId: 'n1' }, '')).status, 401);
    assert.equal((await call({ notificationId: 'n1' }, 'forged')).status, 401);
    assert.equal(google.sent.length, 0);
  });

  it('only the person who wrote the notification or message', async () => {
    assert.equal((await call({ notificationId: 'n1' }, 'token-cust2')).status, 403);
    assert.equal((await call({ chatId: 'chat1', messageId: 'm1' }, 'token-ca1')).status, 403);
    assert.equal(google.sent.length, 0);
  });

  it('only while it is fresh (10 minutes)', async () => {
    google.docs.get('notifications/n1').createdAt = minutesAgo(11);
    assert.equal((await call({ notificationId: 'n1' })).status, 409);
  });

  it('asks for exactly one thing, with plain ids', async () => {
    assert.equal((await call({})).status, 400);
    assert.equal((await call({ notificationId: 'n1', chatId: 'chat1', messageId: 'm1' })).status, 400);
    assert.equal((await call({ notificationId: '../users/x' })).status, 400);
    assert.equal((await call({ notificationId: 'missing' })).status, 404);
  });
});

describe('order notifications', () => {
  it('reach every admin of the company, each in their own language, once', async () => {
    const first = await call({ notificationId: 'n1' });
    assert.deepEqual(first, { status: 200, body: { sent: 3, failed: 0 } });
    const byToken = Object.fromEntries(google.sent.map((m) => [m.token, m]));
    assert.deepEqual(Object.keys(byToken).sort(), ['old-phone', 'phone-ca1', 'phone-ca1b']);
    assert.equal(byToken['phone-ca1'].notification.title, 'تم استلام طلب جديد');
    assert.equal(byToken['phone-ca1b'].notification.title, 'New order received');
    assert.match(byToken['phone-ca1'].notification.body, /Router/);
    assert.deepEqual(byToken['phone-ca1'].data, {
      type: 'new_order', notificationId: 'n1', orderId: 'o1', recipientType: 'company_admin',
    });
    assert.equal(byToken['phone-ca1'].android.notification.channel_id, 'general');

    const again = await call({ notificationId: 'n1' });
    assert.deepEqual(again.body, { skipped: 'already_sent' });
    assert.equal(google.sent.length, 3);
  });

  it('forgets a phone FCM says is gone', async () => {
    google.goneTokens.add('old-phone');
    const result = await call({ notificationId: 'n1' });
    assert.deepEqual(result.body, { sent: 2, failed: 1 });
    assert.deepEqual(google.docs.get('users/ca1b').fcmTokens, ['phone-ca1b']);
  });

  it('reach a customer, and a technician through their account', async () => {
    google.docs.set('notifications/n2', {
      recipientType: 'customer', recipientId: 'cust1', orderId: 'o1', type: 'order_completed',
      productName: 'Router', senderId: 'ca1', createdAt: minutesAgo(0),
    });
    google.docs.set('notifications/n3', {
      recipientType: 'technician', recipientId: 't1', orderId: 'o1', type: 'technician_assigned',
      productName: 'Router', senderId: 'ca1', createdAt: minutesAgo(0),
    });
    assert.equal((await call({ notificationId: 'n2' }, 'token-ca1')).body.sent, 1);
    assert.equal((await call({ notificationId: 'n3' }, 'token-ca1')).body.sent, 1);
    assert.deepEqual(google.sent.map((m) => [m.token, m.notification.title]), [
      ['phone-cust1', 'اكتمل الطلب'],
      ['phone-tech1', 'New installation job assigned'],
    ]);
  });
});

describe('stored text is never pushed', () => {
  const stored = (extra) => google.docs.set('notifications/nx', {
    recipientType: 'company_admin', recipientId: 'c1', orderId: 'o1', senderId: 'cust1',
    title: 'Written by the sender', body: 'Call this number "now"', createdAt: minutesAgo(0),
    ...extra,
  });

  it('an unknown type is refused: nothing is sent and nothing is logged', async () => {
    stored({ type: 'system_alert', productName: 'Router' });
    const result = await call({ notificationId: 'nx' });
    assert.deepEqual(result, { status: 422, body: { error: 'unsupported_notification' } });
    assert.equal(google.sent.length, 0);
    assert.equal(google.docs.has('push_log/n_nx'), false);
  });

  it('a name that only looks like a type (a built-in object key) is refused too', async () => {
    for (const type of ['constructor', '__proto__', 'toString', '']) {
      stored({ type, productName: 'Router' });
      assert.equal((await call({ notificationId: 'nx' })).status, 422, type);
    }
    assert.equal(google.sent.length, 0);
  });

  it('a known type without a product name is refused (the stored body is not read)', async () => {
    stored({ type: 'new_order' });
    assert.equal((await call({ notificationId: 'nx' })).status, 422);
    stored({ type: 'new_order', productName: 42 });
    assert.equal((await call({ notificationId: 'nx' })).status, 422);
    assert.equal(google.sent.length, 0);
  });

  it("a known type is pushed in the relay's own words, whatever text is stored with it", async () => {
    stored({ type: 'new_order', productName: 'Router' });
    assert.equal((await call({ notificationId: 'nx' })).body.sent, 3);
    for (const message of google.sent) {
      assert.ok(
        ['تم استلام طلب جديد', 'New order received'].includes(message.notification.title),
        message.notification.title,
      );
      assert.match(message.notification.body, /Router/);
      const pushed = JSON.stringify(message);
      assert.ok(!pushed.includes('Written by the sender'));
      assert.ok(!pushed.includes('Call this number'));
    }
  });
});

describe('chat messages', () => {
  it("a customer's message reaches the company's admins, tagged per conversation", async () => {
    const result = await call({ chatId: 'chat1', messageId: 'm1' });
    assert.equal(result.body.sent, 3);
    const arabic = google.sent.find((m) => m.token === 'phone-ca1');
    assert.equal(arabic.notification.title, 'Amna · استفسار: Router');
    assert.equal(arabic.notification.body, 'Is it available?');
    assert.deepEqual(arabic.data, { type: 'chat_message', chatId: 'chat1', role: 'company' });
    assert.equal(arabic.android.notification.tag, 'chat_chat1');
    assert.ok(!google.sent.some((m) => m.token === 'phone-ca2'));
  });

  it("the company's reply reaches the customer", async () => {
    const result = await call({ chatId: 'chat1', messageId: 'm2' }, 'token-ca1');
    assert.equal(result.body.sent, 1);
    assert.equal(google.sent[0].token, 'phone-cust1');
    assert.equal(google.sent[0].notification.title, 'Nile Tech · استفسار: Router');
    assert.equal(google.sent[0].data.role, 'customer');
  });
});

describe('texts', () => {
  it('an unknown type, or a type that needs a product name and has none, has no text', () => {
    assert.equal(orderNotificationText({ type: 'something_new', title: 'T', body: 'B' }, 'ar'), null);
    assert.equal(orderNotificationText({ type: 'new_order', title: 'T', body: 'x "Router" y' }, 'en'), null);
    assert.equal(orderNotificationText({ type: 'new_order', productName: '   ' }, 'en'), null);
    assert.equal(orderNotificationText({}, 'en'), null);
  });

  it('each known type is worded from its type and product name only', () => {
    for (const type of [
      'new_order', 'payment_confirmed', 'out_for_delivery', 'technician_assigned', 'new_review', 'review_reply',
    ]) {
      for (const language of ['en', 'ar']) {
        const text = orderNotificationText({ type, productName: 'Router', title: 'T', body: 'B' }, language);
        assert.ok(text.title.length > 0 && text.title !== 'T', `${type} ${language}`);
        assert.match(text.body, /Router/);
        assert.notEqual(text.body, 'B');
      }
    }
    assert.deepEqual(orderNotificationText({ type: 'order_completed' }, 'en'), {
      title: 'Order completed', body: 'Your order has been completed.',
    });
  });

  it('an over-long product name is cut to 200 characters', () => {
    const text = orderNotificationText({ type: 'new_order', productName: 'x'.repeat(5000) }, 'en');
    assert.ok(text.body.length < 300);
  });

  it('long messages are shortened; an order chat has no "Question:"', () => {
    const text = chatMessageText(
      { orderId: 'o1', customerName: '', productName: 'Router' },
      { senderRole: 'customer', text: 'x'.repeat(500) },
      'en',
    );
    assert.equal(text.title, 'Customer · Router');
    assert.equal(text.body.length, 180);
  });
});
