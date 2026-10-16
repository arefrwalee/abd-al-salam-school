/* الوضع الفاتح/الداكن — تفضيل واجهة فقط (ليس بيانات المدرسة) */
import { Store } from './store.js';
import { createStore } from './bridge.js';

export const themeStore = createStore(0);
export function themePref() { return Store.get('ass:theme') || 'system'; }
export function applyTheme(p = themePref()) { const r = document.documentElement; if (p === 'system') delete r.dataset.theme; else r.dataset.theme = p; themeStore.set(v => v + 1); }
export function setTheme(p) { Store.set('ass:theme', p); applyTheme(p); }
export function effectiveDark() { const p = themePref(); return p === 'dark' || (p === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
export function toggleTheme() { setTheme(effectiveDark() ? 'light' : 'dark'); }
if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => themeStore.set(v => v + 1)); } catch (e) { } }
