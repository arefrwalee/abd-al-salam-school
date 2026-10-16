/* =====================================================================
   الصفحات الأكاديمية: لوحات التحكم، الطلاب، ملف الطالب، المدرسون، الفصول، المواد
   ===================================================================== */
import { useState } from 'react';
import {
  Repo, Settings, Store, Idx, Scope, isAdmin, byClass, Notify, Accounts, activeYear, activeStudents, attStats, financeTotals, recordedDates, classStudents,
  subjectResult, atRisk, insights, risk, studentResults, studentAtt, studentFinance, gradeSeries, classRanking, subjectRanking, predictSubject, assessmentsFor, gradeOf, hasScore,
  gradeLabel, gradeTone, passOf, teacherLoad, periodsSorted, nameOf, displayName, userOf, scheduleConflict,
  RISK_LABEL, STATUS_LABEL, STATUS_CLS, ACTION_LABEL, ENTITY_LABEL, RESULT_LABEL, ATT_LABEL, ATT_CLS, EXAM_LABEL, FEE_LABEL, PAY_STATUS, METHOD_LABEL, T_STATUS,
  fmtNum, fmtPct, fmtMoney, fmtDate, fmtDateShort, fmtDateTime, relTime, todayISO, addDays, dow, DAYS, avg, sum, groupBy, parseISO, iso, monthLabel, gradeName, pad2, GRADE_NAMES,
  Icon, Badge, Avatar, Person, PageHead, Card, Kpi, Empty, Progress, PctCell, Seg, Tabs, Banner, LineChart, BarChart, Donut, HBars, Spark, Gauge, AttCalendar, shortNum, cx,
  DataTable, openModal, ModalBody, ModalFoot, confirmDialog, formModal, credsModal, toast, go, useData
} from './common.js';
import { NotifRow } from '../components/Layout.jsx';
import { showCertificate, showProvisional } from './Evaluation.jsx';
import { showReceipt } from './Finance.jsx';

export const RiskBadge = ({ st }) => { const r = risk(st); const [l, c] = RISK_LABEL[r.level]; return <Badge tone={c}>{l}</Badge>; };
export const StatusBadge = ({ s }) => <Badge tone={STATUS_CLS[s] || ''}>{STATUS_LABEL[s] || s}</Badge>;
export const StudentLink = ({ s }) => <Person name={s.fullName} sub={nameOf.cls(s.classId) + ' · ' + s.studentNo} href={'#student-' + s.id} />;
const genderLabel = g => g === 'female' ? 'أنثى' : 'ذكر';
const greeting = () => new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
const lastDays = n => recordedDates().slice(-n);
const Sw = ({ c, s = 9 }) => <i style={{ width: s, height: s, borderRadius: 3, background: c, display: 'inline-block', flex: 'none' }} />;

export function InsightsPanel({ user, limit = 6 }) {
  const list = insights(user).slice(0, limit);
  return <Card title="رؤى ذكية" sub="من بياناتك الفعلية" actions={<button className="btn ghost sm" onClick={() => go('assistant')}><Icon name="sparkles" size={15} />اسأل المساعد</button>}>
    {list.length ? <div>{list.map((i, k) => <div key={k} className={'insight ' + i.sev}><div className="ic"><Icon name={i.ic} size={17} /></div><div style={{ flex: 1, minWidth: 0 }}><b>{i.title}</b><p>{i.text}</p></div>{i.link && <button className="btn ghost xs" onClick={() => go(i.link)}>عرض</button>}</div>)}</div> : <Empty text="لا توجد ملاحظات تستدعي الانتباه حاليًا." ic="ok" />}
  </Card>;
}
export function RiskList({ list, limit = 8 }) {
  if (!list.length) return <Empty text="لا يوجد طلاب بمؤشر خطر حاليًا." ic="ok" />;
  return <div className="list">{list.slice(0, limit).map(({ st, r }) => <div className="li" key={st.id}><Avatar name={st.fullName} /><div className="bd"><a href={'#student-' + st.id}><b>{st.fullName}</b></a><span>{nameOf.cls(st.classId) + ' · ' + (r.factors[0] ? r.factors[0].text : '')}</span></div><span className={'badge ' + RISK_LABEL[r.level][1]} title="درجة الخطر">{fmtNum(r.score)}</span></div>)}</div>;
}
export function RiskCard({ st }) {
  const r = risk(st); const [l, c] = RISK_LABEL[r.level];
  return <div className="stack" style={{ gap: 12 }}>
    <div className="risk"><Gauge score={r.score} tone={c} /><div className="stack" style={{ gap: 6, flex: 1, minWidth: 200 }}><div className="row"><Badge tone={c}>{l}</Badge><span className="muted small">درجة من 100 تجمع: الغياب 35% · التحصيل 30% · اتجاه الدرجات 20% · المواد الراسبة 10% · التأخر 5%</span></div>
      {r.factors.length ? <ul className="factors">{r.factors.map((f, i) => <li key={i}>{f.text}</li>)}</ul> : <div className="muted">لا عوامل خطر ملحوظة.</div>}</div></div>
    <div className="rec"><b>التوصية: </b>{r.rec}</div>
  </div>;
}

