/* صفحات ما قبل الدخول: تسجيل الدخول، الإعداد الأول، التحقق من الشهادات، الدخول التجريبي المباشر */
import { useEffect, useRef, useState } from 'react';
import { Icon, Crest, Banner, KV, Badge, Spinner, Card, PageHead } from '../components/ui.jsx';
import { Mode, Settings, Repo, ENTITIES, isServer } from '../lib/store.js';
import { Auth, ROLE_LABEL, DEMO_PW, passwordRule, refreshPublic } from '../lib/auth.js';
import { api } from '../lib/sync.js';
import { seedDemo } from '../lib/seed.js';
import { activeStudents, attStats, Idx, lastSchoolDayWithData, displayName, findCertificate, nameOf, RESULT_LABEL } from '../lib/domain.js';
import { ALL_ROLES } from '../lib/permissions.js';
import { fmtNum, fmtPct, fmtDate, fmtDateTime, todayISO, addDays, uid, pad2 } from '../lib/utils.js';
import { toast, go } from '../lib/bridge.js';

export const DEMO_LINKS = { admin: 'admin', teacher: 'teacher1', student: 'student1', parent: 'parent1' };
const ROLE_IC = { admin: 'shield', teacher: 'briefcase', student: 'book', parent: 'users' };

function afterLogin(r, role) {
  if (r.user.role !== role) toast.info('تم الدخول بحساب ' + ROLE_LABEL[r.user.role] + ' (يُحدَّد الدور من الحساب تلقائيًا).');
  if (r.offline) toast.warning('تعمل الآن دون اتصال على النسخة المشفّرة المحفوظة' + (r.savedAt ? ' (' + fmtDateTime(r.savedAt) + ')' : '') + '. ستُرسل تعديلاتك عند عودة الاتصال.', { ms: 9000 });
  else if (isServer() && r.vault === false) toast.info('العمل دون اتصال غير مفعّل لأن الاتصال ليس HTTPS. البيانات محفوظة على الخادم فقط.', { ms: 7000 });
  if (r.user.mustChangePassword) { go('profile'); toast.warning('هذه كلمة مرور مؤقتة. غيّرها الآن للمتابعة.'); return; }
  if (!location.hash || location.hash === '#' || location.hash.startsWith('#verify') || location.hash.startsWith('#demo')) go('dashboard');
  toast.success('أهلًا ' + displayName(r.user));
}

