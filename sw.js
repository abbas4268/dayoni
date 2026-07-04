const CACHE = 'abbas-repair-os-v3006';
const ASSETS = [
  './',
  './index.html?v=3006',
  './style.css?v=3006',
  './app.js?v=3006',
  './firebase.js?v=3006',
  './manifest.json?v=3006'
];
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).catch(() =>
      caches.match(e.request).then(r => r || caches.match('./index.html?v=3006'))
    )
  );
});