/* ---------- Dashboard ---------- */
export function Dashboard({ user }) {
  if (user.role === 'admin') return <DashAdmin u={user} />;
  if (user.role === 'teacher') return <DashTeacher u={user} />;
  return <DashFamily u={user} />;
}
function DashAdmin({ u }) {
  const T = todayISO(); const S = Settings.get();
  const sts = activeStudents(); const todayRecs = Idx().attByDate.get(T) || [];
  const at = attStats(todayRecs); const ft = financeTotals();
  const recordedCls = new Set(todayRecs.map(r => r.classId)); const classes = Repo.all('classes').sort(byClass);
  const days = lastDays(20); const dayRates = days.map(d => attStats(Idx().attByDate.get(d) || []).rate);
  const prevRate = avg(dayRates.slice(-10, -1).filter(v => v != null));
  const missing = classes.filter(c => !recordedCls.has(c.id));
  const perClass = classes.map(c => ({ c, n: classStudents(c.id).length }));
  const subjAvg = Repo.all('subjects').map(s => ({ label: s.name, value: avg(sts.map(st => subjectResult(st, s.id).percent).filter(v => v != null)), color: s.color }));
  const months = []; { const m = parseISO(T); m.setDate(1); for (let i = 0; i < 4; i++) { months.unshift(iso(m).slice(0, 7)); m.setMonth(m.getMonth() - 1); } }
  const rev = months.map(k => sum(Repo.all('payments').filter(p => p.paidAt.slice(0, 7) === k).map(p => p.amount)));
  const exp = months.map(k => sum(Repo.all('expenses').filter(e => e.date.slice(0, 7) === k).map(e => e.amount)));
  const risky = atRisk(sts, 'medium');
  const recent = Repo.all('auditLog').slice(-7).reverse();
  const gradeGroups = [...groupBy(sts, s => s.gradeLevel).entries()].sort((a, b) => a[0] - b[0]);
  return <>
    <PageHead title={`${greeting()}، ${displayName(u)}`} sub={`${DAYS[dow(T)]} ${fmtDate(T)} · ${S.termName} · العام الدراسي ${S.academicYear}`}>
      <button className="btn" onClick={() => go('reports')}><Icon name="chart" size={16} />التقارير</button>
      <button className="btn primary" onClick={() => go('attendance')}><Icon name="check" size={16} />الحضور اليوم</button>
    </PageHead>
    <div className="kpis">
      <Kpi label="إجمالي الطلاب" value={fmtNum(sts.length)} sub={`${fmtNum(sts.filter(s => s.gender === 'male').length)} ذكور · ${fmtNum(sts.filter(s => s.gender === 'female').length)} إناث`} ic="users" />
      <Kpi label="المدرسون" value={fmtNum(Repo.where('teachers', t => t.status === 'active').length)} sub={`${fmtNum(Repo.all('teachers').length)} في الكادر`} ic="briefcase" />
      <Kpi label="الفصول" value={fmtNum(classes.length)} sub={`${fmtNum(Repo.all('subjects').length)} مادة دراسية`} ic="layers" />
      <Kpi label="المواد" value={fmtNum(Repo.all('subjects').length)} sub={`${fmtNum(Repo.all('schedules').length)} حصة أسبوعيًا`} ic="book" />
      <Kpi label="الحضور اليوم" value={at.total ? fmtPct(at.rate, 1) : '—'} tone={at.rate == null ? '' : at.rate >= 92 ? 'ok' : at.rate >= 85 ? 'warn' : 'bad'} ic="check"
        sub={at.total ? <>{prevRate != null && <span className={at.rate >= prevRate ? 'trend-up' : 'trend-down'}>{(at.rate >= prevRate ? '▲ ' : '▼ ') + fmtNum(Math.abs(at.rate - prevRate), 1)}</span>}{` مقابل متوسط آخر أسبوعين · ${fmtNum(recordedCls.size)}/${fmtNum(classes.length)} فصول سُجّلت`}</> : 'لم يُسجَّل بعد'} extra={<Spark values={dayRates} color="var(--c2)" />} />
      <Kpi label="الغياب اليوم" value={fmtNum(at.absent)} tone={at.absent ? 'bad' : 'ok'} ic="user" sub={`${fmtNum(at.late)} متأخر · ${fmtNum(at.excused)} بعذر`} />
      <Kpi label="الرسوم المدفوعة" value={shortNum(ft.paid)} tone="ok" ic="wallet" sub={`${fmtPct(ft.rate, 1)} من المستحق (${fmtMoney(ft.net)})`} extra={<Progress p={ft.rate} tone={ft.rate >= S.collectionTarget ? 'ok' : 'warn'} />} />
      <Kpi label="الرسوم المتبقية" value={shortNum(ft.remaining)} tone={ft.overdue ? 'bad' : 'warn'} ic="receipt" sub={`منها ${fmtMoney(ft.overdue)} متأخرة لدى ${fmtNum(ft.overdueStudents)} طالبًا`} />
    </div>
    {S.schoolDays.includes(dow(T)) && missing.length > 0 && <Banner tone="warn" ic="clock">{`لم يُسجَّل حضور اليوم بعد في: ${missing.map(c => c.name).join('، ')}. `}<a href="#attendance">افتح صفحة الحضور</a></Banner>}
    <div className="grid g-main">
      <Card title="الحضور اليومي" sub="آخر 20 يومًا دراسيًا"><LineChart labels={days.map(fmtDateShort)} series={[{ name: 'نسبة الحضور', values: dayRates, color: 'var(--c2)' }]} min={70} max={100} fmt={v => fmtNum(v) + '%'} tip={v => fmtPct(v, 1)} /></Card>
      <InsightsPanel user={u} limit={5} />
    </div>
    <div className="grid g3">
      <Card title="الطلاب في كل فصل" sub="من السعة"><HBars rows={perClass.map(x => ({ label: x.c.name, value: x.n, color: x.n >= (x.c.capacity || 99) ? 'var(--c3)' : 'var(--c1)' }))} max={Math.max(1, ...perClass.map(x => x.c.capacity || x.n))} fmt={v => fmtNum(v)} /></Card>
      <Card title="الطلاب حسب الصف"><Donut items={gradeGroups.map(([g, l], i) => ({ label: gradeName(g), value: l.length, color: ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'][i % 5] }))} center={fmtNum(sts.length)} sub="طالبًا" /></Card>
      <Card title="الطلاب حسب الجنس"><Donut items={[{ label: 'ذكور', value: sts.filter(s => s.gender === 'male').length, color: 'var(--c1)' }, { label: 'إناث', value: sts.filter(s => s.gender === 'female').length, color: 'var(--c3)' }]} center={fmtNum(sts.length)} sub="طالبًا" /></Card>
    </div>
    <div className="grid g2">
      <Card title="متوسط الدرجات حسب المادة" sub="كل الفصول"><HBars rows={subjAvg.sort((a, b) => (b.value || 0) - (a.value || 0))} max={100} /></Card>
      <Card title="الإيرادات والمصروفات" sub="آخر 4 أشهر"><BarChart labels={months.map(k => monthLabel(k).split(' ')[0])} series={[{ name: 'الإيرادات (مدفوعات)', values: rev, color: 'var(--c2)' }, { name: 'المصروفات', values: exp, color: 'var(--c3)' }]} tip={v => fmtMoney(v)} /></Card>
    </div>
    <div className="grid g2">
      <Card title="طلاب يحتاجون متابعة" sub={`${fmtNum(risky.length)} طالبًا`} actions={<button className="btn ghost sm" onClick={() => { Store.ss.set('ass:stFilterRisk', '1'); go('students'); }}>عرض الكل</button>}><RiskList list={risky} limit={7} /></Card>
      <Card title="آخر النشاطات" actions={<button className="btn ghost sm" onClick={() => go('audit')}>سجل النشاط</button>}>
        {recent.length ? <div className="list">{recent.map(a => <div className="li" key={a.id}><span className="kpi-ic"><Icon name={a.action === 'login' ? 'key' : a.action === 'delete' ? 'trash' : a.action === 'create' ? 'plus' : 'edit'} size={15} /></span><div className="bd"><b>{`${ACTION_LABEL[a.action] || a.action} · ${ENTITY_LABEL[a.entity] || a.entity}`}</b><span>{nameOf.user(a.userId) + ' · ' + relTime(a.at)}</span></div></div>)}</div> : <Empty text="لا يوجد نشاط مسجّل بعد" />}
      </Card>
    </div>
  </>;
}
export function todayLessons(rows) {
  const now = new Date(); const hm = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  return rows.sort((a, b) => (Repo.get('periods', a.periodId) || {}).order - (Repo.get('periods', b.periodId) || {}).order).map(s => {
    const p = Repo.get('periods', s.periodId) || {}; const subj = Repo.get('subjects', s.subjectId) || {};
    return { s, p, subj, live: hm >= p.startTime && hm <= p.endTime };
  });
}
function DashTeacher({ u }) {
  const T = todayISO(); const t = Repo.get('teachers', u.linkedId) || {};
  const myCls = Scope.classes(u); const sts = Scope.students(u).filter(s => s.status === 'active');
  const lessons = todayLessons(Repo.where('schedules', s => s.teacherId === u.linkedId && s.dayOfWeek === dow(T)));
  const recorded = new Set((Idx().attByDate.get(T) || []).map(r => r.classId));
  const asg = Scope.assignments(u);
  const pending = Repo.all('assessments').filter(a => asg.some(x => x.classId === a.classId && x.subjectId === a.subjectId)).filter(a => { const n = (Idx().gradesByAssess.get(a.id) || []).filter(hasScore).length; return n < classStudents(a.classId).length || !a.isPublished; });
  const risky = atRisk(sts, 'medium');
  const clsAvg = asg.map(a => ({ label: nameOf.subj(a.subjectId) + ' — ' + nameOf.cls(a.classId), value: avg(classStudents(a.classId).map(s => subjectResult(s, a.subjectId).percent).filter(v => v != null)) })).filter(r => r.value != null).sort((a, b) => b.value - a.value);
  return <>
    <PageHead title={`${greeting()}، ${t.fullName || displayName(u)}`} sub={`${DAYS[dow(T)]} ${fmtDate(T)} · ${t.specialization || ''}`}>
      <button className="btn" onClick={() => go('grades')}><Icon name="pen" size={16} />إدخال الدرجات</button>
      <button className="btn primary" onClick={() => go('attendance')}><Icon name="check" size={16} />تسجيل الحضور</button>
    </PageHead>
    <div className="kpis">
      <Kpi label="حصص اليوم" value={fmtNum(lessons.length)} ic="calendar" sub={`${fmtNum(teacherLoad(u.linkedId))} حصة أسبوعيًا`} />
      <Kpi label="طلابي" value={fmtNum(sts.length)} ic="users" sub={`في ${fmtNum(myCls.length)} فصول`} />
      <Kpi label="تقييمات تنتظر إجراء" value={fmtNum(pending.length)} tone={pending.length ? 'warn' : 'ok'} ic="pen" sub="درجات ناقصة أو غير منشورة" />
      <Kpi label="يحتاجون متابعة" value={fmtNum(risky.length)} tone={risky.some(x => x.r.level === 'high') ? 'bad' : risky.length ? 'warn' : 'ok'} ic="alert" sub={`${fmtNum(risky.filter(x => x.r.level === 'high').length)} في خطر مرتفع`} />
    </div>
    <div className="grid g-main">
      <Card title="حصصي اليوم">{lessons.length ? <div>{lessons.map(({ s, p, subj, live }) => <div className="lesson" key={s.id}><div className="p"><b>{fmtNum(p.order)}</b><span>{p.startTime}</span></div><span className="dot" style={{ background: subj.color }} /><div className="bd"><b>{subj.name + ' — ' + nameOf.cls(s.classId)}</b><span>{`${p.startTime} – ${p.endTime}` + (live ? ' · الآن' : '')}</span></div>{recorded.has(s.classId) ? <Badge tone="ok">سُجّل الحضور</Badge> : <button className="btn soft sm" onClick={() => { Store.ss.set('ass:attClass', s.classId); go('attendance'); }}>سجّل الحضور</button>}</div>)}</div> : <Empty text={Settings.get().schoolDays.includes(dow(T)) ? 'لا حصص لك اليوم.' : 'اليوم عطلة.'} ic="calendar" />}</Card>
      <InsightsPanel user={u} limit={5} />
    </div>
    <div className="grid g2">
      <Card title="تقييمات تنتظر إجراء">{pending.length ? <div className="list">{pending.slice(0, 8).map(a => { const n = (Idx().gradesByAssess.get(a.id) || []).filter(hasScore).length; return <div className="li" key={a.id}><div className="bd"><b>{a.name}</b><span>{`${nameOf.subj(a.subjectId)} · ${nameOf.cls(a.classId)} · ${fmtDate(a.date)}`}</span></div><Badge tone={n ? 'warn' : 'bad'} plain>{`${fmtNum(n)}/${fmtNum(classStudents(a.classId).length)}`}</Badge>{!a.isPublished && <Badge plain>غير منشور</Badge>}<button className="btn ghost xs" onClick={() => { Store.ss.set('ass:gradeSel', a.classId + '|' + a.subjectId); go('grades'); }}>فتح</button></div>; })}</div> : <Empty text="كل التقييمات مكتملة ومنشورة." ic="ok" />}</Card>
      <Card title="طلاب يحتاجون متابعة"><RiskList list={risky} limit={7} /></Card>
    </div>
    <Card title="متوسطات فصولي">{clsAvg.length ? <HBars rows={clsAvg} max={100} /> : <Empty text="لا درجات بعد." />}</Card>
  </>;
}
export function ChildPicker({ user, cur, onPick }) {
  const kids = Scope.students(user); if (kids.length <= 1) return null;
  return <Seg options={kids.map(k => [k.id, k.fullName.split(' ')[0]])} value={cur} onChange={onPick} />;
}
function DashFamily({ u }) {
  const kids = Scope.students(u); const T = todayISO();
  const notes = Notify.mine(u).slice(0, 5);
  return <>
    <PageHead title={`${greeting()}، ${displayName(u)}`} sub={u.role === 'parent' ? `متابعة ${kids.length > 1 ? 'أبنائك' : 'ابنك'} في ${Settings.get().schoolName}` : `${nameOf.cls(kids[0] && kids[0].classId)} · ${DAYS[dow(T)]} ${fmtDate(T)}`} />
    {!kids.length ? <Empty text="لا يوجد طالب مرتبط بهذا الحساب. تواصل مع إدارة المدرسة." /> : kids.map(st => {
      const res = studentResults(st); const a30 = studentAtt(st.id, addDays(T, -29), T); const fin = studentFinance(st.id); const r = risk(st);
      const series = gradeSeries(st).map(x => x.p); const rank = classRanking(st.classId).get(st.id);
      const lessons = todayLessons(Repo.where('schedules', s => s.classId === st.classId && s.dayOfWeek === dow(T)));
      const recentGrades = assessmentsFor(st.classId, null, { publishedOnly: true }).map(a => ({ a, g: gradeOf(a.id, st.id) })).filter(x => hasScore(x.g)).slice(-6).reverse();
      return <section className="stack" style={{ gap: 14 }} key={st.id}>
        {u.role === 'parent' && <div className="row between"><Person name={st.fullName} sub={nameOf.cls(st.classId) + ' · ' + st.studentNo} /><div className="row"><Badge tone={RISK_LABEL[r.level][1]}>{RISK_LABEL[r.level][0]}</Badge><button className="btn sm" onClick={() => go('student', st.id)}>الملف الكامل</button></div></div>}
        <div className="kpis">
          <Kpi label="المعدل الحالي" value={fmtPct(res.avg, 1)} ic="award" tone={gradeTone(res.avg)} sub={gradeLabel(res.avg) + (rank ? ` · الترتيب ${fmtNum(rank)} من ${fmtNum(classStudents(st.classId).length)}` : '')} extra={<Spark values={series} />} />
          <Kpi label="الحضور (30 يومًا)" value={fmtPct(a30.rate, 1)} ic="check" tone={a30.rate >= 92 ? 'ok' : a30.rate >= 85 ? 'warn' : 'bad'} sub={`${fmtNum(a30.absent)} غياب · ${fmtNum(a30.late)} تأخر · ${fmtNum(a30.excused)} بعذر`} />
          <Kpi label="المواد" value={fmtNum(res.rows.length)} ic="book" tone={res.failing ? 'bad' : 'ok'} sub={res.failing ? `${fmtNum(res.failing)} تحت خط النجاح` : 'كلها فوق خط النجاح'} />
          <Kpi label="الرسوم المتبقية" value={fmtMoney(fin.remaining)} ic="wallet" tone={fin.overdue ? 'bad' : fin.remaining ? 'warn' : 'ok'} sub={fin.overdue ? `منها ${fmtMoney(fin.overdue)} متأخرة` : fin.remaining ? 'لا متأخرات' : 'مسددة بالكامل'} />
        </div>
        <div className="grid g2">
          <Card title="حصص اليوم">{lessons.length ? <div>{lessons.map(({ p, subj, s, live }) => <div className="lesson" key={s.id}><div className="p"><b>{fmtNum(p.order)}</b><span>{p.startTime}</span></div><span className="dot" style={{ background: subj.color }} /><div className="bd"><b>{subj.name}</b><span>{nameOf.tch(s.teacherId) + (live ? ' · الآن' : '')}</span></div></div>)}</div> : <Empty text={Settings.get().schoolDays.includes(dow(T)) ? 'لا حصص اليوم.' : 'اليوم عطلة.'} ic="calendar" />}</Card>
          <Card title="آخر الدرجات" actions={<button className="btn ghost sm" onClick={() => go('grades')}>كل الدرجات</button>}>{recentGrades.length ? <div className="list">{recentGrades.map(({ a, g }) => { const p = g.score / a.maxScore * 100; return <div className="li" key={a.id}><Sw c={(Repo.get('subjects', a.subjectId) || {}).color} s={10} /><div className="bd"><b>{nameOf.subj(a.subjectId) + ' — ' + a.name}</b><span>{fmtDate(a.date)}</span></div><b className="tabnum">{`${fmtNum(g.score, g.score % 1 ? 1 : 0)}/${fmtNum(a.maxScore)}`}</b><Badge tone={gradeTone(p)} plain>{fmtPct(p)}</Badge></div>; })}</div> : <Empty text="لا درجات منشورة بعد." />}</Card>
        </div>
        {u.role === 'parent' && r.level !== 'low' && <Card title="مؤشر المتابعة"><RiskCard st={st} /></Card>}
      </section>;
    })}
    <Card title="آخر الإشعارات" flush actions={<button className="btn ghost sm" onClick={() => go('notifications')}>الكل</button>}>{notes.length ? <div>{notes.map(n => <NotifRow key={n.id} n={n} />)}</div> : <Empty text="لا إشعارات" ic="bell" />}</Card>
  </>;
}

/* ---------- Students ---------- */
export function Students({ user: u }) {
  const admin = isAdmin(u);
  const [riskPre] = useState(() => { const v = Store.ss.get('ass:stFilterRisk'); Store.ss.del('ass:stFilterRisk'); return v; });
  const classes = Scope.classes(u); const T = todayISO();
  const all = Scope.students(u); const sts = all.filter(s => s.status === 'active');
  return <>
    <PageHead title={u.role === 'teacher' ? 'طلابي' : 'الطلاب'} sub={u.role === 'teacher' ? 'طلاب الفصول المسندة إليك (عرض فقط)' : `${fmtNum(sts.length)} طالبًا نشطًا في ${fmtNum(classes.length)} فصول`}>
      {admin && <button className="btn primary" onClick={() => studentForm()}><Icon name="plus" size={16} />إضافة طالب</button>}
    </PageHead>
    <Card><DataTable id="students" unit="طالب" exportName="students" searchPh="ابحث بالاسم أو الرقم أو ولي الأمر..." rows={all}
      searchText={s => s.fullName + ' ' + s.studentNo + ' ' + ((Repo.get('parents', s.parentId) || {}).fullName || '') + ' ' + (s.phone || '')}
      filters={[
        { label: 'كل الفصول', options: classes.map(c => [c.id, c.name]), test: (s, v) => s.classId === v },
        { label: 'كل الحالات', options: Object.entries(STATUS_LABEL), test: (s, v) => s.status === v, value: 'active' },
        { label: 'الجنس', options: [['male', 'ذكور'], ['female', 'إناث']], test: (s, v) => s.gender === v },
        { label: 'مؤشر المتابعة', options: [['high', 'خطر مرتفع'], ['medium', 'يحتاج متابعة'], ['risk', 'مرتفع أو متابعة'], ['low', 'مستقر']], test: (s, v) => v === 'risk' ? risk(s).level !== 'low' : risk(s).level === v, value: riskPre ? 'risk' : '' }
      ]}
      columns={[
        { label: 'الطالب', render: s => <StudentLink s={s} />, sort: s => s.fullName, csv: s => s.fullName },
        { label: 'الرقم', key: 'studentNo', cls: 'tabnum', render: s => <span className="ltr muted">{s.studentNo}</span> },
        { label: 'الفصل', sort: s => nameOf.cls(s.classId), render: s => nameOf.cls(s.classId) },
        { label: 'ولي الأمر', sort: s => (Repo.get('parents', s.parentId) || {}).fullName || '', render: s => { const p = Repo.get('parents', s.parentId); return p ? <div><div>{p.fullName}</div><div className="muted small ltr">{p.phone}</div></div> : '—'; } },
        { label: 'الحضور (30 يومًا)', sort: s => studentAtt(s.id, addDays(T, -29), T).rate, render: s => <PctCell p={studentAtt(s.id, addDays(T, -29), T).rate} />, csv: s => fmtNum(studentAtt(s.id, addDays(T, -29), T).rate, 1) },
        { label: 'المعدل', desc: true, sort: s => studentResults(s).avg, render: s => { const a = studentResults(s).avg; return a == null ? '—' : <span className="tabnum">{fmtPct(a, 1)}</span>; }, csv: s => fmtNum(studentResults(s).avg, 1) },
        { label: 'المتابعة', desc: true, sort: s => risk(s).score, render: s => <RiskBadge st={s} />, csv: s => RISK_LABEL[risk(s).level][0] },
        { label: 'الحالة', sort: s => s.status, render: s => <StatusBadge s={s.status} />, csv: s => STATUS_LABEL[s.status] },
        { label: '', sortable: false, cls: 'acts', csv: false, render: s => <div className="row" style={{ justifyContent: 'flex-end', gap: 2 }}>
          <button className="icon-btn sm" title="عرض الملف" aria-label="عرض الملف" onClick={() => go('student', s.id)}><Icon name="eye" size={16} /></button>
          {admin && <button className="icon-btn sm" title="تعديل" aria-label="تعديل" onClick={() => studentForm(s)}><Icon name="edit" size={16} /></button>}
          {admin && <button className="icon-btn sm danger" title="حذف" aria-label="حذف" onClick={() => deleteStudent(s)}><Icon name="trash" size={16} /></button>}
        </div> }
      ]}
      onRow={s => go('student', s.id)} /></Card>
  </>;
}
export function studentForm(st) {
  const classes = Repo.all('classes').sort(byClass);
  const parents = Repo.all('parents').sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
  formModal({
    title: st ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد', size: 'lg', submit: st ? 'حفظ التعديلات' : 'إضافة الطالب',
    values: st ? { ...st } : { status: 'active', registrationDate: todayISO(), gender: 'male' },
    fields: [
      { section: 'البيانات الشخصية' },
      { name: 'fullName', label: 'الاسم الكامل (الاسم، الأب، العائلة)', required: true, span: true, placeholder: 'مثال: أحمد محمد العلي', validate: v => v.split(/\s+/).length < 2 ? 'اكتب الاسم الثلاثي على الأقل باسمين' : null },
      { name: 'fatherName', label: 'اسم الأب', required: true }, { name: 'motherName', label: 'اسم الأم' },
      { name: 'birthDate', label: 'تاريخ الميلاد', type: 'date', required: true, validate: v => v >= todayISO() ? 'تاريخ الميلاد يجب أن يكون في الماضي' : null },
      { name: 'gender', label: 'الجنس', type: 'select', required: true, options: [['male', 'ذكر'], ['female', 'أنثى']] },
      { name: 'phone', label: 'رقم الهاتف', type: 'tel', ltr: true }, { name: 'email', label: 'البريد الإلكتروني', type: 'email', ltr: true },
      { name: 'address', label: 'العنوان', span: true },
      { section: 'التسجيل الأكاديمي' },
      { name: 'classId', label: 'الفصل', type: 'select', required: true, placeholder: 'اختر الفصل', options: classes.map(c => [c.id, `${c.name} (${fmtNum(classStudents(c.id).length)}/${fmtNum(c.capacity)})`]) },
      { name: 'status', label: 'الحالة', type: 'select', required: true, options: Object.entries(STATUS_LABEL) },
      { name: 'registrationDate', label: 'تاريخ التسجيل', type: 'date', required: true },
      { name: 'notes', label: 'ملاحظات', type: 'textarea', rows: 2 },
      { section: 'ولي الأمر' },
      { name: 'parentId', label: 'ولي أمر مسجّل', type: 'select', span: true, placeholder: '— ولي أمر جديد (أدخل بياناته أدناه) —', options: parents.map(x => [x.id, `${x.fullName} · ${x.phone}`]) },
      { name: 'parentName', label: 'اسم ولي الأمر الجديد', hint: 'يُترك فارغًا عند اختيار ولي أمر مسجّل' },
      { name: 'parentPhone', label: 'هاتف ولي الأمر الجديد', type: 'tel', ltr: true }
    ],
    onSubmit: async v => {
      const cls = Repo.get('classes', v.classId);
      const moving = !st || st.classId !== v.classId;
      if (moving && v.status === 'active' && classStudents(cls.id).length >= cls.capacity) return `الفصل ${cls.name} ممتلئ (السعة ${fmtNum(cls.capacity)}). اختر فصلًا آخر أو عدّل السعة من صفحة الفصول.`;
      let parentId = v.parentId; let newParent = null;
      if (!parentId) {
        if (!v.parentName) return 'اختر ولي أمر مسجّلًا أو أدخل اسم ولي الأمر الجديد.';
        if (!v.parentPhone) return 'أدخل رقم هاتف ولي الأمر الجديد.';
        newParent = Repo.create('parents', { fullName: v.parentName, phone: v.parentPhone, phone2: '', email: '', relation: 'father', address: v.address || '', studentIds: [] });
        parentId = newParent.id;
      }
      const data = { fullName: v.fullName, fatherName: v.fatherName, motherName: v.motherName, birthDate: v.birthDate, gender: v.gender, phone: v.phone, email: v.email, address: v.address, classId: v.classId, gradeLevel: cls.gradeLevel, parentId, status: v.status, registrationDate: v.registrationDate, notes: v.notes };
      const creds = [];
      if (st) {
        if (st.parentId !== parentId) { const op = Repo.get('parents', st.parentId); if (op) Repo.update('parents', op.id, { studentIds: op.studentIds.filter(x => x !== st.id) }, { audit: false }); }
        Repo.update('students', st.id, data);
        const np = Repo.get('parents', parentId); if (np && !np.studentIds.includes(st.id)) Repo.update('parents', np.id, { studentIds: [...np.studentIds, st.id] }, { audit: false });
        toast.success('تم حفظ بيانات الطالب ' + v.fullName);
      } else {
        const yr = Settings.get().academicYear.slice(0, 4);
        const seq = Repo.raw('students').filter(x => (x.studentNo || '').startsWith(`STU-${yr}-`)).length + 1;
        const s = Repo.create('students', { ...data, studentNo: `STU-${yr}-${String(seq).padStart(4, '0')}`, photo: '' });
        const np = Repo.get('parents', parentId); Repo.update('parents', np.id, { studentIds: [...(np.studentIds || []), s.id] }, { audit: false });
        try { const a = await Accounts.create('student', s.id, v.email); creds.push(['الطالب', a.username, a.password]); } catch (e) { toast.error(e.message); }
        if (newParent) { try { const a = await Accounts.create('parent', newParent.id, ''); creds.push(['ولي الأمر', a.username, a.password]); } catch (e) { toast.error(e.message); } }
        const T = todayISO(); const year = activeYear();
        [['registration', 50000, T], ['books', 60000, addDays(T, 14)], ['tuition', 250000, addDays(T, 30)], ['tuition', 250000, addDays(T, 90)]].forEach(([feeType, amount, dueDate], i) => Repo.create('fees', { studentId: s.id, academicYearId: year.id, feeType, amount, discount: 0, dueDate, status: 'unpaid', label: feeType === 'tuition' ? (i === 2 ? 'القسط الأول' : 'القسط الثاني') : '' }, { audit: false }));
        toast.success('تمت إضافة الطالب ' + v.fullName);
        if (creds.length) setTimeout(() => credsModal('حسابات الدخول الجديدة', creds), 200);
      }
    }
  });
}
async function deleteStudent(s) {
  const hasMoney = (Idx().payByStudent.get(s.id) || []).length; const hasGrades = Repo.all('grades').some(g => g.studentId === s.id && hasScore(g));
  if (hasMoney || hasGrades) {
    const ok = await confirmDialog({ title: 'لا يمكن حذف الطالب', message: `لدى ${s.fullName} ${hasMoney ? 'مدفوعات' : ''}${hasMoney && hasGrades ? ' و' : ''}${hasGrades ? 'درجات' : ''} مسجّلة، والحذف سيُفقد السجل المالي والأكاديمي. يمكنك بدلًا من ذلك تغيير حالته إلى «منقول». هل تريد ذلك؟`, ok: 'تغيير الحالة إلى منقول' });
    if (ok) { Repo.update('students', s.id, { status: 'transferred' }); toast.success('تم تغيير حالة الطالب إلى منقول'); }
    return;
  }
  if (!(await confirmDialog({ title: 'حذف طالب', message: `هل أنت متأكد من حذف الطالب ${s.fullName}؟`, ok: 'حذف', danger: true }))) return;
  Repo.remove('students', s.id);
  toast.success('تم حذف الطالب', { undo: () => Repo.restore('students', s.id) });
}

/* ---------- Student details ---------- */
export function StudentPage({ user: u, param: id }) {
  const st = Repo.get('students', id);
  if (!st || !Scope.canStudent(u, id)) return <div className="forbidden"><div className="code">403</div><h2>لا تملك صلاحية الوصول إلى هذا الملف</h2><button className="btn primary" onClick={() => go('dashboard')}>العودة إلى الرئيسية</button></div>;
  const T = todayISO(); const par = Repo.get('parents', st.parentId); const cls = Repo.get('classes', st.classId);
  const res = studentResults(st); const a30 = studentAtt(st.id, addDays(T, -29), T); const aAll = studentAtt(st.id); const fin = studentFinance(st.id);
  const rank = classRanking(st.classId).get(st.id); const showFin = u.role !== 'teacher';
  return <>
    <div className="row between"><button className="btn ghost sm" onClick={() => history.length > 1 ? history.back() : go(u.role === 'admin' || u.role === 'teacher' ? 'students' : 'dashboard')}><Icon name="back" size={16} />رجوع</button>{isAdmin(u) && <button className="btn" onClick={() => studentForm(st)}><Icon name="edit" size={16} />تعديل البيانات</button>}</div>
    <Card><div className="row" style={{ gap: 18, alignItems: 'flex-start' }}><Avatar name={st.fullName} lg /><div className="stack" style={{ gap: 8, flex: 1, minWidth: 240 }}>
      <div className="row"><h1 style={{ font: '600 23px var(--f-display)' }}>{st.fullName}</h1><StatusBadge s={st.status} /><RiskBadge st={st} /></div>
      <div className="row muted small" style={{ gap: 16 }}><span>{cls ? cls.name : '—'}</span><span className="ltr">{st.studentNo}</span><span>{genderLabel(st.gender)}</span><span>{'مواليد ' + fmtDate(st.birthDate)}</span><span>{'مسجّل منذ ' + fmtDate(st.registrationDate)}</span></div>
      <div className="row small" style={{ gap: 16 }}><span><span className="muted">ولي الأمر: </span>{par ? par.fullName : '—'}</span>{par && <span className="ltr">{par.phone}</span>}<span><span className="muted">المربي: </span>{cls ? nameOf.tch(cls.homeroomTeacherId) : '—'}</span></div>
    </div></div></Card>
    <div className="kpis">
      <Kpi label="المعدل الحالي" value={fmtPct(res.avg, 1)} ic="award" tone={gradeTone(res.avg)} sub={gradeLabel(res.avg) + (rank ? ` · الترتيب ${fmtNum(rank)} من ${fmtNum(classStudents(st.classId).length)}` : '')} extra={<Spark values={gradeSeries(st).map(x => x.p)} />} />
      <Kpi label="الحضور (30 يومًا)" value={fmtPct(a30.rate, 1)} ic="check" tone={a30.rate >= 92 ? 'ok' : a30.rate >= 85 ? 'warn' : 'bad'} sub={`منذ بداية الفصل ${fmtPct(aAll.rate, 1)}`} />
      <Kpi label="المواد الراسبة" value={fmtNum(res.failing)} ic="book" tone={res.failing ? 'bad' : 'ok'} sub={res.result ? 'النتيجة المتوقعة: ' + RESULT_LABEL[res.result][0] : '—'} />
      {showFin ? <Kpi label="الرسوم المتبقية" value={fmtMoney(fin.remaining)} ic="wallet" tone={fin.overdue ? 'bad' : fin.remaining ? 'warn' : 'ok'} sub={`مدفوع ${fmtMoney(fin.paid)} من ${fmtMoney(fin.net)}`} />
        : <Kpi label="التأخر الصباحي" value={fmtNum(aAll.late)} ic="clock" tone={aAll.late > 3 ? 'warn' : 'ok'} sub="منذ بداية الفصل" />}
    </div>
    <Tabs initial="overview" items={[
      { key: 'overview', label: 'نظرة عامة', render: () => <div className="grid g-main"><Card title="النتائج حسب المادة" flush><SubjectsTable st={st} /></Card><Card title="مؤشر المتابعة الذكي"><RiskCard st={st} /></Card></div> },
      { key: 'att', label: 'الحضور', render: () => { const recs = (Idx().attByStudent.get(st.id) || []).slice().sort((a, b) => a.date < b.date ? 1 : -1); const ds = recordedDates(); const bad = recs.filter(r => r.status !== 'present'); return <div className="grid g2"><Card title="تقويم الحضور"><AttCalendar recs={recs} from={ds[0] || addDays(T, -35)} to={T} /></Card><Card title="سجل الغياب والتأخر">{bad.length ? <div className="list">{bad.map(r => <div className="li" key={r.id}><Badge tone={ATT_CLS[r.status]}>{ATT_LABEL[r.status]}</Badge><div className="bd"><b>{DAYS[dow(r.date)] + ' ' + fmtDate(r.date)}</b><span>{r.reason || 'بدون سبب مسجّل'}</span></div></div>)}</div> : <Empty text="لا غياب ولا تأخر. التزام ممتاز." ic="ok" />}</Card></div>; } },
      { key: 'grades', label: 'الدرجات', render: () => { const ser = gradeSeries(st); return <div className="stack" style={{ gap: 16 }}><Card title="تطور الدرجات">{ser.length >= 2 ? <LineChart labels={ser.map(x => fmtDateShort(x.date))} series={[{ name: 'متوسط الطالب', values: ser.map(x => x.p), color: 'var(--c1)' }]} min={0} max={100} fmt={v => fmtNum(v) + '%'} tip={v => fmtPct(v, 1)} /> : <Empty text="تحتاج تقييمين على الأقل لعرض الاتجاه." />}</Card><Card title="تفاصيل التقييمات" flush><AssessmentsDetail st={st} user={u} /></Card></div>; } },
      showFin ? { key: 'fin', label: 'المالية', render: () => <FinanceDetail st={st} /> } : null,
      { key: 'certs', label: 'الشهادات', render: () => { const cs = Repo.where('certificates', c => c.studentId === st.id); return cs.length ? <div className="list">{cs.map(c => <div className="li" key={c.id}><Icon name="award" size={20} /><div className="bd"><b>{`${c.certNo} · ${fmtPct(c.percentage, 1)} — ${c.gradeLabel}`}</b><span>{'صدرت ' + fmtDate(c.issueDate)}</span></div><Badge tone={RESULT_LABEL[c.result][1]}>{RESULT_LABEL[c.result][0]}</Badge><button className="btn sm" onClick={() => showCertificate(c)}>عرض</button></div>)}</div> : <Empty text="لم تصدر شهادة لهذا الطالب بعد." action={<button className="btn sm" onClick={() => showProvisional(st)}>عرض كشف الدرجات المؤقت</button>} ic="award" />; } }
    ]} />
  </>;
}
function SubjectsTable({ st }) {
  const res = studentResults(st);
  if (!res.rows.length) return <Empty text="لا درجات بعد." />;
  return <div className="tbl-wrap" style={{ border: 0 }}><table className="tbl"><thead><tr>{['المادة', 'النسبة', 'التقدير', 'الترتيب', 'التوقع'].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>
    {res.rows.map(r => { const pr = predictSubject(st, r.subject.id); const rk = subjectRanking(st.classId, r.subject.id).get(st.id); return <tr key={r.subject.id}>
      <td><span className="row" style={{ gap: 8 }}><Sw c={r.subject.color} />{r.subject.name}</span></td>
      <td><PctCell p={r.percent} tone={r.percent < passOf(r.subject) ? 'bad' : r.percent >= 80 ? 'ok' : ''} /></td>
      <td><Badge tone={gradeTone(r.percent)} plain>{gradeLabel(r.percent)}</Badge></td>
      <td className="tabnum">{rk ? fmtNum(rk) : '—'}</td>
      <td className="muted small tabnum" title="توقع إرشادي للدرجة النهائية حسب الاتجاه الحالي">{pr ? `${fmtNum(pr.low)}–${fmtNum(pr.high)}%` : '—'}</td>
    </tr>; })}
  </tbody></table></div>;
}
function AssessmentsDetail({ st, user }) {
  const as = assessmentsFor(st.classId, null, { publishedOnly: user.role === 'student' || user.role === 'parent' });
  if (!as.length) return <Empty text="لا تقييمات بعد." />;
  return <div className="tbl-wrap" style={{ border: 0 }}><table className="tbl cards"><thead><tr>{['التاريخ', 'المادة', 'التقييم', 'النوع', 'الدرجة', 'النسبة'].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>
    {as.slice().reverse().map(a => { const g = gradeOf(a.id, st.id); const p = hasScore(g) ? g.score / a.maxScore * 100 : null; return <tr key={a.id}>
      <td data-label="التاريخ">{fmtDate(a.date)}</td><td data-label="المادة">{nameOf.subj(a.subjectId)}</td><td data-label="التقييم">{a.name}</td><td data-label="النوع">{EXAM_LABEL[a.type]}</td>
      <td data-label="الدرجة" className="tabnum">{hasScore(g) ? `${fmtNum(g.score, g.score % 1 ? 1 : 0)} / ${fmtNum(a.maxScore)}` : '—'}</td>
      <td data-label="النسبة">{p == null ? '—' : <Badge tone={gradeTone(p)} plain>{fmtPct(p)}</Badge>}</td>
    </tr>; })}
  </tbody></table></div>;
}
export function FinanceDetail({ st }) {
  const fin = studentFinance(st.id);
  return <div className="grid g2">
    <Card title="الرسوم المستحقة" flush sub={`المتبقي ${fmtMoney(fin.remaining)}`}>{fin.fees.length ? <div className="tbl-wrap" style={{ border: 0 }}><table className="tbl"><thead><tr>{['البند', 'الاستحقاق', 'الصافي', 'المدفوع', 'الحالة'].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>
      {fin.fees.map(f => <tr key={f.fee.id}><td>{FEE_LABEL[f.fee.feeType] + (f.fee.label ? ' — ' + f.fee.label : '')}</td><td>{fmtDate(f.fee.dueDate)}</td><td className="tabnum">{fmtMoney(f.net)}</td><td className="tabnum">{fmtMoney(f.paid)}</td><td><Badge tone={PAY_STATUS[f.status][1]}>{PAY_STATUS[f.status][0]}</Badge></td></tr>)}
    </tbody></table></div> : <Empty text="لا رسوم" />}</Card>
    <Card title="الإيصالات">{fin.payments.length ? <div className="list">{[...groupBy(fin.payments, p => p.receiptNo).entries()].map(([no, ps]) => <div className="li" key={no}><Icon name="receipt" size={18} /><div className="bd"><b className="ltr">{no}</b><span>{fmtDateTime(ps[0].paidAt) + ' · ' + METHOD_LABEL[ps[0].method]}</span></div><b className="tabnum">{fmtMoney(sum(ps.map(p => p.amount)))}</b><button className="btn ghost xs" onClick={() => showReceipt(no)}>عرض</button></div>)}</div> : <Empty text="لا مدفوعات بعد" />}</Card>
  </div>;
}

/* ---------- Teachers ---------- */
export function Teachers() {
  const teachers = Repo.all('teachers');
  const over = teachers.filter(t => teacherLoad(t.id) > t.weeklyLoad);
  return <>
    <PageHead title="المدرسون" sub={`${fmtNum(teachers.length)} مدرسًا · ${fmtNum(Repo.all('teachingAssignments').length)} إسنادًا (مادة × فصل)`}><button className="btn primary" onClick={() => teacherForm()}><Icon name="plus" size={16} />إضافة مدرس</button></PageHead>
    {over.length > 0 && <Banner tone="warn" ic="alert">{`تجاوز الحمل الأسبوعي: ${over.map(t => `${t.fullName} (${fmtNum(teacherLoad(t.id))}/${fmtNum(t.weeklyLoad)})`).join('، ')}.`}</Banner>}
    <Card><DataTable id="teachers" unit="مدرس" exportName="teachers" searchPh="ابحث بالاسم أو التخصص..." rows={teachers}
      filters={[{ label: 'كل الحالات', options: Object.entries(T_STATUS).map(([k, v]) => [k, v[0]]), test: (t, v) => t.status === v }]}
      columns={[
        { label: 'المدرس', sort: t => t.fullName, render: t => <Person name={t.fullName} sub={t.email} />, csv: t => t.fullName },
        { label: 'الرقم الوظيفي', key: 'employeeNo', render: t => <span className="ltr muted">{t.employeeNo}</span> },
        { label: 'التخصص', key: 'specialization' },
        { label: 'الإسناد', sortable: false, render: t => { const g = groupBy(Repo.where('teachingAssignments', a => a.teacherId === t.id), a => a.subjectId); return <div className="stack" style={{ gap: 4 }}>{[...g.entries()].map(([sid, l]) => <span className="small" key={sid}><b>{nameOf.subj(sid)}</b>{': ' + l.map(a => nameOf.cls(a.classId)).join('، ')}</span>)}</div>; }, csv: t => Repo.where('teachingAssignments', a => a.teacherId === t.id).map(a => nameOf.subj(a.subjectId) + '/' + nameOf.cls(a.classId)).join(' | ') },
        { label: 'الحمل الأسبوعي', desc: true, sort: t => teacherLoad(t.id), render: t => { const l = teacherLoad(t.id); return <div className="pct-cell"><b className="tabnum">{`${fmtNum(l)}/${fmtNum(t.weeklyLoad)}`}</b><Progress p={l / t.weeklyLoad * 100} tone={l > t.weeklyLoad ? 'bad' : l / t.weeklyLoad > .9 ? 'warn' : 'ok'} /></div>; }, csv: t => teacherLoad(t.id) },
        { label: 'الحالة', sort: t => t.status, render: t => <Badge tone={T_STATUS[t.status][1]}>{T_STATUS[t.status][0]}</Badge>, csv: t => T_STATUS[t.status][0] },
        { label: '', sortable: false, cls: 'acts', csv: false, render: t => <div className="row" style={{ justifyContent: 'flex-end', gap: 2 }}>
          <button className="btn ghost xs" onClick={() => assignmentsModal(t)}>الإسناد</button>
          <button className="icon-btn sm" aria-label="الجدول" title="الجدول" onClick={() => { Store.ss.set('ass:schedMode', 'teacher|' + t.id); go('schedule'); }}><Icon name="calendar" size={16} /></button>
          <button className="icon-btn sm" aria-label="تعديل" title="تعديل" onClick={() => teacherForm(t)}><Icon name="edit" size={16} /></button>
          <button className="icon-btn sm danger" aria-label="حذف" title="حذف" onClick={() => deleteTeacher(t)}><Icon name="trash" size={16} /></button>
        </div> }
      ]} /></Card>
  </>;
}
function teacherForm(t) {
  formModal({
    title: t ? 'تعديل بيانات المدرس' : 'إضافة مدرس', submit: t ? 'حفظ' : 'إضافة',
    values: t || { status: 'active', hireDate: todayISO(), weeklyLoad: 24 },
    fields: [
      { name: 'fullName', label: 'الاسم الكامل', required: true, span: true },
      { name: 'employeeNo', label: 'الرقم الوظيفي', hint: t ? '' : 'يُولَّد تلقائيًا إن تُرك فارغًا', ltr: true },
      { name: 'specialization', label: 'التخصص', required: true },
      { name: 'phone', label: 'الهاتف', type: 'tel', required: true, ltr: true }, { name: 'email', label: 'البريد الإلكتروني', type: 'email', ltr: true },
      { name: 'hireDate', label: 'تاريخ التوظيف', type: 'date', required: true },
      { name: 'weeklyLoad', label: 'الحد الأعلى للحصص أسبوعيًا', type: 'number', min: 1, max: 40, required: true },
      { name: 'status', label: 'الحالة', type: 'select', options: Object.entries(T_STATUS).map(([k, v]) => [k, v[0]]) }
    ],
    onSubmit: async v => {
      const dup = Repo.all('teachers').find(x => x.employeeNo === v.employeeNo && (!t || x.id !== t.id)); if (v.employeeNo && dup) return 'الرقم الوظيفي مستخدم لمدرس آخر.';
      if (t) { Repo.update('teachers', t.id, v); toast.success('تم حفظ بيانات المدرس'); return; }
      const no = v.employeeNo || 'EMP-' + String(Repo.raw('teachers').length + 1).padStart(4, '0');
      const nt = Repo.create('teachers', { ...v, employeeNo: no });
      try { const a = await Accounts.create('teacher', nt.id, v.email); credsModal(`حساب ${v.fullName}`, [['المدرس', a.username, a.password]]); } catch (e) { toast.error(e.message); }
      setTimeout(() => assignmentsModal(nt), 250);
    }
  });
}
function assignmentsModal(t) {
  openModal({ title: 'إسناد المواد والفصول — ' + t.fullName, size: 'md', render: ({ close }) => <Assignments t={t} close={close} /> });
}
function Assignments({ t, close }) {
  useData();
  const classes = Repo.all('classes').sort(byClass); const subjects = Repo.all('subjects');
  const [classId, setClassId] = useState(classes[0] && classes[0].id); const [subjectId, setSubjectId] = useState(subjects[0] && subjects[0].id);
  const as = Repo.where('teachingAssignments', a => a.teacherId === t.id).sort((a, b) => nameOf.cls(a.classId).localeCompare(nameOf.cls(b.classId), 'ar'));
  async function remove(a) {
    const rel = Repo.all('schedules').filter(s => s.teacherId === t.id && s.classId === a.classId && s.subjectId === a.subjectId);
    if (!(await confirmDialog({ title: 'إزالة إسناد', message: `إزالة ${nameOf.subj(a.subjectId)} لـ${nameOf.cls(a.classId)}${rel.length ? ` وحذف ${fmtNum(rel.length)} حصة من الجدول` : ''}؟`, ok: 'إزالة', danger: true }))) return;
    Repo.remove('teachingAssignments', a.id); rel.forEach(s => Repo.remove('schedules', s.id, { audit: false }));
  }
  async function add() {
    if (as.some(a => a.classId === classId && a.subjectId === subjectId)) { toast.info('هذا الإسناد موجود مسبقًا'); return; }
    const other = Repo.all('teachingAssignments').find(a => a.classId === classId && a.subjectId === subjectId);
    if (other) {
      if (!(await confirmDialog({ title: 'المادة مسندة لمدرس آخر', message: `${nameOf.subj(subjectId)} في ${nameOf.cls(classId)} مسندة إلى ${nameOf.tch(other.teacherId)}. هل تريد نقلها إلى ${t.fullName}؟ ستنتقل حصصها في الجدول أيضًا إن لم يكن هناك تعارض.`, ok: 'نقل الإسناد' }))) return;
      Repo.remove('teachingAssignments', other.id);
      Repo.all('schedules').filter(s => s.classId === classId && s.subjectId === subjectId).forEach(s => { if (scheduleConflict({ ...s, teacherId: t.id }, s.id)) Repo.remove('schedules', s.id, { audit: false }); else Repo.update('schedules', s.id, { teacherId: t.id }, { audit: false }); });
    }
    Repo.create('teachingAssignments', { teacherId: t.id, subjectId, classId, academicYearId: activeYear().id }); toast.success('تمت إضافة الإسناد');
  }
  return <><ModalBody><div className="stack" style={{ gap: 14 }}>
    <p className="muted">الإسناد يحدد المواد والفصول التي يدرّسها المدرس، ومنه تُبنى صلاحياته في الحضور والدرجات والجدول.</p>
    <div className="row">{as.length ? as.map(a => <span className="chip" key={a.id}>{nameOf.subj(a.subjectId) + ' — ' + nameOf.cls(a.classId)}<button className="x" aria-label="إزالة" onClick={() => remove(a)}><Icon name="x" size={14} /></button></span>) : <span className="muted">لا يوجد إسناد بعد.</span>}</div>
    <div className="form-sec">إضافة إسناد</div>
    <div className="row" style={{ flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 160px' }}><select className="select" id="asg-class" aria-label="الفصل" value={classId} onChange={e => setClassId(e.target.value)}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div style={{ flex: '1 1 160px' }}><select className="select" id="asg-subj" aria-label="المادة" value={subjectId} onChange={e => setSubjectId(e.target.value)}>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <button className="btn primary" onClick={add}><Icon name="plus" size={16} />إضافة</button>
    </div>
  </div></ModalBody><ModalFoot><button className="btn primary" onClick={close}>تم</button></ModalFoot></>;
}
async function deleteTeacher(t) {
  const as = Repo.where('teachingAssignments', a => a.teacherId === t.id).length;
  if (as) { toast.error(`لا يمكن حذف ${t.fullName} لأن لديه ${fmtNum(as)} إسنادًا. انقل الإسناد أولًا أو غيّر حالته إلى «غير فعّال».`); return; }
  if (!(await confirmDialog({ title: 'حذف مدرس', message: `هل أنت متأكد من حذف ${t.fullName}؟ سيُعطَّل حساب دخوله أيضًا.`, ok: 'حذف', danger: true }))) return;
  Repo.remove('teachers', t.id); const tu = userOf('teacher', t.id); if (tu) Repo.update('users', tu.id, { isActive: false });
  Repo.where('classes', c => c.homeroomTeacherId === t.id).forEach(c => Repo.update('classes', c.id, { homeroomTeacherId: '' }));
  toast.success('تم حذف المدرس', { undo: () => { Repo.restore('teachers', t.id); if (tu) Repo.update('users', tu.id, { isActive: true }); } });
}

/* ---------- Classes ---------- */
export function Classes({ user: u }) {
  const admin = isAdmin(u); const T = todayISO();
  const classes = Scope.classes(u);
  return <>
    <PageHead title="الفصول" sub={`${fmtNum(classes.length)} فصول · العام الدراسي ${Settings.get().academicYear}`}>{admin && <button className="btn primary" onClick={() => classForm()}><Icon name="plus" size={16} />إضافة فصل</button>}</PageHead>
    {!classes.length ? <Empty text="لا توجد فصول ضمن صلاحياتك." /> : <div className="grid g3">{classes.map(c => {
      const sts = classStudents(c.id); const n = sts.length;
      const att = attStats(Repo.all('attendance').filter(r => r.classId === c.id && r.date >= addDays(T, -29))).rate;
      const av = avg(sts.map(s => studentResults(s).avg).filter(v => v != null));
      const rk = atRisk(sts, 'high').length;
      return <section className="card class-card" key={c.id}>
        <div className="row between"><div><h3>{c.name}</h3><div className="muted small">{`${gradeName(c.gradeLevel)} · القاعة ${c.room || '—'}`}</div></div>{rk ? <Badge tone="bad">{`${fmtNum(rk)} في خطر`}</Badge> : <Badge tone="ok">مستقر</Badge>}</div>
        <div className="small"><span className="muted">مربي الصف: </span>{nameOf.tch(c.homeroomTeacherId)}</div>
        <div className="stack" style={{ gap: 4 }}><div className="row between small"><span className="muted">الطلاب / السعة</span><b className="tabnum">{`${fmtNum(n)} / ${fmtNum(c.capacity)}`}</b></div><Progress p={n / c.capacity * 100} tone={n >= c.capacity ? 'bad' : n / c.capacity > .9 ? 'warn' : ''} /></div>
        <div className="cc-stats"><div><b>{fmtPct(att, 0)}</b><span>الحضور 30 يومًا</span></div><div><b>{fmtPct(av, 0)}</b><span>متوسط الدرجات</span></div><div><b>{fmtNum((Idx().schedByClass.get(c.id) || []).length)}</b><span>حصة أسبوعيًا</span></div></div>
        <div className="row">
          <button className="btn sm" onClick={() => classStudentsModal(c, admin)}><Icon name="users" size={15} />الطلاب</button>
          <button className="btn ghost sm" onClick={() => { Store.ss.set('ass:schedMode', 'class|' + c.id); go('schedule'); }}><Icon name="calendar" size={15} />الجدول</button>
          {admin && <><div className="grow" /><button className="icon-btn sm" aria-label="تعديل" title="تعديل" onClick={() => classForm(c)}><Icon name="edit" size={16} /></button><button className="icon-btn sm danger" aria-label="حذف" title="حذف" onClick={() => deleteClass(c)}><Icon name="trash" size={16} /></button></>}
        </div>
      </section>;
    })}</div>}
  </>;
}
function classForm(c) {
  formModal({
    title: c ? 'تعديل الفصل' : 'إضافة فصل', values: c ? { ...c, gradeLevel: String(c.gradeLevel) } : { capacity: 24, gradeLevel: '7', section: 'أ' },
    fields: [
      { name: 'gradeLevel', label: 'الصف', type: 'select', required: true, options: GRADE_NAMES.map((g, i) => [String(i + 1), 'الصف ' + g]) },
      { name: 'section', label: 'الشعبة', required: true, placeholder: 'أ' },
      { name: 'capacity', label: 'السعة', type: 'number', min: 1, max: 60, required: true },
      { name: 'room', label: 'القاعة' },
      { name: 'homeroomTeacherId', label: 'مربي الصف', type: 'select', span: true, placeholder: '— بدون —', options: Repo.all('teachers').map(t => [t.id, t.fullName]) }
    ],
    onSubmit: v => {
      const g = Number(v.gradeLevel); const name = `${GRADE_NAMES[g - 1]} - ${v.section}`;
      if (Repo.all('classes').some(x => x.name === name && (!c || x.id !== c.id))) return 'يوجد فصل بنفس الصف والشعبة.';
      if (c && classStudents(c.id).length > v.capacity) return `عدد طلاب الفصل الحالي (${fmtNum(classStudents(c.id).length)}) أكبر من السعة الجديدة.`;
      const data = { name, gradeLevel: g, section: v.section, capacity: v.capacity, room: v.room, homeroomTeacherId: v.homeroomTeacherId, academicYearId: activeYear().id };
      if (c) { Repo.update('classes', c.id, data); if (c.gradeLevel !== g) classStudents(c.id).forEach(s => Repo.update('students', s.id, { gradeLevel: g }, { audit: false })); } else Repo.create('classes', data);
      toast.success(c ? 'تم حفظ الفصل' : 'تمت إضافة الفصل ' + name);
    }
  });
}
async function deleteClass(c) {
  const n = classStudents(c.id).length;
  if (n) { toast.error(`لا يمكن حذف ${c.name} لأن فيه ${fmtNum(n)} طالبًا. انقلهم أولًا من زر «الطلاب».`); return; }
  if (!(await confirmDialog({ title: 'حذف فصل', message: `هل أنت متأكد من حذف ${c.name}؟ سيُحذف جدوله وإسناداته أيضًا.`, ok: 'حذف', danger: true }))) return;
  Repo.remove('classes', c.id); Repo.all('schedules').filter(s => s.classId === c.id).forEach(s => Repo.remove('schedules', s.id, { audit: false })); Repo.all('teachingAssignments').filter(a => a.classId === c.id).forEach(a => Repo.remove('teachingAssignments', a.id, { audit: false }));
  toast.success('تم حذف الفصل');
}
function classStudentsModal(c, admin) {
  openModal({ title: `طلاب ${c.name} (${fmtNum(classStudents(c.id).length)})`, size: 'lg', render: ({ close }) => <ClassStudents c={c} admin={admin} close={close} /> });
}
function ClassStudents({ c, admin, close }) {
  useData();
  const sts = classStudents(c.id); const ranks = classRanking(c.id);
  const targets = Repo.all('classes').filter(x => x.id !== c.id && x.gradeLevel === c.gradeLevel);
  const move = (s, v) => { if (!v) return; const to = Repo.get('classes', v); if (classStudents(v).length >= to.capacity) { toast.error(to.name + ' ممتلئ'); return; } Repo.update('students', s.id, { classId: v }); toast.success(`نُقل ${s.fullName} إلى ${to.name}`); };
  return <ModalBody>{sts.length ? <div className="tbl-wrap"><table className="tbl"><thead><tr>{['الطالب', 'المعدل', 'الترتيب', 'المتابعة', admin ? 'نقل إلى' : ''].map((x, i) => <th key={i}>{x}</th>)}</tr></thead><tbody>
    {sts.map(s => <tr key={s.id}><td><a href={'#student-' + s.id} onClick={close}>{s.fullName}</a></td><td className="tabnum">{fmtPct(studentResults(s).avg, 1)}</td><td className="tabnum">{fmtNum(ranks.get(s.id))}</td><td><RiskBadge st={s} /></td>
      <td>{admin && <select className="select sm" aria-label={'نقل ' + s.fullName} value="" onChange={e => move(s, e.target.value)}><option value="">—</option>{targets.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</td></tr>)}
  </tbody></table></div> : <Empty text="لا طلاب في هذا الفصل." />}</ModalBody>;
}

/* ---------- Subjects ---------- */
export function Subjects({ user: u }) {
  const admin = isAdmin(u);
  const myIds = u.role === 'teacher' ? new Set(Scope.assignments(u).map(a => a.subjectId)) : null;
  const sts = activeStudents();
  const schoolAvg = s => avg(sts.map(st => subjectResult(st, s.id).percent).filter(v => v != null));
  return <>
    <PageHead title="المواد الدراسية" sub={u.role === 'teacher' ? 'المواد التي تدرّسها' : `${fmtNum(Repo.all('subjects').length)} مادة · ${fmtNum(sum(Repo.all('subjects').map(s => s.weeklySessions)))} حصة أسبوعية لكل فصل`}>{admin && <button className="btn primary" onClick={() => subjectForm()}><Icon name="plus" size={16} />إضافة مادة</button>}</PageHead>
    <Card><DataTable id="subjects" unit="مادة" exportName={admin ? 'subjects' : null} pageSize={20} rows={Repo.all('subjects').filter(s => !myIds || myIds.has(s.id))}
      columns={[
        { label: 'المادة', sort: s => s.name, render: s => <span className="row" style={{ gap: 8 }}><Sw c={s.color} s={12} /><b>{s.name}</b></span>, csv: s => s.name },
        { label: 'الرمز', key: 'code', render: s => <span className="ltr muted">{s.code}</span> },
        { label: 'الحصص أسبوعيًا', key: 'weeklySessions', cls: 'tabnum' },
        { label: 'الدرجة النهائية', key: 'maxScore', cls: 'tabnum' },
        { label: 'درجة النجاح', key: 'passScore', cls: 'tabnum' },
        { label: 'المدرسون', sortable: false, render: s => [...new Set(Repo.where('teachingAssignments', a => a.subjectId === s.id).map(a => nameOf.tch(a.teacherId)))].join('، ') || '—' },
        { label: 'متوسط المدرسة', desc: true, sort: schoolAvg, render: s => <PctCell p={schoolAvg(s)} /> },
        admin && { label: '', sortable: false, cls: 'acts', csv: false, render: s => <div className="row" style={{ justifyContent: 'flex-end', gap: 2 }}><button className="icon-btn sm" aria-label="تعديل" onClick={() => subjectForm(s)}><Icon name="edit" size={16} /></button><button className="icon-btn sm danger" aria-label="حذف" onClick={() => deleteSubject(s)}><Icon name="trash" size={16} /></button></div> }
      ]} /></Card>
  </>;
}
function subjectForm(s) {
  formModal({
    title: s ? 'تعديل المادة' : 'إضافة مادة', values: s || { weeklySessions: 2, maxScore: 100, passScore: 50, color: '#2f63e6' },
    fields: [
      { name: 'name', label: 'اسم المادة', required: true }, { name: 'code', label: 'رمز المادة', required: true, ltr: true, validate: v => /^[A-Za-z0-9-]{2,10}$/.test(v) ? null : 'حروف لاتينية وأرقام فقط (2–10)' },
      { name: 'weeklySessions', label: 'عدد الحصص أسبوعيًا', type: 'number', min: 1, max: 10, required: true },
      { name: 'color', label: 'لون المادة', type: 'color' },
      { name: 'maxScore', label: 'الدرجة النهائية', type: 'number', min: 10, max: 1000, required: true },
      { name: 'passScore', label: 'درجة النجاح', type: 'number', min: 1, required: true }
    ],
    onSubmit: v => {
      if (v.passScore >= v.maxScore) return 'درجة النجاح يجب أن تكون أقل من الدرجة النهائية.';
      v.code = v.code.toUpperCase();
      if (Repo.all('subjects').some(x => x.code === v.code && (!s || x.id !== s.id))) return 'رمز المادة مستخدم.';
      if (s) Repo.update('subjects', s.id, v); else Repo.create('subjects', { ...v, gradeLevel: null });
      toast.success('تم حفظ المادة');
    }
  });
}
async function deleteSubject(s) {
  if (Repo.all('assessments').some(a => a.subjectId === s.id)) { toast.error('لا يمكن حذف مادة لديها تقييمات ودرجات مسجّلة.'); return; }
  if (!(await confirmDialog({ title: 'حذف مادة', message: `حذف ${s.name} مع إسناداتها وحصصها في الجدول؟`, ok: 'حذف', danger: true }))) return;
  Repo.remove('subjects', s.id); Repo.all('teachingAssignments').filter(a => a.subjectId === s.id).forEach(a => Repo.remove('teachingAssignments', a.id, { audit: false })); Repo.all('schedules').filter(x => x.subjectId === s.id).forEach(x => Repo.remove('schedules', x.id, { audit: false }));
  toast.success('تم حذف المادة');
}
void cx; void periodsSorted;
