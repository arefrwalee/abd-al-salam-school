'use strict';
/* كلمات المرور: scrypt مع ملح عشوائي لكل مستخدم + مقارنة ثابتة الزمن */
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const PARAMS = { N: 16384, r: 8, p: 1 };

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(pw).normalize('NFKC'), salt, 64, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}
async function verifyPassword(pw, stored) {
  try {
    const [alg, N, r, p, salt, key] = String(stored || '').split('$');
    if (alg !== 'scrypt') { await scrypt('x', 'dummy-salt-value', 64, PARAMS); return false; }
    const k = Buffer.from(key, 'base64');
    const d = await scrypt(String(pw).normalize('NFKC'), Buffer.from(salt, 'base64'), k.length, { N: +N, r: +r, p: +p });
    return crypto.timingSafeEqual(d, k);
  } catch (e) { return false; }
}
const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');
function passwordRule(pw) { pw = String(pw || ''); return (pw.length >= 8 && pw.length <= 128 && /[A-Za-z؀-ۿ]/.test(pw) && /\d/.test(pw)) ? null : 'كلمة المرور 8 أحرف على الأقل وتحتوي حرفًا ورقمًا'; }
function generatePassword() {
  const L = 'abcdefghjkmnpqrstuvwxyz', U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', D = '23456789';
  const pick = s => s[crypto.randomInt(s.length)];
  let p = pick(U) + pick(L) + pick(L) + pick(L) + '-' + pick(D) + pick(D) + pick(D) + pick(D);
  return p;
}
function parseCookies(h) { const o = {}; String(h || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return o; }
function sessionCookie(token, { maxAgeSec, secure }) {
  return `sid=${token}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}${maxAgeSec != null ? '; Max-Age=' + maxAgeSec : ''}`;
}

module.exports = { hashPassword, verifyPassword, DUMMY_HASH, passwordRule, generatePassword, parseCookies, sessionCookie };
