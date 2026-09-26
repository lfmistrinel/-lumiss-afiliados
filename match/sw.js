/* LUMISS · Match de Verão — guarda o site no aparelho pra abrir mesmo sem internet.
   Troque a VERSAO sempre que publicar arquivos novos. */
var VERSAO = 'lumiss-afiliadas-2026-09-25-211835';
var ESSENCIAIS = ['./', './styles.css', './app.js', './config.js', './qr.svg', './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(ESSENCIAIS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (chaves) {
    return Promise.all(chaves.filter(function (k) { return k !== VERSAO; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // A planilha (Apps Script) sempre vai direto pra rede.
  if (/(^|\.)script\.google(usercontent)?\.com$/.test(url.hostname) || /googleusercontent\.com$/.test(url.hostname)) return;
  var mesmaOrigem = url.origin === self.location.origin;
  var fonte = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  var foto = req.destination === 'image';
  if (!mesmaOrigem && !fonte && !foto) return;
  if (mesmaOrigem && url.pathname.indexOf('/api') === 0) return;

  if (req.mode === 'navigate') {
    ev.respondWith(fetch(req).then(function (resp) {
      var copia = resp.clone();
      if (resp.ok && !resp.redirected) caches.open(VERSAO).then(function (c) { c.put('./', copia); });
      return resp;
    }).catch(function () {
      return caches.match('./');
    }));
    return;
  }

  ev.respondWith(caches.open(VERSAO).then(function (cache) {
    return cache.match(req, { ignoreSearch: mesmaOrigem }).then(function (guardado) {
      var daRede = fetch(req).then(function (resp) {
        if (resp && (resp.ok || resp.type === 'opaque')) cache.put(req, resp.clone());
        return resp;
      }).catch(function () { return guardado; });
      return guardado || daRede;
    });
  }));
});
