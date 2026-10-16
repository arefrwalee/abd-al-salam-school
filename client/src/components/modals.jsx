/* =====================================================================
   النوافذ المنبثقة والنماذج والتنبيهات والتصدير والطباعة
   تُفتح من أي مكان عبر دوال: openModal / confirmDialog / formModal
   ===================================================================== */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createStore, toastStore, dismissToast, toast } from '../lib/bridge.js';
import { TOP, fmtNum } from '../lib/utils.js';
import { Audit } from '../lib/store.js';
import { Icon, Banner, cx } from './ui.jsx';

const modalStore = createStore([]);
let mid = 0;
/** يفتح نافذة: render({close}) يعيد المحتوى */
export function openModal({ title, size = 'md', render, onClose }) {
  const id = ++mid;
  const close = () => { if (!modalStore.get().some(m => m.id === id)) return; modalStore.set(l => l.filter(m => m.id !== id)); onClose && onClose(); };
  modalStore.set(l => [...l, { id, title, size, render, close }]);
  return { close };
}
export const closeAllModals = () => modalStore.get().forEach(m => m.close());
export function ModalHost() {
  const list = useSyncExternalStore(modalStore.subscribe, modalStore.get);
  useEffect(() => {
    if (!list.length) return;
    const onEsc = e => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); list[list.length - 1].close(); } };
    document.addEventListener('keydown', onEsc); return () => document.removeEventListener('keydown', onEsc);
  }, [list]);
  return list.map(m => <ModalFrame key={m.id} m={m} />);
}
function ModalFrame({ m }) {
  const box = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const t = setTimeout(() => { const f = box.current && (box.current.querySelector('[autofocus]') || box.current.querySelector('.modal-b input:not([type=checkbox]):not([disabled]), .modal-b select, .modal-b textarea') || box.current.querySelector('.modal-f .btn.primary') || box.current.querySelector('.modal-h button')); f && f.focus(); }, 40);
    return () => { clearTimeout(t); if (prev && prev.isConnected && prev.focus) prev.focus(); };
  }, []);
  const onKey = e => {
    if (e.key === 'Tab') { const f = [...box.current.querySelectorAll('button,input,select,textarea,a[href]')].filter(x => !x.disabled && x.offsetParent !== null); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
  };
  return <div className="modal-back" onMouseDown={e => { if (e.target === e.currentTarget) m.close(); }} onKeyDown={onKey}>
    <div className={cx('modal', m.size)} role="dialog" aria-modal="true" aria-label={m.title} ref={box}>
      <div className="modal-h"><h3>{m.title}</h3><button className="icon-btn sm" aria-label="إغلاق" onClick={m.close}><Icon name="x" /></button></div>
      {m.render({ close: m.close })}
    </div>
  </div>;
}
/** محتوى + أزرار في نافذة */
export const ModalBody = ({ children }) => <div className="modal-b">{children}</div>;
export const ModalFoot = ({ children }) => <div className="modal-f">{children}</div>;

export function confirmDialog({ title = 'تأكيد', message, ok = 'تأكيد', danger = false }) {
  return new Promise(res => {
    let done = false;
    const { close } = openModal({ title, size: 'sm', onClose: () => { if (!done) res(false); }, render: ({ close }) => <>
      <ModalBody><p className="confirm-msg">{message}</p></ModalBody>
      <ModalFoot><button className={cx('btn', danger ? 'danger' : 'primary')} onClick={() => { done = true; close(); res(true); }}>{ok}</button><button className="btn ghost" onClick={() => { done = true; close(); res(false); }}>إلغاء</button></ModalFoot>
    </> });
    void close;
  });
}

