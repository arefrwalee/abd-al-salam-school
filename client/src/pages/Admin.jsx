/* =====================================================================
   التواصل والنظام: الإشعارات، التقارير، المساعد الذكي، المستخدمون، سجل النشاط، الملف الشخصي، الإعدادات
   ===================================================================== */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Repo, Settings, Store, Audit, Auth, Idx, Scope, Notify, Accounts, Sync, api, Mode, ENTITIES, SCHEMA_V, isServer, PAGES, ALL_ROLES, ROLE_LABEL, genPassword, passwordRule,
  activeYear, attStats, recordedDates, classStudents, subjectResult, studentResults, studentAtt, studentFinance, classRanking, atRisk, insights, receipts, lastSchoolDayWithData, passOf, gradeLabel, gradeTone, periodsSorted, nameOf, displayName,
  RISK_LABEL, PAY_STATUS, METHOD_LABEL, NOTIF_LABEL, SEV_ORDER, ACTION_LABEL, ENTITY_LABEL, EXAM_LABEL,
  fmtNum, fmtPct, fmtMoney, fmtDate, fmtDateShort, fmtDateTime, relTime, todayISO, addDays, dow, DAYS, avg, sum, groupBy, gradeName, TOP,
  Icon, Badge, Person, PageHead, Card, Kpi, Empty, PctCell, Select, Seg, Tabs, KV, Banner, LineChart, BarChart, HBars,
  DataTable, openModal, ModalBody, confirmDialog, formModal, credsModal, exportText, PrintButton, toast, go, useData
} from './common.js';
import { StudentLink, InsightsPanel } from './Academic.jsx';
import { NotifRow } from '../components/Layout.jsx';
import { Assistant } from '../lib/assistant.js';
import { Vault } from '../lib/vault.js';
import { seedDemo } from '../lib/seed.js';
import { themePref, setTheme, themeStore } from '../lib/theme.js';

/* ---------- Notifications ---------- */
let notifKeep = 'all';
export function Notifications({ user: u }) {
  const [keep, setKeepS] = useState(notifKeep); const setKeep = v => { notifKeep = v; setKeepS(v); };
  const canSend = u.role === 'admin' || u.role === 'teacher';
  const all = Notify.mine(u); const types = [...new Set(all.map(n => n.type))]; const unread = Notify.unread(u);
  let list = all; if (keep === 'unread') list = list.filter(n => !n.read); else if (keep !== 'all') list = list.filter(n => n.type === keep);
  return <>
    <PageHead title="الإشعارات" sub={`${fmtNum(unread)} غير مقروء من ${fmtNum(all.length)}`}>
      {unread > 0 && <button className="btn" onClick={() => Notify.markAll(u)}><Icon name="ok" size={16} />تعليم الكل كمقروء</button>}
      {canSend && <button className="btn primary" onClick={() => sendNotifForm(u)}><Icon name="send" size={16} />إرسال إشعار</button>}
    </PageHead>
    <Seg options={[['all', 'الكل'], ['unread', 'غير مقروء'], ...types.map(t => [t, NOTIF_LABEL[t]])]} value={keep} onChange={setKeep} />
    <Card flush>{list.length ? <div>{list.slice(0, 100).map(n => <NotifRow key={n.id} n={n} />)}</div> : <Empty text="لا توجد إشعارات هنا." ic="bell" />}</Card>
  </>;
}
function sendNotifForm(u) {
  const cls = Scope.classes(u);
  const aud = u.role === 'admin' ? [['all', 'الجميع'], ['teachers', 'كل المدرسين'], ['parents', 'كل أولياء الأمور'], ['students', 'كل الطلاب'], ...cls.map(c => ['class:' + c.id, 'طلاب وأولياء أمور ' + c.name])] : cls.flatMap(c => [['class:' + c.id, 'طلاب وأولياء أمور ' + c.name], ['classp:' + c.id, 'أولياء أمور ' + c.name]]);
  if (!aud.length) { toast.info('لا توجد فصول لإرسال إشعار لها.'); return; }
  formModal({ title: 'إرسال إشعار', submit: 'إرسال', values: { type: 'announcement', priority: 'normal', audience: aud[0][0] },
    fields: [{ name: 'audience', label: 'المستلمون', type: 'select', required: true, span: true, options: aud }, { name: 'type', label: 'النوع', type: 'select', options: Object.entries(NOTIF_LABEL).filter(([k]) => k !== 'smart') }, { name: 'priority', label: 'الأولوية', type: 'select', options: [['normal', 'عادية'], ['high', 'عالية'], ['low', 'منخفضة']] }, { name: 'title', label: 'العنوان', required: true, span: true }, { name: 'message', label: 'نص الإشعار', type: 'textarea', required: true, span: true, rows: 4 }],
    onSubmit: v => { const n = Notify.send(Notify.audience(v.audience), { type: v.type, title: v.title, message: v.message, priority: v.priority }); Audit.log('create', 'notifications', v.audience, null, { title: v.title, recipients: n }); toast.success(`أُرسل الإشعار إلى ${fmtNum(n)} مستخدمًا`); } });
}

