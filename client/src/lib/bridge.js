/* =====================================================================
   الجسر بين طبقة البيانات وواجهة React
   - toast: تنبيهات قصيرة تعرضها <Toaster/>
   - nav: التنقل بالروابط (#students …) دون مكتبة توجيه خارجية
   - createStore: مخزن صغير يشترك فيه React عبر useSyncExternalStore
   ===================================================================== */
export function createStore(initial) {
  let state = initial; const subs = new Set();
  return {
    get: () => state,
    set: (next) => { state = typeof next === 'function' ? next(state) : next; subs.forEach(f => f()); },
    subscribe: (f) => { subs.add(f); return () => subs.delete(f); }
  };
}

/* ---------- Toasts ---------- */
export const toastStore = createStore([]);
let toastId = 0;
function show(msg, type = 'info', opt = {}) {
  const id = ++toastId;
  toastStore.set(list => [...list, { id, msg, type, undo: opt.undo }]);
  setTimeout(() => dismissToast(id), opt.ms || (opt.undo ? 6500 : 4500));
}
export const dismissToast = id => toastStore.set(list => list.filter(t => t.id !== id));
export const toast = {
  show,
  success: (m, o) => show(m, 'success', o), error: (m, o) => show(m, 'error', o),
  info: (m, o) => show(m, 'info', o), warning: (m, o) => show(m, 'warning', o)
};

/* ---------- Hash navigation ---------- */
export function parseHash() {
  const raw = decodeURIComponent(location.hash.slice(1)) || 'dashboard';
  const i = raw.indexOf('-');
  return i > 0 ? [raw.slice(0, i), raw.slice(i + 1)] : [raw, null];
}
export const routeStore = createStore(parseHash());
window.addEventListener('hashchange', () => routeStore.set(parseHash()));
export function go(route, param) {
  const target = '#' + route + (param ? '-' + param : '');
  if (location.hash === target) routeStore.set(parseHash()); else location.hash = target;
}
/** in-page hints passed between pages (replaces sessionStorage) */
const hints = {};
export const navHint = { set: (k, v) => { hints[k] = v; }, take: k => { const v = hints[k]; delete hints[k]; return v ?? null; } };
