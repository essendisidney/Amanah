/* Amanah PWA — installability + light offline shell. */
const SHELL = 'amanah-shell-v3';
const PRECACHE = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.webmanifest')
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API or auth HTML — stale /phone shells caused OTP verify bugs.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/phone') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/auth/')
  ) {
    event.respondWith(fetch(req));
    return;
  }

  // Network-first for navigations and hashed static assets (avoid sticky old JS).
  if (req.mode === 'navigate' || isStaticAsset(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && isStaticAsset(url)) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/'))),
    );
    return;
  }

  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
