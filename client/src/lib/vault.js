/* =====================================================================
   الخزنة المشفّرة على الجهاز (IndexedDB + AES-256-GCM)
   - تحفظ نسخة من بيانات المستخدم وتعديلاته المعلّقة للعمل دون اتصال
   - مفتاح التشفير يأتي من الخادم ولا يُخزَّن إلا «مغلّفًا» بكلمة مرور المستخدم (PBKDF2 210,000 تكرار)
   - بدون كلمة المرور لا يمكن قراءة أي شيء من الجهاز
   - تتطلب سياقًا آمنًا: HTTPS أو localhost
   ===================================================================== */
const Vault = (() => {
  const DB = 'abd-al-salam-vault', ST = 'kv', ITER = 210000;
  let dbp = null, key = null, rawKey = null, uidCur = null, username = null;
  const te = new TextEncoder(), td = new TextDecoder();
  const supported = () => !!(window.indexedDB && window.crypto && crypto.subtle && window.isSecureContext);
  function db() { if (!dbp) dbp = new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); return dbp; }
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(ST, mode); const s = t.objectStore(ST); const r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
  const idbGet = k => tx('readonly', s => s.get(k));
  const idbSet = (k, v) => tx('readwrite', s => s.put(v, k));
  const idbDel = k => tx('readwrite', s => s.delete(k));
  const idbKeys = () => tx('readonly', s => s.getAllKeys());
  const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function nameKey(n) { const h = await crypto.subtle.digest('SHA-256', te.encode('ass-vault::' + String(n).trim().toLowerCase())); return 'acct:' + [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  async function kek(pw, salt) { const base = await crypto.subtle.importKey('raw', te.encode(String(pw).normalize('NFKC')), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
  async function enc(obj, k = key, aad = uidCur) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(aad) }, k, te.encode(JSON.stringify(obj))); return { iv, ct }; }
  async function dec(v, k = key, aad = uidCur) { if (!v) return null; const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: v.iv, additionalData: te.encode(aad) }, k, v.ct); return JSON.parse(td.decode(pt)); }
  async function useKey(bytes) { rawKey = bytes; key = await crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']); }
  async function wrap(pw) {
    const salt = crypto.getRandomValues(new Uint8Array(16)); const k = await kek(pw, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(uidCur) }, k, rawKey);
    await idbSet(await nameKey(username), { userId: uidCur, salt, iv, wrapped, at: Date.now() });
  }

  /** بعد الدخول عبر الخادم: تفعيل الخزنة، وتغليف المفتاح بكلمة المرور إن توفرت */
  async function openFor(user, cacheKeyB64, password) {
    if (!supported() || !cacheKeyB64) return false;
    try { uidCur = user.id; username = user.username; await useKey(b64d(cacheKeyB64)); if (password) await wrap(password); return true; }
    catch (e) { console.warn('vault', e); key = null; return false; }
  }
  /** الدخول دون اتصال: فك المفتاح بكلمة المرور ثم فك النسخة المحفوظة */
  async function unlockOffline(name, password) {
    if (!supported()) return { error: 'العمل دون اتصال يتطلب HTTPS أو localhost.' };
    const acct = await idbGet(await nameKey(name));
    if (!acct) return { error: 'لا توجد نسخة محفوظة لهذا الحساب على هذا الجهاز. اتصل بالخادم للدخول أول مرة.' };
    try {
      const k = await kek(password, acct.salt);
      const raw = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: acct.iv, additionalData: te.encode(acct.userId) }, k, acct.wrapped));
      uidCur = acct.userId; username = name; await useKey(raw);
    } catch (e) { return { error: 'كلمة المرور غير صحيحة.' }; }
    const snap = await dec(await idbGet('snap:' + uidCur)).catch(() => null);
    if (!snap) return { error: 'النسخة المحفوظة غير متاحة. اتصل بالخادم.' };
    const outbox = await dec(await idbGet('outbox:' + uidCur)).catch(() => []) || [];
    return { userId: uidCur, data: snap.data, settings: snap.settings, seq: snap.seq, savedAt: snap.savedAt, outbox };
  }
  let snapT = null, boxT = null;
  function saveSnapshotSoon(getState) { if (!key) return; clearTimeout(snapT); snapT = setTimeout(async () => { try { const st = getState(); await idbSet('snap:' + uidCur, await enc({ ...st, savedAt: new Date().toISOString() })); } catch (e) { console.warn('vault snapshot', e); } }, 1500); }
  function saveOutboxSoon(queue) { if (!key) return; clearTimeout(boxT); const copy = queue.slice(); boxT = setTimeout(async () => { try { await idbSet('outbox:' + uidCur, await enc(copy)); } catch (e) { console.warn('vault outbox', e); } }, 250); }
  async function saveNow(state, queue) { if (!key) return; clearTimeout(snapT); clearTimeout(boxT); try { if (state) await idbSet('snap:' + uidCur, await enc({ ...state, savedAt: new Date().toISOString() })); await idbSet('outbox:' + uidCur, await enc(queue.slice())); } catch (e) { console.warn('vault save', e); } }
  async function loadOutbox() { if (!key) return []; try { return (await dec(await idbGet('outbox:' + uidCur))) || []; } catch (e) { return []; } }
  async function rewrap(newPw) { if (key && rawKey && username) await wrap(newPw); }
  async function hasAny() { if (!supported()) return false; try { return (await idbKeys()).some(k => String(k).startsWith('acct:')); } catch (e) { return false; } }
  async function wipe() {
    if (!supported()) return;
    const id = uidCur; const keys = await idbKeys();
    for (const k of keys) { if (k === 'snap:' + id || k === 'outbox:' + id) await idbDel(k); else if (String(k).startsWith('acct:')) { const a = await idbGet(k); if (a && a.userId === id) await idbDel(k); } }
  }
  function close() { clearTimeout(snapT); clearTimeout(boxT); key = null; rawKey = null; uidCur = null; username = null; }
  return { supported, openFor, unlockOffline, saveSnapshotSoon, saveOutboxSoon, saveNow, loadOutbox, rewrap, hasAny, wipe, close, get active() { return !!key; } };
})();

export { Vault };
