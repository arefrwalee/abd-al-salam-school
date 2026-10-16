/* =====================================================================
   المستودع (Repository) — نسخة في الذاكرة من البيانات المسموح بها للمستخدم
   لا يُكتب أي شيء في LocalStorage. كل تعديل يُمرَّر إلى «المزامن» (Sync):
   - في وضع الخادم: يُرسل للخادم ويُحفظ مشفّرًا على الجهاز للعمل دون اتصال
   - في وضع العرض: يبقى في الذاكرة فقط
   ===================================================================== */
const Mode = { kind: 'demo', offline: false, public: null };
const isServer = () => Mode.kind === 'server';

/* ---------- UI preferences only (theme). No school data is stored here. ---------- */
const Store = (() => {
  const mem = {}; const PERSIST = new Set(['ass:theme']);
  const get = k => { if (k in mem) return mem[k]; if (PERSIST.has(k)) { try { return localStorage.getItem(k); } catch (e) { } } return null; };
  const set = (k, v) => { mem[k] = v; if (PERSIST.has(k)) { try { localStorage.setItem(k, v); } catch (e) { } } };
  const del = k => { delete mem[k]; if (PERSIST.has(k)) { try { localStorage.removeItem(k); } catch (e) { } } };
  const nav = {}; // in-page navigation hints (replaces sessionStorage)
  const ss = { get: k => nav[k] ?? null, set: (k, v) => { nav[k] = v; }, del: k => { delete nav[k]; } };
  return { get, set, del, ss };
})();

/* ---------- Event bus ---------- */
const Bus = (() => {
  const L = {};
  const on = (ev, fn) => (L[ev] = L[ev] || []).push(fn);
  const emit = (ev, p) => (L[ev] || []).forEach(f => { try { f(p); } catch (e) { console.error(e); } });
  return { on, emit };
})();

/* ---------- Memo (invalidated on every data change) ---------- */
let DATA_V = 0;
const MEMO = new Map();
function memo(k, fn) { const m = MEMO.get(k); if (m && m.v === DATA_V) return m.val; const val = fn(); MEMO.set(k, { v: DATA_V, val }); return val; }
const bump = () => { DATA_V++; if (MEMO.size > 4000) MEMO.clear(); };

/* ---------- Repository ---------- */
const SCHEMA_V = '3.1';
const ENTITIES = ['users', 'students', 'parents', 'teachers', 'academicYears', 'classes', 'subjects', 'teachingAssignments', 'periods', 'schedules', 'attendance', 'assessments', 'grades', 'certificates', 'fees', 'payments', 'expenses', 'notifications', 'auditLog'];
const NO_AUDIT = new Set(['auditLog', 'notifications', 'attendance', 'grades']);
const Repo = (() => {
  const data = {}; ENTITIES.forEach(e => data[e] = []);
  let sink = null;
  const now = () => new Date().toISOString();
  const live = r => !r.deletedAt;
  const emitPut = (e, recs) => { bump(); if (sink && e !== 'auditLog') sink(e, recs); Bus.emit(e + ':changed', recs); };
  const all = e => data[e].filter(live);
  const get = (e, id) => id ? (data[e].find(r => r.id === id && !r.deletedAt) || null) : null;
  const where = (e, fn) => data[e].filter(r => live(r) && fn(r));
  function create(e, obj, o = {}) {
    const r = { id: uid(), ...obj, createdAt: now(), updatedAt: now(), createdBy: Auth.userId(), deletedAt: null };
    data[e].push(r); emitPut(e, [r]);
    if (o.audit !== false && !NO_AUDIT.has(e)) Audit.log('create', e, r.id, null, r);
    return r;
  }
  function bulk(e, arr) {
    const t = now(); const by = Auth.userId();
    const out = arr.map(o => ({ id: uid(), ...o, createdAt: t, updatedAt: t, createdBy: by, deletedAt: null }));
    data[e].push(...out); emitPut(e, out); return out;
  }
  function update(e, id, patch, o = {}) {
    const r = data[e].find(x => x.id === id); if (!r) return null;
    const before = { ...r }; Object.assign(r, patch, { updatedAt: now() }); emitPut(e, [r]);
    if (o.audit !== false && !NO_AUDIT.has(e)) Audit.log('update', e, id, before, { ...r });
    return r;
  }
  function remove(e, id, o = {}) {
    const r = data[e].find(x => x.id === id); if (!r) return false;
    const before = { ...r }; r.deletedAt = now(); r.updatedAt = r.deletedAt; emitPut(e, [r]);
    if (o.audit !== false) Audit.log('delete', e, id, before, null);
    return true;
  }
  function restore(e, id) { const r = data[e].find(x => x.id === id); if (r) { r.deletedAt = null; r.updatedAt = now(); emitPut(e, [r]); Audit.log('restore', e, id, null, r); } }
  /** local-only replacement (seed / demo) */
  function hardSet(e, arr) { data[e] = arr; bump(); }
  /** apply a snapshot from the server (full replaces, partial merges by id) */
  function loadSnapshot(obj, full) {
    if (full) ENTITIES.forEach(e => data[e] = Array.isArray(obj[e]) ? obj[e] : []);
    else for (const [e, recs] of Object.entries(obj || {})) {
      if (!data[e] || !Array.isArray(recs) || !recs.length) continue;
      const pos = new Map(data[e].map((r, i) => [r.id, i]));
      for (const r of recs) { const i = pos.get(r.id); if (i === undefined) { pos.set(r.id, data[e].length); data[e].push(r); } else data[e][i] = r; }
    }
    bump();
  }
  function clearAll() { ENTITIES.forEach(e => data[e] = []); bump(); }
  function exportAll() { const o = {}; ENTITIES.forEach(e => o[e] = data[e]); return { app: 'abd-al-salam-school', schema: SCHEMA_V, exportedAt: now(), settings: Settings.get(), data: o }; }
  function importAll(json) {
    if (!json || json.app !== 'abd-al-salam-school' || !json.data) throw new Error('الملف ليس نسخة احتياطية صالحة لهذا النظام');
    ENTITIES.forEach(e => hardSet(e, Array.isArray(json.data[e]) ? json.data[e] : []));
    if (json.settings || json.data.settings) Settings.replace(json.settings || json.data.settings);
  }
  return { all, get, where, create, bulk, update, remove, restore, hardSet, loadSnapshot, clearAll, exportAll, importAll, raw: e => data[e], setSink: fn => { sink = fn; } };
})();

