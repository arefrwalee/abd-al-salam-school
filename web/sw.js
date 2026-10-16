/* Service Worker: يحفظ ملفات الواجهة فقط (لا بيانات) ليفتح التطبيق دون اتصال.
   البيانات نفسها تبقى في الخزنة المشفّرة ولا تمر عبر هذا الملف. */
const CACHE = 'ass-shell-v4.0';
const SHELL = ['./', 'index.html', 'icon.svg', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return; // never cache API data
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
});
