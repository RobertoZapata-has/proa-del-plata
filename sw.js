// Proa del Plata · service worker
// Cambiar VERSION cada vez que se publica, para que los celulares bajen lo nuevo.
const VERSION = 'pdp-2026-10-17a';
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './js/app.js', './js/reglas.js', './js/ia.js', './js/escena.js', './js/barcos.js', './js/sonido.js', './js/red.js',
  './iconos/icon-192.png', './iconos/icon-512.png', './iconos/icon-maskable-512.png',
];
const CDN = ['https://cdn.jsdelivr.net/', 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // La página y el código: primero internet (para recibir actualizaciones), si no hay, lo guardado.
  if (req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('.js'))) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req.mode === 'navigate' ? './index.html' : req, copy)); } return r; })
      .catch(() => caches.match(req.mode === 'navigate' ? './index.html' : req, { ignoreSearch: true })));
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r;
    })));
    return;
  }
  // Librerías y tipografías: lo guardado al instante y se actualiza por detrás.
  if (CDN.some(p => req.url.startsWith(p))) {
    e.respondWith(caches.open(VERSION).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
  }
  // El servidor de conexión online va directo a internet.
});