/* ---------- Settings (part of the school data, saved on the server) ---------- */
function currentYearName() { const d = new Date(); const y = d.getFullYear(); return d.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`; }
const DEFAULT_SETTINGS = {
  schoolName: 'مدرسة عبد السلام', schoolNameEn: 'Abd Al-Salam School', systemName: 'نظام إدارة مدرسة عبد السلام الذكي',
  principalName: 'أ. محمود العبد الله', address: 'سوريا', phone: '011-0000000', email: 'info@abdulsalam.edu.sy',
  currency: 'ل.س', academicYear: currentYearName(), termName: 'الفصل الأول', term: 'T1',
  weights: { monthly: 20, midterm: 20, final: 40, homework: 10, activity: 5, participation: 5 },
  passPercent: 50, attendanceAlert: 10, gradeDrop: 15, sessionTimeoutMin: 30,
  schoolDays: [0, 1, 2, 3, 4], teacherEditDays: 3, collectionTarget: 85
};
const Settings = {
  _c: { ...DEFAULT_SETTINGS },
  get() { return this._c; },
  replace(o) { this._c = { ...DEFAULT_SETTINGS, ...(o || {}) }; bump(); },
  save(p) {
    const before = { ...this._c }; this._c = { ...this._c, ...p }; bump();
    if (isServer()) Sync.saveSettings(p).catch(e => { this._c = before; bump(); toast.error('تعذّر حفظ الإعدادات: ' + e.message); render(); });
    else Audit.log('update', 'settings', 'settings', before, this._c);
  }
};

/* ---------- Audit (the server writes its own trusted audit log) ---------- */
const Audit = {
  log(action, entity, entityId, before, after) {
    try {
      if (isServer()) { if (action === 'export' || action === 'print') Sync.sendAudit(action, entityId); return; }
      const strip = o => { if (!o) return null; const c = { ...o }; delete c.passwordHash; delete c.salt; return c; };
      Repo.create('auditLog', { userId: Auth.userId(), action, entity, entityId, before: strip(before), after: strip(after), at: new Date().toISOString() }, { audit: false });
      const arr = Repo.raw('auditLog'); if (arr.length > 1500) arr.splice(0, arr.length - 1500);
    } catch (e) { console.error(e); }
  }
};