/* ---------- Reports ---------- */
const REPORTS = {
  students_by_class: { t: 'الطلاب حسب الفصل', d: 'العدد والجنس والحضور والمعدل لكل فصل', g: 'الطلاب' },
  contacts: { t: 'بيانات الاتصال بأولياء الأمور', d: 'قائمة الطلاب مع هواتف أولياء الأمور', g: 'الطلاب' },
  att_daily: { t: 'الحضور اليومي', d: 'نسبة الحضور لكل فصل في يوم محدد', g: 'الحضور' },
  att_top: { t: 'الأكثر غيابًا', d: 'ترتيب الطلاب حسب أيام الغياب في فترة', g: 'الحضور' },
  att_monthly: { t: 'الحضور الشهري', d: 'نسبة الحضور يومًا بيوم خلال فترة', g: 'الحضور' },
  grades_matrix: { t: 'متوسطات الفصول والمواد', d: 'مصفوفة متوسط كل مادة في كل فصل', g: 'الدرجات' },
  top: { t: 'الأوائل', d: 'أعلى المعدلات في كل فصل', g: 'الدرجات' },
  failing: { t: 'الطلاب المتعثرون دراسيًا', d: 'الطلاب الذين لديهم مواد تحت خط النجاح', g: 'الدرجات' },
  fin_outstanding: { t: 'المبالغ المتبقية', d: 'الطلاب الذين عليهم مبالغ مستحقة', g: 'المالية', admin: true },
  fin_period: { t: 'الإيرادات حسب الفترة', d: 'المدفوعات المقبوضة خلال فترة', g: 'المالية', admin: true },
  risk: { t: 'الطلاب في خطر (ذكي)', d: 'ترتيب حسب درجة الخطر مع الأسباب والتوصيات', g: 'ذكية' },
  monthly_summary: { t: 'ملخص الأداء الشهري (ذكي)', d: 'رؤى نصية وأرقام رئيسية لآخر 30 يومًا', g: 'ذكية' }
};
export function Reports({ user: u }) {
  const T = todayISO();
  const [type, setTypeS] = useState(() => Store.ss.get('ass:report') || 'students_by_class');
  const setType = k => { Store.ss.set('ass:report', k); setTypeS(k); };
  const [from, setFrom] = useState(addDays(T, -29)); const [to, setTo] = useState(T); const [cls, setCls] = useState(''); const [day, setDay] = useState(() => lastSchoolDayWithData() || T);
  const classes = Scope.classes(u);
  const pool = cls ? classStudents(cls) : Scope.students(u).filter(s => s.status === 'active');
  const R = buildReport(type, { u, pool, classes, from, to, day });
  const rows = R.rows.map((r, i) => (r && r.id ? r : { ...r, key: i }));
  const printNode = () => {
    const cols = R.columns.filter(c => c.csv !== false);
    const d = document.createElement('div'); d.style.cssText = 'padding:12px;background:#fff;color:#000;font-family:var(--f-body)';
    const el = (tag, txt, css) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (css) e.style.cssText = css; return e; };
    d.append(el('h2', Settings.get().schoolName, 'text-align:center'), el('h3', R.title, 'text-align:center;margin:4px 0 10px'), el('div', 'تاريخ التقرير: ' + fmtDate(T), 'text-align:center;font-size:12px;margin-bottom:10px'));
    const t = el('table', null, 'width:100%;border-collapse:collapse;font-size:12px'); const hr = el('tr'); cols.forEach(c => hr.append(el('th', c.label, 'border:1px solid #ccc;padding:4px'))); const th = el('thead'); th.append(hr); const tb = el('tbody');
    R.rows.forEach(r => { const tr = el('tr'); cols.forEach(c => tr.append(el('td', String(c.csv ? c.csv(r) : c.text ? c.text(r) : c.sort ? c.sort(r) : r[c.key] ?? ''), 'border:1px solid #ccc;padding:4px'))); tb.append(tr); });
    t.append(th, tb); d.append(t); return d;
  };
  const dateIn = (label, v, set) => <label className="row small">{label}<input type="date" className="input sm" value={v} onChange={e => set(e.target.value)} /></label>;
  return <>
    <PageHead title="التقارير" sub="اختر تقريرًا، حدد الفترة أو الفصل، ثم صدّره CSV أو اطبعه" />
    <Card><div className="report-types">{Object.entries(REPORTS).filter(([, r]) => !r.admin || u.role === 'admin').map(([k, r]) => <button key={k} className={k === type ? 'on' : ''} onClick={() => setType(k)}><span className="small muted">{r.g}</span><b>{r.t}</b><span>{r.d}</span></button>)}</div></Card>
    <div className="row">
      {type === 'att_daily' && dateIn('اليوم', day, setDay)}
      {['att_top', 'att_monthly', 'fin_period'].includes(type) && <>{dateIn('من', from, setFrom)}{dateIn('إلى', to, setTo)}</>}
      {['contacts', 'att_top', 'top', 'failing', 'fin_outstanding', 'risk', 'att_monthly'].includes(type) && <Select label="الفصل" options={[['', 'كل الفصول'], ...classes.map(c => [c.id, c.name])]} value={cls} onChange={setCls} />}
    </div>
    <Card title={R.title} actions={<PrintButton target={printNode} what={'report-' + type} />}><div className="stack" style={{ gap: 14 }}>
      {R.note && <div className="muted small">{R.note}</div>}
      {R.top}{R.chart}
      <DataTable key={type + cls + from + to + day} id={'rep-' + type} unit="صف" exportName={'report-' + type} rows={rows} columns={R.columns} pageSize={15} search={rows.length > 8} cards={false} />
    </div></Card>
  </>;
}
function buildReport(type, { u, pool, classes, from, to, day }) {
  const T = todayISO(); const R = { title: REPORTS[type].t, rows: [], columns: [] };
  const sCol = { label: 'الطالب', sort: x => x.s.fullName, render: x => <StudentLink s={x.s} />, csv: x => x.s.fullName };
  const cCol = { label: 'الفصل', sort: x => nameOf.cls(x.s.classId), render: x => nameOf.cls(x.s.classId) };
  const red = v => <b style={{ color: v ? 'var(--red)' : undefined }}>{v}</b>;
  if (type === 'students_by_class') {
    R.rows = classes.map(c => { const sts = classStudents(c.id); return { id: c.id, c, n: sts.length, m: sts.filter(s => s.gender === 'male').length, f: sts.filter(s => s.gender === 'female').length, att: attStats(Repo.all('attendance').filter(r => r.classId === c.id && r.date >= addDays(T, -29))).rate, avg: avg(sts.map(s => studentResults(s).avg).filter(v => v != null)) }; });
    R.columns = [{ label: 'الفصل', sort: x => x.c.name, render: x => x.c.name }, { label: 'الصف', sort: x => x.c.gradeLevel, render: x => gradeName(x.c.gradeLevel), csv: x => gradeName(x.c.gradeLevel) }, { label: 'الطلاب', key: 'n' }, { label: 'ذكور', key: 'm' }, { label: 'إناث', key: 'f' }, { label: 'الحضور 30 يومًا', sort: x => x.att, render: x => <PctCell p={x.att} />, csv: x => fmtNum(x.att, 1) }, { label: 'متوسط الدرجات', sort: x => x.avg, render: x => fmtPct(x.avg, 1), csv: x => fmtNum(x.avg, 1) }];
    R.chart = <BarChart labels={R.rows.map(x => x.c.name.replace(' - ', ' '))} series={[{ name: 'ذكور', values: R.rows.map(x => x.m), color: 'var(--c1)' }, { name: 'إناث', values: R.rows.map(x => x.f), color: 'var(--c3)' }]} fmt={v => fmtNum(v)} height={200} />;
  } else if (type === 'contacts') {
    R.rows = pool.map(s => ({ id: s.id, s, p: Repo.get('parents', s.parentId) || {} }));
    R.columns = [sCol, cCol, { label: 'الرقم', sort: x => x.s.studentNo, render: x => <span className="ltr">{x.s.studentNo}</span> }, { label: 'ولي الأمر', sort: x => x.p.fullName, render: x => x.p.fullName || '—' }, { label: 'الهاتف', sort: x => x.p.phone, render: x => <span className="ltr">{x.p.phone || '—'}</span> }, { label: 'العنوان', sort: x => x.s.address, render: x => x.s.address || '—' }];
  } else if (type === 'att_daily') {
    R.title += ' — ' + DAYS[dow(day)] + ' ' + fmtDate(day);
    const recs = Idx().attByDate.get(day) || [];
    R.rows = classes.map(c => ({ id: c.id, c, a: attStats(recs.filter(r => r.classId === c.id)), n: classStudents(c.id).length }));
    R.columns = [{ label: 'الفصل', sort: x => x.c.name, render: x => x.c.name }, { label: 'الحالة', sort: x => x.a.total, render: x => x.a.total ? <Badge tone="ok">مسجّل</Badge> : <Badge tone="bad">لم يُسجَّل</Badge>, csv: x => x.a.total ? 'مسجل' : 'لم يسجل' }, { label: 'نسبة الحضور', sort: x => x.a.rate, render: x => <PctCell p={x.a.rate} />, csv: x => fmtNum(x.a.rate, 1) }, { label: 'حاضر', sort: x => x.a.present, render: x => fmtNum(x.a.present) }, { label: 'غائب', sort: x => x.a.absent, render: x => fmtNum(x.a.absent) }, { label: 'متأخر', sort: x => x.a.late, render: x => fmtNum(x.a.late) }, { label: 'بعذر', sort: x => x.a.excused, render: x => fmtNum(x.a.excused) }];
    const all = attStats(recs); R.top = <div className="row"><Badge tone="info" plain>{`نسبة الحضور العامة ${fmtPct(all.rate, 1)}`}</Badge><Badge tone="bad" plain>{`الغائبون ${fmtNum(all.absent)}`}</Badge></div>;
  } else if (type === 'att_top') {
    R.rows = pool.map(s => ({ id: s.id, s, a: studentAtt(s.id, from, to) })).filter(x => x.a.absent + x.a.late).sort((a, b) => b.a.absent - a.a.absent || b.a.late - a.a.late);
    R.columns = [sCol, cCol, { label: 'غياب', desc: true, sort: x => x.a.absent, render: x => red(fmtNum(x.a.absent)), csv: x => x.a.absent }, { label: 'تأخر', sort: x => x.a.late, render: x => fmtNum(x.a.late), csv: x => x.a.late }, { label: 'بعذر', sort: x => x.a.excused, render: x => fmtNum(x.a.excused), csv: x => x.a.excused }, { label: 'نسبة الحضور', sort: x => x.a.rate, render: x => <PctCell p={x.a.rate} />, csv: x => fmtNum(x.a.rate, 1) }];
    R.note = `الفترة من ${fmtDate(from)} إلى ${fmtDate(to)}.`;
  } else if (type === 'att_monthly') {
    const ids = new Set(pool.map(s => s.id)); const ds = recordedDates().filter(d => d >= from && d <= to);
    R.rows = ds.map(d => ({ id: d, d, a: attStats((Idx().attByDate.get(d) || []).filter(r => ids.has(r.studentId))) }));
    R.columns = [{ label: 'اليوم', sort: x => x.d, render: x => DAYS[dow(x.d)] + ' ' + fmtDate(x.d), csv: x => x.d }, { label: 'نسبة الحضور', sort: x => x.a.rate, render: x => <PctCell p={x.a.rate} />, csv: x => fmtNum(x.a.rate, 1) }, { label: 'غائب', sort: x => x.a.absent, render: x => fmtNum(x.a.absent) }, { label: 'متأخر', sort: x => x.a.late, render: x => fmtNum(x.a.late) }, { label: 'بعذر', sort: x => x.a.excused, render: x => fmtNum(x.a.excused) }];
    if (R.rows.length) R.chart = <LineChart labels={R.rows.map(x => fmtDateShort(x.d))} series={[{ name: 'الحضور', values: R.rows.map(x => x.a.rate), color: 'var(--c2)' }]} min={70} max={100} fmt={v => fmtNum(v) + '%'} tip={v => fmtPct(v, 1)} height={200} />;
  } else if (type === 'grades_matrix') {
    const subs = Repo.all('subjects').filter(s => u.role === 'admin' || Scope.assignments(u).some(a => a.subjectId === s.id));
    R.rows = classes.map(c => ({ id: c.id, c, v: Object.fromEntries(subs.map(s => [s.id, avg(classStudents(c.id).map(st => subjectResult(st, s.id).percent).filter(x => x != null))])) }));
    R.columns = [{ label: 'الفصل', sort: x => x.c.name, render: x => x.c.name }, ...subs.map(s => ({ label: s.name, sort: x => x.v[s.id], render: x => x.v[s.id] == null ? '—' : <span className={'badge plain ' + gradeTone(x.v[s.id])}>{fmtNum(x.v[s.id], 0)}</span>, csv: x => fmtNum(x.v[s.id], 1) }))];
    R.note = 'الألوان: أخضر ≥ 80، أزرق ≥ 60، برتقالي ≥ 50، أحمر < 50.';
  } else if (type === 'top') {
    R.rows = [...groupBy(pool, s => s.classId).entries()].flatMap(([cid, sts]) => { const rk = classRanking(cid); return sts.map(s => ({ id: s.id, s, a: studentResults(s).avg, r: rk.get(s.id) })).filter(x => x.r && x.r <= 3); }).sort((a, b) => nameOf.cls(a.s.classId).localeCompare(nameOf.cls(b.s.classId), 'ar') || a.r - b.r);
    R.columns = [cCol, { label: 'الترتيب', sort: x => x.r, render: x => <b>{fmtNum(x.r)}</b>, csv: x => x.r }, sCol, { label: 'المعدل', sort: x => x.a, render: x => fmtPct(x.a, 1), csv: x => fmtNum(x.a, 1) }, { label: 'التقدير', sortable: false, render: x => <Badge tone={gradeTone(x.a)} plain>{gradeLabel(x.a)}</Badge>, csv: x => gradeLabel(x.a) }];
  } else if (type === 'failing') {
    R.rows = pool.map(s => ({ id: s.id, s, r: studentResults(s) })).filter(x => x.r.failing).sort((a, b) => b.r.failing - a.r.failing);
    const failed = x => x.r.rows.filter(r => r.percent < passOf(r.subject));
    R.columns = [sCol, cCol, { label: 'عدد المواد', desc: true, sort: x => x.r.failing, render: x => red(fmtNum(x.r.failing)), csv: x => x.r.failing }, { label: 'المواد', sortable: false, render: x => failed(x).map(r => `${r.subject.name} (${fmtNum(r.percent, 0)})`).join('، '), csv: x => failed(x).map(r => r.subject.name).join(' | ') }, { label: 'المعدل', sort: x => x.r.avg, render: x => fmtPct(x.r.avg, 1), csv: x => fmtNum(x.r.avg, 1) }];
  } else if (type === 'fin_outstanding') {
    R.rows = pool.map(s => ({ id: s.id, s, f: studentFinance(s.id) })).filter(x => x.f.remaining > 0).sort((a, b) => b.f.overdue - a.f.overdue || b.f.remaining - a.f.remaining);
    const ph = x => (Repo.get('parents', x.s.parentId) || {}).phone || '';
    R.columns = [sCol, cCol, { label: 'المتبقي', desc: true, sort: x => x.f.remaining, render: x => fmtMoney(x.f.remaining), csv: x => x.f.remaining }, { label: 'متأخر', desc: true, sort: x => x.f.overdue, render: x => <b style={{ color: x.f.overdue ? 'var(--red)' : undefined }}>{fmtMoney(x.f.overdue)}</b>, csv: x => x.f.overdue }, { label: 'الحالة', sort: x => x.f.status, render: x => <Badge tone={PAY_STATUS[x.f.status][1]}>{PAY_STATUS[x.f.status][0]}</Badge>, csv: x => PAY_STATUS[x.f.status][0] }, { label: 'هاتف ولي الأمر', sortable: false, render: x => <span className="ltr">{ph(x) || '—'}</span>, csv: ph }];
    R.top = <div className="row"><Badge tone="warn" plain>{'إجمالي المتبقي ' + fmtMoney(sum(R.rows.map(x => x.f.remaining)))}</Badge><Badge tone="bad" plain>{'المتأخر ' + fmtMoney(sum(R.rows.map(x => x.f.overdue)))}</Badge></div>;
  } else if (type === 'fin_period') {
    const rs = receipts().filter(r => r.paidAt.slice(0, 10) >= from && r.paidAt.slice(0, 10) <= to).map(r => ({ ...r, id: r.receiptNo }));
    R.rows = rs; R.note = `الفترة من ${fmtDate(from)} إلى ${fmtDate(to)} · ${fmtNum(rs.length)} إيصال · الإجمالي ${fmtMoney(sum(rs.map(r => r.amount)))}`;
    R.columns = [{ label: 'رقم الإيصال', sort: r => r.receiptNo, render: r => <span className="ltr">{r.receiptNo}</span> }, { label: 'التاريخ', sort: r => r.paidAt, render: r => fmtDateTime(r.paidAt), csv: r => r.paidAt.slice(0, 10) }, { label: 'الطالب', sort: r => nameOf.st(r.studentId), render: r => nameOf.st(r.studentId) }, { label: 'المبلغ', sort: r => r.amount, render: r => fmtMoney(r.amount), csv: r => r.amount }, { label: 'الطريقة', sort: r => r.method, render: r => METHOD_LABEL[r.method] }];
    const byDay = groupBy(rs, r => r.paidAt.slice(0, 10)); const ds = [...byDay.keys()].sort();
    if (ds.length) R.chart = <BarChart labels={ds.map(fmtDateShort)} series={[{ name: 'المقبوض', values: ds.map(d => sum(byDay.get(d).map(r => r.amount))), color: 'var(--c2)' }]} tip={fmtMoney} height={200} />;
  } else if (type === 'risk') {
    R.rows = atRisk(pool, 'medium').map(x => ({ id: x.st.id, s: x.st, r: x.r }));
    R.columns = [sCol, cCol, { label: 'الدرجة', desc: true, sort: x => x.r.score, render: x => <span className={'badge ' + RISK_LABEL[x.r.level][1]}>{fmtNum(x.r.score)}</span>, csv: x => x.r.score }, { label: 'المستوى', sort: x => x.r.score, render: x => <Badge tone={RISK_LABEL[x.r.level][1]}>{RISK_LABEL[x.r.level][0]}</Badge>, csv: x => RISK_LABEL[x.r.level][0] }, { label: 'الأسباب', sortable: false, render: x => x.r.factors.map(f => f.text).join('؛ '), csv: x => x.r.factors.map(f => f.text).join(' | ') }, { label: 'التوصية', sortable: false, render: x => <span className="small">{x.r.rec}</span>, csv: x => x.r.rec }];
    R.note = 'درجة الخطر من 100: الغياب بلا عذر 35% · التحصيل 30% · اتجاه الدرجات 20% · المواد الراسبة 10% · التأخر 5%.';
  } else if (type === 'monthly_summary') {
    const ids = new Set(pool.map(s => s.id)); const a = attStats(Repo.all('attendance').filter(r => r.date >= addDays(T, -29) && ids.has(r.studentId)));
    R.rows = insights(u).map((x, i) => ({ ...x, key: i }));
    R.columns = [{ label: 'الأهمية', sort: x => SEV_ORDER[x.sev], render: x => <Badge tone={x.sev}>{{ bad: 'عالية', warn: 'متوسطة', info: 'معلومة', ok: 'إيجابية' }[x.sev]}</Badge>, csv: x => x.sev }, { label: 'الملاحظة', sort: x => x.title, render: x => <b>{x.title}</b>, csv: x => x.title }, { label: 'التفاصيل', sortable: false, render: x => x.text, csv: x => x.text }];
    R.top = <div className="kpis"><Kpi label="الطلاب" value={fmtNum(pool.length)} ic="users" /><Kpi label="الحضور 30 يومًا" value={fmtPct(a.rate, 1)} ic="check" tone={a.rate >= 92 ? 'ok' : 'warn'} /><Kpi label="المعدل العام" value={fmtPct(avg(pool.map(s => studentResults(s).avg).filter(v => v != null)), 1)} ic="award" /><Kpi label="في خطر مرتفع" value={fmtNum(atRisk(pool, 'high').length)} ic="alert" tone="bad" /></div>;
  }
  return R;
}

