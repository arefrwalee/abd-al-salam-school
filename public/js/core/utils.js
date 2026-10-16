'use strict';
/* أدوات عامة: تنسيق الأرقام والتواريخ، النصوص العربية، المولّدات */
document.documentElement.lang = 'ar'; document.documentElement.dir = 'rtl';
/* ---------- Utils ---------- */
const LOCALE = 'ar-SY-u-nu-latn';
const fmtNum = (n, d = 0) => (n == null || isNaN(n)) ? '—' : new Intl.NumberFormat(LOCALE, { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
const fmtPct = (n, d = 0) => (n == null || isNaN(n)) ? '—' : fmtNum(n, d) + '%';
const fmtMoney = n => fmtNum(Math.round(n || 0)) + ' ' + (Settings.get().currency || 'ل.س');
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const GRADE_NAMES = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];
const gradeName = g => 'الصف ' + (GRADE_NAMES[g - 1] || g);
const pad2 = n => String(n).padStart(2, '0');
const iso = d => { const x = new Date(d); return x.getFullYear() + '-' + pad2(x.getMonth() + 1) + '-' + pad2(x.getDate()); };
const parseISO = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const todayISO = () => iso(new Date());
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
const dow = s => parseISO(s).getDay();
const fmtDate = s => { if (!s) return '—'; const d = parseISO(s); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
const fmtDateShort = s => { if (!s) return '—'; const d = parseISO(s); return d.getDate() + ' ' + MONTHS[d.getMonth()]; };
const fmtTime = s => { const d = new Date(s); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
const fmtDateTime = s => s ? fmtDate(iso(new Date(s))) + '، ' + fmtTime(s) : '—';
const monthKey = s => String(s).slice(0, 7);
const monthLabel = k => { const [y, m] = k.split('-').map(Number); return MONTHS[m - 1] + ' ' + y; };
const relTime = s => {
  const diff = (Date.now() - new Date(s).getTime()) / 1000;
  if (diff < 60) return 'الآن';
  if (diff < 3600) return 'منذ ' + fmtNum(Math.floor(diff / 60)) + ' دقيقة';
  if (diff < 86400) return 'منذ ' + fmtNum(Math.floor(diff / 3600)) + ' ساعة';
  if (diff < 86400 * 7) return 'منذ ' + fmtNum(Math.floor(diff / 86400)) + ' يوم';
  return fmtDate(iso(new Date(s)));
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const randCode = n => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = arr => arr.reduce((a, b) => a + (b || 0), 0);
const avg = arr => arr.length ? sum(arr) / arr.length : null;
const std = arr => { const m = avg(arr); return arr.length ? Math.sqrt(avg(arr.map(x => (x - m) ** 2))) : 0; };
const groupBy = (arr, fn) => { const m = new Map(); for (const x of arr) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
const normAr = s => String(s ?? '')
  .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660))
  .replace(/[ً-ْـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .toLowerCase().replace(/\s+/g, ' ').trim();
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const TOP = (() => { try { return window.self === window.top; } catch (e) { return false; } })();