export function Login() {
  const [role, setRole] = useState('admin'); const [id, setId] = useState(''); const [pw, setPw] = useState(''); const [rem, setRem] = useState(false);
  const [show, setShow] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [lockUntil, setLockUntil] = useState(null); const [, tick] = useState(0);
  const pwRef = useRef(null);
  useEffect(() => { if (!lockUntil) return; const t = setInterval(() => { if (new Date(lockUntil) <= new Date()) { setLockUntil(null); setErr(''); } tick(x => x + 1); }, 1000); return () => clearInterval(t); }, [lockUntil]);
  const pub = isServer() ? (Mode.public || {}) : null;
  const showDemo = !isServer() || (pub && pub.demo);
  const S = isServer() ? { ...Settings.get(), schoolName: pub.schoolName || Settings.get().schoolName, schoolNameEn: pub.schoolNameEn || Settings.get().schoolNameEn, academicYear: pub.academicYear || Settings.get().academicYear } : Settings.get();
  const T = todayISO();
  const stats = isServer() ? (pub.stats || {}) : { students: activeStudents().length, classes: Repo.all('classes').length, attendanceRate: attStats(Idx().attByDate.get(T) || Idx().attByDate.get(lastSchoolDayWithData()) || []).rate };
  async function submit(e) {
    e.preventDefault(); setErr('');
    if (!id.trim() || !pw) { setErr('أدخل اسم المستخدم وكلمة المرور.'); return; }
    setBusy(true); const r = await Auth.login(id, pw, rem); setBusy(false);
    if (!r.ok) { setErr(r.msg); if (r.locked) setLockUntil(r.locked); pwRef.current && pwRef.current.select(); return; }
    afterLogin(r, role);
  }
  const lockLeft = lockUntil ? Math.max(0, Math.round((new Date(lockUntil) - Date.now()) / 1000)) : 0;
  return <div className="login">
    <div className="login-form"><div className="login-box">
      <div className="row" style={{ gap: 12 }}><Crest /><div><b style={{ font: '600 17px var(--f-display)' }}>{S.schoolName}</b><div className="muted small">العام الدراسي {S.academicYear}</div></div></div>
      <div><h1>تسجيل الدخول</h1><p className="lead">ادخل بحسابك المدرسي. يُحدَّد ما تراه حسب دورك في المدرسة.</p></div>
      {Mode.offline && <Banner tone="warn" ic="alert">لا يوجد اتصال بالخادم. يمكنك الدخول بآخر نسخة مشفّرة محفوظة على هذا الجهاز، وتُرسل تعديلاتك عند عودة الاتصال.</Banner>}
      {!isServer() && <Banner>وضع العرض: بيانات تجريبية في الذاكرة فقط وتُحذف عند إغلاق الصفحة. للاستخدام الفعلي شغّل خادم المدرسة (انظر README).</Banner>}
      <form className="stack" style={{ gap: 14 }} noValidate onSubmit={submit}>
        <div><div className="field"><label>نوع الحساب</label></div>
          <div className="role-tabs" role="radiogroup" aria-label="نوع الحساب">{ALL_ROLES.map(r => <button key={r} type="button" role="radio" aria-checked={r === role} className={r === role ? 'on' : ''} onClick={() => setRole(r)}><Icon name={ROLE_IC[r]} />{ROLE_LABEL[r].replace(' المدرسة', '')}</button>)}</div></div>
        <div className="field"><label htmlFor="login-id">اسم المستخدم أو البريد الإلكتروني</label><input className="input" id="login-id" autoComplete="username" dir="ltr" placeholder={'مثال: ' + DEMO_LINKS[role]} value={id} onChange={e => setId(e.target.value)} autoFocus /></div>
        <div className="field"><label htmlFor="login-pw">كلمة المرور</label><div className="pw-wrap"><input ref={pwRef} className="input" id="login-pw" type={show ? 'text' : 'password'} autoComplete="current-password" dir="ltr" placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} /><button type="button" className="icon-btn" aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onClick={() => setShow(!show)}><Icon name="eye" size={17} /></button></div></div>
        <label className="check" htmlFor="login-rem"><input type="checkbox" id="login-rem" checked={rem} onChange={e => setRem(e.target.checked)} />{isServer() ? 'تذكرني على هذا الجهاز (30 يومًا)' : 'تذكرني'}</label>
        {(err || lockUntil) && <div className="login-err" role="alert">{lockUntil ? `الحساب مقفل مؤقتًا. حاول مجددًا بعد ${pad2(Math.floor(lockLeft / 60))}:${pad2(lockLeft % 60)}` : err}</div>}
        <button className="btn primary" type="submit" disabled={busy} style={{ height: 44, fontSize: 15 }}>{busy ? 'جارٍ التحقق...' : 'تسجيل الدخول'}</button>
      </form>
      {showDemo && <div className="demo"><div className="demo-h">حسابات تجريبية جاهزة — اضغط للتعبئة:</div>
        {ALL_ROLES.filter(r => !isServer() || r !== 'admin').map(r => <button key={r} type="button" onClick={() => { setRole(r); setId(DEMO_LINKS[r]); setPw(DEMO_PW[r]); }}><span>{ROLE_LABEL[r]}</span><code>{DEMO_LINKS[r]} / {DEMO_PW[r]}</code></button>)}</div>}
      <div className="row between small muted"><a href="#verify">التحقق من صحة شهادة</a><span className="row" style={{ gap: 6 }}><Icon name={isServer() ? 'lock' : 'info'} size={14} />{isServer() ? 'اتصال آمن بخادم المدرسة' : 'وضع العرض'}</span></div>
    </div></div>
    <aside className="login-art">
      <div><Crest lg /><div className="ttl">{S.schoolName}</div><div className="en">{String(S.schoolNameEn).toUpperCase()} · SMART SCHOOL MANAGEMENT</div><div className="stripes"><i style={{ background: '#c42b2b' }} /><i style={{ background: '#13803b' }} /><i style={{ background: '#3c6df0' }} /></div></div>
      <div className="feat">
        <div><Icon name="sparkles" size={20} /><span><b>إنذار مبكر للطلاب</b>درجة خطر لكل طالب تجمع الغياب والتحصيل واتجاه الدرجات، مع السبب والتوصية.</span></div>
        <div><Icon name="check" size={20} /><span><b>حضور يومي وإشعار فوري</b>يصل ولي الأمر إشعار الغياب لحظة تسجيله من المدرس.</span></div>
        <div><Icon name="award" size={20} /><span><b>درجات وشهادات موثّقة</b>أوزان مرنة، ترتيب تلقائي، وشهادة برقم فريد ورمز تحقق QR.</span></div>
      </div>
      <div className="live"><div><b className="tabnum">{fmtNum(stats.students || 0)}</b><span>طالبًا نشطًا</span></div><div><b className="tabnum">{fmtNum(stats.classes || 0)}</b><span>فصول دراسية</span></div><div><b className="tabnum">{fmtPct(stats.attendanceRate, 0)}</b><span>حضور آخر يوم دراسي</span></div></div>
    </aside>
  </div>;
}

