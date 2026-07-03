const CACHE = 'abbas-repair-os-v1003';
const ASSETS = [
  './',
  './index.html?v=1003',
  './style.css?v=1003',
  './app.js?v=1003',
  './firebase.js?v=1003',
  './manifest.json?v=1003'
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
    fetch(e.request).catch(() =>
      caches.match(e.request).then(r => r || caches.match('./index.html?v=1003'))
    )
  );
});