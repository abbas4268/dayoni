const CACHE = 'abbas-repair-os-v3001';
const ASSETS = [
  './',
  './index.html?v=3001',
  './style.css?v=3001',
  './app.js?v=3001',
  './firebase.js?v=3001',
  './manifest.json?v=3001'
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
  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).catch(() =>
      caches.match(e.request).then(r => r || caches.match('./index.html?v=3001'))
    )
  );
});