export function DemoAutoLogin({ role }) {
  useEffect(() => { (async () => {
    const r = await Auth.login(DEMO_LINKS[role], DEMO_PW[role], false);
    if (!r.ok) { history.replaceState(null, '', location.pathname); toast.error(r.msg); go('dashboard'); return; }
    history.replaceState(null, '', location.pathname + '#dashboard'); go('dashboard');
    toast.success('أهلًا ' + displayName(r.user) + ' — حساب ' + ROLE_LABEL[role] + ' تجريبي');
  })(); }, [role]);
  return <Spinner text={'جارٍ الدخول بحساب ' + ROLE_LABEL[role] + ' التجريبي...'} />;
}

export function Forbidden() {
  return <div className="forbidden"><div className="code">403</div><h2>لا تملك صلاحية الوصول إلى هذه الصفحة</h2><p className="muted">هذه الصفحة مخصّصة لأدوار أخرى في النظام. إن كنت تحتاجها فتواصل مع إدارة المدرسة.</p><button className="btn primary" onClick={() => go('dashboard')}>العودة إلى الرئيسية</button></div>;
}

/* ---------- certificate verification ---------- */
export function VerifyWidget({ initial }) {
  const [code, setCode] = useState(initial || ''); const [res, setRes] = useState(null);
  async function check() {
    if (!code.trim()) { setRes(null); return; }
    if (isServer() && !Repo.all('certificates').length) {
      try { const r = await api('GET', 'api/verify?code=' + encodeURIComponent(code.trim())); if (!r.ok) { setRes({ error: r.error || 'تعذّر التحقق' }); return; } setRes(r.valid ? { ok: r } : { error: 'لم يُعثر على شهادة بهذا الرمز. تأكد من كتابته كما هو مطبوع على الشهادة.' }); }
      catch (e) { setRes({ error: 'تعذّر الاتصال بالخادم.' }); }
      return;
    }
    const c = findCertificate(code);
    if (!c) { setRes({ error: 'لم يُعثر على شهادة بهذا الرمز. تأكد من كتابته كما هو مطبوع على الشهادة.' }); return; }
    const st = Repo.get('students', c.studentId); const y = Repo.get('academicYears', c.academicYearId);
    setRes({ ok: { certNo: c.certNo, studentName: st && st.fullName, className: nameOf.cls(c.classId), yearName: y && y.name, termName: Settings.get().termName, percentage: c.percentage, gradeLabel: c.gradeLabel, result: c.result, issueDate: c.issueDate, schoolName: Settings.get().schoolName } });
  }
  useEffect(() => { if (initial) check(); }, []);
  const r = res && res.ok;
  return <div className="stack" style={{ gap: 14 }}>
    <div className="row" style={{ flexWrap: 'nowrap' }}><input className="input" id="verify-code" placeholder="رمز التحقق أو رقم الشهادة" dir="ltr" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') check(); }} /><button className="btn primary" onClick={check}>تحقق</button></div>
    {res && res.error && <Banner tone="bad" ic="alert">{res.error}</Banner>}
    {r && <><Banner tone="ok" ic="ok">شهادة صحيحة صادرة عن {r.schoolName}.</Banner>
      <KV pairs={[['رقم الشهادة', <span className="ltr">{r.certNo}</span>], ['اسم الطالب', r.studentName], ['الصف والفصل', r.className], ['العام الدراسي', r.yearName], ['الفصل الدراسي', r.termName], ['النسبة', fmtPct(r.percentage, 1) + ' — ' + r.gradeLabel], ['النتيجة', <Badge tone={RESULT_LABEL[r.result][1]}>{RESULT_LABEL[r.result][0]}</Badge>], ['تاريخ الإصدار', fmtDate(r.issueDate)]]} /></>}
  </div>;
}
export function PublicVerify({ code }) {
  return <div className="verify-page"><div className="card" style={{ width: '100%', maxWidth: 560 }}><div className="card-b stack" style={{ gap: 16, padding: 26 }}>
    <div className="row"><Crest /><div><h2 style={{ font: '600 20px var(--f-display)' }}>التحقق من صحة شهادة</h2><div className="muted small">{(Mode.public && Mode.public.schoolName) || Settings.get().schoolName}</div></div></div>
    <p className="muted">أدخل رمز التحقق المطبوع أسفل الشهادة (8 أحرف) أو رقم الشهادة.</p>
    <VerifyWidget initial={code} /><a href="#">العودة إلى تسجيل الدخول</a>
  </div></div></div>;
}
export function VerifyPage({ param }) { return <><PageHead title="التحقق من شهادة" sub="أدخل رمز التحقق المطبوع على الشهادة" /><Card><VerifyWidget initial={param} /></Card></>; }

