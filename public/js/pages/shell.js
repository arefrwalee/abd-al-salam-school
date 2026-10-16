/* =====================================================================
   Shell — التوجيه، الإطار العام، تسجيل الدخول
   ===================================================================== */
const App = { user: null, route: 'dashboard', param: null };
const PAGE_RENDER = {};
const ROOT = () => document.getElementById('app');

/* ---------- Theme ---------- */
function themePref() { try { return Store.get('ass:theme') || 'system'; } catch (e) { return 'system'; } }
function applyTheme(p = themePref()) { const r = document.documentElement; if (p === 'system') delete r.dataset.theme; else r.dataset.theme = p; }
function effectiveDark() { const p = themePref(); return p === 'dark' || (p === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
function toggleTheme() { const next = effectiveDark() ? 'light' : 'dark'; Store.set('ass:theme', next); applyTheme(next); refreshTopbar(); }

/* ---------- Router ---------- */
function parseHash() { const raw = decodeURIComponent(location.hash.slice(1)) || 'dashboard'; const i = raw.indexOf('-'); return i > 0 ? [raw.slice(0, i), raw.slice(i + 1)] : [raw, null]; }
function go(route, param) { const target = '#' + route + (param ? '-' + param : ''); if (location.hash === target) render(); else location.hash = target; }
window.addEventListener('hashchange', () => render());

function render() {
  const [r, p] = parseHash();
  if (!App.user) { if (r === 'verify') return renderPublicVerify(p); if (isServer() && Mode.public && Mode.public.needsSetup) return renderSetup(); return renderLogin(); }
  const u = App.user = Auth.current();
  if (!u) return renderLogin();
  let route = PAGES[r] ? r : 'dashboard';
  renderShell(route);
  const main = $('#main'); main.replaceChildren();
  if (!canSee(u, route)) { main.append(forbidden()); return; }
  App.route = route; App.param = p;
  const page = h('div', { class: 'page' }); main.append(page);
  try { PAGE_RENDER[route](page, p); } catch (e) { console.error(e); page.append(emptyState('تعذّر عرض هذه الصفحة: ' + e.message, null, 'alert')); }
  document.title = (PAGES[route].t || '') + ' · ' + Settings.get().schoolName;
  closeSide(); window.scrollTo(0, 0);
}
function rerenderSoft() { if (!App.user || isModalOpen()) return; const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest('#main')) return; render(); }
Bus.on('remote', () => { if (!App.user) return; const u = Auth.current(); if (!u) return; App.user = u; refreshTopbar(); rerenderSoft(); });
Bus.on('notifications:changed', () => refreshTopbar());

function forbidden() { return h('div', { class: 'forbidden' }, h('div', { class: 'code' }, '403'), h('h2', {}, 'لا تملك صلاحية الوصول إلى هذه الصفحة'), h('p', { class: 'muted' }, 'هذه الصفحة مخصّصة لأدوار أخرى في النظام. إن كنت تحتاجها فتواصل مع إدارة المدرسة.'), h('button', { class: 'btn primary', onclick: () => go('dashboard') }, 'العودة إلى الرئيسية')); }

/* ---------- Shell ---------- */
let shellUser = null;
function renderShell(route) {
  const u = App.user;
  if (!$('.shell') || shellUser !== u.id) {
    shellUser = u.id;
    const side = h('aside', { class: 'side', id: 'side', 'aria-label': 'القائمة الرئيسية' },
      h('div', { class: 'brand' }, h('div', { class: 'crest', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('div', {}, h('div', { class: 'brand-n' }, Settings.get().schoolName), h('div', { class: 'brand-s' }, 'نظام الإدارة المدرسية الذكي'))),
      h('nav', { class: 'nav', id: 'nav' }),
      h('div', { class: 'side-user' }, avatar(displayName(u)), h('div', { style: { flex: 1, minWidth: 0 } }, h('a', { href: '#profile', class: 'nm', style: { color: '#fff', display: 'block' } }, displayName(u)), h('div', { class: 'rl' }, ROLE_LABEL[u.role])), h('button', { class: 'icon-btn sm', title: 'تسجيل الخروج', 'aria-label': 'تسجيل الخروج', onclick: () => doLogout() }, icon('logout', 17))));
    const top = h('header', { class: 'top' },
      h('button', { class: 'icon-btn menu-btn', 'aria-label': 'فتح القائمة', onclick: () => $('.shell').classList.add('open') }, icon('menu')),
      h('div', { class: 'term-chip' }, h('b', {}, Settings.get().termName), h('span', {}, 'العام الدراسي ' + Settings.get().academicYear)),
      globalSearch(),
      h('div', { class: 'top-actions', id: 'top-actions' }));
    ROOT().replaceChildren(h('div', { class: 'shell' }, side, h('div', { class: 'side-scrim', onclick: closeSide }), h('div', { class: 'content' }, top, h('main', { id: 'main', tabindex: '-1' }))));
  }
  const nav = $('#nav'); nav.replaceChildren();
  const unread = Notify.unread(u);
  NAV_GROUPS.forEach(([g, label]) => {
    const items = Object.entries(PAGES).filter(([k, p]) => p.g === g && !p.hidden && canSee(u, k));
    if (!items.length) return;
    nav.append(h('div', { class: 'nav-g' }, h('div', { class: 'nav-gl' }, label), items.map(([k, p]) => h('a', { href: '#' + k, class: route === k || (route === 'student' && k === 'students') ? 'active' : '', 'aria-current': route === k ? 'page' : null }, icon(p.ic, 18), h('span', {}, k === 'students' && u.role === 'teacher' ? 'طلابي' : p.t), k === 'notifications' && unread ? h('span', { class: 'cnt' }, fmtNum(unread)) : null))));
  });
  refreshTopbar();
}
function closeSide() { const s = $('.shell'); s && s.classList.remove('open'); }
async function doLogout() { if (await confirmDialog({ title: 'تسجيل الخروج', message: 'هل تريد تسجيل الخروج من النظام؟', ok: 'تسجيل الخروج' })) Auth.logout(); }

function refreshTopbar() {
  const box = $('#top-actions'); if (!box || !App.user) return;
  const u = App.user; const unread = Notify.unread(u);
  const bell = h('div', { class: 'bell', style: { position: 'relative' } }, h('button', { class: 'icon-btn', 'aria-label': 'الإشعارات' + (unread ? ` (${unread} غير مقروء)` : ''), onclick: e => toggleBell(e.currentTarget.parentElement) }, icon('bell')), unread ? h('span', { class: 'dot' }, unread > 99 ? '99+' : fmtNum(unread)) : null);
  box.replaceChildren(syncChip(), h('button', { class: 'icon-btn', 'aria-label': effectiveDark() ? 'الوضع الفاتح' : 'الوضع الليلي', title: effectiveDark() ? 'الوضع الفاتح' : 'الوضع الليلي', onclick: toggleTheme }, icon(effectiveDark() ? 'sun' : 'moon')), bell, h('a', { href: '#profile', class: 'icon-btn', 'aria-label': 'ملفي الشخصي', title: 'ملفي الشخصي' }, avatar(displayName(u))));
  const cnt = $('#nav a[href="#notifications"] .cnt'); const link = $('#nav a[href="#notifications"]');
  if (link) { if (cnt) cnt.remove(); if (unread) link.append(h('span', { class: 'cnt' }, fmtNum(unread))); }
}
function syncChip() {
  if (!isServer()) return h('span', { class: 'sync-chip demo', title: 'البيانات في الذاكرة فقط وتُحذف عند إغلاق الصفحة' }, icon('info', 14), 'وضع العرض');
  const st = Sync.state, n = Sync.pending;
  const map = { online: ['متصل', 'ok', 'ok'], syncing: ['جارٍ المزامنة', 'info', 'refresh'], offline: [n ? `دون اتصال · ${fmtNum(n)} بانتظار الإرسال` : 'دون اتصال', 'warn', 'alert'], auth: ['الجلسة منتهية', 'bad', 'lock'], idle: ['', '', 'info'] };
  const [t, c, ic] = map[st] || map.idle; if (!t) return null;
  return h('span', { class: 'sync-chip ' + c, role: 'status', title: Vault.active ? 'نسخة مشفّرة على هذا الجهاز للعمل دون اتصال' : 'البيانات محفوظة على خادم المدرسة' }, icon(ic, 14), h('span', { class: 'sync-t' }, t + (st === 'online' && n ? ` · ${fmtNum(n)}` : '')));
}
Bus.on('sync:state', () => refreshTopbar());
function toggleBell(anchor) {
  const ex = $('.dropdown', anchor); if (ex) { ex.remove(); return; }
  const u = App.user; const list = Notify.mine(u).slice(0, 6);
  const dd = h('div', { class: 'dropdown', role: 'dialog', 'aria-label': 'آخر الإشعارات' },
    h('div', { class: 'dropdown-h' }, 'الإشعارات', Notify.unread(u) ? h('button', { class: 'btn ghost xs', onclick: () => { Notify.markAll(u); dd.remove(); refreshTopbar(); } }, 'تعليم الكل كمقروء') : null),
    list.length ? h('div', { style: { maxHeight: '380px', overflow: 'auto' } }, list.map(n => notifRow(n, () => dd.remove()))) : emptyState('لا توجد إشعارات', null, 'bell'),
    h('div', { class: 'dropdown-f' }, h('a', { href: '#notifications', onclick: () => dd.remove() }, 'عرض كل الإشعارات')));
  anchor.append(dd);
  const off = e => { if (!anchor.contains(e.target)) { dd.remove(); document.removeEventListener('mousedown', off); } };
  setTimeout(() => document.addEventListener('mousedown', off), 0);
}
function notifRow(n, after) {
  const [ic, tone] = NOTIF_ICON[n.type] || ['info', ''];
  return h('div', { class: 'notif' + (n.read ? '' : ' unread'), role: 'button', tabindex: '0', onclick: () => { Notify.markRead(n); after && after(); if (n.link) go(...splitLink(n.link)); else render(); }, onkeydown: e => { if (e.key === 'Enter') e.currentTarget.click(); } },
    h('div', { class: 'ic ' + tone }, icon(ic, 17)), h('div', { class: 'bd' }, h('b', {}, n.title), h('p', {}, n.message)), h('div', { class: 'stack', style: { alignItems: 'flex-end', gap: '4px' } }, h('span', { class: 'tm' }, relTime(n.createdAt)), n.read ? null : h('span', { class: 'udot', 'aria-label': 'غير مقروء' })));
}
const splitLink = l => { const i = l.indexOf('-'); return i > 0 ? [l.slice(0, i), l.slice(i + 1)] : [l]; };

/* ---------- Global search / command palette ---------- */
function globalSearch() {
  const wrap = h('div', { class: 'gsearch' });
  const inp = h('input', { class: 'input', id: 'gsearch', type: 'search', placeholder: 'ابحث عن طالب، مدرس، فصل أو صفحة...', autocomplete: 'off', 'aria-label': 'بحث شامل' });
  let res = null, items = [], sel = 0;
  function close() { if (res) { res.remove(); res = null; } }
  function run() {
    const u = App.user; const q = normAr(inp.value); close(); if (!q) return;
    items = [];
    Object.entries(PAGES).filter(([k, p]) => !p.hidden && canSee(u, k) && normAr(p.t).includes(q)).forEach(([k, p]) => items.push({ g: 'الصفحات', t: p.t, s: '', ic: p.ic, go: () => go(k) }));
    if (u.role !== 'student') Scope.students(u).filter(s => normAr(s.fullName + ' ' + s.studentNo).includes(q)).slice(0, 6).forEach(s => items.push({ g: 'الطلاب', t: s.fullName, s: nameOf.cls(s.classId) + ' · ' + s.studentNo, av: s.fullName, go: () => go('student', s.id) }));
    if (u.role === 'admin') { Repo.all('teachers').filter(t => normAr(t.fullName + ' ' + t.specialization).includes(q)).slice(0, 4).forEach(t => items.push({ g: 'المدرسون', t: t.fullName, s: t.specialization, av: t.fullName, go: () => go('teachers') })); }
    if (u.role === 'admin' || u.role === 'teacher') Scope.classes(u).filter(c => normAr(c.name).includes(q)).forEach(c => items.push({ g: 'الفصول', t: c.name, s: classStudents(c.id).length + ' طالبًا', ic: 'layers', go: () => go('classes') }));
    items.push({ g: 'المساعد الذكي', t: 'اسأل المساعد: ' + inp.value, s: '', ic: 'sparkles', go: () => { Store.ss.set('ass:ask', inp.value); go('assistant'); } });
    sel = 0; res = h('div', { class: 'gs-res', role: 'listbox' }); let lastG = null;
    items.forEach((it, i) => { if (it.g !== lastG) { res.append(h('div', { class: 'gs-h' }, it.g)); lastG = it.g; } res.append(h('button', { class: i === sel ? 'on' : '', role: 'option', onmousedown: e => { e.preventDefault(); pick(i); } }, it.av ? avatar(it.av) : h('span', { class: 'kpi-ic' }, icon(it.ic, 16)), h('div', {}, h('div', {}, it.t), it.s ? h('div', { class: 'sub' }, it.s) : null))); });
    wrap.append(res);
  }
  function pick(i) { const it = items[i]; close(); inp.value = ''; inp.blur(); it && it.go(); }
  inp.addEventListener('input', run);
  inp.addEventListener('keydown', e => {
    if (!res) return; const btns = $$('button', res);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length; btns.forEach((b, i) => b.classList.toggle('on', i === sel)); btns[sel].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(sel); } else if (e.key === 'Escape') { close(); inp.blur(); }
  });
  inp.addEventListener('blur', () => setTimeout(close, 150));
  wrap.append(icon('search', 16), inp, h('kbd', {}, 'Ctrl K'));
  return wrap;
}
document.addEventListener('keydown', e => {
  if (!App.user) return;
  const tag = (document.activeElement || {}).tagName;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); const g = $('#gsearch'); g && g.focus(); }
  else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag) && !isModalOpen()) { e.preventDefault(); const g = $('#gsearch'); g && g.focus(); }
});

