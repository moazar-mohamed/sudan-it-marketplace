/*
 * Keeps the portal's own files on the device so it opens with no network (the
 * jobs themselves come from Firestore's copy on the device). Pages: the network
 * first, the kept copy when offline. Built files (/assets/, named by content):
 * the kept copy first. Nothing else is touched: Firestore, sign-in and the push
 * relay always go to the network. Pushes are shown by /push/push-sw.js.
 */
const CACHE = 'technician-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/og-logo.png', '/favicon-mark.png', '/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/push/') || url.pathname.startsWith('/__/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          await cache.put('/', fresh.clone());
          return fresh;
        } catch {
          return (await caches.match('/')) || Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const kept = await caches.match(request);
        if (kept) return kept;
        const fresh = await fetch(request);
        if (fresh.ok) (await caches.open(CACHE)).put(request, fresh.clone());
        return fresh;
      })(),
    );
  }
});
