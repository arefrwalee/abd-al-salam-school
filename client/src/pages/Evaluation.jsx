/* =====================================================================
   التقييم والمتابعة: الجدول الدراسي، الحضور والغياب، الدرجات، الشهادات
   ===================================================================== */
import { useEffect, useRef, useState } from 'react';
import {
  Repo, Settings, Store, Audit, Idx, Scope, isAdmin, byClass, Notify, activeYear, attStats, recordedDates, classStudents, userOf,
  subjectResult, studentResults, studentAtt, gradeSeries, classRanking, assessmentsFor, gradeOf, hasScore, gradeLabel, gradeTone, passOf, teacherLoad, periodsSorted, nameOf,
  scheduleConflict, autoSchedule, canEditAttendance, saveAttendance, setGrade, publishAssessment, issueCertificates, rankMap,
  RESULT_LABEL, ATT_LABEL, ATT_CLS, EXAM_LABEL,
  fmtNum, fmtPct, fmtDate, fmtDateShort, fmtTime, relTime, todayISO, addDays, dow, DAYS, avg, sum, groupBy, gradeName,
  Icon, Badge, Avatar, PageHead, Card, Kpi, Empty, Progress, PctCell, Select, KV, Banner, LineChart, BarChart, AttCalendar, QRCode, cx,
  DataTable, openModal, ModalBody, ModalFoot, confirmDialog, formModal, copyText, PrintButton, toast, go, useData
} from './common.js';
import { StudentLink, ChildPicker } from './Academic.jsx';

