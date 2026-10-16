/* =====================================================================
   الإقلاع: اختيار الوضع
   - خادم المدرسة متاح  → وضع الخادم (حفظ آمن + نسخة مشفّرة دون اتصال)
   - الخادم غير متاح لكن توجد نسخة مشفّرة → دخول دون اتصال
   - غير ذلك (فتح الملف مباشرة أو المعاينة) → وضع العرض في الذاكرة
   ===================================================================== */
async function detectMode() {
  if (!/^https?:$/.test(location.protocol)) return 'demo';
  try {
    const r = await fetch('api/public', { credentials: 'same-origin', cache: 'no-store', headers: { 'X-Requested-With': 'abd-al-salam' } });
    if (r.ok) { const j = await r.json(); if (j && j.app === 'abd-al-salam-school') { Mode.public = j; return 'server'; } }
    return 'demo';
  } catch (e) {
    if (await Vault.hasAny()) { Mode.offline = true; Mode.public = { schoolName: 'مدرسة عبد السلام', stats: {} }; return 'server'; }
    return 'demo';
  }
}
async function bootSeed(force) {
  const root = ROOT();
  const bar = h('div', { class: 'prog', style: { width: '220px' } }, h('i', { style: { width: '0%' } }));
  root.replaceChildren(h('div', { class: 'boot' }, h('div', { class: 'boot-card' }, h('div', { class: 'crest lg' }, h('i'), h('i'), h('i')), h('b', { style: { font: '600 20px var(--f-display)' } }, 'مدرسة عبد السلام'), h('div', { class: 'muted' }, force ? 'جارٍ إعادة إنشاء البيانات التجريبية...' : 'جارٍ تجهيز وضع العرض...'), bar)));
  await new Promise(r => setTimeout(r, 30));
  await seedDemo(p => { bar.firstChild.style.width = p + '%'; });
}
async function boot() {
  applyTheme();
  ROOT().replaceChildren(h('div', { class: 'boot' }, h('div', { class: 'boot-card' }, h('div', { class: 'spinner' }), h('div', { class: 'muted' }, 'جارٍ الاتصال بخادم المدرسة...'))));
  Mode.kind = await detectMode();
  if (Mode.kind === 'demo') {
    try { await bootSeed(false); } catch (e) { console.error(e); ROOT().replaceChildren(h('div', { class: 'boot' }, emptyState('تعذّر تجهيز البيانات: ' + e.message, null, 'alert'))); return; }
    App.user = null; render(); return;
  }
  if ('serviceWorker' in navigator && window.isSecureContext) { try { navigator.serviceWorker.register('sw.js'); } catch (e) { } }
  App.user = await Auth.restore();
  render();
  if (App.user && App.user.mustChangePassword) { location.hash = '#profile'; toast.warning('يُرجى تغيير كلمة المرور المؤقتة الآن.'); }
}
// idle session timeout (the server enforces it too)
let idleWarned = false;
['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(ev => document.addEventListener(ev, () => { Auth.touch(); idleWarned = false; }, { passive: true }));
setInterval(() => {
  if (!App.user || isServer()) return; // in server mode the server expires idle sessions and the app asks for the password again
  const lim = Settings.get().sessionTimeoutMin * 60000; const idle = Auth.idleMs();
  if (idle > lim) Auth.logout('انتهت الجلسة بعد فترة خمول. سجّل الدخول من جديد.');
  else if (idle > lim - 60000 && !idleWarned) { idleWarned = true; toast.warning('ستنتهي الجلسة خلال دقيقة بسبب الخمول. حرّك المؤشر للبقاء متصلًا.'); }
}, 15000);
if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => refreshTopbar()); } catch (e) { } }
boot();
