/* =====================================================================
   UI components — DOM helpers, icons, modal, toast, forms, tables, charts, QR
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag); let deferredValue;
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') deferredValue = v;
    else if (typeof v !== 'string' && typeof v !== 'number' && k in el) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  if (deferredValue !== undefined) el.value = deferredValue;
  return el;
}
function append(el, kids) { for (const k of kids.flat(Infinity)) { if (k == null || k === false) continue; el.append(k instanceof Node ? k : document.createTextNode(String(k))); } return el; }
(() => { const rc = Element.prototype.replaceChildren; Element.prototype.replaceChildren = function (...k) { return rc.apply(this, k.flat(Infinity).filter(x => x != null && x !== false).map(x => x instanceof Node ? x : document.createTextNode(String(x)))); }; })();
const SVGNS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs = {}, ...kids) { const el = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v); kids.flat().forEach(k => { if (k != null) el.append(k instanceof Node ? k : document.createTextNode(String(k))); }); return el; }

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  briefcase: 'M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18',
  layers: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  calendar: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18',
  check: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  ok: 'M20 6 9 17l-5-5',
  award: 'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.2 13.9 7 23l5-3 5 3-1.2-9.1',
  pen: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  wallet: 'M20 7H5a2 2 0 0 1 0-4h13v4M3 5v14a2 2 0 0 0 2 2h15V7M16 14h.01',
  receipt: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6M9 16h3',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  chart: 'M3 3v18h18M7 15v3M12 10v8M17 6v12',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  plus: 'M12 5v14M5 12h14',
  edit: 'M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  x: 'M18 6 6 18M6 6l12 12',
  menu: 'M3 6h18M3 12h18M3 18h18',
  back: 'M9 18l6-6-6-6',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  copy: 'M9 9h11v11H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  printer: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  up: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  down: 'M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  lock: 'M5 11h14v11H5zM7 11V7a5 5 0 0 1 10 0v4',
  unlock: 'M5 11h14v11H5zM7 11V7a5 5 0 0 1 9.9-1',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4',
  key: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4',
  wand: 'M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M15 9h.01M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5'
};
function icon(n, s = 18) { const el = sv('svg', { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }); el.append(sv('path', { d: ICONS[n] || ICONS.info })); return el; }

/* ---------- Small widgets ---------- */
const badge = (t, cls = '', plain) => h('span', { class: 'badge ' + cls + (plain ? ' plain' : '') }, t);
const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join(' ');
const hashTone = s => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return 't' + (x % 4); };
const avatar = (name, cls = '') => h('span', { class: 'av ' + hashTone(name) + ' ' + cls, 'aria-hidden': 'true' }, initials(name));
const person = (name, sub, onclick) => h('div', { class: 'person' }, avatar(name), h('div', { style: { minWidth: 0 } }, onclick ? h('a', { href: '#', class: 'nm', onclick: e => { e.preventDefault(); onclick(); } }, name) : h('div', { class: 'nm' }, name), sub ? h('div', { class: 'sub' }, sub) : null));
const pageHead = (title, sub, ...actions) => h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, title), sub ? h('p', {}, sub) : null), h('div', { class: 'page-actions' }, actions));
function card(title, body, opt = {}) { return h('section', { class: 'card ' + (opt.cls || '') }, title ? h('div', { class: 'card-h' }, h('h3', {}, title, opt.sub ? h('span', { class: 'sub' }, '  ·  ' + opt.sub) : null), opt.actions ? h('div', { class: 'row' }, opt.actions) : null) : null, h('div', { class: 'card-b' + (opt.flush ? ' flush' : '') }, body)); }
function kpi({ label, value, sub, tone = '', ic = 'chart', extra }) { return h('div', { class: 'kpi ' + tone }, h('div', { class: 'kpi-top' }, h('span', {}, label), h('span', { class: 'kpi-ic' }, icon(ic, 17))), h('div', { class: 'kpi-v' }, value), sub != null ? h('div', { class: 'kpi-s' }, sub) : null, extra || null); }
function emptyState(text, action, ic = 'info') { return h('div', { class: 'empty' }, h('div', { class: 'empty-ic' }, icon(ic, 22)), h('div', {}, text), action || null); }
function progress(p, tone) { const t = tone || (p >= 90 ? 'ok' : p >= 75 ? '' : p >= 60 ? 'warn' : 'bad'); return h('div', { class: 'prog ' + t }, h('i', { style: { width: clamp(p || 0, 0, 100) + '%' } })); }
const pctCell = (p, tone) => p == null ? h('span', { class: 'muted' }, '—') : h('div', { class: 'pct-cell' }, h('b', { class: 'tabnum' }, fmtPct(p, 0)), progress(p, tone));
function selectEl(options, value, onchange, attrs = {}) { const s = h('select', { class: 'select sm', ...attrs, onchange: e => onchange(e.target.value) }, options.map(([v, l]) => h('option', { value: v }, l))); s.value = value == null ? '' : value; return s; }
function seg(options, value, onchange) { const el = h('div', { class: 'seg', role: 'tablist' }); options.forEach(([v, l]) => el.append(h('button', { class: v === value ? 'on' : '', role: 'tab', 'aria-selected': String(v === value), onclick: () => onchange(v) }, l))); return el; }
function tabs(items, active, onChange) {
  const bar = h('div', { class: 'tabs', role: 'tablist' }); const body = h('div', { style: { paddingTop: '16px' } }); let cur = active || items[0].key;
  function draw() { bar.replaceChildren(...items.map(it => h('button', { class: it.key === cur ? 'on' : '', role: 'tab', 'aria-selected': String(it.key === cur), onclick: () => { cur = it.key; onChange && onChange(cur); draw(); } }, it.label))); body.replaceChildren(); const it = items.find(i => i.key === cur); try { append(body, [it.render()]); } catch (e) { console.error(e); body.append(emptyState('تعذّر عرض هذا القسم')); } }
  draw(); return h('div', {}, bar, body);
}
function kv(pairs) { const dl = h('dl', { class: 'kv' }); pairs.forEach(([k, v]) => dl.append(h('dt', {}, k), h('dd', {}, v == null || v === '' ? '—' : v))); return dl; }
function banner(text, tone = '', ic = 'info') { return h('div', { class: 'banner ' + tone }, icon(ic, 17), h('div', {}, text)); }

