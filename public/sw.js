/* Service Worker: يحفظ ملفات الواجهة فقط (لا بيانات) ليفتح التطبيق دون اتصال.
   البيانات نفسها تبقى في الخزنة المشفّرة ولا تمر عبر هذا الملف. */
const CACHE = 'ass-shell-v3.2';
const SHELL = ['./', 'index.html', 'icon.svg', 'manifest.webmanifest',
  'css/fonts.css', 'css/tokens.css', 'css/base.css', 'css/layout.css', 'css/components.css', 'css/pages.css', 'css/sync.css', 'css/print.css', 'css/responsive.css',
  'js/core/utils.js', 'js/core/repo.js', 'js/data/vault.js', 'js/data/sync.js', 'js/core/auth.js', 'js/core/permissions.js', 'js/services/domain.js', 'js/ui/components.js', 'js/data/seed.js', 'js/smart/assistant.js', 'js/pages/shell.js', 'js/pages/academic.js', 'js/pages/evaluation.js', 'js/pages/admin.js', 'js/main.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return; // never cache API data
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
});
