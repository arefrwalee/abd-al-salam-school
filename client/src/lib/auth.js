import { toast } from './bridge.js';
import { fmtNum, randCode } from './utils.js';
import { Audit, Bus, Mode, Repo, bump, isServer } from './store.js';
import { Vault } from './vault.js';
import { Sync, api } from './sync.js';

/* =====================================================================
   المصادقة والحسابات
   - وضع الخادم: التحقق يتم على الخادم (scrypt + جلسة HttpOnly)، ولا تصل كلمات المرور المخزنة إلى المتصفح
   - دون اتصال: فك الخزنة المشفّرة بكلمة المرور
   - وضع العرض: حسابات تجريبية في الذاكرة فقط
   ===================================================================== */
async function sha256(str) {
  if (window.crypto && crypto.subtle) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x9e3779b9, h4 = 0x85ebca6b;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); h3 = Math.imul(h3 ^ c, 2246822507); h4 = Math.imul(h4 ^ c, 3266489909); }
  return [h1, h2, h3, h4].map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
const hashPw = (pw, salt) => sha256(salt + '::' + pw);
const passwordRule = pw => (String(pw).length >= 8 && /[A-Za-z؀-ۿ]/.test(pw) && /\d/.test(pw)) ? null : 'كلمة المرور 8 أحرف على الأقل وتحتوي حرفًا ورقمًا';
function genPassword() { const L = 'abcdefghjkmnpqrstuvwxyz', U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', D = '23456789'; const r = new Uint32Array(8); crypto.getRandomValues(r); const p = (s, i) => s[r[i] % s.length]; return p(U, 0) + p(L, 1) + p(L, 2) + p(L, 3) + '-' + p(D, 4) + p(D, 5) + p(D, 6) + p(D, 7); }

const ROLE_LABEL = { admin: 'مدير المدرسة', teacher: 'مدرس', student: 'طالب', parent: 'ولي أمر' };
const DEMO_PW = { admin: 'Admin@123', teacher: 'Teacher@123', student: 'Student@123', parent: 'Parent@123' };

const Auth = (() => {
  let user = null; let lastAct = Date.now();
  const userId = () => user ? user.id : null;
  const current = () => user ? (Repo.get('users', user.id) || user) : null;

  /** استعادة الجلسة عند فتح الصفحة (وضع الخادم فقط — الجلسة في كوكي HttpOnly) */
  async function restore() {
    if (!isServer() || Mode.offline) return null;
    try {
      const r = await api('GET', 'api/me'); if (!r.ok) return null;
      user = r.user; await Vault.openFor(r.user, r.cacheKey, null);
      Repo.setSink(Sync.sink); await Sync.start(r.user); user = current(); lastAct = Date.now(); return user;
    } catch (e) { return null; }
  }

  async function login(id, pw, remember) {
    if (!isServer()) return demoLogin(id, pw);
    let r;
    try { r = Mode.offline ? null : await api('POST', 'api/login', { username: String(id).trim(), password: pw, remember: !!remember }); }
    catch (e) { r = null; }
    if (r === null) return offlineLogin(id, pw);
    if (!r.ok) return { ok: false, msg: r.error || 'تعذّر تسجيل الدخول', locked: r.lockedUntil };
    user = r.user;
    const vaultOn = await Vault.openFor(r.user, r.cacheKey, pw);
    Repo.setSink(Sync.sink);
    try { await Sync.start(r.user); } catch (e) { return { ok: false, msg: 'تعذّر تحميل البيانات من الخادم: ' + e.message }; }
    user = current(); lastAct = Date.now(); bump();
    return { ok: true, user, vault: vaultOn };
  }
  async function offlineLogin(id, pw) {
    const r = await Vault.unlockOffline(id, pw);
    if (r.error) return { ok: false, msg: 'لا يوجد اتصال بالخادم. ' + r.error };
    Repo.setSink(Sync.sink);
    const u = (r.data.users || []).find(x => x.id === r.userId);
    if (!u) return { ok: false, msg: 'النسخة المحفوظة غير مكتملة.' };
    user = u; Sync.startOffline(u, r); Mode.offline = false; lastAct = Date.now();
    return { ok: true, user: current(), offline: true, savedAt: r.savedAt };
  }
  async function demoLogin(id, pw) {
    const key = String(id || '').trim().toLowerCase();
    const fail = 'اسم المستخدم أو كلمة المرور غير صحيحة.';
    const u = Repo.all('users').find(x => x.username.toLowerCase() === key || (x.email || '').toLowerCase() === key);
    if (!u) return { ok: false, msg: fail };
    if (!u.isActive) return { ok: false, msg: 'هذا الحساب معطّل. تواصل مع إدارة المدرسة لإعادة تفعيله.' };
    if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) return { ok: false, locked: u.lockedUntil, msg: 'الحساب مقفل مؤقتًا بسبب محاولات دخول خاطئة متكررة.' };
    if (await hashPw(pw, u.salt) !== u.passwordHash) {
      const fa = (u.failedAttempts || 0) + 1; const patch = { failedAttempts: fa };
      if (fa >= 5) { patch.lockedUntil = new Date(Date.now() + 15 * 60000).toISOString(); patch.failedAttempts = 0; }
      Repo.update('users', u.id, patch, { audit: false });
      if (patch.lockedUntil) return { ok: false, locked: patch.lockedUntil, msg: 'تم قفل الحساب 15 دقيقة بعد 5 محاولات خاطئة.' };
      return { ok: false, msg: fail + ' المحاولات المتبقية قبل القفل: ' + fmtNum(5 - fa) + '.' };
    }
    const t = new Date().toISOString();
    Repo.update('users', u.id, { failedAttempts: 0, lockedUntil: null, lastLogin: t, lastActivity: t }, { audit: false });
    user = u; lastAct = Date.now(); Audit.log('login', 'users', u.id, null, null); bump();
    return { ok: true, user: u };
  }
  async function logout(reason) {
    if (user && !isServer()) Audit.log('logout', 'users', user.id, null, null);
    if (isServer()) { try { await Sync.stop(); } catch (e) { } try { await api('POST', 'api/logout', {}); } catch (e) { } Vault.close(); Repo.clearAll(); Repo.setSink(null); }
    user = null;
    history.replaceState(null, '', location.pathname + location.search);
    if (isServer()) await refreshPublic();
    bump(); Bus.emit('auth', null);
    if (reason) toast.info(reason);
  }
  function touch() { lastAct = Date.now(); }
  const idleMs = () => Date.now() - lastAct;
  async function changePassword(oldPw, newPw) {
    const u = current(); if (!u) return 'لا توجد جلسة';
    const rule = passwordRule(newPw); if (rule) return rule;
    if (isServer()) {
      let r; try { r = await api('POST', 'api/password', { oldPassword: oldPw, newPassword: newPw }); } catch (e) { return 'لا يوجد اتصال بالخادم. تغيير كلمة المرور يحتاج اتصالًا.'; }
      if (!r.ok) return r.error || 'تعذّر تغيير كلمة المرور';
      Repo.loadSnapshot({ users: [r.user] }, false); await Vault.rewrap(newPw); return null;
    }
    if (await hashPw(oldPw, u.salt) !== u.passwordHash) return 'كلمة المرور الحالية غير صحيحة';
    const salt = randCode(12);
    Repo.update('users', u.id, { salt, passwordHash: await hashPw(newPw, salt), mustChangePassword: false });
    return null;
  }
  return { login, logout, current, userId, restore, touch, idleMs, changePassword };
})();