/* ======================= Schedule ======================= */
export function Schedule({ user: u }) {
  const admin = isAdmin(u);
  const [sel, setSel] = useState(() => {
    const pre = Store.ss.get('ass:schedMode'); Store.ss.del('ass:schedMode');
    let mode = 'class', ent = null;
    if (u.role === 'teacher') { mode = 'teacher'; ent = u.linkedId; }
    else if (u.role === 'student' || u.role === 'parent') ent = (Scope.students(u)[0] || {}).classId;
    else if (pre) [mode, ent] = pre.split('|');
    if (!ent && mode === 'class') ent = (Repo.all('classes').sort(byClass)[0] || {}).id;
    if (!ent && mode === 'teacher') ent = (Repo.all('teachers')[0] || {}).id;
    return { mode, ent };
  });
  const { mode, ent } = sel; const kids = Scope.students(u);
  const printRef = useRef(null);
  const title = mode === 'class' ? 'جدول ' + nameOf.cls(ent) : 'جدول ' + nameOf.tch(ent);
  const rows = mode === 'class' ? (Idx().schedByClass.get(ent) || []) : (Idx().schedByTeacher.get(ent) || []);
  const editable = admin && mode === 'class';
  const printTarget = () => { const d = document.createElement('div'); d.style.cssText = 'padding:12px;background:#fff;color:#000'; const h2 = document.createElement('h2'); h2.style.cssText = 'text-align:center;margin-bottom:10px'; h2.textContent = Settings.get().schoolName + ' — ' + title; d.append(h2, printRef.current.cloneNode(true)); return d; };
  return <>
    <PageHead title="الجدول الدراسي" sub={admin ? 'انقر خانة فارغة لإضافة حصة، أو اسحب حصة لنقلها. يُمنع أي تعارض للمدرس أو الفصل أو القاعة.' : 'الجدول الأسبوعي · ' + Settings.get().termName}>
      {admin && <div className="seg" role="tablist">{[['class', 'حسب الفصل'], ['teacher', 'حسب المدرس']].map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={v === mode} className={v === mode ? 'on' : ''} onClick={() => setSel({ mode: v, ent: v === 'class' ? (Repo.all('classes').sort(byClass)[0] || {}).id : (Repo.all('teachers')[0] || {}).id })}>{l}</button>)}</div>}
      {admin && (mode === 'class' ? <Select label="الفصل" options={Repo.all('classes').sort(byClass).map(c => [c.id, c.name])} value={ent} onChange={v => setSel({ mode, ent: v })} /> : <Select label="المدرس" options={Repo.all('teachers').map(t => [t.id, t.fullName])} value={ent} onChange={v => setSel({ mode, ent: v })} />)}
      {!admin && u.role === 'parent' && kids.length > 1 && <Select label="الابن" options={kids.map(k => [k.classId, k.fullName + ' — ' + nameOf.cls(k.classId)])} value={ent} onChange={v => setSel({ mode, ent: v })} />}
      {editable && <><button className="btn soft" onClick={() => smartFill(ent)}><Icon name="wand" size={16} />اقتراح ذكي للحصص الناقصة</button><button className="btn ghost" onClick={() => clearClass(ent)}><Icon name="trash" size={16} />مسح الجدول</button></>}
      <PrintButton target={printTarget} what="schedule" />
    </PageHead>
    <div className="stack" style={{ gap: 14 }}>
      <Card title={title} sub={`${fmtNum(rows.length)} حصة أسبوعيًا`}><div className="sched-wrap" ref={printRef}><ScheduleGrid rows={rows} mode={mode} ent={ent} editable={editable} /></div></Card>
      {mode === 'class' ? <ClassSummary classId={ent} /> : <TeacherSummary tid={ent} />}
    </div>
  </>;
}
function ScheduleGrid({ rows, mode, ent, editable }) {
  const ps = periodsSorted(); const days = Settings.get().schoolDays; const today = dow(todayISO());
  const map = new Map(rows.map(r => [r.dayOfWeek + '|' + r.periodId, r]));
  const [over, setOver] = useState(null); const [bad, setBad] = useState(null);
  function drop(e, d, p, r) {
    e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/plain'); const src = Repo.get('schedules', id); if (!src || (r && r.id === id)) return;
    const key = d + '|' + p.id; const fail = msg => { setBad(key); toast.error(msg); setTimeout(() => setBad(null), 900); };
    if (r) {
      const a = { ...src, dayOfWeek: d, periodId: p.id }, b = { ...r, dayOfWeek: src.dayOfWeek, periodId: src.periodId };
      const ca = conflictExcept(a, [src.id, r.id]), cb = conflictExcept(b, [src.id, r.id]);
      if (ca || cb) return fail('تعذّر التبديل: ' + (ca || cb));
      Repo.update('schedules', src.id, { dayOfWeek: d, periodId: p.id }); Repo.update('schedules', r.id, { dayOfWeek: b.dayOfWeek, periodId: b.periodId }); notifySchedule(ent); toast.success('تم تبديل الحصتين');
    } else {
      const c = scheduleConflict({ ...src, dayOfWeek: d, periodId: p.id }, src.id);
      if (c) return fail('تعذّر النقل: ' + c);
      Repo.update('schedules', src.id, { dayOfWeek: d, periodId: p.id }); notifySchedule(ent); toast.success('تم نقل الحصة إلى ' + DAYS[d] + ' — الحصة ' + fmtNum(p.order));
    }
  }
  return <table className="sched">
    <thead><tr><th>الحصة</th>{days.map(d => <th key={d} style={d === today ? { color: 'var(--blue-ink)' } : undefined}>{DAYS[d] + (d === today ? ' (اليوم)' : '')}</th>)}</tr></thead>
    <tbody>{ps.map((p, pi) => [
      pi === 3 ? <tr className="brk" key={'brk'}><td colSpan={days.length + 1}>الاستراحة 10:25 – 10:45</td></tr> : null,
      <tr key={p.id}><td><b>{'الحصة ' + fmtNum(p.order)}</b><span className="ltr">{p.startTime + '–' + p.endTime}</span></td>
        {days.map(d => {
          const r = map.get(d + '|' + p.id); const key = d + '|' + p.id;
          const dnd = editable ? { onDragOver: e => { e.preventDefault(); setOver(key); }, onDragLeave: () => setOver(o => o === key ? null : o), onDrop: e => drop(e, d, p, r) } : {};
          const extra = cx(over === key && 'drag-over', bad === key && 'conflict');
          if (r) {
            const s = Repo.get('subjects', r.subjectId) || {};
            return <td key={d}><div className={cx('slot filled', editable && 'can', d === today && 'today', extra)} style={{ background: `color-mix(in srgb, ${s.color} 12%, var(--surface))`, borderColor: `color-mix(in srgb, ${s.color} 35%, var(--line))` }}
              draggable={editable || undefined} onDragStart={editable ? e => { e.dataTransfer.setData('text/plain', r.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
              title={`${s.name} — ${nameOf.tch(r.teacherId)} — ${nameOf.cls(r.classId)}`} onClick={editable ? () => editSlot(r) : undefined} {...dnd}>
              <b><i style={{ background: s.color }} />{s.name}</b><span>{mode === 'class' ? nameOf.tch(r.teacherId) : nameOf.cls(r.classId)}</span>{r.room && <span>{'القاعة ' + r.room}</span>}
            </div></td>;
          }
          return <td key={d}><div className={cx('slot empty', editable && 'can', extra)} onClick={editable ? () => addSlot(ent, { dayOfWeek: d, periodId: p.id }) : undefined} {...dnd}>{editable && <Icon name="plus" size={16} />}</div></td>;
        })}
      </tr>
    ])}</tbody>
  </table>;
}
function conflictExcept(rec, ids) {
  const all = Repo.all('schedules').filter(s => !ids.includes(s.id) && s.dayOfWeek === rec.dayOfWeek && s.periodId === rec.periodId);
  if (all.some(s => s.classId === rec.classId)) return 'الفصل لديه حصة أخرى في هذا الوقت.';
  const t = all.find(s => s.teacherId === rec.teacherId); if (t) return `${nameOf.tch(rec.teacherId)} لديه حصة مع ${nameOf.cls(t.classId)}.`;
  return null;
}
let schedNotifyTimer = null;
function notifySchedule(classId) {
  clearTimeout(schedNotifyTimer);
  schedNotifyTimer = setTimeout(() => { const sts = classStudents(classId); const tids = [...new Set((Idx().schedByClass.get(classId) || []).map(s => s.teacherId))]; Notify.send([...sts.map(s => userOf('student', s.id)), ...tids.map(t => userOf('teacher', t))], { type: 'general', title: 'تعديل في الجدول', message: `تم تعديل الجدول الأسبوعي لـ${nameOf.cls(classId)}.`, link: 'schedule', priority: 'normal' }); }, 4000);
}
function addSlot(classId, key) {
  const asg = Repo.where('teachingAssignments', a => a.classId === classId);
  if (!asg.length) { toast.error('لا يوجد إسناد مواد لهذا الفصل. أضف الإسناد من صفحة المدرسين.'); return; }
  const cls = Repo.get('classes', classId); const have = Idx().schedByClass.get(classId) || [];
  formModal({
    title: `إضافة حصة — ${DAYS[key.dayOfWeek]}، الحصة ${fmtNum((Repo.get('periods', key.periodId) || {}).order)}`, size: 'sm', submit: 'إضافة', values: { room: cls.room },
    fields: [{ name: 'asg', label: 'المادة والمدرس', type: 'select', required: true, placeholder: 'اختر', options: asg.map(a => { const s = Repo.get('subjects', a.subjectId); const n = have.filter(x => x.subjectId === a.subjectId).length; return [a.id, `${s.name} — ${nameOf.tch(a.teacherId)} (${fmtNum(n)}/${fmtNum(s.weeklySessions)})`]; }) }, { name: 'room', label: 'القاعة' }],
    onSubmit: v => {
      const a = Repo.get('teachingAssignments', v.asg);
      const rec = { classId, ...key, subjectId: a.subjectId, teacherId: a.teacherId, room: v.room, academicYearId: activeYear().id };
      const c = scheduleConflict(rec); if (c) return 'تعارض: ' + c;
      const t = Repo.get('teachers', a.teacherId); if (t && teacherLoad(t.id) + 1 > t.weeklyLoad) toast.warning(`${t.fullName} سيتجاوز حمله الأسبوعي (${fmtNum(teacherLoad(t.id) + 1)}/${fmtNum(t.weeklyLoad)}).`);
      Repo.create('schedules', rec); notifySchedule(classId); toast.success('تمت إضافة الحصة');
    }
  });
}
function editSlot(r) {
  const s = Repo.get('subjects', r.subjectId); const p = Repo.get('periods', r.periodId);
  openModal({ title: `${s.name} — ${nameOf.cls(r.classId)}`, size: 'sm', render: ({ close }) => <>
    <ModalBody><KV pairs={[['اليوم', DAYS[r.dayOfWeek]], ['الحصة', `${fmtNum(p.order)} (${p.startTime}–${p.endTime})`], ['المدرس', nameOf.tch(r.teacherId)], ['القاعة', r.room || '—']]} /></ModalBody>
    <ModalFoot><button className="btn danger" onClick={() => { Repo.remove('schedules', r.id); notifySchedule(r.classId); close(); toast.success('تم حذف الحصة', { undo: () => Repo.restore('schedules', r.id) }); }}><Icon name="trash" size={16} />حذف الحصة</button><button className="btn ghost" onClick={close}>إغلاق</button></ModalFoot>
  </> });
}
function smartFill(classId) {
  const res = autoSchedule(classId, { room: (Repo.get('classes', classId) || {}).room, existing: Repo.all('schedules') });
  const missing = Object.entries(res.missing);
  if (!res.placed.length && !missing.length) { toast.info('جدول هذا الفصل مكتمل. لا حصص ناقصة.'); return; }
  openModal({ title: 'اقتراح ذكي للجدول — ' + nameOf.cls(classId), size: 'md', render: ({ close }) => <>
    <ModalBody><div className="stack">
      <p>{`يقترح المساعد إضافة ${fmtNum(res.placed.length)} حصة دون أي تعارض، مع توزيع حصص المادة الواحدة على أيام مختلفة قدر الإمكان:`}</p>
      <div className="tbl-wrap"><table className="tbl"><thead><tr>{['اليوم', 'الحصة', 'المادة', 'المدرس'].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{res.placed.map((r, i) => <tr key={i}><td>{DAYS[r.dayOfWeek]}</td><td className="tabnum">{fmtNum((Repo.get('periods', r.periodId) || {}).order)}</td><td>{nameOf.subj(r.subjectId)}</td><td>{nameOf.tch(r.teacherId)}</td></tr>)}</tbody></table></div>
      {missing.length > 0 && <Banner tone="warn" ic="alert">{`تعذّر جدولة: ${missing.map(([sid, n]) => `${nameOf.subj(sid)} (${fmtNum(n)})`).join('، ')} — لا توجد خانة متاحة للمدرس والفصل معًا.`}</Banner>}
    </div></ModalBody>
    <ModalFoot>{res.placed.length ? <><button className="btn primary" onClick={() => { res.placed.forEach(r => Repo.create('schedules', r, { audit: false })); Audit.log('create', 'schedules', classId, null, { smartFill: res.placed.length }); notifySchedule(classId); close(); toast.success(`أُضيفت ${fmtNum(res.placed.length)} حصة`); }}>اعتماد الاقتراح</button><button className="btn ghost" onClick={close}>إلغاء</button></> : <button className="btn" onClick={close}>إغلاق</button>}</ModalFoot>
  </> });
}
async function clearClass(classId) {
  const rows = Idx().schedByClass.get(classId) || []; if (!rows.length) return;
  if (!(await confirmDialog({ title: 'مسح الجدول', message: `حذف كل حصص ${nameOf.cls(classId)} (${fmtNum(rows.length)} حصة)؟ يمكنك بعدها استخدام الاقتراح الذكي لإعادة بنائه.`, ok: 'مسح', danger: true }))) return;
  rows.slice().forEach(r => Repo.remove('schedules', r.id, { audit: false })); Audit.log('delete', 'schedules', classId, { count: rows.length }, null); toast.success('تم مسح الجدول');
}
function ClassSummary({ classId }) {
  const rows = Idx().schedByClass.get(classId) || [];
  const asg = Repo.where('teachingAssignments', a => a.classId === classId);
  return <Card title="اكتمال الحصص حسب المادة"><div className="row">{asg.map(a => { const s = Repo.get('subjects', a.subjectId) || {}; const n = rows.filter(r => r.subjectId === a.subjectId).length; return <span className="chip" key={a.id} title={nameOf.tch(a.teacherId)}><i style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />{s.name}<Badge tone={n >= s.weeklySessions ? 'ok' : n ? 'warn' : 'bad'} plain>{`${fmtNum(n)}/${fmtNum(s.weeklySessions)}`}</Badge></span>; })}</div></Card>;
}
function TeacherSummary({ tid }) {
  const t = Repo.get('teachers', tid); if (!t) return null; const l = teacherLoad(tid);
  return <Card title="الحمل الأسبوعي"><div className="stack">
    <div className="row between"><span>{`${fmtNum(l)} حصة من حد أعلى ${fmtNum(t.weeklyLoad)}`}</span><Badge tone={l > t.weeklyLoad ? 'bad' : 'ok'}>{l > t.weeklyLoad ? 'تجاوز الحد' : 'ضمن الحد'}</Badge></div>
    <Progress p={l / t.weeklyLoad * 100} tone={l > t.weeklyLoad ? 'bad' : 'ok'} />
    <div className="row">{[...groupBy(Idx().schedByTeacher.get(tid) || [], s => s.dayOfWeek).entries()].sort((a, b) => a[0] - b[0]).map(([d, l2]) => <span className="chip" key={d}>{DAYS[d] + ': ' + fmtNum(l2.length)}</span>)}</div>
  </div></Card>;
}

/* ======================= Attendance ======================= */
export function Attendance({ user: u }) {
  if (u.role === 'student' || u.role === 'parent') return <AttendanceFamily u={u} />;
  return <AttendanceStaff u={u} />;
}
function AttendanceStaff({ u }) {
  const T = todayISO(); const classes = Scope.classes(u);
  const [classId, setClassId] = useState(() => {
    const pre = Store.ss.get('ass:attClass'); Store.ss.del('ass:attClass');
    if (pre && classes.some(c => c.id === pre)) return pre;
    return u.role === 'teacher' ? ((Repo.where('schedules', s => s.teacherId === u.linkedId && s.dayOfWeek === dow(T))[0] || {}).classId || (classes[0] || {}).id) : (classes[0] || {}).id;
  });
  const [date, setDate] = useState(T); const [view, setView] = useState('take');
  return <>
    <PageHead title="الحضور والغياب" sub={u.role === 'teacher' ? `يمكنك تسجيل الحضور وتعديله لليوم و${fmtNum(Settings.get().teacherEditDays)} أيام سابقة.` : 'سجل الحضور اليومي لكل الفصول'}>
      <div className="seg" role="tablist">{[['take', 'تسجيل الحضور'], ['today', 'لوحة اليوم'], ['report', 'تقرير الحضور']].map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={v === view} className={v === view ? 'on' : ''} onClick={() => setView(v)}>{l}</button>)}</div>
    </PageHead>
    <div className="stack" style={{ gap: 14 }}>
      {!classes.length ? <Empty text="لا فصول ضمن صلاحياتك." /> :
        view === 'today' ? <AttToday classes={classes} open={id => { setClassId(id); setDate(T); setView('take'); }} /> :
        view === 'report' ? <AttReport u={u} classes={classes} /> :
        <AttTake key={classId + date} u={u} classes={classes} classId={classId} setClassId={setClassId} date={date} setDate={setDate} />}
    </div>
  </>;
}
function AttTake({ u, classes, classId, setClassId, date, setDate }) {
  useData();
  const T = todayISO(); const editable = canEditAttendance(u, date);
  const sts = classStudents(classId);
  const existing = new Map((Idx().attByDate.get(date) || []).filter(r => r.classId === classId).map(r => [r.studentId, r]));
  const [state, setState] = useState(() => Object.fromEntries(sts.map(s => { const e = existing.get(s.id); return [s.id, { status: e ? e.status : 'present', reason: e ? e.reason || '' : '' }]; })));
  const get = id => state[id] || { status: 'present', reason: '' };
  const upd = (id, patch) => setState(st => ({ ...st, [id]: { ...get(id), ...patch } }));
  const holiday = !Settings.get().schoolDays.includes(dow(date));
  const counts = { present: 0, absent: 0, late: 0, excused: 0 }; sts.forEach(s => counts[get(s.id).status]++);
  const save = () => {
    const r = saveAttendance(classId, date, sts.map(s => ({ studentId: s.id, ...get(s.id) })));
    toast.success(`تم حفظ حضور ${nameOf.cls(classId)} ليوم ${fmtDate(date)}` + (r.absences ? ` · أُرسل ${fmtNum(r.absences)} إشعار غياب لأولياء الأمور` : ''));
  };
  return <>
    <div className="row">
      <Select id="att-class" label="الفصل" options={classes.map(c => [c.id, c.name])} value={classId} onChange={setClassId} />
      <input type="date" className="input sm" id="att-date" value={date} max={T} aria-label="التاريخ" onChange={e => setDate(e.target.value || T)} />
      {existing.size ? <Badge tone="info" plain>{'مسجّل مسبقًا · آخر تعديل ' + relTime([...existing.values()].map(r => r.updatedAt).sort().pop())}</Badge> : <Badge tone="warn" plain>لم يُسجَّل بعد</Badge>}
    </div>
    {holiday && <Banner tone="warn" ic="calendar">{DAYS[dow(date)] + ' يوم عطلة. اختر يومًا دراسيًا.'}</Banner>}
    {!editable && !holiday && <Banner tone="warn" ic="lock">عرض فقط: انتهت مهلة تعديل هذا اليوم للمدرسين. تواصل مع الإدارة للتعديل.</Banner>}
    {sts.length ? <Card flush><div>{sts.map(s => {
      const st = get(s.id); const a = studentAtt(s.id, addDays(T, -29), T);
      return <div className="att-row" key={s.id}>
        <div className="row" style={{ flexWrap: 'nowrap' }}><Avatar name={s.fullName} /><div style={{ minWidth: 0 }}><a href={'#student-' + s.id} className="nm">{s.fullName}</a><div className="small muted">{`حضور 30 يومًا: ${fmtPct(a.rate, 0)}`}{a.absent >= 3 && <span style={{ color: 'var(--red)' }}>{` · ${fmtNum(a.absent)} غياب`}</span>}</div></div></div>
        <div className="att-btns" role="radiogroup" aria-label={'حالة ' + s.fullName}>{Object.keys(ATT_LABEL).map(k => <button key={k} type="button" className={cx(st.status === k && 'on', k)} role="radio" aria-checked={st.status === k} disabled={!editable} onClick={() => upd(s.id, { status: k })}>{ATT_LABEL[k]}</button>)}</div>
        {st.status !== 'present' && <input className="input sm att-reason" id={'reason-' + s.id} placeholder="سبب الغياب أو التأخر (اختياري)" value={st.reason} disabled={!editable} onChange={e => upd(s.id, { reason: e.target.value })} />}
      </div>;
    })}</div></Card> : <Empty text="لا طلاب نشطين في هذا الفصل." />}
    {sts.length > 0 && <div className="savebar">
      <div className="row">{Object.entries(counts).map(([k, n]) => <Badge key={k} tone={ATT_CLS[k]}>{`${ATT_LABEL[k]}: ${fmtNum(n)}`}</Badge>)}</div>
      <div className="grow" />
      <button className="btn ghost" disabled={!editable} onClick={() => setState(Object.fromEntries(sts.map(s => [s.id, { status: 'present', reason: '' }])))}>الكل حاضر</button>
      <button className="btn primary" disabled={!editable || holiday} onClick={save}><Icon name="ok" size={16} />{existing.size ? 'حفظ التعديلات' : 'حفظ الحضور'}</button>
    </div>}
  </>;
}
function AttToday({ classes, open }) {
  const T = todayISO(); const recs = Idx().attByDate.get(T) || [];
  const rows = classes.map(c => { const r = recs.filter(x => x.classId === c.id); return { c, n: classStudents(c.id).length, s: attStats(r), done: r.length > 0 }; });
  const absents = recs.filter(r => r.status !== 'present' && classes.some(c => c.id === r.classId));
  return <div className="grid g-main">
    <Card title={'حالة التسجيل اليوم — ' + fmtDate(T)}><div className="list">{rows.map(x => <div className="li" key={x.c.id}><div className="bd"><b>{x.c.name}</b><span>{x.done ? `حضور ${fmtPct(x.s.rate, 0)} · ${fmtNum(x.s.absent)} غائب · ${fmtNum(x.s.late)} متأخر` : `${fmtNum(x.n)} طالبًا · لم يُسجَّل بعد`}</span></div>{x.done ? <Badge tone="ok">سُجّل</Badge> : <Badge tone="bad">لم يُسجَّل</Badge>}<button className="btn ghost xs" onClick={() => open(x.c.id)}>{x.done ? 'عرض' : 'تسجيل'}</button></div>)}</div></Card>
    <Card title="الغائبون والمتأخرون اليوم">{absents.length ? <div className="list">{absents.map(r => <div className="li" key={r.id}><Badge tone={ATT_CLS[r.status]}>{ATT_LABEL[r.status]}</Badge><div className="bd"><a href={'#student-' + r.studentId}><b>{nameOf.st(r.studentId)}</b></a><span>{nameOf.cls(r.classId) + (r.reason ? ' · ' + r.reason : '')}</span></div></div>)}</div> : <Empty text="لا غياب مسجّل اليوم." ic="ok" />}</Card>
  </div>;
}
function AttReport({ u, classes }) {
  const T = todayISO(); const [from, setFrom] = useState(addDays(T, -29)); const [to, setTo] = useState(T); const [cls, setCls] = useState('');
  const pool = cls ? classStudents(cls) : Scope.students(u).filter(s => s.status === 'active');
  const ids = new Set(pool.map(s => s.id));
  const rows = pool.map(s => ({ id: s.id, s, a: studentAtt(s.id, from, to) }));
  const tot = attStats(Repo.all('attendance').filter(r => r.date >= from && r.date <= to && ids.has(r.studentId)));
  return <Card><div className="stack" style={{ gap: 14 }}>
    <div className="row"><Select label="الفصل" options={[['', 'كل الفصول'], ...classes.map(c => [c.id, c.name])]} value={cls} onChange={setCls} />
      <label className="row small">من<input type="date" className="input sm" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label className="row small">إلى<input type="date" className="input sm" value={to} onChange={e => setTo(e.target.value)} /></label></div>
    <div className="kpis" style={{ marginBottom: 14 }}>
      <Kpi label="نسبة الحضور" value={fmtPct(tot.rate, 1)} ic="check" tone={tot.rate >= 92 ? 'ok' : 'warn'} />
      <Kpi label="أيام الغياب" value={fmtNum(tot.absent)} ic="user" tone="bad" />
      <Kpi label="التأخر" value={fmtNum(tot.late)} ic="clock" tone="warn" />
      <Kpi label="غياب بعذر" value={fmtNum(tot.excused)} ic="info" />
    </div>
    <DataTable id="att-rep" unit="طالب" exportName="attendance-report" rows={rows} defaultSort={3} defaultDir={-1} searchText={x => x.s.fullName} columns={[
      { label: 'الطالب', sort: x => x.s.fullName, render: x => <StudentLink s={x.s} />, csv: x => x.s.fullName },
      { label: 'الفصل', sort: x => nameOf.cls(x.s.classId), render: x => nameOf.cls(x.s.classId) },
      { label: 'نسبة الحضور', sort: x => x.a.rate, render: x => <PctCell p={x.a.rate} />, csv: x => fmtNum(x.a.rate, 1) },
      { label: 'غياب', desc: true, sort: x => x.a.absent, render: x => <b className="tabnum" style={{ color: x.a.absent ? 'var(--red)' : undefined }}>{fmtNum(x.a.absent)}</b>, csv: x => x.a.absent },
      { label: 'تأخر', desc: true, sort: x => x.a.late, render: x => fmtNum(x.a.late), csv: x => x.a.late },
      { label: 'بعذر', desc: true, sort: x => x.a.excused, render: x => fmtNum(x.a.excused), csv: x => x.a.excused },
      { label: 'أيام مسجّلة', sort: x => x.a.total, render: x => fmtNum(x.a.total), csv: x => x.a.total }
    ]} />
  </div></Card>;
}
function AttendanceFamily({ u }) {
  const kids = Scope.students(u); const [cur, setCur] = useState((kids[0] || {}).id); const T = todayISO();
  const st = Repo.get('students', cur);
  const head = <PageHead title="الحضور والغياب" sub={u.role === 'parent' ? 'سجل حضور أبنائك' : 'سجل حضورك'}><ChildPicker user={u} cur={cur} onPick={setCur} /></PageHead>;
  if (!st) return <>{head}<Empty text="لا يوجد طالب مرتبط بالحساب." /></>;
  const recs = (Idx().attByStudent.get(st.id) || []).slice().sort((a, b) => a.date < b.date ? 1 : -1);
  const a = studentAtt(st.id); const a30 = studentAtt(st.id, addDays(T, -29), T); const ds = recordedDates(); const bad = recs.filter(r => r.status !== 'present');
  return <>{head}<div className="stack" style={{ gap: 14 }}>
    <div className="kpis">
      <Kpi label="الحضور (30 يومًا)" value={fmtPct(a30.rate, 1)} ic="check" tone={a30.rate >= 92 ? 'ok' : a30.rate >= 85 ? 'warn' : 'bad'} />
      <Kpi label="أيام الغياب" value={fmtNum(a.absent)} ic="user" tone={a.absent ? 'bad' : 'ok'} sub="منذ بداية الفصل" />
      <Kpi label="التأخر" value={fmtNum(a.late)} ic="clock" tone={a.late ? 'warn' : 'ok'} />
      <Kpi label="غياب بعذر" value={fmtNum(a.excused)} ic="info" />
    </div>
    <div className="grid g2"><Card title="تقويم الحضور"><AttCalendar recs={recs} from={ds[0] || addDays(T, -35)} to={T} /></Card>
      <Card title="السجل">{bad.length ? <div className="list">{bad.map(r => <div className="li" key={r.id}><Badge tone={ATT_CLS[r.status]}>{ATT_LABEL[r.status]}</Badge><div className="bd"><b>{DAYS[dow(r.date)] + ' ' + fmtDate(r.date)}</b><span>{r.reason || '—'}</span></div></div>)}</div> : <Empty text="لا غياب ولا تأخر. التزام ممتاز." ic="ok" />}</Card></div>
  </div></>;
}

/* ======================= Grades ======================= */
export function Grades({ user: u }) {
  if (u.role === 'student' || u.role === 'parent') return <GradesFamily u={u} />;
  return <GradesStaff u={u} />;
}
function GradesStaff({ u }) {
  const classes = Scope.classes(u).filter(c => u.role === 'admin' || Scope.assignments(u).some(a => a.classId === c.id));
  const [sel, setSel] = useState(() => {
    const pre = Store.ss.get('ass:gradeSel'); Store.ss.del('ass:gradeSel');
    if (pre) { const [c, s] = pre.split('|'); if (classes.some(x => x.id === c)) return { classId: c, subjectId: s }; }
    return { classId: (classes[0] || {}).id, subjectId: null };
  });
  if (!classes.length) return <><PageHead title="الدرجات" /><Empty text="لا توجد مواد مسندة إليك." /></>;
  const { classId } = sel; const subs = Scope.subjectsFor(u, classId);
  const subjectId = subs.some(s => s.id === sel.subjectId) ? sel.subjectId : (subs[0] || {}).id;
  const canEdit = Scope.teaches(u, classId, subjectId);
  return <>
    <PageHead title="الدرجات" sub="إدخال الدرجات بأوزان مرنة، مع حساب النسبة والتقدير والترتيب تلقائيًا">
      <Select label="الفصل" options={classes.map(c => [c.id, c.name])} value={classId} onChange={v => setSel({ classId: v, subjectId: null })} />
      <Select label="المادة" options={subs.map(s => [s.id, s.name])} value={subjectId} onChange={v => setSel({ classId, subjectId: v })} />
      {canEdit && <button className="btn primary" onClick={() => assessmentForm(classId, subjectId, null)}><Icon name="plus" size={16} />تقييم جديد</button>}
    </PageHead>
    <GradeGrid key={classId + '|' + subjectId} u={u} classId={classId} subjectId={subjectId} canEdit={canEdit} />
  </>;
}
function GradeGrid({ u, classId, subjectId, canEdit }) {
  const subj = Repo.get('subjects', subjectId); const [saved, setSaved] = useState('');
  const tbody = useRef(null);
  if (!subj) return <Empty text="اختر مادة." />;
  const as = assessmentsFor(classId, subjectId); const sts = classStudents(classId);
  const ranks = rankMap(sts.map(s => ({ id: s.id, val: subjectResult(s, subjectId).percent })));
  const locked = as.some(a => (Idx().gradesByAssess.get(a.id) || []).some(g => g.isLocked));
  const move = (r, c) => { const t = tbody.current && tbody.current.querySelector(`input[data-r="${r}"][data-c="${c}"]`); if (t) { t.focus(); t.select(); return true; } return false; };
  return <div className="stack" style={{ gap: 14 }}>
    {!canEdit && <Banner ic="eye">عرض فقط: هذه المادة غير مسندة إليك في هذا الفصل.</Banner>}
    {locked && <Banner tone="warn" ic="lock">بعض الدرجات مقفلة لأن الشهادات صدرت. {u.role === 'admin' ? <a href="#" onClick={e => { e.preventDefault(); unlockGrades(classId, subjectId); }}>فك القفل لهذه المادة</a> : 'التعديل متاح للإدارة فقط.'}</Banner>}
    <GradeStats classId={classId} subjectId={subjectId} />
    {as.length ? <Card title={`${subj.name} — ${nameOf.cls(classId)}`}><div className="stack">
      <div className="row between small muted"><span>Enter أو السهم للأسفل للانتقال للطالب التالي. يُحفظ كل إدخال تلقائيًا. النسبة = مجموع (الدرجة ÷ الحد الأعلى × الوزن) ÷ مجموع الأوزان.</span><span className="save-ind" aria-live="polite">{saved && <><Icon name="ok" size={14} />{saved}</>}</span></div>
      <div className="tbl-wrap"><table className="tbl gtbl">
        <thead><tr><th>الطالب</th>{as.map(a => <th key={a.id}><div className="ah"><span>{a.name}</span><small>{`${EXAM_LABEL[a.type]} · من ${fmtNum(a.maxScore)} · وزن ${fmtNum(a.weight)}`}</small><div className="row" style={{ gap: 2, justifyContent: 'center' }}>{a.isPublished ? <Badge tone="ok" plain>منشور</Badge> : <Badge tone="warn" plain>مسودة</Badge>}{canEdit && <button className="icon-btn sm" aria-label={'خيارات ' + a.name} title="خيارات" onClick={() => assessmentMenu(a, u)}><Icon name="sliders" size={14} /></button>}</div></div></th>)}<th>النسبة</th><th>التقدير</th><th>الترتيب</th></tr></thead>
        <tbody ref={tbody}>{sts.map((s, si) => { const r = subjectResult(s, subjectId).percent; return <tr key={s.id}>
          <td><a href={'#student-' + s.id}>{s.fullName}</a></td>
          {as.map((a, ai) => <td key={a.id}><GradeCell a={a} s={s} si={si} ai={ai} u={u} canEdit={canEdit} move={move} onSaved={() => setSaved('حُفظ تلقائيًا ' + fmtTime(new Date().toISOString()))} /></td>)}
          <td>{r == null ? '—' : <PctCell p={r} tone={r < passOf(subj) ? 'bad' : r >= 80 ? 'ok' : ''} />}</td>
          <td><Badge tone={gradeTone(r)} plain>{gradeLabel(r)}</Badge></td>
          <td className="tabnum">{ranks.get(s.id) ? fmtNum(ranks.get(s.id)) : '—'}</td>
        </tr>; })}</tbody>
      </table></div>
    </div></Card> : <Empty text="لا تقييمات لهذه المادة بعد." action={canEdit ? <button className="btn primary" onClick={() => assessmentForm(classId, subjectId, null)}>إنشاء أول تقييم</button> : null} ic="pen" />}
  </div>;
}
function GradeCell({ a, s, si, ai, u, canEdit, move, onSaved }) {
  const g = gradeOf(a.id, s.id); const stored = hasScore(g) ? String(g.score) : '';
  const isLocked = g && g.isLocked && u.role !== 'admin';
  const [val, setVal] = useState(stored); const [cls, setCls] = useState(''); const focused = useRef(false);
  useEffect(() => { if (!focused.current) setVal(stored); }, [stored]);
  function commit() {
    const v = String(val).trim(); if (v === stored) return;
    if (v !== '' && (isNaN(v) || Number(v) < 0 || Number(v) > a.maxScore)) { setCls('invalid'); toast.error(`الدرجة يجب أن تكون بين 0 و${fmtNum(a.maxScore)}`); return; }
    const r = setGrade(a, s.id, v);
    if (r === 'locked') { toast.error('هذه الدرجة مقفلة بعد إصدار الشهادة.'); setVal(stored); return; }
    if (r === 'ok') { setCls('saved'); onSaved(); }
  }
  return <>
    <input type="number" step="0.5" min={0} max={a.maxScore} inputMode="decimal" className={cls} value={val} disabled={!canEdit || isLocked} aria-label={`${s.fullName} — ${a.name}`} data-r={si} data-c={ai} title={isLocked ? 'مقفلة بعد إصدار الشهادة' : ''}
      onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; commit(); }} onChange={e => { setVal(e.target.value); setCls(''); }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); if (!move(si + 1, ai)) e.currentTarget.blur(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); move(si - 1, ai); }
        else if (e.key === 'ArrowLeft' && e.altKey) { e.preventDefault(); move(si, ai + 1); } else if (e.key === 'ArrowRight' && e.altKey) { e.preventDefault(); move(si, ai - 1); }
      }} />
    {isLocked && <span className="muted" title="مقفلة"> <Icon name="lock" size={12} /></span>}
  </>;
}
function GradeStats({ classId, subjectId }) {
  const subj = Repo.get('subjects', subjectId); const ps = classStudents(classId).map(s => subjectResult(s, subjectId).percent).filter(v => v != null);
  if (!ps.length) return null;
  const pass = ps.filter(p => p >= passOf(subj)).length; const av = avg(ps);
  const edges = [0, 50, 60, 70, 80, 90];
  const bins = edges.map((lo, i) => ({ label: i === 0 ? '<50' : `${lo}–${(edges[i + 1] || 101) - 1}`, value: ps.filter(p => p >= lo && p < (edges[i + 1] || 101)).length }));
  return <div className="grid g-main">
    <div className="kpis" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
      <Kpi label="متوسط الفصل" value={fmtPct(av, 1)} ic="chart" tone={gradeTone(av)} />
      <Kpi label="نسبة النجاح" value={fmtPct(pass / ps.length * 100, 0)} ic="award" tone={pass / ps.length >= .85 ? 'ok' : 'warn'} sub={`${fmtNum(pass)} من ${fmtNum(ps.length)}`} />
      <Kpi label="أعلى نسبة" value={fmtPct(Math.max(...ps), 1)} ic="up" tone="ok" />
      <Kpi label="أدنى نسبة" value={fmtPct(Math.min(...ps), 1)} ic="down" tone={Math.min(...ps) < 50 ? 'bad' : ''} />
    </div>
    <Card title="توزيع النسب"><BarChart labels={bins.map(b => b.label)} series={[{ name: 'عدد الطلاب', values: bins.map(b => b.value), color: 'var(--c1)' }]} height={200} fmt={v => fmtNum(v)} showVals /></Card>
  </div>;
}
function assessmentForm(classId, subjectId, a) {
  const W = Settings.get().weights;
  formModal({
    title: a ? 'تعديل التقييم' : 'تقييم جديد — ' + nameOf.subj(subjectId), values: a || { type: 'monthly', maxScore: 20, weight: W.monthly, date: todayISO() },
    onFieldChange: (name, v) => (name === 'type' && !a && W[v] != null ? { weight: W[v] } : null),
    fields: [
      { name: 'name', label: 'اسم التقييم', required: true, span: true, placeholder: 'مثال: اختبار شهري 3' },
      { name: 'type', label: 'النوع', type: 'select', required: true, options: Object.entries(EXAM_LABEL), hint: 'الوزن الافتراضي حسب الإعدادات: ' + Object.entries(W).map(([k, v]) => EXAM_LABEL[k] + ' ' + v).join('، ') },
      { name: 'date', label: 'التاريخ', type: 'date', required: true },
      { name: 'maxScore', label: 'الدرجة القصوى', type: 'number', min: 1, max: 100, required: true },
      { name: 'weight', label: 'الوزن', type: 'number', min: 1, max: 100, required: true, hint: 'يُترك كما هو أو يُعدّل لهذا التقييم فقط' }
    ],
    onSubmit: v => {
      if (a) { const maxG = Math.max(0, ...(Idx().gradesByAssess.get(a.id) || []).filter(hasScore).map(g => g.score)); if (v.maxScore < maxG) return 'توجد درجة مدخلة أعلى من الدرجة القصوى الجديدة.'; Repo.update('assessments', a.id, v); }
      else Repo.create('assessments', { ...v, classId, subjectId, term: Settings.get().term, isPublished: false });
      toast.success(a ? 'تم تعديل التقييم' : 'أُضيف التقييم كمسودة. أدخل الدرجات ثم انشره.');
    }
  });
}
function assessmentMenu(a, u) {
  const n = (Idx().gradesByAssess.get(a.id) || []).filter(hasScore).length; const total = classStudents(a.classId).length;
  openModal({ title: a.name, size: 'sm', render: ({ close }) => <>
    <ModalBody><div className="stack"><KV pairs={[['المادة', nameOf.subj(a.subjectId)], ['الفصل', nameOf.cls(a.classId)], ['النوع', EXAM_LABEL[a.type]], ['التاريخ', fmtDate(a.date)], ['الدرجات المدخلة', `${fmtNum(n)} من ${fmtNum(total)}`], ['الحالة', a.isPublished ? 'منشور للطلاب وأولياء الأمور' : 'مسودة (غير مرئي للطلاب)']]} />
      {n < total && !a.isPublished && <Banner tone="warn" ic="alert">لم تُدخل كل الدرجات بعد. يمكنك النشر وسيرى الطلاب الدرجات المدخلة فقط.</Banner>}</div></ModalBody>
    <ModalFoot>
      {a.isPublished ? <button className="btn" onClick={() => { Repo.update('assessments', a.id, { isPublished: false }); close(); toast.info('أُلغي نشر التقييم'); }}>إلغاء النشر</button>
        : <button className="btn success" disabled={!n} onClick={() => { const r = publishAssessment(a); close(); toast.success(`نُشر التقييم وأُرسل ${fmtNum(r.notified)} إشعارًا` + (r.alerts ? ` · ${fmtNum(r.alerts)} تنبيه انخفاض لأولياء الأمور` : '')); }}><Icon name="send" size={15} />نشر الدرجات</button>}
      <button className="btn" onClick={() => { close(); assessmentForm(a.classId, a.subjectId, a); }}><Icon name="edit" size={15} />تعديل</button>
      <button className="btn ghost" style={{ color: 'var(--red)' }} onClick={async () => {
        close();
        if (!(await confirmDialog({ title: 'حذف التقييم', message: `حذف «${a.name}»${n ? ` مع ${fmtNum(n)} درجة مدخلة` : ''}؟`, ok: 'حذف', danger: true }))) return;
        const gs = (Idx().gradesByAssess.get(a.id) || []).slice();
        if (gs.some(g => g.isLocked) && u.role !== 'admin') { toast.error('لا يمكن حذف تقييم بدرجات مقفلة.'); return; }
        Repo.remove('assessments', a.id); gs.forEach(g => Repo.remove('grades', g.id, { audit: false })); toast.success('تم حذف التقييم');
      }}><Icon name="trash" size={15} />حذف</button>
    </ModalFoot>
  </> });
}
async function unlockGrades(classId, subjectId) {
  if (!(await confirmDialog({ title: 'فك قفل الدرجات', message: `فك قفل درجات ${nameOf.subj(subjectId)} في ${nameOf.cls(classId)}؟ يُسجَّل هذا الإجراء في سجل النشاط، ويجب إعادة إصدار الشهادات بعد التعديل.`, ok: 'فك القفل' }))) return;
  assessmentsFor(classId, subjectId).forEach(a => (Idx().gradesByAssess.get(a.id) || []).slice().forEach(g => { if (g.isLocked) Repo.update('grades', g.id, { isLocked: false }, { audit: false }); }));
  Audit.log('update', 'grades', classId, { locked: true }, { locked: false, subjectId }); toast.success('تم فك القفل');
}
function GradesFamily({ u }) {
  const kids = Scope.students(u); const [cur, setCur] = useState((kids[0] || {}).id);
  const st = Repo.get('students', cur);
  const head = <PageHead title="الدرجات" sub={u.role === 'parent' ? 'درجات أبنائك المنشورة' : 'درجاتك المنشورة'}><ChildPicker user={u} cur={cur} onPick={setCur} /></PageHead>;
  if (!st) return <>{head}<Empty text="لا يوجد طالب مرتبط بالحساب." /></>;
  const res = studentResults(st, { publishedOnly: true }); const ser = gradeSeries(st);
  const rank = classRanking(st.classId, { publishedOnly: true }).get(st.id);
  const as = assessmentsFor(st.classId, null, { publishedOnly: true });
  return <>{head}<div className="stack" style={{ gap: 14 }}>
    <div className="kpis">
      <Kpi label="المعدل" value={fmtPct(res.avg, 1)} ic="award" tone={gradeTone(res.avg)} sub={gradeLabel(res.avg)} />
      <Kpi label="الترتيب في الفصل" value={rank ? fmtNum(rank) : '—'} ic="chart" sub={'من ' + fmtNum(classStudents(st.classId).length)} />
      <Kpi label="المواد" value={fmtNum(res.rows.length)} ic="book" tone={res.failing ? 'bad' : 'ok'} sub={res.failing ? `${fmtNum(res.failing)} تحت خط النجاح` : 'كلها ناجحة'} />
      <Kpi label="النتيجة المتوقعة" value={res.result ? RESULT_LABEL[res.result][0] : '—'} ic="pen" tone={res.result ? RESULT_LABEL[res.result][1] : ''} />
    </div>
    <div className="grid g2">
      <Card title="النتائج حسب المادة" flush>{res.rows.length ? <div className="tbl-wrap" style={{ border: 0 }}><table className="tbl"><thead><tr>{['المادة', 'النسبة', 'التقدير'].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{res.rows.map(r => <tr key={r.subject.id}><td><span className="row" style={{ gap: 8 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: r.subject.color, display: 'inline-block' }} />{r.subject.name}</span></td><td><PctCell p={r.percent} tone={r.percent < passOf(r.subject) ? 'bad' : r.percent >= 80 ? 'ok' : ''} /></td><td><Badge tone={gradeTone(r.percent)} plain>{gradeLabel(r.percent)}</Badge></td></tr>)}</tbody></table></div> : <Empty text="لا درجات منشورة بعد." />}</Card>
      <Card title="تطور المستوى">{ser.length >= 2 ? <LineChart labels={ser.map(x => fmtDateShort(x.date))} series={[{ name: 'المتوسط', values: ser.map(x => x.p), color: 'var(--c1)' }]} min={0} max={100} fmt={v => fmtNum(v) + '%'} tip={v => fmtPct(v, 1)} /> : <Empty text="بيانات غير كافية." />}</Card>
    </div>
    <Card title="كل التقييمات المنشورة" flush>{as.length ? <div className="tbl-wrap" style={{ border: 0 }}><table className="tbl cards"><thead><tr>{['التاريخ', 'المادة', 'التقييم', 'النوع', 'الدرجة', 'النسبة'].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>
      {as.slice().reverse().map(a => { const g = gradeOf(a.id, st.id); const p = hasScore(g) ? g.score / a.maxScore * 100 : null; return <tr key={a.id}><td data-label="التاريخ">{fmtDate(a.date)}</td><td data-label="المادة">{nameOf.subj(a.subjectId)}</td><td data-label="التقييم">{a.name}</td><td data-label="النوع">{EXAM_LABEL[a.type]}</td><td data-label="الدرجة" className="tabnum">{hasScore(g) ? `${fmtNum(g.score, g.score % 1 ? 1 : 0)} / ${fmtNum(a.maxScore)}` : '—'}</td><td data-label="النسبة">{p == null ? '—' : <Badge tone={gradeTone(p)} plain>{fmtPct(p)}</Badge>}</td></tr>; })}
    </tbody></table></div> : <Empty text="لا تقييمات منشورة بعد." />}</Card>
  </div></>;
}

/* ======================= Certificates ======================= */
export function Certificates({ user: u }) {
  const head = sub => <PageHead title="الشهادات" sub={sub}><button className="btn ghost" onClick={() => go('verify')}><Icon name="qr" size={16} />التحقق من شهادة</button></PageHead>;
  if (u.role === 'student' || u.role === 'parent') {
    return <>{head('الشهادات الصادرة وكشف الدرجات المؤقت')}{Scope.students(u).map(st => { const cs = Repo.where('certificates', c => c.studentId === st.id); return <Card key={st.id} title={st.fullName + ' — ' + nameOf.cls(st.classId)}>
      {cs.length ? <div className="list">{cs.map(c => <div className="li" key={c.id}><Icon name="award" size={22} /><div className="bd"><b>{`${Settings.get().termName} ${(Repo.get('academicYears', c.academicYearId) || {}).name || ''} · ${fmtPct(c.percentage, 1)} — ${c.gradeLabel}`}</b><span className="ltr">{c.certNo}</span></div><Badge tone={RESULT_LABEL[c.result][1]}>{RESULT_LABEL[c.result][0]}</Badge><button className="btn primary sm" onClick={() => showCertificate(c)}>عرض الشهادة</button></div>)}</div>
        : <Empty text="لم تصدر الشهادة الرسمية بعد. يمكنك عرض كشف الدرجات المؤقت." action={<button className="btn sm" onClick={() => showProvisional(st)}>عرض الكشف المؤقت</button>} ic="award" />}
    </Card>; })}</>;
  }
  return <>{head('نتائج الفصل الدراسي وإصدار الشهادات الموثّقة برقم فريد ورمز تحقق')}<CertsStaff u={u} /></>;
}
function CertsStaff({ u }) {
  const classes = Scope.classes(u); const [classId, setClassId] = useState((classes[0] || {}).id);
  if (!classes.length) return <Empty text="لا توجد فصول ضمن صلاحياتك." />;
  const sts = classStudents(classId); const ranks = classRanking(classId, { publishedOnly: true }); const year = activeYear(); const S = Settings.get();
  const certs = new Map(Repo.where('certificates', c => c.academicYearId === year.id && c.term === S.term).map(c => [c.studentId, c]));
  const issued = sts.filter(s => certs.has(s.id)).length;
  const pending = Repo.all('assessments').filter(a => a.classId === classId && !a.isPublished).length;
  const R = s => studentResults(s, { publishedOnly: true });
  async function issue() {
    if (!(await confirmDialog({ title: 'إصدار شهادات ' + nameOf.cls(classId), message: `ستُحسب النتائج من التقييمات المنشورة فقط، وتُقفل درجات الفصل بعد الإصدار، ويُشعَر الطلاب وأولياء الأمور.${pending ? ` تنبيه: يوجد ${fmtNum(pending)} تقييم غير منشور لن يُحتسب.` : ''}`, ok: issued ? 'إعادة الإصدار' : 'إصدار الشهادات' }))) return;
    const r = issueCertificates(classId); toast.success(`صدرت ${fmtNum(r.made)} شهادة جديدة` + (r.updated ? ` وحُدّثت ${fmtNum(r.updated)}` : ''));
  }
  return <div className="stack" style={{ gap: 14 }}>
    <div className="row"><Select label="الفصل" options={classes.map(c => [c.id, c.name])} value={classId} onChange={setClassId} /><Badge tone={issued === sts.length && sts.length ? 'ok' : 'warn'} plain>{`صدر ${fmtNum(issued)} من ${fmtNum(sts.length)}`}</Badge><div className="grow" />
      {isAdmin(u) && <button className="btn primary" onClick={issue}><Icon name="award" size={16} />{issued ? 'إعادة إصدار الشهادات' : 'إصدار شهادات الفصل'}</button>}</div>
    {pending > 0 && <Banner tone="warn" ic="alert">{`يوجد ${fmtNum(pending)} تقييم غير منشور في هذا الفصل ولن يدخل في حساب الشهادة.`}</Banner>}
    <Card><DataTable key={classId} id="certs" unit="طالب" rows={sts} defaultSort={2} exportName={'results-' + nameOf.cls(classId)} columns={[
      { label: 'الطالب', sort: s => s.fullName, render: s => <StudentLink s={s} />, csv: s => s.fullName },
      { label: 'المعدل', desc: true, sort: s => R(s).avg, render: s => <PctCell p={R(s).avg} />, csv: s => fmtNum(R(s).avg, 1) },
      { label: 'الترتيب', sort: s => ranks.get(s.id) ?? 999, render: s => <b className="tabnum">{ranks.get(s.id) ? fmtNum(ranks.get(s.id)) : '—'}</b>, csv: s => ranks.get(s.id) || '' },
      { label: 'التقدير', sortable: false, render: s => { const a = R(s).avg; return <Badge tone={gradeTone(a)} plain>{gradeLabel(a)}</Badge>; }, csv: s => gradeLabel(R(s).avg) },
      { label: 'النتيجة', sort: s => R(s).result, render: s => { const r = R(s); return r.result ? <Badge tone={RESULT_LABEL[r.result][1]}>{RESULT_LABEL[r.result][0] + (r.failing ? ` (${fmtNum(r.failing)})` : '')}</Badge> : '—'; }, csv: s => (RESULT_LABEL[R(s).result] || [''])[0] },
      { label: 'الشهادة', sortable: false, render: s => { const c = certs.get(s.id); return c ? <span className="ltr small">{c.certNo}</span> : <span className="muted small">لم تصدر</span>; }, csv: s => (certs.get(s.id) || {}).certNo || '' },
      { label: '', sortable: false, cls: 'acts', csv: false, render: s => { const c = certs.get(s.id); return c ? <button className="btn sm" onClick={() => showCertificate(c)}>عرض</button> : <button className="btn ghost sm" onClick={() => showProvisional(s)}>معاينة</button>; } }
    ]} /></Card>
  </div>;
}
function CertificateView({ st, data, provisional }) {
  const S = Settings.get(); const year = Repo.get('academicYears', data.academicYearId) || activeYear();
  const fail = data.subjects.filter(x => x.score < x.pass).length;
  const qrText = provisional ? null : `${String(S.schoolNameEn).toUpperCase()} | CERT ${data.certNo} | VERIFY ${data.verifyCode}`;
  return <div className="cert"><div className="cert-in">
    <div className="cert-head"><div className="row" style={{ gap: 12 }}><div className="crest lg" style={{ boxShadow: 'inset 0 0 0 1px #d7dceb' }}><i /><i /><i /></div><div><div className="sch">{S.schoolName}</div><div className="en">{String(S.schoolNameEn).toUpperCase()}</div><div style={{ fontSize: 12, color: '#5a6680' }}>{S.address}</div></div></div>
      <div className="meta"><div>{'العام الدراسي ' + (year.name || S.academicYear)}</div><div>{S.termName}</div>{provisional ? <div>{'تاريخ الطباعة ' + fmtDate(todayISO())}</div> : <div>رقم الشهادة <b className="ltr" style={{ color: '#14203a' }}>{data.certNo}</b></div>}</div></div>
    <div className={cx('cert-title', provisional && 'prov')}>{provisional ? 'كشف درجات مؤقت' : (data.result === 'pass' ? 'شهادة نجاح' : 'شهادة نتائج الفصل')}</div>
    <div className="cert-sub">{provisional ? 'غير رسمي — للاطلاع فقط، ويُحتسب من التقييمات المنشورة حتى تاريخه' : 'تشهد إدارة المدرسة بأن الطالب المذكور أدناه قد حصل على النتائج التالية'}</div>
    <div className="cert-stripes"><i style={{ background: '#c42b2b' }} /><i style={{ background: '#13803b' }} /><i style={{ background: '#1f4fd8' }} /></div>
    <div className="cert-info">{[['اسم الطالب', st.fullName], ['الصف', gradeName(st.gradeLevel)], ['الفصل', nameOf.cls(data.classId || st.classId)], ['الرقم المدرسي', <span className="ltr">{st.studentNo}</span>], ['تاريخ الميلاد', fmtDate(st.birthDate)], ['اسم الأم', st.motherName || '—']].map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
    <table><thead><tr>{['المادة', 'الدرجة النهائية', 'درجة النجاح', 'الدرجة', 'التقدير'].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{data.subjects.map((x, i) => <tr key={i}><td>{x.name}</td><td>{fmtNum(x.max)}</td><td>{fmtNum(x.pass)}</td><td className={x.score < x.pass ? 'fail-mark' : ''}>{fmtNum(x.score, 1)}</td><td>{x.gradeLabel}</td></tr>)}</tbody></table>
    <div className="cert-sum">{[['المجموع', `${fmtNum(data.total, 1)} / ${fmtNum(data.maxTotal)}`], ['النسبة', fmtPct(data.percentage, 1)], ['التقدير', data.gradeLabel], ['الترتيب', data.rank ? `${fmtNum(data.rank)} من ${fmtNum(data.classSize)}` : '—']].map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
    <div style={{ textAlign: 'center', fontWeight: 600, color: data.result === 'pass' ? '#13803b' : data.result === 'fail' ? '#c42b2b' : '#a35a05' }}>{'النتيجة: ' + RESULT_LABEL[data.result][0] + (fail ? ` — ${fmtNum(fail)} ${fail === 1 ? 'مادة' : 'مواد'} تحت خط النجاح` : '')}</div>
    <div className="cert-foot">
      {provisional ? <div className="cert-qr">هذا الكشف لا يُعتمد رسميًا.</div> : <div className="cert-qr"><QRCode text={qrText} size={92} /><div>للتحقق من صحة الشهادة أدخل الرمز<br /><b>{data.verifyCode}</b><br />في صفحة «التحقق من شهادة»<br />{'تاريخ الإصدار ' + fmtDate(data.issueDate)}</div></div>}
      {!provisional && <div className="stamp">{S.schoolName}<br />{year.name || ''}</div>}
      <div className="cert-sign">مدير المدرسة<div className="ln">{S.principalName}</div></div>
    </div>
  </div></div>;
}
function CertModal({ st, data, provisional, close, verifyCode }) {
  const ref = useRef(null);
  return <><ModalBody><div style={{ background: 'var(--sunken)', padding: 12, borderRadius: 12, overflowX: 'auto' }} ref={ref}><CertificateView st={st} data={data} provisional={provisional} /></div></ModalBody>
    <ModalFoot><PrintButton target={() => ref.current && ref.current.firstChild} what={provisional ? 'transcript' : 'certificate'} label={provisional ? 'طباعة' : 'طباعة / حفظ PDF'} />
      {verifyCode && <button className="btn" onClick={() => copyText(verifyCode, 'نُسخ رمز التحقق ' + verifyCode)}><Icon name="copy" size={15} />نسخ رمز التحقق</button>}
      <button className="btn ghost" onClick={close}>إغلاق</button></ModalFoot></>;
}
export function showCertificate(c) {
  const st = Repo.get('students', c.studentId); if (!st) return;
  openModal({ title: 'شهادة ' + st.fullName, size: 'xl', render: ({ close }) => <CertModal st={st} data={c} close={close} verifyCode={c.verifyCode} /> });
}
export function showProvisional(st) {
  const r = studentResults(st, { publishedOnly: true });
  if (!r.rows.length) { toast.info('لا توجد درجات منشورة بعد.'); return; }
  const data = { academicYearId: activeYear().id, classId: st.classId, subjects: r.rows.map(x => ({ name: x.subject.name, score: Math.round(x.percent * 10) / 10, max: 100, pass: passOf(x.subject), gradeLabel: gradeLabel(x.percent) })), total: sum(r.rows.map(x => x.percent)), maxTotal: r.rows.length * 100, percentage: r.avg, gradeLabel: gradeLabel(r.avg), rank: classRanking(st.classId, { publishedOnly: true }).get(st.id), classSize: classStudents(st.classId).length, result: r.result };
  openModal({ title: 'كشف درجات مؤقت — ' + st.fullName, size: 'xl', render: ({ close }) => <CertModal st={st} data={data} provisional close={close} /> });
}
