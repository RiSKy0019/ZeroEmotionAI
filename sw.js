/* ============================================================
   sw.js — service worker for offline / installable PWA
   - Navigations: network-first (so new deploys show), cache fallback.
   - Assets (local + CDN): cache-first, runtime-cached on first load.
   Bump CACHE when shipping a new version to evict old assets.
   ============================================================ */
var CACHE = 'zea-v4';
var CORE = ['./', './index.html', './assets/css/app.css', './manifest.webmanifest', './assets/icon.svg'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE).catch(function () {}); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  // network-first for page navigations
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (m) { return m || caches.match('./index.html'); });
      })
    );
    return;
  }

  // cache-first for assets (same-origin + CDN), populate cache on first fetch
  e.respondWith(
    caches.match(req).then(function (m) {
      if (m) return m;
      return fetch(req).then(function (res) {
        try { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); } catch (e2) {}
        return res;
      }).catch(function () { return m; });
    })
  );
});
