'use strict';
/* =====================================================================
   خادم نظام إدارة مدرسة عبد السلام الذكي
   Node.js فقط (بدون أي حزم خارجية): http + sqlite + crypto
   التشغيل: node server/server.js   ثم افتح http://localhost:8080
   ===================================================================== */
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('./config');
const { SecureStore } = require('./db');
const A = require('./auth');
const P = require('./policy');

process.removeAllListeners('warning');
process.on('warning', w => { if (w.name !== 'ExperimentalWarning') console.warn(w); });

const store = new SecureStore(C.DATA_DIR, C.ENTITIES);
const TLS = !!(C.TLS_CERT && C.TLS_KEY);
const NO_AUDIT = new Set(['auditLog', 'notifications', 'attendance', 'grades']);
const now = () => new Date().toISOString();
const settings = () => store.settings || {};

/* ---------- helpers ---------- */
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  ...(TLS ? { 'Strict-Transport-Security': 'max-age=31536000' } : {})
};
function send(res, status, body, headers = {}) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { ...SEC_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}
const fail = (res, status, msg, extra) => send(res, status, { error: msg, ...extra });
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > C.MAX_BODY) { reject(Object.assign(new Error('الطلب كبير جدًا'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(Object.assign(new Error('صيغة JSON غير صالحة'), { status: 400 })); } });
    req.on('error', reject);
  });
}
const ipOf = req => (req.socket.remoteAddress || '').replace('::ffff:', '');
const limits = new Map();
function rateLimit(key, max, windowMs) {
  const t = Date.now(); const r = limits.get(key);
  if (!r || r.reset < t) { limits.set(key, { n: 1, reset: t + windowMs }); return true; }
  r.n++; return r.n <= max;
}
setInterval(() => { const t = Date.now(); for (const [k, v] of limits) if (v.reset < t) limits.delete(k); store.purgeSessions(); }, 60e3).unref();
const sanitizeAudit = o => { if (!o) return null; const c = { ...o }; delete c.passwordHash; delete c.salt; delete c._cacheKey; delete c._seq; return c; };
function audit(userId, action, entity, entityId, before, after) {
  store.put('auditLog', { id: crypto.randomBytes(9).toString('base64url'), userId, action, entity, entityId, before: sanitizeAudit(before), after: sanitizeAudit(after), at: now(), createdAt: now(), updatedAt: now(), createdBy: userId, deletedAt: null });
}
function userView(u) { return P.clean(u, 'users', u); }
function findUserByLogin(login) { const k = String(login || '').trim().toLowerCase(); if (!k) return null; return store.live('users').find(u => u.username.toLowerCase() === k || (u.email && u.email.toLowerCase() === k)) || null; }
function nextUsername(prefix) { const names = new Set([...store.map('users').values()].map(u => u.username)); let n = [...names].filter(x => x.startsWith(prefix)).length + 1; while (names.has(prefix + n)) n++; return prefix + n; }
function ensureCacheKey(u) { if (u._cacheKey) return u._cacheKey; const k = crypto.randomBytes(32).toString('base64'); store.tx(() => store.put('users', { ...u, _cacheKey: k })); return k; }

/* ---------- session ---------- */
function auth(req) {
  const token = A.parseCookies(req.headers.cookie).sid; if (!token) return null;
  const s = store.getSession(token); if (!s) return null;
  const t = Date.now();
  const idleMin = Number(settings().sessionTimeoutMin || 30);
  if (s.expires_at < t || (!s.remember && t - s.last_seen > idleMin * 60e3)) { store.deleteSession(token); return null; }
  const u = store.get('users', s.user_id); if (!u || u.deletedAt || !u.isActive) { store.deleteSession(token); return null; }
  if (t - s.last_seen > 30e3) store.touchSession(token);
  return { user: u, token, session: s };
}
function csrfOk(req) {
  if (req.headers['x-requested-with'] !== 'abd-al-salam') return false;
  const origin = req.headers.origin; if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch (e) { return false; }
}