/* ---------- Forms ---------- */
function validateField(f, v) {
  if (f.required && (v === '' || v == null || (f.type === 'checkbox' && !v))) return 'هذا الحقل مطلوب';
  if (v === '' || v == null) return null;
  if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'صيغة البريد الإلكتروني غير صحيحة';
  if (f.type === 'tel' && !/^[+\d][\d\s-]{6,}$/.test(v)) return 'رقم الهاتف غير صحيح';
  if (f.type === 'number') { if (isNaN(v)) return 'أدخل رقمًا صحيحًا'; if (f.min != null && v < f.min) return 'القيمة أقل من الحد الأدنى (' + fmtNum(f.min) + ')'; if (f.max != null && v > f.max) return 'القيمة أكبر من الحد الأعلى (' + fmtNum(f.max) + ')'; }
  if (f.validate) return f.validate(v);
  return null;
}
function FormBody({ fields, values, onSubmit, submit, intro, extra, close, onFieldChange }) {
  const init = {}; fields.forEach(f => { if (!f.section) init[f.name] = values[f.name] ?? f.default ?? (f.type === 'checkbox' ? false : ''); });
  const [vals, setVals] = useState(init); const [errs, setErrs] = useState({}); const [gerr, setGerr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (name, v) => setVals(prev => { const next = { ...prev, [name]: v }; if (onFieldChange) { const patch = onFieldChange(name, v, next); if (patch) Object.assign(next, patch); } return next; });
  async function submitForm(e) {
    e && e.preventDefault(); setGerr('');
    const out = {}; const er = {};
    for (const f of fields) { if (f.section) continue; let v = vals[f.name]; if (typeof v === 'string') v = v.trim(); if (f.type === 'number' && v !== '' && v != null) v = Number(v); out[f.name] = v; const m = validateField(f, v); if (m) er[f.name] = m; }
    setErrs(er);
    if (Object.keys(er).length) { setGerr('يرجى التأكد من تعبئة جميع الحقول المطلوبة بشكل صحيح.'); return; }
    setBusy(true);
    try { const r = await onSubmit(out, { close }); if (typeof r === 'string') setGerr(r); else if (r !== false) close(); }
    catch (err) { console.error(err); setGerr('حدث خطأ غير متوقع: ' + err.message); }
    finally { setBusy(false); }
  }
  return <form noValidate onSubmit={submitForm} style={{ display: 'contents' }}>
    <ModalBody>
      {intro && <div className="mb">{typeof intro === 'function' ? intro(vals) : intro}</div>}
      <div className="form-grid">
        {fields.map((f, i) => {
          if (f.section) return <div key={'s' + i} className="form-sec span2">{f.section}</div>;
          const id = 'f-' + f.name; const v = vals[f.name]; const inv = errs[f.name] ? ' invalid' : '';
          const common = { id, name: f.name, disabled: f.disabled, 'aria-describedby': id + '-err' };
          let input;
          if (f.type === 'select') { const opts = typeof f.options === 'function' ? f.options(vals) : f.options; input = <select className={'select' + inv} {...common} value={v ?? ''} onChange={e => set(f.name, e.target.value)}>{f.placeholder != null && <option value="">{f.placeholder}</option>}{opts.map(([ov, ol]) => <option key={ov} value={ov}>{ol}</option>)}</select>; }
          else if (f.type === 'textarea') input = <textarea className={'input' + inv} rows={f.rows || 3} placeholder={f.placeholder || ''} {...common} value={v ?? ''} onChange={e => set(f.name, e.target.value)} />;
          else if (f.type === 'checkbox') return <div key={f.name} className={cx('field', f.span && 'span2')}><label className="check" htmlFor={id}><input type="checkbox" {...common} checked={!!v} onChange={e => set(f.name, e.target.checked)} />{f.label}</label><div className="field-err" id={id + '-err'}>{errs[f.name]}</div></div>;
          else input = <input className={'input' + inv} type={f.type || 'text'} placeholder={f.placeholder || ''} min={f.min} max={f.max} step={f.step} autoComplete={f.autocomplete || 'off'} dir={f.ltr ? 'ltr' : undefined} {...common} value={v ?? ''} onChange={e => set(f.name, e.target.value)} />;
          return <div key={f.name} className={cx('field', f.span && 'span2')}>
            <label htmlFor={id}>{f.label}{f.required && <span className="req"> *</span>}</label>{input}
            {f.hint && <div className="hint">{f.hint}</div>}<div className="field-err" id={id + '-err'}>{errs[f.name]}</div>
          </div>;
        })}
        <div className="form-err" role="alert">{gerr}</div>
      </div>
      {extra && <div style={{ marginTop: 12 }}>{typeof extra === 'function' ? extra(vals) : extra}</div>}
    </ModalBody>
    <ModalFoot><button className="btn primary" type="submit" disabled={busy}>{busy ? 'جارٍ الحفظ...' : submit}</button><button className="btn ghost" type="button" onClick={close}>إلغاء</button></ModalFoot>
  </form>;
}
/** نموذج في نافذة. onSubmit يعيد نص خطأ لإظهاره، أو false لإبقاء النافذة مفتوحة */
export function formModal({ title, fields, values = {}, submit = 'حفظ', onSubmit, size = 'md', intro, extra, onFieldChange }) {
  return openModal({ title, size, render: ({ close }) => <FormBody {...{ fields, values, onSubmit, submit, intro, extra, close, onFieldChange }} /> });
}
/** يعرض بيانات دخول مؤقتة مرة واحدة */
export function credsModal(title, creds) {
  const text = creds.map(([r, un, pw]) => `${r}: ${un} / ${pw}`).join('\n');
  openModal({ title, size: 'sm', render: ({ close }) => <>
    <ModalBody><p className="mb muted">سلّم بيانات الدخول لأصحابها. كلمة المرور مؤقتة وتظهر هذه المرة فقط، ويُطلب تغييرها عند أول دخول.</p>
      <div className="stack">{creds.map(([r, un, pw]) => <div className="demo" key={un}><b>{r}</b><code>{un} / {pw}</code></div>)}</div></ModalBody>
    <ModalFoot><button className="btn primary" onClick={close}>تم</button><button className="btn" onClick={() => copyText(text, 'نُسخت بيانات الدخول')}><Icon name="copy" size={15} />نسخ</button></ModalFoot>
  </> });
}

/* ---------- Export / copy / print ---------- */
export async function copyText(text, okMsg = 'تم النسخ إلى الحافظة') { try { await navigator.clipboard.writeText(text); toast.success(okMsg); return true; } catch (e) { return false; } }
export function exportText(name, text, mime = 'text/plain') {
  Audit.log('export', 'system', name, null, { name });
  if (TOP) { try { const url = URL.createObjectURL(new Blob([text], { type: mime + ';charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); toast.success('تم تنزيل الملف ' + name); return; } catch (e) { } }
  openModal({ title: 'تصدير: ' + name, size: 'lg', render: ({ close }) => <ExportBox name={name} text={text} close={close} /> });
}
function ExportBox({ name, text, close }) {
  const ta = useRef(null);
  useEffect(() => { ta.current && ta.current.select(); }, []);
  return <><ModalBody><Banner tone="warn">تنزيل الملفات غير متاح في هذه المعاينة. انسخ المحتوى والصقه في ملف باسم {name}.</Banner><div style={{ height: 12 }} />
    <textarea ref={ta} className="input" rows={12} readOnly dir="ltr" value={text} style={{ fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 12 }} /></ModalBody>
    <ModalFoot><button className="btn primary" onClick={async () => { if (!(await copyText(text))) { ta.current.select(); toast.info('حدّد النص وانسخه يدويًا (Ctrl+C)'); } }}><Icon name="copy" size={16} />نسخ المحتوى</button><button className="btn ghost" onClick={close}>إغلاق</button></ModalFoot></>;
}
export const canPrint = () => TOP;
export function printElement(el, what = 'document') {
  if (!TOP) { toast.info('الطباعة غير متاحة داخل هذه المعاينة. افتح التطبيق مباشرة في المتصفح ثم اطبع.'); return; }
  if (!el) return;
  document.getElementById('print-area')?.remove();
  const area = document.createElement('div'); area.id = 'print-area'; area.append(el.cloneNode(true)); document.body.append(area);
  Audit.log('print', 'system', what, null, null);
  setTimeout(() => { window.print(); setTimeout(() => area.remove(), 500); }, 60);
}
export const PrintButton = ({ target, what, label = 'طباعة' }) => canPrint() ? <button className="btn" onClick={() => printElement(typeof target === 'function' ? target() : target && target.current, what)}><Icon name="printer" size={16} />{label}</button> : null;

/* ---------- Toasts ---------- */
export function Toaster() {
  const list = useSyncExternalStore(toastStore.subscribe, toastStore.get);
  return <div className="toasts" role="status" aria-live="polite">{list.map(t => <div key={t.id} className={'toast ' + t.type}>
    <Icon name={t.type === 'success' ? 'ok' : t.type === 'error' || t.type === 'warning' ? 'alert' : 'info'} />
    <span>{t.msg}</span>
    {t.undo && <button className="toast-act" onClick={() => { t.undo(); dismissToast(t.id); }}>تراجع</button>}
    <button className="toast-x" aria-label="إغلاق" onClick={() => dismissToast(t.id)}><Icon name="x" size={15} /></button>
  </div>)}</div>;
}
