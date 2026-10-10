/* ZUSMO SHADOW service worker. Naikkan nomor CACHE setiap kali index.html diperbarui. */
var CACHE = 'zusmo-shadow-v2.0.0';
var CORE = [
  './',
  './index.html',
  './manifest.json',
  './asset/logo.png',
  './asset/icon-180.png',
  './asset/icon-192.png',
  './asset/icon-512.png',
  './asset/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* satu per satu: file yang belum ada (mis. logo) tidak menggagalkan instalasi */
      return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function timeout(ms) { return new Promise(function (_, rej) { setTimeout(rej, ms); }); }

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  var isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;

  /* halaman: coba jaringan dulu, jatuh ke cache saat offline */
  if (req.mode === 'navigate') {
    e.respondWith(
      Promise.race([fetch(req), timeout(4500)]).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (r) {
          return r || caches.match('./index.html');
        });
      })
    );
    return;
  }

  /* aset & font: pakai cache, perbarui di belakang layar */
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