/* ---------- live updates (Server-Sent Events) ---------- */
const sse = new Set();
function broadcast(kind = 'change') { const msg = `event: ${kind}\ndata: ${JSON.stringify({ seq: store.seq })}\n\n`; for (const c of sse) { try { c.res.write(msg); } catch (e) { sse.delete(c); } } }
setInterval(() => { for (const c of sse) { try { c.res.write(': ping\n\n'); } catch (e) { sse.delete(c); } } }, 25e3).unref();

/* ---------- dataset import (setup / reset / restore) ---------- */
function validDataset(ds) {
  if (!ds || typeof ds !== 'object' || !ds.data || typeof ds.data !== 'object') return 'بيانات غير صالحة';
  for (const e of C.ENTITIES) { const arr = ds.data[e]; if (arr === undefined) continue; if (!Array.isArray(arr)) return 'بيانات غير صالحة: ' + e; for (const r of arr) if (!r || typeof r.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(r.id)) return 'معرّف غير صالح في ' + e; }
  return null;
}
async function rehashUsers(users, adminUsername, adminPassword) {
  const out = []; let adminDone = false; const queue = [...users];
  const worker = async () => { while (queue.length) { const u = queue.shift(); const c = { ...u }; delete c.salt; delete c._cacheKey;
    let pw = C.DEMO_PW[c.role] || A.generatePassword();
    if (c.role === 'admin' && !adminDone && (c.username === 'admin' || adminUsername)) { adminDone = true; c.username = adminUsername || c.username; pw = adminPassword; c.mustChangePassword = false; }
    c.passwordHash = await A.hashPassword(pw); c.failedAttempts = 0; c.lockedUntil = null; c.lastLogin = null; out.push(c); } };
  await Promise.all(Array.from({ length: 6 }, worker));
  return out;
}

