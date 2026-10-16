/* الإطار العام: القائمة الجانبية، الشريط العلوي، البحث الشامل، الإشعارات، حالة المزامنة */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Icon, Avatar, Crest, Empty, cx } from './ui.jsx';
import { confirmDialog } from './modals.jsx';
import { PAGES, NAV_GROUPS, canSee, Scope } from '../lib/permissions.js';
import { Settings, Bus, isServer, Store, Repo } from '../lib/store.js';
import { Auth, ROLE_LABEL } from '../lib/auth.js';
import { Sync } from '../lib/sync.js';
import { Vault } from '../lib/vault.js';
import { displayName, Notify, NOTIF_ICON, nameOf, classStudents } from '../lib/domain.js';
import { normAr, fmtNum, relTime } from '../lib/utils.js';
import { go } from '../lib/bridge.js';
import { effectiveDark, toggleTheme, themeStore } from '../lib/theme.js';
import { useData } from '../hooks.js';

const syncStore = (() => { let v = 0; const subs = new Set(); Bus.on('sync:state', () => { v++; subs.forEach(f => f()); }); return { get: () => v, subscribe: f => { subs.add(f); return () => subs.delete(f); } }; })();

export function SyncChip() {
  useSyncExternalStore(syncStore.subscribe, syncStore.get);
  if (!isServer()) return <span className="sync-chip demo" title="البيانات في الذاكرة فقط وتُحذف عند إغلاق الصفحة"><Icon name="info" size={14} />وضع العرض</span>;
  const st = Sync.state, n = Sync.pending;
  const map = { online: ['متصل', 'ok', 'ok'], syncing: ['جارٍ المزامنة', 'info', 'refresh'], offline: [n ? `دون اتصال · ${fmtNum(n)} بانتظار الإرسال` : 'دون اتصال', 'warn', 'alert'], auth: ['الجلسة منتهية', 'bad', 'lock'] };
  const m = map[st]; if (!m) return null;
  return <span className={'sync-chip ' + m[1]} role="status" title={Vault.active ? 'نسخة مشفّرة على هذا الجهاز للعمل دون اتصال' : 'البيانات محفوظة على خادم المدرسة'}><Icon name={m[2]} size={14} /><span className="sync-t">{m[0]}</span></span>;
}

export function NotifRow({ n, after }) {
  const [ic, tone] = NOTIF_ICON[n.type] || ['info', ''];
  const open = () => { Notify.markRead(n); after && after(); if (n.link) { const i = n.link.indexOf('-'); i > 0 ? go(n.link.slice(0, i), n.link.slice(i + 1)) : go(n.link); } };
  return <div className={cx('notif', !n.read && 'unread')} role="button" tabIndex={0} onClick={open} onKeyDown={e => { if (e.key === 'Enter') open(); }}>
    <div className={'ic ' + tone}><Icon name={ic} size={17} /></div>
    <div className="bd"><b>{n.title}</b><p>{n.message}</p></div>
    <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}><span className="tm">{relTime(n.createdAt)}</span>{!n.read && <span className="udot" aria-label="غير مقروء" />}</div>
  </div>;
}