/* ---------- Login ---------- */
function renderLogin() {
  document.title = 'تسجيل الدخول · ' + Settings.get().schoolName;
  let role = 'admin';
  const remembered = '';
  const pub = isServer() ? (Mode.public || {}) : null;
  const showDemo = !isServer() || (pub && pub.demo);
  const idIn = h('input', { class: 'input', id: 'login-id', autocomplete: 'username', placeholder: 'مثال: admin أو البريد الإلكتروني', dir: 'ltr', value: remembered });
  const pwIn = h('input', { class: 'input', id: 'login-pw', type: 'password', autocomplete: 'current-password', dir: 'ltr', placeholder: '••••••••' });
  const rem = h('input', { type: 'checkbox', id: 'login-rem' }); rem.checked = !!remembered;
  const err = h('div', { class: 'login-err', role: 'alert', hidden: true });
  const btn = h('button', { class: 'btn primary', type: 'submit', style: { height: '44px', fontSize: '15px' } }, 'تسجيل الدخول');
  const tabsEl = h('div', { class: 'role-tabs', role: 'radiogroup', 'aria-label': 'نوع الحساب' });
  const ROLE_IC = { admin: 'shield', teacher: 'briefcase', student: 'book', parent: 'users' };
  const DEMO_USER = { admin: 'admin', teacher: 'teacher1', student: 'student1', parent: 'parent1' };
  function drawTabs() { tabsEl.replaceChildren(...ALL_ROLES.map(r => h('button', { type: 'button', class: r === role ? 'on' : '', role: 'radio', 'aria-checked': String(r === role), onclick: () => { role = r; drawTabs(); idIn.placeholder = 'مثال: ' + DEMO_USER[r]; } }, icon(ROLE_IC[r], 18), ROLE_LABEL[r].replace(' المدرسة', '')))); }
  drawTabs();
  let lockTimer = null;
  function showLock(until) { clearInterval(lockTimer); const tick = () => { const s = Math.max(0, Math.round((new Date(until) - Date.now()) / 1000)); err.textContent = `الحساب مقفل مؤقتًا. حاول مجددًا بعد ${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`; if (!s) { clearInterval(lockTimer); err.hidden = true; } }; tick(); lockTimer = setInterval(tick, 1000); }
  const form = h('form', { class: 'stack', style: { gap: '14px' }, novalidate: true, onsubmit: async e => {
    e.preventDefault(); err.hidden = true;
    if (!idIn.value.trim() || !pwIn.value) { err.textContent = 'أدخل اسم المستخدم وكلمة المرور.'; err.hidden = false; (idIn.value.trim() ? pwIn : idIn).focus(); return; }
    btn.disabled = true; btn.textContent = 'جارٍ التحقق...';
    const r = await Auth.login(idIn.value, pwIn.value, rem.checked);
    btn.disabled = false; btn.textContent = 'تسجيل الدخول';
    if (!r.ok) { err.textContent = r.msg; err.hidden = false; if (r.locked) showLock(r.locked); pwIn.select(); return; }
    if (r.user.role !== role) toast.info('تم الدخول بحساب ' + ROLE_LABEL[r.user.role] + ' (يُحدَّد الدور من الحساب تلقائيًا).');
    if (r.offline) toast.warning('تعمل الآن دون اتصال على النسخة المشفّرة المحفوظة' + (r.savedAt ? ' (' + fmtDateTime(r.savedAt) + ')' : '') + '. ستُرسل تعديلاتك عند عودة الاتصال.', { ms: 9000 });
    else if (isServer() && r.vault === false) toast.info('العمل دون اتصال غير مفعّل لأن الاتصال ليس HTTPS. البيانات محفوظة على الخادم فقط.', { ms: 7000 });
    if (r.user.mustChangePassword) { App.user = r.user; location.hash = '#profile'; render(); toast.warning('هذه كلمة مرور مؤقتة. غيّرها الآن للمتابعة.'); return; }
    clearInterval(lockTimer); App.user = r.user;
    if (!location.hash || location.hash === '#' || location.hash === '#verify') location.hash = '#dashboard'; else render();
    toast.success('أهلًا ' + displayName(r.user));
  } },
    h('div', {}, h('div', { class: 'field' }, h('label', {}, 'نوع الحساب')), tabsEl),
    h('div', { class: 'field' }, h('label', { for: 'login-id' }, 'اسم المستخدم أو البريد الإلكتروني'), idIn),
    h('div', { class: 'field' }, h('label', { for: 'login-pw' }, 'كلمة المرور'), h('div', { class: 'pw-wrap' }, pwIn, h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'إظهار كلمة المرور', onclick: e => { pwIn.type = pwIn.type === 'password' ? 'text' : 'password'; e.currentTarget.setAttribute('aria-label', pwIn.type === 'password' ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور'); } }, icon('eye', 17)))),
    h('label', { class: 'check', for: 'login-rem' }, rem, isServer() ? 'تذكرني على هذا الجهاز (30 يومًا)' : 'تذكرني'),
    err, btn);
  const demo = h('div', { class: 'demo' }, h('div', { class: 'demo-h' }, 'حسابات تجريبية جاهزة — اضغط للتعبئة:'),
    ALL_ROLES.filter(r => !isServer() || r !== 'admin').map(r => h('button', { type: 'button', onclick: () => { role = r; drawTabs(); idIn.value = DEMO_USER[r]; pwIn.value = DEMO_PW[r]; btn.focus(); } }, h('span', {}, ROLE_LABEL[r]), h('code', {}, DEMO_USER[r] + ' / ' + DEMO_PW[r]))));
  const S = isServer() ? { ...Settings.get(), schoolName: pub.schoolName || Settings.get().schoolName, schoolNameEn: pub.schoolNameEn || Settings.get().schoolNameEn, academicYear: pub.academicYear || Settings.get().academicYear } : Settings.get(); const T = todayISO();
  const stats = isServer() ? (pub.stats || {}) : { students: activeStudents().length, classes: Repo.all('classes').length, attendanceRate: attStats(Idx().attByDate.get(T) || Idx().attByDate.get(lastSchoolDayWithData()) || []).rate };
  const art = h('aside', { class: 'login-art' },
    h('div', {}, h('div', { class: 'crest lg', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('div', { class: 'ttl' }, S.schoolName), h('div', { class: 'en' }, S.schoolNameEn.toUpperCase() + ' · SMART SCHOOL MANAGEMENT'), h('div', { class: 'stripes' }, h('i', { style: { background: '#c42b2b' } }), h('i', { style: { background: '#13803b' } }), h('i', { style: { background: '#3c6df0' } }))),
    h('div', { class: 'feat' },
      h('div', {}, icon('sparkles', 20), h('span', {}, h('b', {}, 'إنذار مبكر للطلاب'), 'درجة خطر لكل طالب تجمع الغياب والتحصيل واتجاه الدرجات، مع السبب والتوصية.')),
      h('div', {}, icon('check', 20), h('span', {}, h('b', {}, 'حضور يومي وإشعار فوري'), 'يصل ولي الأمر إشعار الغياب لحظة تسجيله من المدرس.')),
      h('div', {}, icon('award', 20), h('span', {}, h('b', {}, 'درجات وشهادات موثّقة'), 'أوزان مرنة، ترتيب تلقائي، وشهادة برقم فريد ورمز تحقق QR.'))),
    h('div', { class: 'live' },
      h('div', {}, h('b', { class: 'tabnum' }, fmtNum(stats.students || 0)), h('span', {}, 'طالبًا نشطًا')),
      h('div', {}, h('b', { class: 'tabnum' }, fmtNum(stats.classes || 0)), h('span', {}, 'فصول دراسية')),
      h('div', {}, h('b', { class: 'tabnum' }, fmtPct(stats.attendanceRate, 0)), h('span', {}, 'حضور آخر يوم دراسي'))));
  ROOT().replaceChildren(h('div', { class: 'login' },
    h('div', { class: 'login-form' }, h('div', { class: 'login-box' },
      h('div', { class: 'row', style: { gap: '12px' } }, h('div', { class: 'crest', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('div', {}, h('b', { style: { font: '600 17px var(--f-display)' } }, S.schoolName), h('div', { class: 'muted small' }, 'العام الدراسي ' + S.academicYear))),
      h('div', {}, h('h1', {}, 'تسجيل الدخول'), h('p', { class: 'lead' }, 'ادخل بحسابك المدرسي. يُحدَّد ما تراه حسب دورك في المدرسة.')),
      Mode.offline ? banner('لا يوجد اتصال بالخادم. يمكنك الدخول بآخر نسخة مشفّرة محفوظة على هذا الجهاز، وتُرسل تعديلاتك عند عودة الاتصال.', 'warn', 'alert') : null,
      !isServer() ? banner('وضع العرض: بيانات تجريبية في الذاكرة فقط وتُحذف عند إغلاق الصفحة. للاستخدام الفعلي شغّل خادم المدرسة (انظر README).', '', 'info') : null,
      form, showDemo ? demo : null,
      h('div', { class: 'row between small muted' }, h('a', { href: '#verify' }, 'التحقق من صحة شهادة'), h('span', { class: 'row', style: { gap: '6px' } }, icon(isServer() ? 'lock' : 'info', 14), isServer() ? 'اتصال آمن بخادم المدرسة' : 'وضع العرض')))),
    art));
  setTimeout(() => (remembered ? pwIn : idIn).focus(), 50);
}

/* ---------- Public certificate verification ---------- */
function verifyWidget(initial) {
  const inp = h('input', { class: 'input', id: 'verify-code', placeholder: 'رمز التحقق أو رقم الشهادة', dir: 'ltr', value: initial || '' });
  const out = h('div', {});
  async function check() {
    out.replaceChildren();
    if (!inp.value.trim()) return;
    if (isServer() && !Repo.all('certificates').length) {
      let r; try { r = await api('GET', 'api/verify?code=' + encodeURIComponent(inp.value.trim())); } catch (e) { out.append(banner('تعذّر الاتصال بالخادم.', 'bad', 'alert')); return; }
      if (!r.ok) { out.append(banner(r.error || 'تعذّر التحقق', 'bad', 'alert')); return; }
      if (!r.valid) { out.append(banner('لم يُعثر على شهادة بهذا الرمز. تأكد من كتابته كما هو مطبوع على الشهادة.', 'bad', 'alert')); return; }
      out.append(banner('شهادة صحيحة صادرة عن ' + r.schoolName + '.', 'ok', 'ok'), h('div', { style: { height: '12px' } }), kv([['رقم الشهادة', h('span', { class: 'ltr' }, r.certNo)], ['اسم الطالب', r.studentName || '—'], ['الصف والفصل', r.className || '—'], ['العام الدراسي', r.yearName || '—'], ['الفصل الدراسي', r.termName || '—'], ['النسبة', fmtPct(r.percentage, 1) + ' — ' + r.gradeLabel], ['النتيجة', badge(RESULT_LABEL[r.result][0], RESULT_LABEL[r.result][1])], ['تاريخ الإصدار', fmtDate(r.issueDate)]]));
      return;
    }
    const c = findCertificate(inp.value);
    if (!c) { out.append(banner('لم يُعثر على شهادة بهذا الرمز. تأكد من كتابته كما هو مطبوع على الشهادة.', 'bad', 'alert')); return; }
    const st = Repo.get('students', c.studentId); const y = Repo.get('academicYears', c.academicYearId);
    out.append(banner('شهادة صحيحة صادرة عن ' + Settings.get().schoolName + '.', 'ok', 'ok'), h('div', { style: { height: '12px' } }),
      kv([['رقم الشهادة', h('span', { class: 'ltr' }, c.certNo)], ['اسم الطالب', st ? st.fullName : '—'], ['الصف والفصل', nameOf.cls(c.classId)], ['العام الدراسي', y ? y.name : '—'], ['الفصل الدراسي', Settings.get().termName], ['النسبة', fmtPct(c.percentage, 1) + ' — ' + c.gradeLabel], ['النتيجة', badge(RESULT_LABEL[c.result][0], RESULT_LABEL[c.result][1])], ['تاريخ الإصدار', fmtDate(c.issueDate)]]));
  }
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
  if (initial) setTimeout(check, 0);
  return h('div', { class: 'stack', style: { gap: '14px' } }, h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, inp, h('button', { class: 'btn primary', onclick: check }, 'تحقق')), out);
}
function renderPublicVerify(code) {
  document.title = 'التحقق من شهادة · ' + ((Mode.public && Mode.public.schoolName) || Settings.get().schoolName);
  ROOT().replaceChildren(h('div', { class: 'verify-page' }, h('div', { class: 'card', style: { width: '100%', maxWidth: '560px' } }, h('div', { class: 'card-b stack', style: { gap: '16px', padding: '26px' } },
    h('div', { class: 'row' }, h('div', { class: 'crest' }, h('i'), h('i'), h('i')), h('div', {}, h('h2', { style: { font: '600 20px var(--f-display)' } }, 'التحقق من صحة شهادة'), h('div', { class: 'muted small' }, Settings.get().schoolName))),
    h('p', { class: 'muted' }, 'أدخل رمز التحقق المطبوع أسفل الشهادة (8 أحرف) أو رقم الشهادة.'),
    verifyWidget(code), h('a', { href: '#' }, 'العودة إلى تسجيل الدخول')))));
}
PAGE_RENDER.verify = (page, code) => { page.append(pageHead('التحقق من شهادة', 'أدخل رمز التحقق المطبوع على الشهادة'), card(null, verifyWidget(code))); };

/* ---------- First-run setup (server mode) ---------- */
function renderSetup() {
  document.title = 'الإعداد الأول · نظام إدارة مدرسة عبد السلام';
  const f = (id, label, attrs = {}, hint) => h('div', { class: 'field' }, h('label', { for: id }, label), h('input', { class: 'input', id, ...attrs }), hint ? h('div', { class: 'hint' }, hint) : null);
  const demo = h('input', { type: 'checkbox', id: 'setup-demo' }); demo.checked = true;
  const err = h('div', { class: 'login-err', role: 'alert', hidden: true });
  const prog = h('div', { class: 'muted small', 'aria-live': 'polite' });
  const btn = h('button', { class: 'btn primary', type: 'submit', style: { height: '44px' } }, 'إنشاء النظام');
  const form = h('form', { class: 'stack', style: { gap: '14px' }, novalidate: true, onsubmit: async e => {
    e.preventDefault(); err.hidden = true;
    const v = id => $('#' + id).value.trim();
    const school = v('setup-school'), principal = v('setup-principal'), un = v('setup-user'), pw = $('#setup-pw').value, pw2 = $('#setup-pw2').value;
    const bad = !school ? 'أدخل اسم المدرسة.' : !principal ? 'أدخل اسم مدير المدرسة.' : !/^[a-z0-9._-]{3,30}$/i.test(un) ? 'اسم الدخول: حروف لاتينية وأرقام (3–30).' : passwordRule(pw) ? passwordRule(pw) : pw !== pw2 ? 'كلمتا المرور غير متطابقتين.' : null;
    if (bad) { err.textContent = bad; err.hidden = false; return; }
    btn.disabled = true;
    try {
      let ds;
      if (demo.checked) { prog.textContent = 'جارٍ إنشاء البيانات التجريبية...'; await seedDemo(p => { prog.textContent = 'جارٍ إنشاء البيانات التجريبية... ' + p + '%'; }); }
      else { Repo.clearAll(); Settings.replace({}); const y = { id: uid(), name: Settings.get().academicYear, startDate: todayISO(), endDate: addDays(todayISO(), 280), terms: [{ key: 'T1', name: 'الفصل الأول' }, { key: 'T2', name: 'الفصل الثاني' }], isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null }; Repo.hardSet('academicYears', [y]); Repo.hardSet('periods', [['08:00', '08:45'], ['08:50', '09:35'], ['09:40', '10:25'], ['10:45', '11:30'], ['11:35', '12:20'], ['12:25', '13:10']].map(([a, b], i) => ({ id: uid(), order: i + 1, startTime: a, endTime: b, isBreak: false, createdAt: y.createdAt, updatedAt: y.createdAt, deletedAt: null }))); Repo.hardSet('users', [{ id: uid(), username: un, email: '', role: 'admin', linkedId: null, isActive: true, prefs: {}, createdAt: y.createdAt, updatedAt: y.createdAt, deletedAt: null }]); }
      const admins = Repo.raw('users').filter(u => u.role === 'admin'); if (admins[0]) admins[0].prefs = { ...(admins[0].prefs || {}), displayName: principal };
      ds = { settings: { ...Settings.get(), schoolName: school, principalName: principal }, data: Object.fromEntries(ENTITIES.map(e => [e, Repo.raw(e)])) };
      prog.textContent = 'جارٍ الحفظ المشفّر على الخادم...';
      const r = await api('POST', 'api/setup', { adminUsername: un, adminPassword: pw, schoolName: school, demo: demo.checked, dataset: ds });
      Repo.clearAll();
      if (!r.ok) { err.textContent = r.error || 'تعذّر الإعداد'; err.hidden = false; btn.disabled = false; prog.textContent = ''; return; }
      await refreshPublic(); toast.success('تم إنشاء النظام بنجاح. سجّل الدخول بحساب المدير.');
      render(); setTimeout(() => { const i = $('#login-id'); if (i) i.value = un; const p2 = $('#login-pw'); if (p2) p2.focus(); }, 60);
    } catch (e2) { err.textContent = 'تعذّر الاتصال بالخادم: ' + e2.message; err.hidden = false; btn.disabled = false; prog.textContent = ''; }
  } },
    f('setup-school', 'اسم المدرسة', { value: 'مدرسة عبد السلام', autocomplete: 'organization' }),
    f('setup-principal', 'اسم مدير المدرسة (يظهر على الشهادات)', { placeholder: 'مثال: أ. محمود العبد الله' }),
    f('setup-user', 'اسم دخول المدير', { dir: 'ltr', autocomplete: 'username', placeholder: 'principal' }),
    f('setup-pw', 'كلمة مرور المدير', { type: 'password', dir: 'ltr', autocomplete: 'new-password' }, '8 أحرف على الأقل وتحتوي حرفًا ورقمًا. لا تُحفظ إلا مشفّرة على الخادم (scrypt).'),
    f('setup-pw2', 'تأكيد كلمة المرور', { type: 'password', dir: 'ltr', autocomplete: 'new-password' }),
    h('label', { class: 'check', for: 'setup-demo' }, demo, 'تحميل بيانات تجريبية (120 طالبًا، 10 مدرسين، حضور ودرجات ورسوم) للتجربة'),
    err, prog, btn);
  ROOT().replaceChildren(h('div', { class: 'verify-page' }, h('div', { class: 'card', style: { width: '100%', maxWidth: '560px' } }, h('div', { class: 'card-b stack', style: { gap: '16px', padding: '28px' } },
    h('div', { class: 'row' }, h('div', { class: 'crest' }, h('i'), h('i'), h('i')), h('div', {}, h('h1', { style: { font: '600 22px var(--f-display)' } }, 'الإعداد الأول للنظام'), h('div', { class: 'muted small' }, 'يُنفَّذ مرة واحدة فقط على هذا الخادم'))),
    banner('ستُحفظ كل البيانات على هذا الخادم في قاعدة SQLite مشفّرة بمفتاح AES-256 في data/master.key. احتفظ بنسخة من هذا المفتاح في مكان آمن؛ بدونه لا يمكن قراءة البيانات.', '', 'lock'),
    form))));
  setTimeout(() => $('#setup-principal') && $('#setup-principal').focus(), 50);
}
