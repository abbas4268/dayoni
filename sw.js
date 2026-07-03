const CACHE = 'abbas-repair-os-v1001';
const ASSETS = ['./','./index.html?v=1001','./style.css?v=1001','./app.js?v=1001','./firebase.js?v=1001','./manifest.json?v=1001'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => { if (e.request.method !== 'GET') return; e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html?v=1001')))); });
