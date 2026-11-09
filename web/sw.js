const V = 'rb-v33';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'voice.js', 'sync.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'data/bible.json', 'data/kozlov_timings.json', 'data/web.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// App files: network first (so updates show), fall back to cache offline. Data files: cache first, cached on first use.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET') return;
  const put = r => { if (r.ok) { const cl = r.clone(); caches.open(V).then(c => c.put(e.request, cl)); } return r; };
  if (u.pathname.includes('/data/')) {
    e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(r => r || fetch(e.request).then(put)));
  } else {
    e.respondWith(fetch(e.request).then(put).catch(() => caches.match(e.request, {ignoreSearch: true})));
  }
});