/* ---------- Toast ---------- */
const toast = (() => {
  let box;
  function show(msg, type = 'info', opt = {}) {
    if (!box || !box.isConnected) { box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
    const t = h('div', { class: 'toast ' + type }, icon(type === 'success' ? 'ok' : type === 'error' || type === 'warning' ? 'alert' : 'info', 18), h('span', {}, msg),
      opt.undo ? h('button', { class: 'toast-act', onclick: () => { opt.undo(); t.remove(); } }, 'تراجع') : null,
      h('button', { class: 'toast-x', 'aria-label': 'إغلاق', onclick: () => t.remove() }, icon('x', 15)));
    box.append(t); setTimeout(() => t.remove(), opt.ms || (opt.undo ? 6500 : 4500));
  }
  return { show, success: (m, o) => show(m, 'success', o), error: (m, o) => show(m, 'error', o), info: (m, o) => show(m, 'info', o), warning: (m, o) => show(m, 'warning', o) };
})();
window.toast = toast;

/* ---------- Modal ---------- */
const isModalOpen = () => !!document.querySelector('.modal-back');
function openModal({ title, body, footer, size = 'md', onClose }) {
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: 'modal ' + size, role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const bd = h('div', { class: 'modal-b' }, body);
  box.append(h('div', { class: 'modal-h' }, h('h3', {}, title), h('button', { class: 'icon-btn sm', 'aria-label': 'إغلاق', onclick: () => close() }, icon('x'))), bd);
  if (footer) box.append(h('div', { class: 'modal-f' }, footer));
  back.append(box); document.body.append(back);
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  const prev = document.activeElement;
  back.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') { const f = $$('button,input,select,textarea,a[href]', box).filter(x => !x.disabled && x.offsetParent !== null); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
  });
  setTimeout(() => { const f = box.querySelector('[autofocus]') || bd.querySelector('input:not([type=checkbox]):not([disabled]),select,textarea') || box.querySelector('.modal-f .btn.primary') || box.querySelector('.modal-h button'); f && f.focus(); }, 40);
  let closed = false;
  function close() { if (closed) return; closed = true; back.remove(); onClose && onClose(); if (prev && prev.isConnected && prev.focus) prev.focus(); }
  return { close, box, body: bd };
}
function confirmDialog({ title = 'تأكيد', message, ok = 'تأكيد', danger = false }) {
  return new Promise(res => {
    let done = false;
    const m = openModal({ title, size: 'sm', body: h('p', { class: 'confirm-msg' }, message), footer: [h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => { done = true; m.close(); res(true); } }, ok), h('button', { class: 'btn ghost', onclick: () => { done = true; m.close(); res(false); } }, 'إلغاء')], onClose: () => { if (!done) res(false); } });
  });
}
function validateField(f, v) {
  if (f.required && (v === '' || v == null || (f.type === 'checkbox' && !v))) return 'هذا الحقل مطلوب';
  if (v === '' || v == null) return null;
  if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'صيغة البريد الإلكتروني غير صحيحة';
  if (f.type === 'tel' && !/^[+\d][\d\s-]{6,}$/.test(v)) return 'رقم الهاتف غير صحيح';
  if (f.type === 'number') { if (isNaN(v)) return 'أدخل رقمًا صحيحًا'; if (f.min != null && v < f.min) return 'القيمة أقل من الحد الأدنى (' + fmtNum(f.min) + ')'; if (f.max != null && v > f.max) return 'القيمة أكبر من الحد الأعلى (' + fmtNum(f.max) + ')'; }
  if (f.validate) return f.validate(v);
  return null;
}
function formModal({ title, fields, values = {}, submit = 'حفظ', onSubmit, size = 'md', intro, extra }) {
  const form = h('form', { class: 'form-grid', novalidate: true });
  const inputs = {}, errs = {};
  fields.forEach(f => {
    if (f.section) { form.append(h('div', { class: 'form-sec span2' }, f.section)); return; }
    const id = 'f-' + f.name; const v = values[f.name] ?? f.default ?? '';
    let inp;
    if (f.type === 'select') { inp = h('select', { class: 'select', id, name: f.name }, f.placeholder ? h('option', { value: '' }, f.placeholder) : null, (typeof f.options === 'function' ? f.options(values) : f.options).map(([ov, ol]) => h('option', { value: ov }, ol))); inp.value = v; }
    else if (f.type === 'textarea') { inp = h('textarea', { class: 'input', id, name: f.name, rows: f.rows || 3, placeholder: f.placeholder || '' }); inp.value = v; }
    else if (f.type === 'checkbox') { inp = h('input', { type: 'checkbox', id, name: f.name }); inp.checked = !!v; }
    else { inp = h('input', { class: 'input', id, name: f.name, type: f.type || 'text', placeholder: f.placeholder || '', min: f.min, max: f.max, step: f.step, autocomplete: f.autocomplete || 'off', dir: f.ltr ? 'ltr' : null }); inp.value = v; }
    if (f.disabled) inp.disabled = true;
    inputs[f.name] = inp; errs[f.name] = h('div', { class: 'field-err', id: id + '-err' });
    inp.setAttribute('aria-describedby', id + '-err');
    form.append(f.type === 'checkbox'
      ? h('div', { class: 'field' + (f.span ? ' span2' : '') }, h('label', { class: 'check', for: id }, inp, f.label), errs[f.name])
      : h('div', { class: 'field' + (f.span ? ' span2' : '') }, h('label', { for: id }, f.label, f.required ? h('span', { class: 'req' }, ' *') : null), inp, f.hint ? h('div', { class: 'hint' }, f.hint) : null, errs[f.name]));
  });
  const gerr = h('div', { class: 'form-err', role: 'alert' });
  form.append(gerr, h('button', { type: 'submit', hidden: true }));
  const saveBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => form.requestSubmit() }, submit);
  const m = openModal({ title, size, body: [intro ? h('div', { class: 'mb' }, intro) : null, form, extra || null], footer: [saveBtn, h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, 'إلغاء')] });
  form.addEventListener('submit', async e => {
    e.preventDefault(); gerr.textContent = '';
    Object.values(errs).forEach(x => x.textContent = ''); Object.values(inputs).forEach(x => x.classList.remove('invalid'));
    const vals = {}; let bad = false;
    for (const f of fields) {
      if (f.section) continue; const inp = inputs[f.name];
      let v = f.type === 'checkbox' ? inp.checked : inp.value.trim();
      if (f.type === 'number' && v !== '') v = Number(v);
      vals[f.name] = v;
      const msg = validateField(f, v);
      if (msg) { bad = true; inp.classList.add('invalid'); errs[f.name].textContent = msg; }
    }
    if (bad) { gerr.textContent = 'يرجى التأكد من تعبئة جميع الحقول المطلوبة بشكل صحيح.'; const first = form.querySelector('.invalid'); first && first.focus(); return; }
    saveBtn.disabled = true;
    try { const r = await onSubmit(vals, m); if (typeof r === 'string') { gerr.textContent = r; return; } if (r !== false) m.close(); }
    catch (err) { console.error(err); gerr.textContent = 'حدث خطأ غير متوقع: ' + err.message; }
    finally { saveBtn.disabled = false; }
  });
  return m;
}

