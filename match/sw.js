/* LUMISS · /match do evento da Shopee — guarda o site no tablet para abrir mesmo sem internet (as 20 fotos inclusive).
   O cadastro (POST para o LUMISS OS) nunca passa por aqui: quem segura sem internet é o comum/cadastro.js.
   Troque a VERSAO sempre que publicar arquivos novos. */
var VERSAO = 'lumiss-match-shopee-2026-11-04-2';
var FOTOS = ['SG7.png', 'MEL3.png', 'LARA2.png', 'TATI1.png', 'TATI2.jpg', 'LILA1.png', 'DUDA1.png', 'CH3.png', 'JELLY1.png', 'JELLY3.jpg',
  'ROSA1.png', 'ROSA2.png', 'DORA1.png', 'DORA2.png', 'IRIS1.png', 'GIN5.jpg', 'GIN7.jpg', 'TAM3.jpg', 'SG3.png', 'MEL2.png'];
var ESSENCIAIS = ['./', './styles.css', './app.js', './config.js', './logo.svg', './manifest.webmanifest',
  '../comum/cadastro.js', '../favicon.png', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png']
  .concat(FOTOS.map(function (f) { return './produtos/' + f; }));

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
  var mesmaOrigem = url.origin === self.location.origin;
  var fonte = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!mesmaOrigem && !fonte) return;

  if (req.mode === 'navigate') {
    ev.respondWith(fetch(req).then(function (resp) {
      var copia = resp.clone();
      if (resp.ok && !resp.redirected) caches.open(VERSAO).then(function (c) { c.put('./', copia); });
      return resp;
    }).catch(function () { return caches.match('./'); }));
    return;
  }

  // O que está guardado responde na hora; a rede atualiza a cópia por trás.
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
