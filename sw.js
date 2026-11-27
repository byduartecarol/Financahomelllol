// Service worker: guarda os arquivos do app pra funcionar sem internet.
// IMPORTANTE: a cada nova versão publicada, aumente o número abaixo.
const VERSION = 'fc-v19';
const FILES = [
  './',
  'index.html',
  'styles.css?v=0.10.0',
  'manifest.webmanifest',
  'js/db.js?v=0.10.0',
  'js/security.js?v=0.10.0',
  'js/pets.js?v=0.10.0',
  'js/money.js?v=0.10.0',
  'js/charts.js?v=0.10.0',
  'js/lanc.js?v=0.10.0',
  'js/app.js?v=0.10.0',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rede primeiro (pega atualizações), cache se estiver sem internet.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    // no-cache: sempre confere com o servidor se tem arquivo novo (evita misturar versão velha e nova)
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});