/* ---------- API routes ---------- */
const routes = {
  'GET /api/health': (req, res) => send(res, 200, { ok: true, seq: store.seq }),

  'GET /api/public': (req, res) => {
    const S = settings(); const users = store.live('users');
    const lastDay = [...store.map('attendance').values()].reduce((m, r) => (!r.deletedAt && r.date > m ? r.date : m), '');
    const recs = lastDay ? [...store.map('attendance').values()].filter(r => r.date === lastDay && !r.deletedAt) : [];
    const rate = recs.length ? (recs.filter(r => r.status === 'present' || r.status === 'excused').length + recs.filter(r => r.status === 'late').length * 0.5) / recs.length * 100 : null;
    send(res, 200, { app: 'abd-al-salam-school', needsSetup: !users.length, secure: TLS || ['localhost', '127.0.0.1'].includes(String(req.headers.host || '').split(':')[0]), schoolName: S.schoolName || 'مدرسة عبد السلام', schoolNameEn: S.schoolNameEn || 'Abd Al-Salam School', academicYear: S.academicYear || '', termName: S.termName || '', demo: !!S.demoData, stats: { students: store.live('students').filter(s => s.status === 'active').length, classes: store.live('classes').length, attendanceRate: rate } });
  },

  'POST /api/setup': async (req, res, body) => {
    if (store.live('users').length) return fail(res, 409, 'تم إعداد النظام مسبقًا');
    if (!rateLimit('setup:' + ipOf(req), 10, 600e3)) return fail(res, 429, 'محاولات كثيرة، انتظر قليلًا');
    const { adminUsername, adminPassword, schoolName, dataset, demo } = body;
    if (!/^[a-z0-9._-]{3,30}$/i.test(adminUsername || '')) return fail(res, 400, 'اسم دخول المدير: حروف لاتينية وأرقام (3–30)');
    const pr = A.passwordRule(adminPassword); if (pr) return fail(res, 400, pr);
    const v = validDataset(dataset); if (v) return fail(res, 400, v);
    const data = { ...dataset.data };
    let users = (data.users || []).filter(u => C.DEMO_PW[u.role]);
    if (!users.some(u => u.role === 'admin')) users.unshift({ id: crypto.randomBytes(9).toString('base64url'), username: adminUsername, email: '', role: 'admin', linkedId: null, isActive: true, prefs: {}, createdAt: now(), updatedAt: now(), createdBy: null, deletedAt: null });
    data.users = await rehashUsers(users, adminUsername, adminPassword);
    data.auditLog = [];
    const S = { ...(dataset.settings || {}), schoolName: String(schoolName || (dataset.settings || {}).schoolName || 'مدرسة عبد السلام').slice(0, 120), demoData: !!demo };
    store.replaceAll(data, S);
    store.tx(() => audit(data.users.find(u => u.role === 'admin').id, 'create', 'system', 'setup', null, { demo: !!demo, records: store.count() }));
    console.log('✔ تم الإعداد الأول:', store.count(), 'سجلًا', demo ? '(بيانات تجريبية)' : '');
    autoBackup();
    send(res, 200, { ok: true });
  },

  'POST /api/login': async (req, res, body) => {
    const ip = ipOf(req);
    if (!rateLimit('login:' + ip, 20, 600e3)) return fail(res, 429, 'محاولات دخول كثيرة من هذا الجهاز. انتظر 10 دقائق.');
    const u = findUserByLogin(body.username);
    const generic = 'اسم المستخدم أو كلمة المرور غير صحيحة.';
    if (!u) { await A.verifyPassword(body.password || '', A.DUMMY_HASH); return fail(res, 401, generic); }
    if (!u.isActive) return fail(res, 403, 'هذا الحساب معطّل. تواصل مع إدارة المدرسة.');
    if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) return fail(res, 423, 'الحساب مقفل مؤقتًا بسبب محاولات خاطئة متكررة.', { lockedUntil: u.lockedUntil });
    const ok = await A.verifyPassword(body.password || '', u.passwordHash);
    if (!ok) {
      const fa = (u.failedAttempts || 0) + 1; const patch = { failedAttempts: fa };
      if (fa >= C.LOCK_ATTEMPTS) { patch.lockedUntil = new Date(Date.now() + C.LOCK_MINUTES * 60e3).toISOString(); patch.failedAttempts = 0; }
      store.tx(() => { store.put('users', { ...u, ...patch }); if (patch.lockedUntil) audit(u.id, 'lock', 'users', u.id, null, { ip }); });
      broadcast();
      if (patch.lockedUntil) return fail(res, 423, `تم قفل الحساب ${C.LOCK_MINUTES} دقيقة بعد ${C.LOCK_ATTEMPTS} محاولات خاطئة.`, { lockedUntil: patch.lockedUntil });
      return fail(res, 401, generic + ` المحاولات المتبقية قبل القفل: ${C.LOCK_ATTEMPTS - fa}.`);
    }
    const remember = !!body.remember;
    const token = store.createSession(u.id, remember, remember ? C.REMEMBER_DAYS * 24 : C.SESSION_HOURS, ip, req.headers['user-agent']);
    let fresh; store.tx(() => { fresh = store.put('users', { ...u, failedAttempts: 0, lockedUntil: null, lastLogin: now(), lastActivity: now() }); audit(u.id, 'login', 'users', u.id, null, { ip }); });
    broadcast();
    send(res, 200, { user: userView(fresh), cacheKey: ensureCacheKey(fresh) }, { 'Set-Cookie': A.sessionCookie(token, { maxAgeSec: remember ? C.REMEMBER_DAYS * 86400 : undefined, secure: TLS }) });
  },

  'POST /api/logout': (req, res, body, s) => {
    if (s) { store.deleteSession(s.token); store.tx(() => audit(s.user.id, 'logout', 'users', s.user.id, null, null)); }
    send(res, 200, { ok: true }, { 'Set-Cookie': A.sessionCookie('', { maxAgeSec: 0, secure: TLS }) });
  },

  'GET /api/me': (req, res, body, s) => { if (!s) return fail(res, 401, 'غير مسجّل'); send(res, 200, { user: userView(s.user), cacheKey: ensureCacheKey(s.user) }); },

  'GET /api/sync': (req, res, body, s, url) => {
    if (!s) return fail(res, 401, 'انتهت الجلسة');
    const since = Math.max(0, Number(url.searchParams.get('since') || 0)) || 0;
    send(res, 200, { seq: store.seq, full: !since, settings: settings(), data: P.snapshot(store, s.user, since) });
  },

  'GET /api/events': (req, res, body, s) => {
    if (!s) return fail(res, 401, 'انتهت الجلسة');
    res.writeHead(200, { ...SEC_HEADERS, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(`retry: 5000\nevent: hello\ndata: ${JSON.stringify({ seq: store.seq })}\n\n`);
    const c = { res, userId: s.user.id }; sse.add(c); req.on('close', () => sse.delete(c));
  },

  'POST /api/ops': (req, res, body, s) => {
    if (!s) return fail(res, 401, 'انتهت الجلسة');
    const ops = Array.isArray(body.ops) ? body.ops : null;
    if (!ops || ops.length > 5000) return fail(res, 400, 'طلب غير صالح');
    const user = s.user; const results = []; const counts = {};
    store.tx(() => {
      for (const op of ops) {
        const entity = op && op.entity; let rec = op && op.record;
        const id = rec && rec.id;
        if (entity === 'auditLog') {
          if ((user.role === 'admin' || user.role === 'teacher') && rec && ['export', 'print'].includes(rec.action) && !store.get('auditLog', id) && typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id)) audit(user.id, rec.action, 'system', String(rec.entityId || '').slice(0, 120), null, null);
          results.push({ id, ok: true }); continue;
        }
        const old = entity && store.map(entity) ? store.get(entity, id) : null;
        if (entity === 'users' && old && rec) rec = { ...old, ...rec, passwordHash: old.passwordHash, salt: undefined, _cacheKey: old._cacheKey, username: old.username, role: old.role, linkedId: old.linkedId, lastLogin: old.lastLogin };
        const err = P.checkWrite(store, user, entity, rec, old, settings());
        if (err) { results.push({ id, error: err }); continue; }
        const t = now();
        const next = { ...rec, createdAt: old ? old.createdAt : (rec.createdAt || t), createdBy: old ? old.createdBy : user.id, updatedAt: t };
        if (entity === 'users') delete next.salt;
        const saved = store.put(entity, next);
        if (!NO_AUDIT.has(entity)) audit(user.id, !old ? 'create' : (saved.deletedAt && !old.deletedAt ? 'delete' : (!saved.deletedAt && old.deletedAt ? 'restore' : 'update')), entity, id, old, saved);
        else if (entity !== 'notifications') counts[entity] = (counts[entity] || 0) + 1;
        results.push({ id, ok: true });
      }
      for (const [e, n] of Object.entries(counts)) audit(user.id, 'update', e, '', null, { count: n });
    });
    broadcast();
    send(res, 200, { results, seq: store.seq });
  },

  'PUT /api/settings': (req, res, body, s) => {
    if (!s) return fail(res, 401, 'انتهت الجلسة'); if (s.user.role !== 'admin') return fail(res, 403, 'للمدير فقط');
    const incoming = body.settings; if (!incoming || typeof incoming !== 'object') return fail(res, 400, 'بيانات غير صالحة');
    if (JSON.stringify(incoming).length > 50000) return fail(res, 413, 'الإعدادات كبيرة جدًا');
    const before = settings(); const next = { ...before, ...incoming, demoData: before.demoData };
    store.tx(() => { store.setSettings(next); audit(s.user.id, 'update', 'settings', 'settings', before, next); });
    broadcast(); send(res, 200, { ok: true, settings: next });
  },

  'POST /api/users': async (req, res, body, s) => {
    if (!s) return fail(res, 401, 'انتهت الجلسة'); if (s.user.role !== 'admin') return fail(res, 403, 'للمدير فقط');
    const { role, linkedId, email } = body;
    if (!C.DEMO_PW[role]) return fail(res, 400, 'دور غير صالح');
    const linkMap = { teacher: 'teachers', student: 'students', parent: 'parents' };
    if (role !== 'admin') { if (!store.get(linkMap[role], linkedId)) return fail(res, 400, 'السجل المرتبط غير موجود'); if (store.live('users').some(u => u.role === role && u.linkedId === linkedId)) return fail(res, 409, 'لهذا الشخص حساب مسبقًا'); }
    let username = body.username, password = body.password;
    if (role === 'admin') { if (!/^[a-z0-9._-]{3,30}$/i.test(username || '')) return fail(res, 400, 'اسم دخول غير صالح'); if (findUserByLogin(username)) return fail(res, 409, 'اسم الدخول مستخدم'); const pr = A.passwordRule(password); if (pr) return fail(res, 400, pr); }
    else { username = nextUsername(role); password = A.generatePassword(); }
    const u = { id: crypto.randomBytes(9).toString('base64url'), username, email: String(email || '').slice(0, 120), role, linkedId: role === 'admin' ? null : linkedId, passwordHash: await A.hashPassword(password), isActive: true, failedAttempts: 0, lockedUntil: null, lastLogin: null, lastActivity: null, mustChangePassword: true, prefs: {}, createdAt: now(), updatedAt: now(), createdBy: s.user.id, deletedAt: null };
    let saved; store.tx(() => { saved = store.put('users', u); audit(s.user.id, 'create', 'users', u.id, null, saved); });
    broadcast(); send(res, 200, { user: userView(saved), username, password });
  },

  'POST /api/password': async (req, res, body, s) => {
    if (!s) return fail(res, 401, 'انتهت الجلسة');
    if (!rateLimit('pw:' + s.user.id, 10, 600e3)) return fail(res, 429, 'محاولات كثيرة، انتظر قليلًا');
    if (!(await A.verifyPassword(body.oldPassword || '', s.user.passwordHash))) return fail(res, 400, 'كلمة المرور الحالية غير صحيحة');
    const pr = A.passwordRule(body.newPassword); if (pr) return fail(res, 400, pr);
    if (body.newPassword === body.oldPassword) return fail(res, 400, 'اختر كلمة مرور مختلفة عن الحالية');
    const hash = await A.hashPassword(body.newPassword);
    let saved; store.tx(() => { saved = store.put('users', { ...s.user, passwordHash: hash, mustChangePassword: false, updatedAt: now() }); audit(s.user.id, 'update', 'users', s.user.id, null, { password: 'changed' }); });
    store.deleteUserSessions(s.user.id, s.token);
    broadcast(); send(res, 200, { ok: true, user: userView(saved) });
  },

  'POST /api/backup': async (req, res, body, s) => {
    if (!s) return fail(res, 401, 'انتهت الجلسة'); if (s.user.role !== 'admin') return fail(res, 403, 'للمدير فقط');
    if (A.passwordRule(body.passphrase)) return fail(res, 400, 'كلمة سر النسخة: 8 أحرف على الأقل وتحتوي حرفًا ورقمًا');
    const data = {}; for (const e of C.ENTITIES) data[e] = [...store.map(e).values()].map(r => { const c = { ...r }; delete c._seq; delete c._cacheKey; return c; });
    const plain = Buffer.from(JSON.stringify({ app: 'abd-al-salam-school', exportedAt: now(), settings: settings(), data }), 'utf8');
    const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
    const key = crypto.scryptSync(String(body.passphrase).normalize('NFKC'), salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    const c = crypto.createCipheriv('aes-256-gcm', key, iv); const ct = Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]);
    store.tx(() => audit(s.user.id, 'export', 'system', 'backup', null, { bytes: plain.length }));
    send(res, 200, { format: 'abd-al-salam-backup', v: 1, kdf: { alg: 'scrypt', N: 32768, r: 8, p: 1, salt: salt.toString('base64') }, cipher: 'aes-256-gcm', iv: iv.toString('base64'), data: ct.toString('base64'), createdAt: now() });
  },

  'POST /api/restore': async (req, res, body, s) => {
    if (!s) return fail(res, 401, 'انتهت الجلسة'); if (s.user.role !== 'admin') return fail(res, 403, 'للمدير فقط');
    if (!(await A.verifyPassword(body.password || '', s.user.passwordHash))) return fail(res, 400, 'كلمة مرور المدير غير صحيحة');
    const b = body.backup;
    if (!b || b.format !== 'abd-al-salam-backup') return fail(res, 400, 'الملف ليس نسخة احتياطية لهذا النظام');
    let payload;
    try {
      const key = crypto.scryptSync(String(body.passphrase || '').normalize('NFKC'), Buffer.from(b.kdf.salt, 'base64'), 32, { N: b.kdf.N, r: b.kdf.r, p: b.kdf.p, maxmem: 64 * 1024 * 1024 });
      const buf = Buffer.from(b.data, 'base64'); const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(b.iv, 'base64')); d.setAuthTag(buf.subarray(buf.length - 16));
      payload = JSON.parse(Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]).toString('utf8'));
    } catch (e) { return fail(res, 400, 'كلمة سر النسخة غير صحيحة أو الملف تالف'); }
    const v = validDataset(payload); if (v) return fail(res, 400, v);
    if (!(payload.data.users || []).some(u => u.role === 'admin' && u.isActive && !u.deletedAt)) return fail(res, 400, 'النسخة لا تحتوي حساب مدير فعّال');
    store.backup();
    store.replaceAll(payload.data, payload.settings || {});
    store.deleteAllSessions();
    store.tx(() => audit(s.user.id, 'restore', 'system', 'backup', null, { exportedAt: payload.exportedAt }));
    broadcast('reset'); send(res, 200, { ok: true });
  },

  'POST /api/reset': async (req, res, body, s) => {
    if (!s) return fail(res, 401, 'انتهت الجلسة'); if (s.user.role !== 'admin') return fail(res, 403, 'للمدير فقط');
    if (!(await A.verifyPassword(body.password || '', s.user.passwordHash))) return fail(res, 400, 'كلمة مرور المدير غير صحيحة');
    const v = validDataset(body.dataset); if (v) return fail(res, 400, v);
    store.backup();
    const data = { ...body.dataset.data }; data.users = await rehashUsers((data.users || []).filter(u => C.DEMO_PW[u.role]), s.user.username, body.password); data.auditLog = [];
    store.replaceAll(data, { ...(body.dataset.settings || {}), demoData: true });
    store.deleteAllSessions();
    store.tx(() => audit(data.users.find(u => u.role === 'admin').id, 'create', 'system', 'reset', null, { records: store.count() }));
    broadcast('reset'); send(res, 200, { ok: true });
  },

  'GET /api/verify': (req, res, body, s, url) => {
    if (!rateLimit('verify:' + ipOf(req), 30, 60e3)) return fail(res, 429, 'محاولات كثيرة، انتظر دقيقة');
    const code = String(url.searchParams.get('code') || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!code || code.length > 40) return send(res, 200, { valid: false });
    const c = store.live('certificates').find(x => x.verifyCode === code || String(x.certNo).toUpperCase() === code);
    if (!c) return send(res, 200, { valid: false });
    const st = store.get('students', c.studentId) || {}; const y = store.get('academicYears', c.academicYearId) || {}; const cl = store.get('classes', c.classId) || {};
    send(res, 200, { valid: true, certNo: c.certNo, studentName: st.fullName, className: cl.name, yearName: y.name, termName: settings().termName, percentage: c.percentage, gradeLabel: c.gradeLabel, result: c.result, issueDate: c.issueDate, schoolName: settings().schoolName });
  }
};
routes['POST /api/users/password'] = async (req, res, body, s) => {
  if (!s) return fail(res, 401, 'انتهت الجلسة'); if (s.user.role !== 'admin') return fail(res, 403, 'للمدير فقط');
  const u = store.get('users', body.userId); if (!u || u.deletedAt) return fail(res, 404, 'المستخدم غير موجود');
  const password = body.password || A.generatePassword(); const pr = A.passwordRule(password); if (pr) return fail(res, 400, pr);
  const hash = await A.hashPassword(password);
  store.tx(() => { store.put('users', { ...u, passwordHash: hash, mustChangePassword: body.mustChange !== false, failedAttempts: 0, lockedUntil: null }); audit(s.user.id, 'update', 'users', u.id, null, { password: 'reset' }); });
  if (u.id !== s.user.id) store.deleteUserSessions(u.id);
  broadcast(); send(res, 200, { ok: true, password });
};