/* ---------- Export / copy / print ---------- */
async function copyText(text, okMsg = 'تم النسخ إلى الحافظة') {
  try { await navigator.clipboard.writeText(text); toast.success(okMsg); return true; } catch (e) { return false; }
}
function exportText(name, text, mime = 'text/plain') {
  Audit.log('export', 'system', name, null, { name });
  if (TOP) {
    try { const url = URL.createObjectURL(new Blob([text], { type: mime + ';charset=utf-8' })); const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); toast.success('تم تنزيل الملف ' + name); return; } catch (e) { }
  }
  const ta = h('textarea', { class: 'input', rows: 12, readonly: true, dir: 'ltr', style: { fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: '12px' } }); ta.value = text;
  const m = openModal({ title: 'تصدير: ' + name, size: 'lg', body: [banner('تنزيل الملفات غير متاح في هذه المعاينة. انسخ المحتوى والصقه في ملف باسم ' + name + '، أو افتح نسخة التطبيق المحلية للتنزيل المباشر.', 'warn', 'info'), h('div', { style: { height: '12px' } }), ta], footer: [h('button', { class: 'btn primary', onclick: async () => { if (!(await copyText(text))) { ta.focus(); ta.select(); toast.info('حدّد النص وانسخه يدويًا (Ctrl+C)'); } } }, icon('copy', 16), 'نسخ المحتوى'), h('button', { class: 'btn ghost', onclick: () => m.close() }, 'إغلاق')] });
  setTimeout(() => ta.select(), 60);
}
const canPrint = () => TOP;
function printNode(node, what = 'document') {
  if (!TOP) { toast.info('الطباعة غير متاحة داخل هذه المعاينة. افتح ملف التطبيق المحلي في المتصفح ثم اطبع.'); return; }
  let area = $('#print-area'); if (area) area.remove();
  area = h('div', { id: 'print-area' }, node.cloneNode(true)); document.body.append(area);
  Audit.log('print', 'system', what, null, null);
  setTimeout(() => { window.print(); setTimeout(() => area.remove(), 500); }, 60);
}
const printBtn = (getNode, what, label = 'طباعة') => canPrint() ? h('button', { class: 'btn', onclick: () => printNode(getNode(), what) }, icon('printer', 16), label) : null;