/* ---------- AI Assistant ---------- */
export function AssistantPage({ user: u }) {
  const [msgs, setMsgs] = useState(() => [{ id: 0, who: 'bot', res: { text: `أهلًا ${displayName(u)}. اسألني عن الحضور أو الدرجات أو الرسوم أو الطلاب الذين يحتاجون متابعة.`, sug: (Assistant.SUGGEST[u.role] || []).slice(0, 4) } }]);
  const [q, setQ] = useState(''); const logRef = useRef(null); const inRef = useRef(null); const seq = useRef(1);
  function send(text) {
    text = (text ?? q).trim(); if (!text) return; setQ('');
    const id = seq.current; seq.current += 2;
    setMsgs(m => [...m, { id, who: 'me', text }, { id: id + 1, who: 'bot', thinking: true }]);
    setTimeout(() => {
      let res; try { res = Assistant.ask(text, u); } catch (e) { console.error(e); res = { text: 'حدث خطأ أثناء تحليل السؤال: ' + e.message }; }
      setMsgs(m => m.map(x => x.id === id + 1 ? { id: id + 1, who: 'bot', res } : x));
    }, 220);
  }
  useEffect(() => { const pre = Store.ss.get('ass:ask'); if (pre) { Store.ss.del('ass:ask'); send(pre); } inRef.current && inRef.current.focus(); }, []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [msgs]);
  const ins = insights(u).slice(0, 4);
  return <>
    <PageHead title="المساعد الذكي" sub="يجيب من بيانات النظام الفعلية ضمن صلاحياتك، ويعمل على هذا الجهاز دون إرسال البيانات لأي جهة خارجية." />
    <div className="grid g-main">
      <section className="card chat">
        <div className="chat-log" aria-live="polite" ref={logRef}>{msgs.map(m => m.who === 'me' ? <div className="msg me" key={m.id}><div className="bub">{m.text}</div></div>
          : m.thinking ? <div className="msg bot" key={m.id}><div className="bub muted">جارٍ التحليل...</div></div>
          : <div className="msg bot" key={m.id}><div className="bub">{m.res.text}</div>
            {m.res.bars && m.res.bars.length > 0 && <Card><HBars rows={m.res.bars} max={100} /></Card>}
            {m.res.table && m.res.table.rows.length > 0 && <div className="tbl-wrap"><table className="tbl"><thead><tr>{m.res.table.head.map((x, i) => <th key={i}>{x}</th>)}</tr></thead><tbody>{m.res.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>}
            {m.res.list && m.res.list.length > 0 && <div className="row">{m.res.list.slice(0, 12).map((x, i) => <a key={i} className="chip" href={'#' + x.route}>{x.label + (x.sub ? ' · ' + x.sub : '')}</a>)}</div>}
            {m.res.sug && <div className="sugs">{m.res.sug.map(s => <button key={s} onClick={() => send(s)}>{s}</button>)}</div>}
            {m.res.src && <div className="src">{m.res.src}</div>}
          </div>)}</div>
        <div className="chat-in"><input ref={inRef} className="input" id="ask-in" placeholder="اكتب سؤالك بالعربية... مثال: كم طالب غائب اليوم؟" autoComplete="off" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }} /><button className="btn primary" aria-label="إرسال" onClick={() => send()}><Icon name="send" size={16} />اسأل</button></div>
      </section>
      <div className="stack" style={{ gap: 16 }}>
        <Card title="أسئلة مقترحة"><div className="sugs">{(Assistant.SUGGEST[u.role] || []).map(s => <button key={s} onClick={() => send(s)}>{s}</button>)}</div></Card>
        {ins.length > 0 && <Card title="رؤى اليوم"><div>{ins.map((i, k) => <div key={k} className={'insight ' + i.sev}><div className="ic"><Icon name={i.ic} size={16} /></div><div><b>{i.title}</b><p>{i.text}</p></div></div>)}</div></Card>}
        <Card title="كيف يعمل؟"><p className="small muted">يفهم المساعد الأسئلة العربية بالكلمات المفتاحية بعد توحيد الهمزات والتاء المربوطة، ويستخرج الفصل والمادة والفترة واسم الطالب، ثم يحسب الإجابة مباشرة من السجلات. في المرحلة القادمة يمكن ربطه بنموذج لغوي عبر خادم آمن دون تغيير هذه الواجهة.</p></Card>
      </div>
    </div>
  </>;
}

