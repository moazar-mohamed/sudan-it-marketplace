// The push relay: the app calls it right after it wrote a notification or a
// chat message, and it sends that one thing to the recipients' phones.
//
// It never sends text it was handed. It only relays what is already in
// Firestore (where the security rules decided who may write it), only for the
// signed-in person who wrote it, only while it is fresh, and only once.

import { createFirestore, createTokenSource } from './google.js';
import { chatMessageText, languageOf, orderNotificationText } from './texts.js';

/** How long after it was written something may still be pushed. */
const MAX_AGE_MS = 10 * 60 * 1000;

/** The Android channel the app creates (MainActivity.kt). */
const ANDROID_CHANNEL = 'general';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function reply(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

/**
 * env: PROJECT_ID, FIREBASE_API_KEY, SERVICE_ACCOUNT_JSON, and for local tests
 * FIRESTORE_EMULATOR_HOST / AUTH_EMULATOR_HOST.
 */
export function createRelay(env, { fetch = globalThis.fetch, now = Date.now, log = () => {} } = {}) {
  const serviceAccount = JSON.parse(env.SERVICE_ACCOUNT_JSON);
  const projectId = env.PROJECT_ID || serviceAccount.project_id;
  const accessToken = createTokenSource(serviceAccount, { fetch, now });
  const db = createFirestore({
    projectId,
    emulatorHost: env.FIRESTORE_EMULATOR_HOST,
    accessToken,
    fetch,
  });

  /** The uid behind a Firebase ID token, or null when it is not valid. */
  async function verifiedUid(idToken) {
    const root = env.AUTH_EMULATOR_HOST
      ? `http://${env.AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com`
      : 'https://identitytoolkit.googleapis.com';
    const response = await fetch(`${root}/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!response.ok) return null;
    const user = (await response.json()).users?.[0];
    return user && !user.disabled ? user.localId : null;
  }

  /** Each recipient's uid, device tokens and language. */
  async function usersByIds(uids) {
    const users = await Promise.all(
      uids.map(async (uid) => ({ uid, ...((await db.get(`users/${uid}`)) ?? {}) })),
    );
    return users;
  }

  async function companyAdmins(companyId) {
    const admins = await db.where('users', { role: 'company_admin', companyId });
    return admins.map((user) => ({ uid: user.id, ...user }));
  }

  async function recipientsOf(notification) {
    switch (notification.recipientType) {
      case 'customer':
        return usersByIds([notification.recipientId]);
      case 'company_admin':
        return companyAdmins(notification.recipientId);
      case 'technician': {
        const technician = await db.get(`technicians/${notification.recipientId}`);
        if (!technician) return [];
        if (technician.uid) return usersByIds([technician.uid]);
        if (!technician.email) return [];
        const users = await db.where('users', {
          role: 'technician',
          email: technician.email,
          companyId: technician.companyId,
        });
        return users.map((user) => ({ uid: user.id, ...user }));
      }
      default:
        return [];
    }
  }

  /**
   * Sends one message per device token. Tokens FCM reports as gone are
   * removed from the user's profile.
   */
  async function sendTo(recipients, build) {
    let sent = 0;
    let failed = 0;
    for (const recipient of recipients) {
      const tokens = [...new Set(recipient.fcmTokens ?? [])].filter(
        (token) => typeof token === 'string' && token.length > 0,
      );
      if (tokens.length === 0) continue;
      const { title, body, data, tag } = build(recipient);
      const gone = [];
      for (const token of tokens) {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${await accessToken()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title, body },
                data,
                android: {
                  priority: 'HIGH',
                  notification: {
                    channel_id: ANDROID_CHANNEL,
                    ...(tag ? { tag } : {}),
                  },
                },
                apns: { payload: { aps: { sound: 'default' } } },
              },
            }),
          },
        );
        if (response.ok) {
          sent++;
          continue;
        }
        failed++;
        const error = (await response.json().catch(() => ({})))?.error ?? {};
        const code = (error.details ?? []).find((d) => d.errorCode)?.errorCode;
        log(`fcm ${response.status} ${code ?? error.status ?? ''} for ${recipient.uid}`);
        if (response.status === 404 || code === 'UNREGISTERED') gone.push(token);
      }
      if (gone.length > 0) {
        await db.removeFromArray(`users/${recipient.uid}`, 'fcmTokens', gone);
      }
    }
    return { sent, failed };
  }

  function isFresh(createdAt) {
    return createdAt instanceof Date && now() - createdAt.getTime() <= MAX_AGE_MS;
  }

  async function pushNotification(uid, notificationId) {
    const notification = await db.get(`notifications/${notificationId}`);
    if (!notification) return reply(404, { error: 'not_found' });
    if (notification.senderId !== uid) return reply(403, { error: 'not_sender' });
    if (!isFresh(notification.createdAt)) return reply(409, { error: 'too_old' });
    const logPath = `push_log/n_${notificationId}`;
    if (!(await db.createOnce(logPath, { kind: 'notification', by: uid, at: new Date(now()) }))) {
      return reply(200, { skipped: 'already_sent' });
    }
    const recipients = await recipientsOf(notification);
    const result = await sendTo(recipients, (recipient) => ({
      ...orderNotificationText(notification, languageOf(recipient)),
      data: {
        type: String(notification.type ?? ''),
        notificationId,
        orderId: String(notification.orderId ?? ''),
        recipientType: String(notification.recipientType ?? ''),
      },
    }));
    await db.merge(logPath, result);
    return reply(200, result);
  }

  async function pushChatMessage(uid, chatId, messageId) {
    const [chat, message] = await Promise.all([
      db.get(`chats/${chatId}`),
      db.get(`chats/${chatId}/messages/${messageId}`),
    ]);
    if (!chat || !message) return reply(404, { error: 'not_found' });
    if (message.senderId !== uid) return reply(403, { error: 'not_sender' });
    if (!isFresh(message.createdAt)) return reply(409, { error: 'too_old' });
    const logPath = `push_log/m_${chatId}_${messageId}`;
    if (!(await db.createOnce(logPath, { kind: 'chat', by: uid, at: new Date(now()) }))) {
      return reply(200, { skipped: 'already_sent' });
    }
    const toCompany = message.senderRole === 'customer';
    const recipients = toCompany
      ? await companyAdmins(chat.companyId)
      : await usersByIds([chat.customerId]);
    const result = await sendTo(recipients, (recipient) => ({
      ...chatMessageText(chat, message, languageOf(recipient)),
      data: {
        type: 'chat_message',
        chatId,
        role: toCompany ? 'company' : 'customer',
      },
      // A newer message from the same conversation replaces the older one.
      tag: `chat_${chatId}`,
    }));
    await db.merge(logPath, result);
    return reply(200, result);
  }

  return async function handle(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/push') {
      return reply(404, { error: 'not_found' });
    }
    const idToken = /^Bearer (.+)$/.exec(request.headers.get('Authorization') ?? '')?.[1];
    if (!idToken) return reply(401, { error: 'unauthenticated' });
    let body;
    try {
      body = await request.json();
    } catch {
      return reply(400, { error: 'bad_request' });
    }
    const isId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value);
    const wantsNotification = isId(body?.notificationId);
    const wantsChat = isId(body?.chatId) && isId(body?.messageId);
    if (wantsNotification === wantsChat) return reply(400, { error: 'bad_request' });

    try {
      const uid = await verifiedUid(idToken);
      if (!uid) return reply(401, { error: 'unauthenticated' });
      return wantsNotification
        ? await pushNotification(uid, body.notificationId)
        : await pushChatMessage(uid, body.chatId, body.messageId);
    } catch (error) {
      log(`relay error: ${error?.message ?? error}`);
      return reply(502, { error: 'upstream' });
    }
  };
}
