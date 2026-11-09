/* Sudan ICT Marketplace - service worker.
   Online: always loads the newest site from the network (so a Netlify redeploy updates the app).
   Offline: falls back to the last copy saved on the phone. Firebase, other sites and downloads are never cached. */
const CACHE = 'sictm-v3';
const CORE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isHtml = res => res.ok && (res.headers.get('content-type') || '').includes('text/html');

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // Let downloads (the Android APK and its short links) go straight to the network.
  if (url.pathname.startsWith('/download/') || url.pathname === '/app' || url.pathname === '/android') return;
  // Firebase sign-in helper pages (Google login window): never cache, never treat as the home page.
  if (url.pathname.startsWith('/__/')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => { if (isHtml(res)) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('/', copy)); } return res; })
        .catch(() => caches.match('/'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
