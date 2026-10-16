/* =====================================================================
   التطبيق: اختيار الوضع (خادم / دون اتصال / عرض)، التوجيه، وحماية الصفحات
   ===================================================================== */
import { useEffect, useState } from 'react';
import { Mode, Bus, isServer } from './lib/store.js';
import { Auth, ROLE_LABEL } from './lib/auth.js';
import { Vault } from './lib/vault.js';
import { seedDemo } from './lib/seed.js';
import { PAGES, canSee } from './lib/permissions.js';
import { applyTheme } from './lib/theme.js';
import { toast, go } from './lib/bridge.js';
import { useData, useRoute } from './hooks.js';
import { Spinner, Crest, Progress, Empty } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import { openModal, ModalBody, ModalFoot } from './components/modals.jsx';
import { Login, Setup, PublicVerify, DemoAutoLogin, DEMO_LINKS, Forbidden } from './pages/Auth.jsx';
import { api, Sync } from './lib/sync.js';
import { ROUTES } from './pages/index.js';

async function detectMode() {
  if (!/^https?:$/.test(location.protocol)) return 'demo';
  try {
    const r = await fetch('api/public', { credentials: 'same-origin', cache: 'no-store', headers: { 'X-Requested-With': 'abd-al-salam' } });
    if (r.ok) { const j = await r.json().catch(() => null); if (j && j.app === 'abd-al-salam-school') { Mode.public = j; return 'server'; } }
    return 'demo';
  } catch (e) {
    if (await Vault.hasAny()) { Mode.offline = true; Mode.public = { schoolName: 'مدرسة عبد السلام', stats: {} }; return 'server'; }
    return 'demo';
  }
}

export default function App() {
  const [phase, setPhase] = useState('boot'); const [pct, setPct] = useState(0);
  useData(); const [route, param] = useRoute();
  useEffect(() => {
    (async () => {
      applyTheme();
      Mode.kind = await detectMode();
      if (Mode.kind === 'demo') { setPhase('seeding'); try { await seedDemo(setPct); setPhase('ready'); } catch (e) { console.error(e); setPhase('error'); } return; }
      if ('serviceWorker' in navigator && window.isSecureContext) { try { navigator.serviceWorker.register('sw.js'); } catch (e) { } }
      const u = await Auth.restore();
      setPhase('ready');
      if (u && u.mustChangePassword) { go('profile'); toast.warning('يُرجى تغيير كلمة المرور المؤقتة الآن.'); }
    })();
  }, []);
  useEffect(() => Bus.on('auth:lost', ({ pending }) => reauthModal(pending)), []);
  useEffect(() => { const p = PAGES[route]; document.title = (p && Auth.current() ? p.t + ' · ' : '') + 'نظام إدارة مدرسة عبد السلام'; }, [route]);

  if (phase === 'boot') return <Spinner text="جارٍ الاتصال بخادم المدرسة..." />;
  if (phase === 'seeding') return <div className="boot"><div className="boot-card"><Crest lg /><b style={{ font: '600 20px var(--f-display)' }}>مدرسة عبد السلام</b><div className="muted">جارٍ تجهيز وضع العرض...</div><div style={{ width: 220 }}><Progress p={pct} tone="" /></div></div></div>;
  if (phase === 'error') return <div className="boot"><Empty text="تعذّر تجهيز البيانات. حدّث الصفحة." ic="alert" /></div>;

  const user = Auth.current();
  if (!user) {
    if (route === 'demo' && DEMO_LINKS[param] && (!isServer() || (Mode.public && Mode.public.demo && param !== 'admin'))) return <DemoAutoLogin role={param} />;
    if (route === 'verify') return <PublicVerify code={param} />;
    if (isServer() && Mode.public && Mode.public.needsSetup) return <Setup />;
    return <Login />;
  }
  const r = PAGES[route] ? route : 'dashboard';
  const Page = ROUTES[r];
  return <Layout route={r} user={user}>
    {!canSee(user, r) ? <Forbidden /> : Page ? <Page key={r + (param || '')} param={param} user={user} /> : <Empty text="الصفحة غير موجودة" />}
  </Layout>;
}

let reauthOpen = false;
function reauthModal(pending) {
  const u = Auth.current(); if (!u || reauthOpen) return; reauthOpen = true;
  openModal({ title: 'انتهت الجلسة', size: 'sm', onClose: () => { reauthOpen = false; }, render: ({ close }) => <Reauth user={u} pending={pending} close={close} /> });
}
function Reauth({ user, pending, close }) {
  const [pw, setPw] = useState(''); const [err, setErr] = useState('');
  const submit = async e => {
    e.preventDefault();
    try { const r = await api('POST', 'api/login', { username: user.username, password: pw }); if (!r.ok) { setErr(r.error || 'تعذّر الدخول'); return; } await Sync.resume(r.user, r.cacheKey, pw); close(); toast.success('تم تجديد الجلسة'); }
    catch (x) { setErr('تعذّر الاتصال بالخادم'); }
  };
  return <form onSubmit={submit} style={{ display: 'contents' }}>
    <ModalBody><p className="mb">أدخل كلمة المرور للمتابعة باسم {user.username} ({ROLE_LABEL[user.role]}).{pending ? ` لديك ${pending} تعديل لم يُرسل بعد وسيُحفظ.` : ''}</p>
      <div className="field"><label htmlFor="reauth-pw">كلمة المرور</label><input className="input" type="password" id="reauth-pw" dir="ltr" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} autoFocus /></div>
      <div className="form-err" role="alert">{err}</div></ModalBody>
    <ModalFoot><button className="btn primary" type="submit">متابعة</button><button className="btn ghost" type="button" onClick={() => { close(); Auth.logout(); }}>تسجيل الخروج</button></ModalFoot>
  </form>;
}
