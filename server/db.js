'use strict';
/* =====================================================================
   طبقة التخزين: SQLite مدمجة في Node.js + تشفير كل سجل AES-256-GCM
   - كل سجل يُخزَّن مشفّرًا بمفتاح رئيسي (master key) لا يُحفظ داخل قاعدة البيانات
   - سرقة ملف school.db وحده لا تكشف أي بيانات
   - البيانات تُحمَّل في الذاكرة عند التشغيل لسرعة الاستعلام والتحقق من الصلاحيات
   ===================================================================== */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

class SecureStore {
  constructor(dataDir, entities) {
    this.dir = dataDir; this.entities = entities;
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.join(dataDir, 'backups'), { recursive: true, mode: 0o700 });
    this.key = this._loadKey();
    this.db = new DatabaseSync(path.join(dataDir, 'school.db'));
    try { fs.chmodSync(path.join(dataDir, 'school.db'), 0o600); } catch (e) { }
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS records (entity TEXT NOT NULL, id TEXT NOT NULL, seq INTEGER NOT NULL, iv BLOB NOT NULL, data BLOB NOT NULL, PRIMARY KEY (entity, id));
      CREATE INDEX IF NOT EXISTS records_seq ON records(seq);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, iv BLOB, value BLOB);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, remember INTEGER NOT NULL DEFAULT 0, ip TEXT, ua TEXT);
      CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    `);
    this.st = {
      upsert: this.db.prepare('INSERT INTO records (entity, id, seq, iv, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT(entity, id) DO UPDATE SET seq = excluded.seq, iv = excluded.iv, data = excluded.data'),
      metaSet: this.db.prepare('INSERT INTO meta (key, iv, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET iv = excluded.iv, value = excluded.value'),
      metaGet: this.db.prepare('SELECT iv, value FROM meta WHERE key = ?'),
      sessIns: this.db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen, remember, ip, ua) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
      sessGet: this.db.prepare('SELECT * FROM sessions WHERE token_hash = ?'),
      sessTouch: this.db.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?'),
      sessDel: this.db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
      sessDelUser: this.db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?'),
      sessDelUserAll: this.db.prepare('DELETE FROM sessions WHERE user_id = ?'),
      sessPurge: this.db.prepare('DELETE FROM sessions WHERE expires_at < ?')
    };
    this._load();
  }

  /* ---------- master key ---------- */
  _loadKey() {
    if (process.env.SCHOOL_MASTER_KEY) {
      const k = Buffer.from(process.env.SCHOOL_MASTER_KEY, 'base64');
      if (k.length !== 32) throw new Error('SCHOOL_MASTER_KEY must be 32 bytes in base64');
      return k;
    }
    const f = path.join(this.dir, 'master.key');
    if (fs.existsSync(f)) { const k = Buffer.from(fs.readFileSync(f, 'utf8').trim(), 'base64'); if (k.length !== 32) throw new Error('master.key is corrupted'); return k; }
    const k = crypto.randomBytes(32);
    fs.writeFileSync(f, k.toString('base64'), { mode: 0o600 });
    console.log('🔑  أُنشئ مفتاح تشفير رئيسي جديد في', f, '— احفظ نسخة منه في مكان آمن خارج الجهاز. بدونه لا يمكن قراءة البيانات.');
    return k;
  }
  enc(aad, obj) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', this.key, iv); c.setAAD(Buffer.from(aad));
    const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final(), c.getAuthTag()]);
    return { iv, ct };
  }
  dec(aad, iv, buf) {
    const b = Buffer.from(buf); const tag = b.subarray(b.length - 16), ct = b.subarray(0, b.length - 16);
    const d = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv)); d.setAAD(Buffer.from(aad)); d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(ct), d.final()]).toString('utf8'));
  }

  /* ---------- records ---------- */
  _load() {
    this.mem = {}; this.entities.forEach(e => this.mem[e] = new Map());
    const rows = this.db.prepare('SELECT entity, id, seq, iv, data FROM records').all();
    for (const r of rows) {
      if (!this.mem[r.entity]) continue;
      const rec = this.dec(r.entity + '|' + r.id, r.iv, r.data); rec._seq = r.seq;
      this.mem[r.entity].set(r.id, rec);
    }
    this.seq = Number(this.getMeta('seq') || 0);
    this.settings = this.getMeta('settings') || null;
  }
  map(e) { return this.mem[e]; }
  get(e, id) { return this.mem[e] ? this.mem[e].get(id) || null : null; }
  live(e) { return [...this.mem[e].values()].filter(r => !r.deletedAt); }
  count() { return Object.values(this.mem).reduce((a, m) => a + m.size, 0); }
  /** يكتب سجلًا (داخل معاملة يفتحها المستدعي أو بشكل منفرد) */
  put(entity, rec) {
    if (!this.mem[entity]) throw new Error('unknown entity ' + entity);
    this.seq++; const clean = { ...rec }; delete clean._seq;
    const { iv, ct } = this.enc(entity + '|' + clean.id, clean);
    this.st.upsert.run(entity, clean.id, this.seq, iv, ct);
    clean._seq = this.seq; this.mem[entity].set(clean.id, clean);
    return clean;
  }
  tx(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); this.setMeta('seq', this.seq); this.db.exec('COMMIT'); return r; }
    catch (e) { this.db.exec('ROLLBACK'); this._load(); throw e; }
  }
  replaceAll(data, settings) {
    this.tx(() => {
      this.db.exec('DELETE FROM records');
      this.entities.forEach(e => this.mem[e] = new Map());
      for (const e of this.entities) for (const r of (data[e] || [])) this.put(e, r);
      this.setSettings(settings);
    });
  }
  /* ---------- meta (encrypted) ---------- */
  getMeta(k) { const r = this.st.metaGet.get(k); if (!r) return null; return this.dec('meta|' + k, r.iv, r.value); }
  setMeta(k, v) { const { iv, ct } = this.enc('meta|' + k, v); this.st.metaSet.run(k, iv, ct); }
  setSettings(s) { this.settings = s; this.setMeta('settings', s); }

  /* ---------- sessions (only token hashes are stored) ---------- */
  createSession(userId, remember, hours, ip, ua) {
    const token = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    this.st.sessIns.run(hashToken(token), userId, now, now + hours * 3600e3, now, remember ? 1 : 0, String(ip || '').slice(0, 64), String(ua || '').slice(0, 200));
    return token;
  }
  getSession(token) { return token ? this.st.sessGet.get(hashToken(token)) : null; }
  touchSession(token) { this.st.sessTouch.run(Date.now(), hashToken(token)); }
  deleteSession(token) { if (token) this.st.sessDel.run(hashToken(token)); }
  deleteUserSessions(userId, exceptToken) { if (exceptToken) this.st.sessDelUser.run(userId, hashToken(exceptToken)); else this.st.sessDelUserAll.run(userId); }
  deleteAllSessions() { this.db.exec('DELETE FROM sessions'); }
  purgeSessions() { this.st.sessPurge.run(Date.now()); }

  /* ---------- backups (the copy stays encrypted at rest) ---------- */
  backup() {
    const d = new Date(); const p2 = n => String(n).padStart(2, '0');
    const file = path.join(this.dir, 'backups', `school-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}.db`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    this.db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    return file;
  }
  pruneBackups(keep) {
    const dir = path.join(this.dir, 'backups');
    const files = fs.readdirSync(dir).filter(f => /^school-\d{8}-\d{4}\.db$/.test(f)).sort();
    files.slice(0, Math.max(0, files.length - keep)).forEach(f => fs.unlinkSync(path.join(dir, f)));
  }
  close() { try { this.db.close(); } catch (e) { } }
}
const hashToken = t => crypto.createHash('sha256').update(String(t)).digest('hex');

module.exports = { SecureStore };