/* ---------- DataTable ---------- */
function DataTable(cfg) {
  const id = cfg.id || 'dt'; const ps = cfg.pageSize || 12;
  const st = { q: '', sort: cfg.defaultSort ?? null, dir: cfg.defaultDir || 1, page: 0, f: {} };
  const root = h('div', { class: 'dt' });
  const countEl = h('span', { class: 'dt-count' });
  const search = cfg.search === false ? null : h('div', { class: 'search-in' }, icon('search', 16), h('input', { type: 'search', class: 'input', id: id + '-q', placeholder: cfg.searchPh || 'بحث...', 'aria-label': 'بحث', oninput: e => { st.q = e.target.value; st.page = 0; draw(); } }));
  const fsel = (cfg.filters || []).map((f, i) => { const s = h('select', { class: 'select sm', id: id + '-f' + i, 'aria-label': f.label, onchange: e => { st.f[i] = e.target.value; st.page = 0; draw(); } }, h('option', { value: '' }, f.label), f.options.map(([v, l]) => h('option', { value: v }, l))); if (f.value) { s.value = f.value; st.f[i] = f.value; } return s; });
  const bar = h('div', { class: 'dt-bar' }, search, ...fsel, h('div', { class: 'grow' }), countEl, cfg.exportName ? h('button', { class: 'btn ghost sm', onclick: () => exportText(cfg.exportName + '.csv', '﻿' + csv(), 'text/csv') }, icon('download', 15), 'CSV') : null, ...(cfg.toolbar || []));
  const table = h('table', { class: 'tbl' + (cfg.cards === false ? '' : ' cards') });
  const pager = h('div', { class: 'pager' });
  root.append(bar, h('div', { class: 'tbl-wrap' }, table), pager);
  const colText = (c, r) => c.text ? c.text(r) : c.sort ? c.sort(r) : r[c.key];
  function rowsNow() {
    let rs = typeof cfg.rows === 'function' ? cfg.rows() : cfg.rows;
    if (st.q) { const q = normAr(st.q); rs = rs.filter(r => normAr(cfg.searchText ? cfg.searchText(r) : cfg.columns.map(c => colText(c, r)).join(' ')).includes(q)); }
    (cfg.filters || []).forEach((f, i) => { if (st.f[i]) rs = rs.filter(r => f.test(r, st.f[i])); });
    if (st.sort != null) { const c = cfg.columns[st.sort]; const val = c.sort || (r => r[c.key]); rs = [...rs].sort((a, b) => { const x = val(a), y = val(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ar')) * st.dir; }); }
    return rs;
  }
  function draw() {
    const rs = rowsNow(); const pages = Math.max(1, Math.ceil(rs.length / ps)); if (st.page >= pages) st.page = pages - 1;
    const slice = rs.slice(st.page * ps, st.page * ps + ps);
    table.replaceChildren(
      h('thead', {}, h('tr', {}, cfg.columns.map((c, i) => h('th', { class: (c.cls || '') + (c.sortable === false ? '' : ' sortable'), scope: 'col', onclick: c.sortable === false ? null : () => { if (st.sort === i) st.dir *= -1; else { st.sort = i; st.dir = c.desc ? -1 : 1; } draw(); } }, c.label, st.sort === i ? h('span', { class: 'sort-ind' }, st.dir > 0 ? '▲' : '▼') : null)))),
      h('tbody', {}, slice.length ? slice.map(r => h('tr', { class: cfg.onRow ? 'clickable' : '', onclick: cfg.onRow ? e => { if (e.target.closest('button,a,input,select,label')) return; cfg.onRow(r); } : null }, cfg.columns.map(c => h('td', { class: c.cls || '', 'data-label': c.label }, c.render ? c.render(r) : (r[c.key] ?? '—'))))) : h('tr', {}, h('td', { colspan: cfg.columns.length, class: 'empty-cell' }, emptyState(cfg.empty || 'لا توجد نتائج مطابقة', null, 'search'))))
    );
    countEl.textContent = fmtNum(rs.length) + ' ' + (cfg.unit || 'سجل');
    pager.replaceChildren();
    if (pages > 1) pager.append(h('button', { class: 'btn ghost sm', disabled: st.page === 0, onclick: () => { st.page--; draw(); } }, 'السابق'), h('span', {}, `صفحة ${fmtNum(st.page + 1)} من ${fmtNum(pages)}`), h('button', { class: 'btn ghost sm', disabled: st.page >= pages - 1, onclick: () => { st.page++; draw(); } }, 'التالي'));
  }
  function csv() {
    const cols = cfg.columns.filter(c => c.csv !== false);
    const esc = v => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [cols.map(c => esc(c.label)).join(','), ...rowsNow().map(r => cols.map(c => esc(c.csv ? c.csv(r) : colText(c, r))).join(','))].join('\r\n');
  }
  draw(); root.refresh = draw; root.csv = csv; return root;
}

/* ---------- Charts (pure SVG, drawn to one scale) ---------- */
function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
function legend(series) { return series.length > 1 ? h('div', { class: 'legend' }, series.map(s => h('span', {}, h('i', { style: { background: s.color } }), s.name))) : null; }
const shortNum = v => v >= 1e6 ? fmtNum(v / 1e6, v % 1e6 ? 1 : 0) + 'م' : v >= 1e3 ? fmtNum(v / 1e3, 0) + 'ألف' : fmtNum(v, v < 10 && v % 1 ? 1 : 0);
function barChart({ labels, series, height = 230, fmt = shortNum, tip = fmtNum, max, yTicks = 4, showVals = false }) {
  const W = 640, H = height, pl = 52, pr = 10, pt = 14, pb = 36;
  const vmax = max ?? niceMax(Math.max(1, ...series.flatMap(s => s.values.map(v => v || 0))));
  const iw = W - pl - pr, ih = H - pt - pb, n = labels.length, g = iw / Math.max(1, n);
  const bw = Math.min(30, (g * 0.72) / series.length);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', direction: 'ltr' });
  for (let i = 0; i <= yTicks; i++) { const v = vmax * i / yTicks, y = pt + ih - ih * i / yTicks; svg.append(sv('line', { x1: pl, x2: W - pr, y1: y, y2: y, class: 'grid' }), sv('text', { x: pl - 8, y: y + 4, class: 'tick', 'text-anchor': 'end' }, fmt(v))); }
  const step = n > 14 ? Math.ceil(n / 12) : 1;
  labels.forEach((lb, i) => {
    const cx = pl + g * i + g / 2;
    series.forEach((s, j) => {
      const v = s.values[i] || 0; const bh = ih * Math.min(v, vmax) / vmax; const x = cx - (bw * series.length) / 2 + j * bw;
      svg.append(sv('rect', { x: x + 1, y: pt + ih - bh, width: Math.max(1, bw - 2), height: Math.max(0, bh), rx: 3, fill: s.color || 'var(--c1)' }, sv('title', {}, `${lb}${s.name ? ' — ' + s.name : ''}: ${tip(v)}`)));
      if (showVals && v) svg.append(sv('text', { x: x + bw / 2, y: pt + ih - bh - 5, class: 'val', 'text-anchor': 'middle' }, fmt(v)));
    });
    if (i % step === 0) svg.append(sv('text', { x: cx, y: H - 14, class: 'tick', 'text-anchor': 'middle' }, lb));
  });
  svg.append(sv('line', { x1: pl, x2: W - pr, y1: pt + ih, y2: pt + ih, class: 'axis' }));
  return h('div', { class: 'chart-box' }, legend(series), svg);
}
function lineChart({ labels, series, height = 230, fmt = v => fmtNum(v), tip = fmt, min = 0, max, yTicks = 4, area = true }) {
  const W = 640, H = height, pl = 46, pr = 14, pt = 16, pb = 36;
  const vals = series.flatMap(s => s.values.filter(v => v != null));
  const vmax = max ?? niceMax(Math.max(1, ...vals)); const vmin = min;
  const iw = W - pl - pr, ih = H - pt - pb, n = labels.length;
  const X = i => pl + (n <= 1 ? iw / 2 : iw * i / (n - 1)); const Y = v => pt + ih - ih * (v - vmin) / (vmax - vmin || 1);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', direction: 'ltr' });
  for (let i = 0; i <= yTicks; i++) { const v = vmin + (vmax - vmin) * i / yTicks, y = Y(v); svg.append(sv('line', { x1: pl, x2: W - pr, y1: y, y2: y, class: 'grid' }), sv('text', { x: pl - 8, y: y + 4, class: 'tick', 'text-anchor': 'end' }, fmt(v))); }
  const step = Math.max(1, Math.ceil(n / 8));
  labels.forEach((lb, i) => { if ((i % step === 0 && (n - 1 - i >= step * 0.7)) || i === n - 1) svg.append(sv('text', { x: X(i), y: H - 14, class: 'tick', 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }, lb)); });
  series.forEach(s => {
    const pts = s.values.map((v, i) => v == null ? null : [X(i), Y(clamp(v, vmin, vmax))]).filter(Boolean);
    if (!pts.length) return;
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('');
    if (area && series.length === 1) svg.append(sv('path', { d: d + `L${pts[pts.length - 1][0]},${pt + ih}L${pts[0][0]},${pt + ih}Z`, fill: s.color, 'fill-opacity': .12, stroke: 'none' }));
    svg.append(sv('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    s.values.forEach((v, i) => { if (v == null) return; const last = i === s.values.length - 1; svg.append(sv('circle', { cx: X(i), cy: Y(clamp(v, vmin, vmax)), r: last ? 4.5 : 3, fill: last ? s.color : 'var(--surface)', stroke: s.color, 'stroke-width': 2 }, sv('title', {}, `${labels[i]}${s.name ? ' — ' + s.name : ''}: ${tip(v)}`))); });
  });
  svg.append(sv('line', { x1: pl, x2: W - pr, y1: pt + ih, y2: pt + ih, class: 'axis' }));
  return h('div', { class: 'chart-box' }, legend(series), svg);
}
function donut({ items, size = 168, thick = 24, center, sub, fmt = fmtNum }) {
  const total = sum(items.map(i => i.value)); const r = size / 2 - thick / 2; const C = 2 * Math.PI * r; let off = 0;
  const svg = sv('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: 'img' });
  svg.append(sv('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'var(--sunken)', 'stroke-width': thick }));
  const gap = items.filter(i => i.value > 0).length > 1 ? 2 : 0;
  items.forEach(it => { if (!total || !it.value) return; const len = C * it.value / total; svg.append(sv('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: it.color, 'stroke-width': thick, 'stroke-dasharray': `${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}`, 'stroke-dashoffset': -off, transform: `rotate(-90 ${size / 2} ${size / 2})` }, sv('title', {}, `${it.label}: ${fmt(it.value)}`))); off += len; });
  if (center != null) { svg.append(sv('text', { x: size / 2, y: size / 2 + (sub ? 3 : 8), 'text-anchor': 'middle', class: 'donut-c' }, center)); if (sub) svg.append(sv('text', { x: size / 2, y: size / 2 + 22, 'text-anchor': 'middle', class: 'donut-s' }, sub)); }
  return h('div', { class: 'donut-wrap' }, svg, h('ul', { class: 'donut-legend' }, items.map(it => h('li', {}, h('i', { style: { background: it.color } }), h('span', {}, it.label), h('b', { class: 'tabnum' }, fmt(it.value) + (total ? ' · ' + fmtPct(it.value / total * 100) : ''))))));
}
function hbars(rows, { max, fmt = v => fmtPct(v, 0), color } = {}) {
  const m = max ?? Math.max(1, ...rows.map(r => r.value || 0));
  return h('div', { class: 'hbars' }, rows.map(r => h('div', { class: 'hbar', title: `${r.label}: ${fmt(r.value)}` }, h('span', { class: 'lb' }, r.label), h('div', { class: 'tr' }, h('i', { style: { width: clamp((r.value || 0) / m * 100, 0, 100) + '%', background: r.color || color || 'var(--c1)' } })), h('b', { class: 'tabnum' }, r.value == null ? '—' : fmt(r.value)))));
}
function spark(values, color = 'var(--c1)', w = 96, hgt = 26) {
  const v = values.filter(x => x != null); const svg = sv('svg', { width: w, height: hgt, viewBox: `0 0 ${w} ${hgt}`, class: 'spark' });
  if (v.length < 2) return svg;
  const mn = Math.min(...v), mx = Math.max(...v), rg = mx - mn || 1;
  const pts = v.map((x, i) => [i * (w - 4) / (v.length - 1) + 2, hgt - 3 - (x - mn) / rg * (hgt - 6)]);
  svg.append(sv('polyline', { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: color, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }), sv('circle', { cx: pts[pts.length - 1][0], cy: pts[pts.length - 1][1], r: 2.6, fill: color }));
  return svg;
}
function gauge(score, tone) {
  const color = tone === 'bad' ? 'var(--red)' : tone === 'warn' ? 'var(--amber)' : 'var(--green)';
  const r = 48, cx = 59, cy = 58, C = Math.PI * r;
  const svg = sv('svg', { width: 118, height: 66, viewBox: '0 0 118 66' });
  svg.append(sv('path', { d: `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`, fill: 'none', stroke: 'var(--sunken)', 'stroke-width': 10, 'stroke-linecap': 'round' }));
  svg.append(sv('path', { d: `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`, fill: 'none', stroke: color, 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-dasharray': `${C * clamp(score, 0, 100) / 100} ${C}` }));
  return h('div', { class: 'gauge', title: 'درجة الخطر من 100' }, svg, h('b', { class: 'tabnum', style: { color } }, fmtNum(score)));
}

/* ---------- Attendance calendar ---------- */
function attCalendar(recs, from, to) {
  const map = new Map(recs.map(r => [r.date, r])); const days = Settings.get().schoolDays;
  const grid = h('div', { class: 'cal' }); days.forEach(d => grid.append(h('div', { class: 'hd' }, DAYS[d])));
  let d = from; while (dow(d) !== days[0]) d = addDays(d, -1);
  const cells = [];
  while (d <= to) { if (days.includes(dow(d))) { const r = map.get(d); const out = d < from; cells.push(h('div', { class: 'd ' + (r ? r.status : '') + (out ? ' out' : ''), title: fmtDate(d) + (r ? ' — ' + ATT_LABEL[r.status] + (r.reason ? ' (' + r.reason + ')' : '') : ' — لم يُسجَّل') }, h('b', {}, parseISO(d).getDate()), h('span', {}, MONTHS[parseISO(d).getMonth()].split(' ')[0]))); } d = addDays(d, 1); }
  grid.append(...cells);
  return h('div', { class: 'stack' }, grid, h('div', { class: 'cal-legend' }, Object.entries(ATT_LABEL).map(([k, l]) => h('span', {}, h('i', { style: { background: k === 'present' ? 'var(--green-soft)' : k === 'absent' ? 'var(--red)' : k === 'late' ? 'var(--amber-soft)' : 'var(--blue-soft)' } }), l)), h('span', {}, h('i', { style: { background: 'var(--sunken)' } }), 'لم يُسجَّل')));
}

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
  function svg(text, px = 112) {
    const M = encode(text), n = M.length, q = 4, s = n + q * 2; let d = '';
    M.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + q},${y + q}h1v1h-1z`; }));
    const el = sv('svg', { viewBox: `0 0 ${s} ${s}`, width: px, height: px, 'shape-rendering': 'crispEdges', role: 'img', 'aria-label': 'رمز QR للتحقق' });
    el.append(sv('rect', { width: s, height: s, fill: '#ffffff' }), sv('path', { d, fill: '#000000' }));
    return el;
  }
  return { encode, svg };
})();