/* ---------- static files ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname); if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(C.PUBLIC_DIR, p));
  if (!file.startsWith(C.PUBLIC_DIR + path.sep)) { res.writeHead(403, SEC_HEADERS); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { ...SEC_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
    const ext = path.extname(file);
    res.writeHead(200, { ...SEC_HEADERS, 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' || p === '/sw.js' ? 'no-cache' : 'public, max-age=300', 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------- server ---------- */
async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  try {
    if (!url.pathname.startsWith('/api/')) { if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, SEC_HEADERS); return res.end(); } return serveStatic(req, res, url); }
    const key = req.method + ' ' + url.pathname; const fn = routes[key];
    if (!fn) return fail(res, 404, 'غير موجود');
    let body = {};
    if (req.method !== 'GET') {
      if (!csrfOk(req)) return fail(res, 403, 'طلب مرفوض (حماية CSRF)');
      if (!String(req.headers['content-type'] || '').includes('application/json')) return fail(res, 415, 'JSON فقط');
      body = await readBody(req);
    }
    const s = auth(req);
    await fn(req, res, body, s, url);
  } catch (e) {
    console.error('✖', req.method, url.pathname, e.message);
    if (!res.headersSent) fail(res, e.status || 500, e.status ? e.message : 'خطأ داخلي في الخادم');
  }
}
const server = TLS ? https.createServer({ cert: fs.readFileSync(C.TLS_CERT), key: fs.readFileSync(C.TLS_KEY) }, handler) : http.createServer(handler);
server.listen(C.PORT, C.HOST, () => {
  const proto = TLS ? 'https' : 'http';
  console.log(`\n🏫  نظام إدارة مدرسة عبد السلام يعمل على ${proto}://localhost:${C.PORT}`);
  console.log(`    البيانات المشفّرة: ${C.DATA_DIR}  ·  السجلات: ${store.count()}${store.live('users').length ? '' : '  ·  افتح الرابط لإكمال الإعداد الأول'}`);
  if (!TLS) console.log('    ملاحظة: للوصول من أجهزة أخرى في الشبكة مع التشفير دون اتصال فعّل HTTPS (انظر README).');
});
function autoBackup() { try { if (store.count()) { const f = store.backup(); store.pruneBackups(C.BACKUP_KEEP); console.log('💾 نسخة احتياطية تلقائية:', path.basename(f)); } } catch (e) { console.error('backup failed', e.message); } }
setTimeout(autoBackup, 5000).unref();
setInterval(autoBackup, C.BACKUP_EVERY_HOURS * 3600e3).unref();
const shutdown = () => { console.log('\nإيقاف الخادم...'); for (const c of sse) { try { c.res.end(); } catch (e) { } } server.close(); store.close(); process.exit(0); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
module.exports = { server, store };