/* ---------- first-run setup (server mode) ---------- */
export function Setup() {
  const [v, setV] = useState({ school: 'مدرسة عبد السلام', principal: '', user: '', pw: '', pw2: '', demo: true });
  const [err, setErr] = useState(''); const [prog, setProg] = useState(''); const [busy, setBusy] = useState(false);
  const set = k => e => setV({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  async function submit(e) {
    e.preventDefault(); setErr('');
    const bad = !v.school.trim() ? 'أدخل اسم المدرسة.' : !v.principal.trim() ? 'أدخل اسم مدير المدرسة.' : !/^[a-z0-9._-]{3,30}$/i.test(v.user) ? 'اسم الدخول: حروف لاتينية وأرقام (3–30).' : passwordRule(v.pw) ? passwordRule(v.pw) : v.pw !== v.pw2 ? 'كلمتا المرور غير متطابقتين.' : null;
    if (bad) { setErr(bad); return; }
    setBusy(true);
    try {
      if (v.demo) { setProg('جارٍ إنشاء البيانات التجريبية...'); await seedDemo(p => setProg('جارٍ إنشاء البيانات التجريبية... ' + p + '%')); }
      else {
        Repo.clearAll(); Settings.replace({}); const t = new Date().toISOString();
        const y = { id: uid(), name: Settings.get().academicYear, startDate: todayISO(), endDate: addDays(todayISO(), 280), terms: [{ key: 'T1', name: 'الفصل الأول' }, { key: 'T2', name: 'الفصل الثاني' }], isActive: true, createdAt: t, updatedAt: t, deletedAt: null };
        Repo.hardSet('academicYears', [y]);
        Repo.hardSet('periods', [['08:00', '08:45'], ['08:50', '09:35'], ['09:40', '10:25'], ['10:45', '11:30'], ['11:35', '12:20'], ['12:25', '13:10']].map(([a, b], i) => ({ id: uid(), order: i + 1, startTime: a, endTime: b, isBreak: false, createdAt: t, updatedAt: t, deletedAt: null })));
        Repo.hardSet('users', [{ id: uid(), username: v.user, email: '', role: 'admin', linkedId: null, isActive: true, prefs: {}, createdAt: t, updatedAt: t, deletedAt: null }]);
      }
      const admins = Repo.raw('users').filter(u => u.role === 'admin'); if (admins[0]) admins[0].prefs = { ...(admins[0].prefs || {}), displayName: v.principal };
      const ds = { settings: { ...Settings.get(), schoolName: v.school, principalName: v.principal }, data: Object.fromEntries(ENTITIES.map(e => [e, Repo.raw(e)])) };
      setProg('جارٍ الحفظ المشفّر على الخادم...');
      const r = await api('POST', 'api/setup', { adminUsername: v.user, adminPassword: v.pw, schoolName: v.school, demo: v.demo, dataset: ds });
      Repo.clearAll();
      if (!r.ok) { setErr(r.error || 'تعذّر الإعداد'); setBusy(false); setProg(''); return; }
      await refreshPublic(); toast.success('تم إنشاء النظام بنجاح. سجّل الدخول بحساب المدير.');
    } catch (x) { setErr('تعذّر الاتصال بالخادم: ' + x.message); setBusy(false); setProg(''); }
  }
  const F = (k, label, props = {}, hint) => <div className="field"><label htmlFor={'setup-' + k}>{label}</label><input className="input" id={'setup-' + k} value={v[k]} onChange={set(k)} {...props} />{hint && <div className="hint">{hint}</div>}</div>;
  return <div className="verify-page"><div className="card" style={{ width: '100%', maxWidth: 560 }}><div className="card-b stack" style={{ gap: 16, padding: 28 }}>
    <div className="row"><Crest /><div><h1 style={{ font: '600 22px var(--f-display)' }}>الإعداد الأول للنظام</h1><div className="muted small">يُنفَّذ مرة واحدة فقط على هذا الخادم</div></div></div>
    <Banner ic="lock">ستُحفظ كل البيانات على هذا الخادم في قاعدة SQLite مشفّرة بمفتاح AES-256 في data/master.key. احتفظ بنسخة من هذا المفتاح في مكان آمن؛ بدونه لا يمكن قراءة البيانات.</Banner>
    <form className="stack" style={{ gap: 14 }} noValidate onSubmit={submit}>
      {F('school', 'اسم المدرسة', { autoComplete: 'organization' })}
      {F('principal', 'اسم مدير المدرسة (يظهر على الشهادات)', { placeholder: 'مثال: أ. محمود العبد الله', autoFocus: true })}
      {F('user', 'اسم دخول المدير', { dir: 'ltr', autoComplete: 'username', placeholder: 'principal' })}
      {F('pw', 'كلمة مرور المدير', { type: 'password', dir: 'ltr', autoComplete: 'new-password' }, '8 أحرف على الأقل وتحتوي حرفًا ورقمًا. لا تُحفظ إلا مشفّرة على الخادم (scrypt).')}
      {F('pw2', 'تأكيد كلمة المرور', { type: 'password', dir: 'ltr', autoComplete: 'new-password' })}
      <label className="check" htmlFor="setup-demo"><input type="checkbox" id="setup-demo" checked={v.demo} onChange={set('demo')} />تحميل بيانات تجريبية (120 طالبًا، 10 مدرسين، حضور ودرجات ورسوم) للتجربة</label>
      {err && <div className="login-err" role="alert">{err}</div>}
      {prog && <div className="muted small" aria-live="polite">{prog}</div>}
      <button className="btn primary" type="submit" disabled={busy} style={{ height: 44 }}>إنشاء النظام</button>
    </form>
  </div></div></div>;
}
void activeStudents;