/* ---------- Accounts (create / reset) ---------- */
async function makeUser(role, username, linkedId, email, pw) {
  const salt = randCode(12);
  return { username, email: email || '', role, linkedId: linkedId || null, salt, passwordHash: await hashPw(pw || DEMO_PW[role], salt), isActive: true, failedAttempts: 0, lockedUntil: null, lastLogin: null, lastActivity: null, mustChangePassword: false, prefs: {} };
}
function nextUsername(prefix) { let n = Repo.raw('users').filter(u => u.username.startsWith(prefix)).length + 1; while (Repo.raw('users').some(u => u.username === prefix + n)) n++; return prefix + n; }
const Accounts = {
  /** ينشئ حساب دخول لطالب/ولي أمر/مدرس، ويعيد اسم الدخول وكلمة مرور مؤقتة تُسلَّم مرة واحدة */
  async create(role, linkedId, email) {
    if (isServer()) {
      const r = await api('POST', 'api/users', { role, linkedId, email: email || '' });
      if (!r.ok) throw new Error(r.error || 'تعذّر إنشاء الحساب');
      Repo.loadSnapshot({ users: [r.user] }, false); return { username: r.username, password: r.password };
    }
    const pw = genPassword(); const u = Repo.create('users', { ...(await makeUser(role, nextUsername(role), linkedId, email, pw)), mustChangePassword: true });
    return { username: u.username, password: pw };
  },
  async createAdmin(username, email, password) {
    if (isServer()) { const r = await api('POST', 'api/users', { role: 'admin', username, email, password }); if (!r.ok) throw new Error(r.error || 'تعذّر إنشاء الحساب'); Repo.loadSnapshot({ users: [r.user] }, false); return r; }
    if (Repo.raw('users').some(u => u.username.toLowerCase() === username.toLowerCase())) throw new Error('اسم الدخول مستخدم');
    Repo.create('users', { ...(await makeUser('admin', username, null, email, password)), mustChangePassword: true }); return { username };
  },
  async resetPassword(userId, password, mustChange) {
    if (isServer()) { const r = await api('POST', 'api/users/password', { userId, password, mustChange }); if (!r.ok) throw new Error(r.error || 'تعذّر تعيين كلمة المرور'); return r.password; }
    const salt = randCode(12); Repo.update('users', userId, { salt, passwordHash: await hashPw(password, salt), mustChangePassword: !!mustChange, failedAttempts: 0, lockedUntil: null }); return password;
  }
};
async function refreshPublic() { try { const r = await api('GET', 'api/public'); if (r.ok) { Mode.public = r; Mode.offline = false; } } catch (e) { Mode.offline = true; } bump(); }

export { Accounts, Auth, DEMO_PW, ROLE_LABEL, genPassword, hashPw, makeUser, nextUsername, passwordRule, refreshPublic, sha256 };