function Bell({ user }) {
  const [open, setOpen] = useState(false); const ref = useRef(null);
  useEffect(() => { if (!open) return; const off = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', off); return () => document.removeEventListener('mousedown', off); }, [open]);
  const unread = Notify.unread(user); const list = Notify.mine(user).slice(0, 6);
  return <div className="bell" ref={ref} style={{ position: 'relative' }}>
    <button className="icon-btn" aria-label={'الإشعارات' + (unread ? ` (${unread} غير مقروء)` : '')} onClick={() => setOpen(!open)}><Icon name="bell" /></button>
    {unread > 0 && <span className="dot">{unread > 99 ? '99+' : fmtNum(unread)}</span>}
    {open && <div className="dropdown" role="dialog" aria-label="آخر الإشعارات">
      <div className="dropdown-h">الإشعارات{unread > 0 && <button className="btn ghost xs" onClick={() => Notify.markAll(user)}>تعليم الكل كمقروء</button>}</div>
      {list.length ? <div style={{ maxHeight: 380, overflow: 'auto' }}>{list.map(n => <NotifRow key={n.id} n={n} after={() => setOpen(false)} />)}</div> : <Empty text="لا توجد إشعارات" ic="bell" />}
      <div className="dropdown-f"><a href="#notifications" onClick={() => setOpen(false)}>عرض كل الإشعارات</a></div>
    </div>}
  </div>;
}

function GlobalSearch({ user }) {
  const [q, setQ] = useState(''); const [sel, setSel] = useState(0); const inp = useRef(null);
  useEffect(() => {
    const onKey = e => { const tag = (document.activeElement || {}).tagName; if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inp.current && inp.current.focus(); } else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag) && !document.querySelector('.modal-back')) { e.preventDefault(); inp.current && inp.current.focus(); } };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, []);
  const items = [];
  const nq = normAr(q);
  if (nq) {
    Object.entries(PAGES).filter(([k, p]) => !p.hidden && canSee(user, k) && normAr(p.t).includes(nq)).forEach(([k, p]) => items.push({ g: 'الصفحات', t: p.t, ic: p.ic, go: () => go(k) }));
    if (user.role !== 'student') Scope.students(user).filter(s => normAr(s.fullName + ' ' + s.studentNo).includes(nq)).slice(0, 6).forEach(s => items.push({ g: 'الطلاب', t: s.fullName, s: nameOf.cls(s.classId) + ' · ' + s.studentNo, av: s.fullName, go: () => go('student', s.id) }));
    if (user.role === 'admin') Repo.all('teachers').filter(t => normAr(t.fullName + ' ' + t.specialization).includes(nq)).slice(0, 4).forEach(t => items.push({ g: 'المدرسون', t: t.fullName, s: t.specialization, av: t.fullName, go: () => go('teachers') }));
    if (user.role === 'admin' || user.role === 'teacher') Scope.classes(user).filter(c => normAr(c.name).includes(nq)).forEach(c => items.push({ g: 'الفصول', t: c.name, s: classStudents(c.id).length + ' طالبًا', ic: 'layers', go: () => go('classes') }));
    items.push({ g: 'المساعد الذكي', t: 'اسأل المساعد: ' + q, ic: 'sparkles', go: () => { Store.ss.set('ass:ask', q); go('assistant'); } });
  }
  const pick = i => { const it = items[i]; setQ(''); inp.current && inp.current.blur(); it && it.go(); };
  let lastG = null;
  return <div className="gsearch">
    <Icon name="search" size={16} />
    <input ref={inp} className="input" id="gsearch" type="search" placeholder="ابحث عن طالب، مدرس، فصل أو صفحة..." autoComplete="off" aria-label="بحث شامل" value={q}
      onChange={e => { setQ(e.target.value); setSel(0); }} onBlur={() => setTimeout(() => setQ(''), 150)}
      onKeyDown={e => { if (!items.length) return; if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setSel((sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length); } else if (e.key === 'Enter') { e.preventDefault(); pick(sel); } else if (e.key === 'Escape') setQ(''); }} />
    <kbd>Ctrl K</kbd>
    {items.length > 0 && <div className="gs-res" role="listbox">{items.map((it, i) => { const head = it.g !== lastG ? <div className="gs-h">{it.g}</div> : null; lastG = it.g; return <div key={i}>{head}<button type="button" role="option" aria-selected={i === sel} className={i === sel ? 'on' : ''} onMouseDown={e => { e.preventDefault(); pick(i); }}>{it.av ? <Avatar name={it.av} /> : <span className="kpi-ic"><Icon name={it.ic} size={16} /></span>}<div><div>{it.t}</div>{it.s && <div className="sub">{it.s}</div>}</div></button></div>; })}</div>}
  </div>;
}

export default function Layout({ route, user, children }) {
  useData(); useSyncExternalStore(themeStore.subscribe, themeStore.get);
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [route]);
  const S = Settings.get(); const unread = Notify.unread(user);
  const doLogout = async () => { if (await confirmDialog({ title: 'تسجيل الخروج', message: 'هل تريد تسجيل الخروج من النظام؟', ok: 'تسجيل الخروج' })) Auth.logout(); };
  return <div className={cx('shell', open && 'open')}>
    <aside className="side" aria-label="القائمة الرئيسية">
      <div className="brand"><Crest /><div><div className="brand-n">{S.schoolName}</div><div className="brand-s">نظام الإدارة المدرسية الذكي</div></div></div>
      <nav className="nav">{NAV_GROUPS.map(([g, label]) => {
        const items = Object.entries(PAGES).filter(([k, p]) => p.g === g && !p.hidden && canSee(user, k)); if (!items.length) return null;
        return <div className="nav-g" key={g}><div className="nav-gl">{label}</div>{items.map(([k, p]) => <a key={k} href={'#' + k} className={route === k || (route === 'student' && k === 'students') ? 'active' : ''} aria-current={route === k ? 'page' : undefined}><Icon name={p.ic} /><span>{k === 'students' && user.role === 'teacher' ? 'طلابي' : p.t}</span>{k === 'notifications' && unread > 0 && <span className="cnt">{fmtNum(unread)}</span>}</a>)}</div>;
      })}</nav>
      <div className="side-user"><Avatar name={displayName(user)} /><div style={{ flex: 1, minWidth: 0 }}><a href="#profile" className="nm" style={{ color: '#fff', display: 'block' }}>{displayName(user)}</a><div className="rl">{ROLE_LABEL[user.role]}</div></div><button className="icon-btn sm" title="تسجيل الخروج" aria-label="تسجيل الخروج" onClick={doLogout}><Icon name="logout" size={17} /></button></div>
    </aside>
    <div className="side-scrim" onClick={() => setOpen(false)} />
    <div className="content">
      <header className="top">
        <button className="icon-btn menu-btn" aria-label="فتح القائمة" onClick={() => setOpen(true)}><Icon name="menu" /></button>
        <div className="term-chip"><b>{S.termName}</b><span>العام الدراسي {S.academicYear}</span></div>
        <GlobalSearch user={user} />
        <div className="top-actions">
          <SyncChip />
          <button className="icon-btn" aria-label={effectiveDark() ? 'الوضع الفاتح' : 'الوضع الليلي'} title={effectiveDark() ? 'الوضع الفاتح' : 'الوضع الليلي'} onClick={toggleTheme}><Icon name={effectiveDark() ? 'sun' : 'moon'} /></button>
          <Bell user={user} />
          <a href="#profile" className="icon-btn" aria-label="ملفي الشخصي" title="ملفي الشخصي"><Avatar name={displayName(user)} /></a>
        </div>
      </header>
      <main id="main" tabIndex={-1}><div className="page">{children}</div></main>
    </div>
  </div>;
}
void Store;
