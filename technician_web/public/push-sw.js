/*
 * Shows the pushes the relay (push_relay/) sends to this browser while no page
 * of the technician portal is in front, and opens the right page when one is
 * pressed. A plain worker: no library, no caching, and its scope (/push/) holds
 * no page, so it never stands between the portal and the network.
 */

// Where a pressed push leads in the technician portal, from what the relay put in its data.
function targetOf(data) {
  if (data.type === 'job_chat_message' && data.orderId) return `/chats/${encodeURIComponent(data.orderId)}`;
  if (data.orderId) return `/jobs/${encodeURIComponent(data.orderId)}`;
  return '/notifications';
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const notification = payload.notification || {};
  const data = payload.data || {};
  event.waitUntil(
    (async () => {
      // A page of the portal in front shows it its own way (its list and badges).
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.some((w) => w.visibilityState === 'visible' && w.focused)) return;
      await self.registration.showNotification(notification.title || 'Sudan ICT Marketplace', {
        body: notification.body || '',
        icon: notification.icon || '/favicon-mark.png',
        badge: '/favicon-mark.png',
        dir: 'auto',
        ...(notification.tag ? { tag: notification.tag, renotify: true } : {}),
        data,
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = targetOf(event.notification.data || {});
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        // The open tab moves to the page itself (no reload, nothing typed is lost).
        new BroadcastChannel('push-open').postMessage({ path });
        return open.focus();
      }
      return self.clients.openWindow(path);
    })(),
  );
});
