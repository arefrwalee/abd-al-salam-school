/* ---------- QR code (byte mode, ECC M, versions 1–10) ---------- */
const QR = (() => {
  const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5], ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  const ALIGN = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  function rawModules(v) { let r = (16 * v + 128) * v + 64; if (v >= 2) { const na = Math.floor(v / 7) + 2; r -= (25 * na - 10) * na - 55; if (v >= 7) r -= 36; } return r; }
  const totalCW = v => Math.floor(rawModules(v) / 8);
  function gmul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; }
  function divisor(d) { const r = new Array(d).fill(0); r[d - 1] = 1; let root = 1; for (let i = 0; i < d; i++) { for (let j = 0; j < d; j++) { r[j] = gmul(r[j], root); if (j + 1 < d) r[j] ^= r[j + 1]; } root = gmul(root, 2); } return r; }
  function remainder(data, div) { const res = div.map(() => 0); for (const b of data) { const f = b ^ res.shift(); res.push(0); div.forEach((c, i) => res[i] ^= gmul(c, f)); } return res; }
  function encode(text) {
    const bytes = [...new TextEncoder().encode(text)];
    let v = 1; for (; v <= 10; v++) { const cap = (totalCW(v) - ECC[v] * BLOCKS[v]) * 8; if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= cap) break; }
    if (v > 10) throw new Error('QR text too long');
    const bits = []; const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4); push(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => push(b, 8));
    const dataCap = (totalCW(v) - ECC[v] * BLOCKS[v]) * 8;
    push(0, Math.min(4, dataCap - bits.length)); push(0, (8 - bits.length % 8) % 8);
    for (let p = 0xEC; bits.length < dataCap; p ^= 0xEC ^ 0x11) push(p, 8);
    const data = []; for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
    const nb = BLOCKS[v], eccLen = ECC[v], raw = totalCW(v), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = divisor(eccLen);
    const blocks = []; for (let i = 0, k = 0; i < nb; i++) { const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1)); k += dat.length; const ecc = remainder(dat, div); if (i < nShort) dat.push(0); blocks.push(dat.concat(ecc)); }
    const out = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort) out.push(b[i]); });
    const size = v * 4 + 17;
    const M = Array.from({ length: size }, () => new Array(size).fill(false));
    const F = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (x, y) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), xx = x + dx, yy = y + dy; if (xx >= 0 && xx < size && yy >= 0 && yy < size) set(xx, yy, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const al = ALIGN[v], n = al.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
    const drawFormat = mk => { const dat = (0 << 3) | mk; let rem = dat; for (let k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537); const b = ((dat << 10) | rem) ^ 0x5412; const g = k => ((b >>> k) & 1) === 1; for (let k = 0; k <= 5; k++) set(8, k, g(k)); set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8)); for (let k = 9; k < 15; k++) set(14 - k, 8, g(k)); for (let k = 0; k < 8; k++) set(size - 1 - k, 8, g(k)); for (let k = 8; k < 15; k++) set(8, size - 15 + k, g(k)); set(8, size - 8, true); };
    drawFormat(0);
    if (v >= 7) { let rem = v; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25); const b = (v << 12) | rem; for (let i = 0; i < 18; i++) { const bit = ((b >>> i) & 1) === 1, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, bit); set(c, a, bit); } }
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right = 5; for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) { const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert; if (!F[y][x] && i < out.length * 8) { M[y][x] = ((out[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; } } }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && (x + y) % 2 === 0) M[y][x] = !M[y][x];
    drawFormat(0);
    return M;
  }
  return { encode };
})();

export { QR };
