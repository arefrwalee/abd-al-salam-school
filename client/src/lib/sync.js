import { toast } from './bridge.js';
import { fmtNum, uid } from './utils.js';
import { Bus, ENTITIES, Repo, Settings, DEFAULT_SETTINGS } from './store.js';
import { Vault } from './vault.js';
import { Auth } from './auth.js';

/* =====================================================================
   المزامن (Sync) — الوصلة بين الواجهة والخادم الآمن
   - يرسل كل تعديل إلى /api/ops (الخادم يتحقق من الصلاحيات ويرفض المخالف)
   - يستقبل التحديثات الفورية عبر Server-Sent Events
   - عند انقطاع الاتصال: تُحفظ التعديلات في الخزنة المشفّرة وتُرسل تلقائيًا عند العودة
   ===================================================================== */
async function api(method, path, body) {
  const r = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', headers: { 'X-Requested-With': 'abd-al-salam', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch (e) { }
  return { ok: r.ok, status: r.status, ...j };
}
const Sync = (() => {
  let seq = 0, queue = [], user = null, es = null, flushT = null, pullT = null, flushing = false, retryT = null, fullT = null;
  let state = 'idle'; // idle | online | syncing | offline | auth
  const setState = s => { if (state !== s) { state = s; Bus.emit('sync:state', s); } };
  const vaultState = () => ({ data: Object.fromEntries(ENTITIES.map(e => [e, Repo.raw(e)])), settings: Settings.get(), seq, user: user && user.id });
  function sink(entity, recs) {
    if (!user) return;
    for (const r of recs) { const i = queue.findIndex(q => q.entity === entity && q.record.id === r.id); const op = { entity, record: { ...r } }; if (i >= 0) queue[i] = op; else queue.push(op); }
    Vault.saveOutboxSoon(queue); Vault.saveSnapshotSoon(vaultState); Bus.emit('sync:state', state);
    clearTimeout(flushT); flushT = setTimeout(flush, 250);
  }
  async function flush() {
    if (!queue.length || flushing || state === 'offline' || state === 'auth') return;
    flushing = true; setState('syncing');
    const batch = queue.slice(0, 2000);
    try {
      const r = await api('POST', 'api/ops', { ops: batch });
      if (r.status === 401) { setState('auth'); onAuthLost(); return; }
      queue.splice(0, batch.length); Vault.saveOutboxSoon(queue);
      if (!r.ok) { toast.error('رفض الخادم التعديلات: ' + (r.error || r.status)); await pull(true); }
      else {
        const errs = (r.results || []).filter(x => x.error);
        if (errs.length) { toast.error('لم يُحفظ ' + fmtNum(errs.length) + ' تعديل: ' + errs[0].error); await pull(true); }
      }
      setState('online');
    } catch (e) { goOffline(); }
    finally { flushing = false; if (queue.length && state === 'online') { clearTimeout(flushT); flushT = setTimeout(flush, 50); } Bus.emit('sync:state', state); }
  }
  async function pull(full) {
    const fam = user && (user.role === 'student' || user.role === 'parent');
    const r = await api('GET', 'api/sync?since=' + (full || fam ? 0 : seq));
    if (r.status === 401) { setState('auth'); onAuthLost(); return false; }
    if (!r.ok) throw new Error(r.error || 'sync failed');
    const sig = x => { if (!x) return ''; const { updatedAt, createdAt, createdBy, ...rest } = x; void updatedAt; void createdAt; void createdBy; return JSON.stringify(rest); };
    let foreign = JSON.stringify({ ...DEFAULT_SETTINGS, ...r.settings }) !== JSON.stringify(Settings.get());
    if (!foreign) for (const e of ENTITIES) {
      const inc = (r.data || {})[e]; if (!inc) continue; const loc = Repo.raw(e);
      if (r.full && inc.length !== loc.length) { foreign = true; break; }
      const m = new Map(loc.map(x => [x.id, x]));
      if (inc.some(rec => sig(m.get(rec.id)) !== sig(rec))) { foreign = true; break; }
    }
    Repo.loadSnapshot(r.data, r.full);
    if (r.full && queue.length) { const g = {}; queue.forEach(q => (g[q.entity] = g[q.entity] || []).push(q.record)); Repo.loadSnapshot(g, false); }
    Settings.replace(r.settings); seq = r.seq;
    Vault.saveSnapshotSoon(vaultState);
    if (foreign) Bus.emit('remote', 'sync');
    return true;
  }
  function schedulePull() { clearTimeout(pullT); pullT = setTimeout(() => { if (state !== 'offline' && state !== 'auth') pull(false).catch(goOffline); }, 350); }
  function connectEvents() {
    if (es) es.close();
    try {
      es = new EventSource('api/events');
      es.addEventListener('change', e => { try { const s = JSON.parse(e.data).seq; if (s > seq) schedulePull(); } catch (x) { } });
      es.addEventListener('reset', () => { Auth.logout('أعادت الإدارة تهيئة البيانات أو استعادت نسخة احتياطية. سجّل الدخول من جديد.'); });
      es.onopen = () => { if (state === 'offline') reconnected(); };
      es.onerror = () => { if (!navigator.onLine) goOffline(); };
    } catch (e) { }
  }
  function goOffline() { if (!user) return; setState('offline'); Vault.saveOutboxSoon(queue); clearInterval(retryT); retryT = setInterval(tryReconnect, 10000); }
  async function tryReconnect() {
    try { const r = await api('GET', 'api/me'); if (r.status === 401) { clearInterval(retryT); setState('auth'); onAuthLost(); return; } if (r.ok) await reconnected(); } catch (e) { }
  }
  async function reconnected() {
    clearInterval(retryT); setState('online');
    const n = queue.length; await flush(); await pull(true).catch(() => { });
    connectEvents(); if (n) toast.success('عاد الاتصال وتمت مزامنة ' + fmtNum(n) + ' تعديل.');
  }
  async function start(u) {
    user = u; setState('syncing');
    const pending = await Vault.loadOutbox(); if (pending.length) queue = pending.concat(queue);
    await pull(true); setState('online');
    if (queue.length) flush();
    connectEvents();
    clearInterval(fullT); fullT = setInterval(() => { if (state === 'online') pull(true).catch(goOffline); }, 5 * 60e3);
  }
  function startOffline(u, r) {
    user = u; seq = r.seq || 0; queue = r.outbox || [];
    Repo.loadSnapshot(r.data, true); Settings.replace(r.settings);
    goOffline();
  }
  async function stop() {
    clearTimeout(flushT); clearTimeout(pullT); clearInterval(retryT); clearInterval(fullT);
    if (queue.length && state === 'online') { try { await flush(); } catch (e) { } }
    await Vault.saveNow(user ? vaultState() : null, queue);
    if (es) { es.close(); es = null; }
    user = null; queue = []; seq = 0; setState('idle');
  }
  /** الجلسة انتهت أثناء العمل: تطلب الواجهة كلمة المرور عبر <ReauthModal/> دون فقدان التعديلات */
  function onAuthLost() { if (Auth.current()) Bus.emit('auth:lost', { pending: queue.length }); }
  async function resume(user, cacheKey, password) {
    await Vault.openFor(user, cacheKey, password); setState('online'); await flush(); await pull(true); connectEvents();
  }
  async function saveSettings(p) { const r = await api('PUT', 'api/settings', { settings: p }); if (!r.ok) throw new Error(r.error || 'خطأ'); Settings.replace(r.settings); return r; }
  function sendAudit(action, entityId) { if (!user) return; api('POST', 'api/ops', { ops: [{ entity: 'auditLog', record: { id: uid(), action, entityId: String(entityId || '') } }] }).catch(() => { }); }
  window.addEventListener('online', () => { if (user && state === 'offline') tryReconnect(); });
  window.addEventListener('offline', () => { if (user) goOffline(); });
  return { sink, flush, pull, start, startOffline, stop, saveSettings, sendAudit, resume, get state() { return state; }, get pending() { return queue.length; } };
})();

export { Sync, api };