/* ---------- Users ---------- */
const isLocked = x => x.lockedUntil && new Date(x.lockedUntil) > new Date();
export function Users({ user: me }) {
  return <>
    <PageHead title="المستخدمون والصلاحيات" sub="الحسابات وأدوارها. الصلاحيات تُحدَّد حسب الدور وتُفحص في كل عملية."><button className="btn primary" onClick={() => adminUserForm()}><Icon name="plus" size={16} />حساب إداري جديد</button></PageHead>
    <Tabs initial="list" items={[
      { key: 'list', label: 'الحسابات', render: () => <Card><DataTable id="users" unit="حساب" exportName="users" rows={Repo.all('users')} searchText={x => x.username + ' ' + displayName(x) + ' ' + (x.email || '')}
        filters={[{ label: 'كل الأدوار', options: Object.entries(ROLE_LABEL), test: (x, v) => x.role === v }, { label: 'كل الحالات', options: [['active', 'فعّال'], ['inactive', 'معطّل'], ['locked', 'مقفل']], test: (x, v) => v === 'active' ? x.isActive : v === 'inactive' ? !x.isActive : isLocked(x) }]}
        columns={[
          { label: 'المستخدم', sort: x => displayName(x), render: x => <Person name={displayName(x)} sub={x.username} />, csv: x => displayName(x) },
          { label: 'اسم الدخول', key: 'username', render: x => <span className="ltr">{x.username}</span> },
          { label: 'الدور', sort: x => x.role, render: x => <Badge tone={{ admin: 'violet', teacher: 'info', student: '', parent: 'ok' }[x.role]} plain>{ROLE_LABEL[x.role]}</Badge>, csv: x => ROLE_LABEL[x.role] },
          { label: 'آخر دخول', desc: true, sort: x => x.lastLogin || '', render: x => x.lastLogin ? relTime(x.lastLogin) : <span className="muted">لم يدخل بعد</span>, csv: x => x.lastLogin || '' },
          { label: 'الحالة', sort: x => x.isActive, render: x => isLocked(x) ? <Badge tone="bad">مقفل مؤقتًا</Badge> : x.isActive ? <Badge tone="ok">فعّال</Badge> : <Badge>معطّل</Badge>, csv: x => x.isActive ? 'فعال' : 'معطل' },
          { label: '', sortable: false, cls: 'acts', csv: false, render: x => <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
            {isLocked(x) && <button className="btn ghost xs" onClick={() => { Repo.update('users', x.id, { lockedUntil: null, failedAttempts: 0 }); toast.success('تم فك القفل'); }}><Icon name="unlock" size={14} />فك القفل</button>}
            <button className="btn ghost xs" onClick={() => resetPassword(x)}><Icon name="key" size={14} />كلمة المرور</button>
            {x.id !== me.id && <button className="btn ghost xs" onClick={() => { Repo.update('users', x.id, { isActive: !x.isActive }); toast.success(x.isActive ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب'); }}>{x.isActive ? 'تعطيل' : 'تفعيل'}</button>}
          </div> }
        ]} /></Card> },
      { key: 'matrix', label: 'مصفوفة الصلاحيات', render: () => <Card title="ما يستطيع كل دور الوصول إليه">
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>الصفحة</th>{ALL_ROLES.map(r => <th key={r} className="c">{ROLE_LABEL[r]}</th>)}</tr></thead><tbody>
          {Object.entries(PAGES).filter(([, p]) => !p.hidden).map(([k, p]) => <tr key={k}><td><span className="row" style={{ gap: 8 }}><Icon name={p.ic} size={16} />{p.t}</span></td>{ALL_ROLES.map(r => <td key={r} className="c">{p.roles.includes(r) ? <span style={{ color: 'var(--green)' }} aria-label="مسموح"><Icon name="ok" size={18} /></span> : <span className="muted" aria-label="غير مسموح">—</span>}</td>)}</tr>)}
        </tbody></table></div>
        <p className="muted small" style={{ marginTop: 10 }}>{'إضافة لذلك: المدرس يرى فقط طلاب وفصول ومواد الإسناد الخاص به، وولي الأمر يرى أبناءه فقط، والطالب يرى بياناته فقط. يمكن للمدرس تعديل الحضور لليوم و' + fmtNum(Settings.get().teacherEditDays) + ' أيام سابقة، ولا يعدّل الدرجات المقفلة بعد إصدار الشهادات.'}</p>
      </Card> }
    ]} />
  </>;
}
function resetPassword(x) {
  formModal({ title: 'تعيين كلمة مرور — ' + displayName(x), size: 'sm', submit: 'حفظ', values: { pw: genPassword(), must: true },
    intro: <p className="muted small">اقترحنا كلمة مرور عشوائية قوية. سلّمها للمستخدم، وسيُطلب منه تغييرها عند الدخول.</p>,
    fields: [{ name: 'pw', label: 'كلمة المرور الجديدة', required: true, ltr: true, validate: passwordRule }, { name: 'must', label: 'إلزام المستخدم بتغييرها عند الدخول التالي', type: 'checkbox' }],
    onSubmit: async v => { try { const pw = await Accounts.resetPassword(x.id, v.pw, !!v.must); setTimeout(() => credsModal('كلمة المرور الجديدة', [[displayName(x), x.username, pw]]), 50); } catch (e) { return e.message; } } });
}
function adminUserForm() {
  formModal({ title: 'حساب إداري جديد', size: 'sm', submit: 'إنشاء',
    fields: [{ name: 'username', label: 'اسم الدخول', required: true, ltr: true, validate: v => /^[a-z0-9._-]{3,30}$/i.test(v) ? (Repo.raw('users').some(u => u.username.toLowerCase() === v.toLowerCase()) ? 'اسم الدخول مستخدم' : null) : 'حروف لاتينية وأرقام فقط (3–30)' }, { name: 'email', label: 'البريد الإلكتروني', type: 'email', ltr: true }, { name: 'pw', label: 'كلمة مرور مؤقتة', required: true, ltr: true, default: genPassword(), validate: passwordRule }],
    onSubmit: async v => { try { await Accounts.createAdmin(v.username, v.email, v.pw); toast.success('تم إنشاء الحساب ' + v.username); } catch (e) { return e.message; } } });
}

/* ---------- Audit log ---------- */
export function AuditPage() {
  const rows = Repo.all('auditLog').slice().reverse();
  const showDiff = a => openModal({ title: (ACTION_LABEL[a.action] || a.action) + ' · ' + (ENTITY_LABEL[a.entity] || a.entity), size: 'lg', render: () => <ModalBody><div className="diff"><div><div className="small muted mb">قبل</div><pre>{a.before ? JSON.stringify(a.before, null, 2) : '—'}</pre></div><div><div className="small muted mb">بعد</div><pre>{a.after ? JSON.stringify(a.after, null, 2) : '—'}</pre></div></div></ModalBody> });
  return <>
    <PageHead title="سجل النشاط" sub="كل عملية إنشاء أو تعديل أو حذف أو دخول، مع القيم قبل وبعد" />
    <Card><DataTable id="audit" unit="عملية" exportName="audit-log" rows={rows} pageSize={20}
      searchText={a => nameOf.user(a.userId) + ' ' + (ENTITY_LABEL[a.entity] || a.entity) + ' ' + (ACTION_LABEL[a.action] || a.action)}
      filters={[{ label: 'كل العمليات', options: Object.entries(ACTION_LABEL), test: (a, v) => a.action === v }, { label: 'كل الأقسام', options: Object.entries(ENTITY_LABEL), test: (a, v) => a.entity === v }]}
      columns={[
        { label: 'الوقت', desc: true, sort: a => a.at, render: a => <div><div>{relTime(a.at)}</div><div className="muted small">{fmtDateTime(a.at)}</div></div>, csv: a => a.at },
        { label: 'المستخدم', sort: a => nameOf.user(a.userId), render: a => nameOf.user(a.userId) },
        { label: 'العملية', sort: a => a.action, render: a => <Badge tone={{ create: 'ok', update: 'info', delete: 'bad', lock: 'bad' }[a.action] || ''} plain>{ACTION_LABEL[a.action] || a.action}</Badge>, csv: a => ACTION_LABEL[a.action] || a.action },
        { label: 'القسم', sort: a => a.entity, render: a => ENTITY_LABEL[a.entity] || a.entity },
        { label: 'العنصر', sortable: false, render: a => { const o = a.after || a.before || {}; return o.fullName || o.name || o.title || o.receiptNo || o.certNo || o.username || (a.entity === 'attendance' && o.date ? nameOf.cls(o.classId) + ' · ' + fmtDate(o.date) : '—'); } },
        { label: '', sortable: false, cls: 'acts', csv: false, render: a => (a.before || a.after) ? <button className="btn ghost xs" onClick={() => showDiff(a)}>التفاصيل</button> : null }
      ]} /></Card>
  </>;
}

/* ---------- Profile ---------- */
export function Profile({ user: u }) {
  useSyncExternalStore(themeStore.subscribe, themeStore.get);
  const map = { teacher: 'teachers', student: 'students', parent: 'parents' };
  const p = u.role === 'admin' ? null : Repo.get(map[u.role], u.linkedId);
  const [pw, setPw] = useState({ o: '', n: '', n2: '' }); const [msg, setMsg] = useState(''); const [, tick] = useState(0);
  const prefs = u.prefs || {};
  async function changePw(e) {
    e.preventDefault(); setMsg('');
    if (pw.n !== pw.n2) { setMsg('كلمتا المرور غير متطابقتين.'); return; }
    const err = await Auth.changePassword(pw.o, pw.n); if (err) { setMsg(err); return; }
    toast.success('تم تغيير كلمة المرور'); setPw({ o: '', n: '', n2: '' });
  }
  const pf = (k, id, label) => <div className="field"><label htmlFor={id}>{label}</label><input className="input" id={id} type="password" dir="ltr" autoComplete={k === 'o' ? 'current-password' : 'new-password'} value={pw[k]} onChange={e => setPw({ ...pw, [k]: e.target.value })} /></div>;
  async function wipe() {
    if (!(await confirmDialog({ title: 'حذف النسخة من هذا الجهاز', message: 'ستُحذف النسخة المشفّرة من هذا الجهاز ويُسجَّل خروجك. التعديلات غير المرسلة ستُفقد إن لم يكن هناك اتصال.', ok: 'حذف وتسجيل الخروج', danger: true }))) return;
    await Sync.flush(); await Vault.wipe(); Auth.logout('حُذفت النسخة المحلية من هذا الجهاز.');
  }
  const notifOk = TOP && 'Notification' in window;
  return <>
    <PageHead title="ملفي الشخصي" sub={ROLE_LABEL[u.role]} />
    {u.mustChangePassword && <Banner tone="warn" ic="lock">يُرجى تغيير كلمة المرور المؤقتة الآن لحماية حسابك.</Banner>}
    <div className="grid g2">
      <Card title="بياناتي"><div className="stack" style={{ gap: 14 }}><Person name={displayName(u)} sub={ROLE_LABEL[u.role]} />
        <KV pairs={[['اسم الدخول', <span className="ltr">{u.username}</span>], ['البريد الإلكتروني', u.email || (p && p.email) || '—'], ['الهاتف', p && p.phone ? <span className="ltr">{p.phone}</span> : '—'], ['آخر دخول', u.lastLogin ? fmtDateTime(u.lastLogin) : '—'], u.role === 'teacher' && p ? ['التخصص', p.specialization] : null, u.role === 'parent' ? ['الأبناء', Scope.students(u).map(s => s.fullName).join('، ')] : null, u.role === 'student' && p ? ['الفصل', nameOf.cls(p.classId)] : null]} />
      </div></Card>
      <Card title="تغيير كلمة المرور"><form className="stack" style={{ gap: 12, maxWidth: 420 }} noValidate onSubmit={changePw}>
        {pf('o', 'pw-old', 'كلمة المرور الحالية')}{pf('n', 'pw-new', 'كلمة المرور الجديدة')}{pf('n2', 'pw-new2', 'تأكيد كلمة المرور الجديدة')}
        <div className="hint small muted">8 أحرف على الأقل، وتحتوي حرفًا ورقمًا.</div>
        <div className="form-err" role="alert">{msg}</div>
        <div><button className="btn primary" type="submit">تغيير كلمة المرور</button></div>
      </form></Card>
      <Card title="المظهر والتنبيهات"><div className="stack" style={{ gap: 14 }}>
        <div className="row between"><span>المظهر</span><Seg options={[['light', 'فاتح'], ['dark', 'داكن'], ['system', 'حسب الجهاز']]} value={themePref()} onChange={setTheme} /></div>
        <label className="check"><input type="checkbox" id="pref-email" checked={prefs.digest !== false} onChange={e => { Repo.update('users', u.id, { prefs: { ...prefs, digest: e.target.checked } }, { audit: false }); toast.success('تم حفظ التفضيل'); }} />إظهار الإشعارات العادية (الإشعارات العاجلة تظهر دائمًا)</label>
        {isServer() && <div className="stack" style={{ gap: 6 }}>
          <div className="row between"><span className="small">نسخة العمل دون اتصال على هذا الجهاز: <b>{Vault.active ? 'مفعّلة ومشفّرة' : 'غير مفعّلة'}</b></span>{Vault.active && <button className="btn sm" onClick={wipe}>حذف من هذا الجهاز</button>}</div>
          <div className="muted small">{Vault.supported() ? 'تُفتح النسخة بكلمة مرورك فقط، ولا يمكن قراءتها بدونها.' : 'يتطلب اتصالًا آمنًا HTTPS أو localhost.'}</div>
        </div>}
        {notifOk ? <div className="row between"><span className="small">إشعارات المتصفح للتنبيهات العاجلة: <b>{{ granted: 'مفعّلة', denied: 'مرفوضة من المتصفح', default: 'غير مفعّلة' }[Notification.permission]}</b></span>{Notification.permission === 'default' && <button className="btn sm" onClick={async () => { try { await Notification.requestPermission(); } catch (e) { } tick(x => x + 1); }}>تفعيل</button>}</div>
          : <div className="small muted">إشعارات المتصفح متاحة عند فتح التطبيق مباشرة في المتصفح.</div>}
      </div></Card>
    </div>
  </>;
}

/* ---------- Settings ---------- */
function SettingsForm({ fields, onSave }) {
  const [vals, setVals] = useState(() => Object.fromEntries(fields.filter(f => !f.section).map(f => [f.name, f.value ?? ''])));
  const [err, setErr] = useState('');
  function submit(e) {
    e.preventDefault(); setErr(''); const v = {};
    for (const f of fields) {
      if (f.section) continue; let x = String(vals[f.name] ?? '').trim();
      if (f.type === 'number') { x = Number(x); if (isNaN(x) || (f.min != null && x < f.min) || (f.max != null && x > f.max)) { setErr(`قيمة «${f.label}» خارج الحدود المسموحة.`); document.getElementById('s-' + f.name)?.focus(); return; } }
      if (f.required && x === '') { setErr(`«${f.label}» مطلوب.`); document.getElementById('s-' + f.name)?.focus(); return; }
      v[f.name] = x;
    }
    const r = onSave(v); if (typeof r === 'string') { setErr(r); return; } toast.success('تم حفظ الإعدادات');
  }
  return <form className="form-grid" noValidate onSubmit={submit}>
    {fields.map((f, i) => f.section ? <div key={'s' + i} className="form-sec span2">{f.section}</div> :
      <div key={f.name} className={'field' + (f.span ? ' span2' : '')}><label htmlFor={'s-' + f.name}>{f.label}</label>
        <input className="input" id={'s-' + f.name} type={f.type || 'text'} min={f.min} max={f.max} dir={f.ltr ? 'ltr' : undefined} value={vals[f.name]} onChange={e => setVals({ ...vals, [f.name]: e.target.value })} />
        {f.hint && <div className="hint">{f.hint}</div>}</div>)}
    <div className="form-err">{err}</div>
    <div className="span2"><button className="btn primary" type="submit">حفظ التغييرات</button></div>
  </form>;
}
export function SettingsPage() {
  const S = Settings.get();
  return <>
    <PageHead title="الإعدادات" sub="إعدادات المدرسة وقواعد التقييم والتنبيهات والنسخ الاحتياطي" />
    <Tabs initial="school" items={[
      { key: 'school', label: 'المدرسة', render: () => <Card><SettingsForm fields={[
        { name: 'schoolName', label: 'اسم المدرسة', value: S.schoolName, required: true }, { name: 'schoolNameEn', label: 'الاسم بالإنجليزية', value: S.schoolNameEn, ltr: true },
        { name: 'principalName', label: 'اسم المدير (يظهر على الشهادات)', value: S.principalName, required: true }, { name: 'address', label: 'العنوان', value: S.address },
        { name: 'phone', label: 'الهاتف', value: S.phone, ltr: true }, { name: 'email', label: 'البريد الإلكتروني', value: S.email, ltr: true },
        { section: 'العام الدراسي' }, { name: 'academicYear', label: 'العام الدراسي', value: S.academicYear, required: true, ltr: true }, { name: 'termName', label: 'الفصل الدراسي الحالي', value: S.termName, required: true },
        { name: 'currency', label: 'العملة', value: S.currency, required: true }
      ]} onSave={v => { Settings.save(v); const y = activeYear(); if (y.id && y.name !== v.academicYear) Repo.update('academicYears', y.id, { name: v.academicYear }); }} /></Card> },
      { key: 'eval', label: 'التقييم والتنبيهات', render: () => <Card><SettingsForm fields={[
        { section: 'الأوزان الافتراضية لأنواع التقييم' }, ...Object.entries(S.weights).map(([k, v]) => ({ name: 'w_' + k, label: EXAM_LABEL[k], type: 'number', min: 0, max: 100, value: v })),
        { section: 'قواعد النجاح والتنبيهات الذكية' },
        { name: 'passPercent', label: 'نسبة النجاح الافتراضية %', type: 'number', min: 1, max: 99, value: S.passPercent },
        { name: 'attendanceAlert', label: 'عتبة تنبيه الغياب بلا عذر % (30 يومًا)', type: 'number', min: 1, max: 50, value: S.attendanceAlert },
        { name: 'gradeDrop', label: 'تنبيه انخفاض الدرجات (نقاط بين تقييمين)', type: 'number', min: 5, max: 50, value: S.gradeDrop },
        { name: 'teacherEditDays', label: 'أيام تعديل الحضور المسموحة للمدرس', type: 'number', min: 0, max: 14, value: S.teacherEditDays },
        { name: 'collectionTarget', label: 'المستهدف من تحصيل الرسوم %', type: 'number', min: 10, max: 100, value: S.collectionTarget },
        { name: 'sessionTimeoutMin', label: 'إنهاء الجلسة بعد خمول (دقيقة)', type: 'number', min: 5, max: 240, value: S.sessionTimeoutMin }
      ]} onSave={v => { const weights = {}; Object.keys(S.weights).forEach(k => { weights[k] = v['w_' + k]; delete v['w_' + k]; }); Settings.save({ ...v, weights }); }} /></Card> },
      { key: 'periods', label: 'أوقات الحصص', render: () => <Periods /> },
      { key: 'backup', label: 'النسخ الاحتياطي والبيانات', render: () => <BackupTab /> }
    ]} />
  </>;
}
function Periods() {
  useData(); const ps = periodsSorted();
  return <Card title="أوقات الحصص اليومية"><div className="stack">
    {ps.map(p => <div className="row" key={p.id}><b style={{ width: 70 }}>{'الحصة ' + fmtNum(p.order)}</b>
      <input type="time" className="input sm" defaultValue={p.startTime} aria-label={'بداية الحصة ' + p.order} onChange={e => e.target.value && Repo.update('periods', p.id, { startTime: e.target.value })} /><span>—</span>
      <input type="time" className="input sm" defaultValue={p.endTime} aria-label={'نهاية الحصة ' + p.order} onBlur={e => { if (e.target.value && e.target.value !== p.endTime) { Repo.update('periods', p.id, { endTime: e.target.value }); toast.success('تم الحفظ'); } }} /></div>)}
    <p className="muted small">{'أيام الدراسة: ' + Settings.get().schoolDays.map(d => DAYS[d]).join('، ') + '. تُحفظ التغييرات فورًا.'}</p>
  </div></Card>;
}

/* ---------- Backup / restore / reset ---------- */
function BackupTab() {
  const srv = isServer(); const fi = useRef(null);
  const onFile = () => { const f = fi.current.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => restoreFrom(String(r.result)); r.readAsText(f); fi.current.value = ''; };
  return <div className="grid g2">
    <Card title="تصدير نسخة احتياطية مشفّرة"><div className="stack">
      <p className="muted">{srv ? 'تُنشأ على الخادم نسخة كاملة مشفّرة AES-256 بكلمة سر تختارها الآن. احفظ الملف وكلمة السر في مكانين مختلفين؛ بدون كلمة السر لا يمكن فتح النسخة.' : 'في وضع العرض تُصدَّر البيانات الحالية كملف JSON.'}</p>
      <div><button className="btn primary" onClick={() => srv ? exportEncrypted() : exportText(`abd-al-salam-demo-${todayISO()}.json`, JSON.stringify(Repo.exportAll()), 'application/json')}><Icon name="download" size={16} />تصدير النسخة</button></div>
      {srv && <div className="muted small">إضافة لذلك يحفظ الخادم نسخة تلقائية مشفّرة كل 24 ساعة في مجلد data/backups (آخر 14 نسخة).</div>}
    </div></Card>
    <Card title="استعادة نسخة"><div className="stack"><p className="muted">{'تستبدل الاستعادة كل البيانات الحالية. ' + (srv ? 'يحتفظ الخادم بنسخة من الوضع الحالي قبل الاستبدال.' : '')}</p><input type="file" accept="application/json,.json" id="restore-file" className="input" ref={fi} onChange={onFile} /></div></Card>
    <Card title="البيانات التجريبية"><div className="stack"><p className="muted">إعادة إنشاء بيانات تجريبية جديدة (120 طالبًا، 6 فصول، 10 مدرسين، حضور ودرجات ورسوم). تُحذف كل البيانات الحالية ويُسجَّل خروج الجميع.</p><div><button className="btn danger" onClick={resetDemo}><Icon name="refresh" size={16} />إعادة ضبط البيانات التجريبية</button></div></div></Card>
    <Card title="عن النظام"><KV pairs={[['النظام', Settings.get().systemName], ['إصدار المخطط', SCHEMA_V], ['مكان الحفظ', srv ? 'خادم المدرسة: قاعدة SQLite مشفّرة AES-256-GCM لكل سجل، وكلمات المرور scrypt' : 'الذاكرة فقط (وضع العرض) — لا يُحفظ شيء'], ['على هذا الجهاز', srv ? (Vault.active ? 'نسخة مشفّرة للعمل دون اتصال (IndexedDB)' : 'لا شيء (العمل دون اتصال يتطلب HTTPS أو localhost)') : 'لا شيء'], ['السجلات المحمّلة', fmtNum(sum(ENTITIES.map(e => (Repo.raw(e) || []).length)))], ['البنية', 'واجهة React 18 (Vite) · خادم Node.js بدون حزم خارجية · SQLite مشفّرة']]} /></Card>
  </div>;
}
function exportEncrypted() {
  formModal({ title: 'تصدير نسخة مشفّرة', size: 'sm', submit: 'تصدير', fields: [{ name: 'p1', label: 'كلمة سر النسخة', type: 'password', required: true, ltr: true, validate: passwordRule }, { name: 'p2', label: 'تأكيد كلمة السر', type: 'password', required: true, ltr: true }],
    onSubmit: async v => {
      if (v.p1 !== v.p2) return 'كلمتا السر غير متطابقتين.';
      let r; try { r = await api('POST', 'api/backup', { passphrase: v.p1 }); } catch (e) { return 'لا يوجد اتصال بالخادم.'; }
      if (!r.ok) return r.error || 'تعذّر إنشاء النسخة';
      const { ok, status, ...file } = r; void ok; void status;
      exportText(`abd-al-salam-backup-${todayISO()}.json`, JSON.stringify(file), 'application/json');
    } });
}
async function restoreFrom(txt) {
  let json; try { json = JSON.parse(txt); } catch (e) { toast.error('الملف ليس JSON صالحًا'); return; }
  if (!isServer()) {
    if (!(await confirmDialog({ title: 'استعادة نسخة', message: 'ستُستبدل البيانات الحالية في الذاكرة بمحتوى الملف.', ok: 'استعادة', danger: true }))) return;
    try { Repo.importAll(json); toast.success('تمت الاستعادة'); } catch (e) { toast.error(e.message); } return;
  }
  if (json.format !== 'abd-al-salam-backup') { toast.error('هذا الملف ليس نسخة احتياطية مشفّرة من الخادم.'); return; }
  formModal({ title: 'استعادة نسخة احتياطية', size: 'sm', submit: 'استعادة', intro: <Banner tone="warn" ic="alert">{`ستُستبدل كل البيانات بنسخة ${fmtDateTime(json.createdAt)} ويُسجَّل خروج الجميع. يحتفظ الخادم بنسخة من الوضع الحالي.`}</Banner>,
    fields: [{ name: 'pass', label: 'كلمة سر النسخة', type: 'password', required: true, ltr: true }, { name: 'pw', label: 'كلمة مرورك (للتأكيد)', type: 'password', required: true, ltr: true }],
    onSubmit: async v => {
      let r; try { r = await api('POST', 'api/restore', { backup: json, passphrase: v.pass, password: v.pw }); } catch (e) { return 'لا يوجد اتصال بالخادم.'; }
      if (!r.ok) return r.error || 'تعذّرت الاستعادة';
      setTimeout(() => Auth.logout('تمت الاستعادة. سجّل الدخول من جديد.'), 50);
    } });
}
async function resetDemo() {
  if (!isServer()) {
    if (!(await confirmDialog({ title: 'إعادة ضبط البيانات', message: 'سيتم إنشاء بيانات تجريبية جديدة وتسجيل خروجك.', ok: 'إعادة الضبط', danger: true }))) return;
    await Auth.logout(); await seedDemo(); toast.info('أُعيد ضبط البيانات التجريبية.'); return;
  }
  formModal({ title: 'إعادة ضبط البيانات التجريبية', size: 'sm', submit: 'إعادة الضبط', intro: <Banner tone="bad" ic="alert">ستُحذف كل بيانات المدرسة على الخادم وتُستبدل ببيانات تجريبية. يحتفظ الخادم بنسخة من الوضع الحالي في data/backups. سيبقى اسم دخولك وكلمة مرورك كما هي.</Banner>,
    fields: [{ name: 'pw', label: 'كلمة مرورك (للتأكيد)', type: 'password', required: true, ltr: true }],
    onSubmit: async v => {
      const keep = { ...Settings.get() };
      await seedDemo(); const ds = { settings: { ...Settings.get(), schoolName: keep.schoolName, principalName: keep.principalName }, data: Object.fromEntries(ENTITIES.map(e => [e, Repo.raw(e)])) };
      let r; try { r = await api('POST', 'api/reset', { password: v.pw, dataset: ds }); } catch (e) { r = { ok: false, error: 'لا يوجد اتصال بالخادم.' }; }
      if (!r.ok) { await Sync.pull(true).catch(() => { }); return r.error || 'تعذّرت إعادة الضبط'; }
      setTimeout(() => Auth.logout('أُعيد ضبط البيانات التجريبية. سجّل الدخول من جديد.'), 50);
    } });
}
void Mode; void InsightsPanel; void go;
