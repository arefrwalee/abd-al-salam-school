import { DAYS, TOP, addDays, avg, clamp, dow, fmtDate, fmtMoney, fmtNum, fmtPct, groupBy, randCode, std, sum, todayISO } from './utils.js';
import { Audit, Repo, Settings, memo } from './store.js';
import { Auth } from './auth.js';
import { Scope } from './permissions.js';

/* =====================================================================
   Domain — قواعد العمل والخدمات ومحرك الذكاء
   ===================================================================== */
const ATT_LABEL = { present: 'حاضر', absent: 'غائب', late: 'متأخر', excused: 'غياب بعذر' };
const ATT_CLS = { present: 'ok', absent: 'bad', late: 'warn', excused: 'info' };
const STATUS_LABEL = { active: 'نشط', suspended: 'متوقف', transferred: 'منقول', graduated: 'متخرج' };
const STATUS_CLS = { active: 'ok', suspended: 'bad', transferred: '', graduated: 'info' };
const T_STATUS = { active: ['على رأس عمله', 'ok'], onLeave: ['في إجازة', 'warn'], inactive: ['غير فعّال', ''] };
const EXAM_LABEL = { monthly: 'اختبار شهري', midterm: 'منتصف الفصل', final: 'اختبار نهائي', homework: 'واجبات', activity: 'نشاط', participation: 'مشاركة' };
const FEE_LABEL = { registration: 'رسوم التسجيل', tuition: 'الرسوم الدراسية', transport: 'النقل', books: 'الكتب', activities: 'النشاطات', other: 'رسوم أخرى' };
const PAY_STATUS = { paid: ['مدفوع', 'ok'], partial: ['مدفوع جزئيًا', 'warn'], unpaid: ['غير مدفوع', ''], overdue: ['متأخر السداد', 'bad'] };
const METHOD_LABEL = { cash: 'نقدًا', bank: 'تحويل مصرفي', card: 'بطاقة', other: 'أخرى' };
const EXP_LABEL = { salaries: 'الرواتب', maintenance: 'الصيانة', utilities: 'الكهرباء والماء', supplies: 'المستلزمات', transport: 'النقل', other: 'أخرى' };
const EXP_COLOR = { salaries: 'var(--c1)', maintenance: 'var(--c4)', utilities: 'var(--c3)', supplies: 'var(--c2)', transport: 'var(--violet)', other: 'var(--c5)' };
const NOTIF_LABEL = { absence: 'غياب', grades: 'درجات', payment: 'دفع', meeting: 'اجتماع', announcement: 'إعلان', general: 'عام', smart: 'تنبيه ذكي' };
const NOTIF_ICON = { absence: ['user', 'bad'], grades: ['pen', 'info'], payment: ['wallet', 'ok'], meeting: ['calendar', 'warn'], announcement: ['bell', 'info'], general: ['info', ''], smart: ['sparkles', 'warn'] };
const RESULT_LABEL = { pass: ['ناجح', 'ok'], retake: ['إكمال', 'warn'], fail: ['راسب', 'bad'] };
const RISK_LABEL = { high: ['خطر مرتفع', 'bad'], medium: ['يحتاج متابعة', 'warn'], low: ['مستقر', 'ok'] };
const ACTION_LABEL = { create: 'إنشاء', update: 'تعديل', delete: 'حذف', login: 'تسجيل دخول', logout: 'تسجيل خروج', export: 'تصدير', print: 'طباعة', restore: 'استعادة', lock: 'قفل حساب', import: 'استيراد' };
const ENTITY_LABEL = { users: 'المستخدمون', students: 'الطلاب', parents: 'أولياء الأمور', teachers: 'المدرسون', classes: 'الفصول', subjects: 'المواد', teachingAssignments: 'الإسناد', schedules: 'الجدول', attendance: 'الحضور', assessments: 'التقييمات', grades: 'الدرجات', certificates: 'الشهادات', fees: 'الرسوم', payments: 'المدفوعات', expenses: 'المصروفات', notifications: 'الإشعارات', settings: 'الإعدادات', system: 'النظام', academicYears: 'الأعوام الدراسية', periods: 'الحصص' };

/* ---------- Lookups ---------- */
const nameOf = {
  cls: id => (Repo.get('classes', id) || {}).name || '—',
  subj: id => (Repo.get('subjects', id) || {}).name || '—',
  tch: id => (Repo.get('teachers', id) || {}).fullName || '—',
  st: id => (Repo.get('students', id) || {}).fullName || '—',
  user: id => { const u = Repo.get('users', id) || Repo.raw('users').find(x => x.id === id); if (!u) return 'النظام'; return displayName(u); }
};
function displayName(u) {
  if (!u) return '—';
  if (u.role === 'admin') return (u.prefs && u.prefs.displayName) || (u.username === 'admin' ? Settings.get().principalName : u.username);
  const map = { teacher: 'teachers', student: 'students', parent: 'parents' };
  const p = Repo.get(map[u.role], u.linkedId); return p ? p.fullName : u.username;
}
const activeYear = () => Repo.all('academicYears').find(y => y.isActive) || Repo.all('academicYears')[0] || { id: null, name: Settings.get().academicYear };
const periodsSorted = () => Repo.all('periods').sort((a, b) => a.order - b.order);

/* ---------- Indexes ---------- */
function Idx() {
  return memo('idx', () => {
    const m = (arr, k) => groupBy(arr, r => r[k]);
    const att = Repo.all('attendance'), grades = Repo.all('grades');
    const users = Repo.all('users');
    return {
      attByStudent: m(att, 'studentId'), attByDate: m(att, 'date'),
      gradesByAssess: m(grades, 'assessmentId'),
      gradeKey: new Map(grades.map(g => [g.assessmentId + '|' + g.studentId, g])),
      assessByClass: m(Repo.all('assessments'), 'classId'),
      feesByStudent: m(Repo.all('fees'), 'studentId'),
      payByFee: m(Repo.all('payments'), 'feeId'), payByStudent: m(Repo.all('payments'), 'studentId'),
      studentsByClass: m(Repo.where('students', s => s.status === 'active'), 'classId'),
      userByLinked: new Map(users.filter(u => u.linkedId).map(u => [u.role + '|' + u.linkedId, u])),
      schedByClass: m(Repo.all('schedules'), 'classId'), schedByTeacher: m(Repo.all('schedules'), 'teacherId')
    };
  });
}
const userOf = (role, linkedId) => Idx().userByLinked.get(role + '|' + linkedId) || null;
const activeStudents = () => Repo.where('students', s => s.status === 'active');
const classStudents = classId => (Idx().studentsByClass.get(classId) || []).slice().sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));

/* ---------- Attendance ---------- */
function attStats(recs) {
  const c = { present: 0, absent: 0, late: 0, excused: 0 };
  recs.forEach(r => c[r.status] = (c[r.status] || 0) + 1);
  const total = recs.length;
  return { ...c, total, rate: total ? (c.present + c.excused + c.late * 0.5) / total * 100 : null, absentPct: total ? c.absent / total * 100 : 0, latePct: total ? c.late / total * 100 : 0 };
}
function studentAtt(id, from, to) {
  let r = Idx().attByStudent.get(id) || [];
  if (from) r = r.filter(x => x.date >= from); if (to) r = r.filter(x => x.date <= to);
  return attStats(r);
}
function recordedDates() { return memo('dates', () => [...Idx().attByDate.keys()].sort()); }
function lastSchoolDayWithData() { const d = recordedDates(); return d[d.length - 1] || todayISO(); }
function canEditAttendance(u, date) {
  if (u.role === 'admin') return true;
  if (u.role !== 'teacher') return false;
  const T = todayISO(); return date <= T && date >= addDays(T, -Settings.get().teacherEditDays);
}
function saveAttendance(classId, date, entries) {
  const existing = new Map((Idx().attByDate.get(date) || []).filter(r => r.classId === classId).map(r => [r.studentId, r]));
  const newAbs = []; const toCreate = []; let changed = 0;
  entries.forEach(e => {
    const ex = existing.get(e.studentId);
    if (ex) {
      if (ex.status !== e.status || (ex.reason || '') !== (e.reason || '')) { Repo.update('attendance', ex.id, { status: e.status, reason: e.reason || '', recordedBy: Auth.userId() }); changed++; if (e.status === 'absent' && ex.status !== 'absent') newAbs.push(e); }
    } else { toCreate.push({ studentId: e.studentId, classId, date, status: e.status, reason: e.reason || '', recordedBy: Auth.userId() }); if (e.status === 'absent') newAbs.push(e); }
  });
  if (toCreate.length) Repo.bulk('attendance', toCreate);
  Audit.log('update', 'attendance', classId, null, { date, classId, recorded: entries.length, created: toCreate.length, changed });
  const S = Settings.get();
  newAbs.forEach(e => {
    const st = Repo.get('students', e.studentId); if (!st) return;
    Notify.send([Notify.parentUser(st), Notify.studentUser(st)], { type: 'absence', title: 'تسجيل غياب', message: `تم تسجيل غياب الطالب ${st.fullName} يوم ${DAYS[dow(date)]} ${fmtDate(date)}.`, link: 'student-' + st.id, priority: 'high' });
    const a = studentAtt(st.id, addDays(date, -30), date);
    if (a.absentPct >= S.attendanceAlert && a.absent >= 3) {
      Notify.send([...Notify.adminIds(), Notify.homeroomUser(st), Notify.parentUser(st)], { type: 'smart', title: 'تجاوز حد الغياب', message: `${st.fullName} تجاوز ${fmtNum(S.attendanceAlert)}% غياب بلا عذر خلال 30 يومًا (${fmtPct(a.absentPct, 1)}).`, link: 'student-' + st.id, priority: 'high' });
    }
  });
  return { created: toCreate.length, changed, absences: newAbs.length };
}

/* ---------- Grades ---------- */
const passOf = s => s.maxScore ? s.passScore / s.maxScore * 100 : Settings.get().passPercent;
function gradeLabel(p) { if (p == null) return '—'; return p >= 90 ? 'ممتاز' : p >= 80 ? 'جيد جدًا' : p >= 70 ? 'جيد' : p >= 50 ? 'مقبول' : 'ضعيف'; }
function gradeTone(p) { if (p == null) return ''; return p >= 80 ? 'ok' : p >= 60 ? 'info' : p >= 50 ? 'warn' : 'bad'; }
function assessmentsFor(classId, subjectId, opt = {}) {
  return (Idx().assessByClass.get(classId) || []).filter(a => (!subjectId || a.subjectId === subjectId) && (!opt.publishedOnly || a.isPublished)).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}
const gradeOf = (assessId, studentId) => Idx().gradeKey.get(assessId + '|' + studentId) || null;
const hasScore = g => g && g.score !== null && g.score !== '' && g.score !== undefined;
function subjectResult(st, subjectId, opt = {}) {
  const as = assessmentsFor(st.classId, subjectId, opt);
  let w = 0, s = 0; const items = [];
  for (const a of as) { const g = gradeOf(a.id, st.id); if (hasScore(g)) { const p = g.score / a.maxScore; s += p * a.weight; w += a.weight; items.push({ a, g, p: p * 100 }); } }
  return { percent: w ? s / w * 100 : null, items };
}
function studentResults(st, opt = {}) {
  return memo('res:' + st.id + (opt.publishedOnly ? ':p' : ''), () => {
    const rows = Repo.all('subjects').map(s => ({ subject: s, ...subjectResult(st, s.id, opt) })).filter(r => r.percent != null);
    const average = avg(rows.map(r => r.percent));
    const failing = rows.filter(r => r.percent < passOf(r.subject)).length;
    const result = !rows.length ? null : failing === 0 ? 'pass' : failing <= 2 ? 'retake' : 'fail';
    return { rows, avg: average, failing, result };
  });
}
function rankMap(list) {
  const sorted = list.filter(x => x.val != null).sort((a, b) => b.val - a.val);
  let rank = 0, prev = null; const m = new Map();
  sorted.forEach((x, i) => { if (prev === null || Math.abs(x.val - prev) > 1e-9) { rank = i + 1; prev = x.val; } m.set(x.id, rank); });
  return m;
}
function classRanking(classId, opt = {}) { return memo('rank:' + classId + (opt.publishedOnly ? ':p' : ''), () => rankMap(classStudents(classId).map(s => ({ id: s.id, val: studentResults(s, opt).avg })))); }
function subjectRanking(classId, subjectId) { return memo('srank:' + classId + subjectId, () => rankMap(classStudents(classId).map(s => ({ id: s.id, val: subjectResult(s, subjectId).percent })))); }
function setGrade(assessment, studentId, score) {
  const g = gradeOf(assessment.id, studentId);
  const val = score === '' || score == null ? null : Number(score);
  if (g) { if (g.isLocked && Auth.current().role !== 'admin') return 'locked'; if (g.score === val) return 'same'; Repo.update('grades', g.id, { score: val, enteredBy: Auth.userId() }); }
  else { if (val == null) return 'same'; Repo.create('grades', { assessmentId: assessment.id, studentId, score: val, comment: '', enteredBy: Auth.userId(), isLocked: false }); }
  return 'ok';
}
function publishAssessment(a) {
  Repo.update('assessments', a.id, { isPublished: true });
  const S = Settings.get(); const subj = Repo.get('subjects', a.subjectId);
  const sts = classStudents(a.classId); const alerts = [];
  const users = [];
  sts.forEach(st => {
    const g = gradeOf(a.id, st.id); if (!hasScore(g)) return;
    users.push(Notify.studentUser(st), Notify.parentUser(st));
    const p = g.score / a.maxScore * 100;
    const prev = assessmentsFor(a.classId, a.subjectId, { publishedOnly: true }).filter(x => x.id !== a.id && x.date <= a.date).pop();
    const pg = prev ? gradeOf(prev.id, st.id) : null;
    const pp = hasScore(pg) ? pg.score / prev.maxScore * 100 : null;
    if (p < S.passPercent || (pp != null && pp - p >= S.gradeDrop)) alerts.push({ st, p, pp });
  });
  Notify.send(users, { type: 'grades', title: 'نُشرت درجات جديدة', message: `نُشرت نتائج «${a.name}» في مادة ${subj ? subj.name : ''}.`, link: 'grades', priority: 'normal' });
  alerts.forEach(({ st, p, pp }) => Notify.send([Notify.parentUser(st)], { type: 'smart', title: 'انخفاض في الدرجات', message: `${st.fullName}: ${fmtPct(p, 0)} في «${a.name}» (${subj ? subj.name : ''})` + (pp != null ? ` مقابل ${fmtPct(pp, 0)} في التقييم السابق.` : '.'), link: 'grades', priority: 'high' }));
  return { notified: users.filter(Boolean).length, alerts: alerts.length };
}

/* ---------- Finance ---------- */
function feeInfo(f) {
  const paid = sum((Idx().payByFee.get(f.id) || []).map(p => p.amount));
  const net = f.amount - (f.discount || 0);
  const remaining = Math.max(0, net - paid);
  let status = remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
  if (remaining > 0 && f.dueDate < todayISO()) status = 'overdue';
  return { fee: f, paid, net, remaining, status };
}
function studentFinance(id) {
  return memo('fin:' + id, () => {
    const fees = (Idx().feesByStudent.get(id) || []).map(feeInfo).sort((a, b) => a.fee.dueDate < b.fee.dueDate ? -1 : 1);
    const net = sum(fees.map(f => f.net)), paid = sum(fees.map(f => f.paid)), remaining = sum(fees.map(f => f.remaining));
    const overdue = fees.filter(f => f.status === 'overdue');
    const status = !fees.length ? 'paid' : remaining <= 0 ? 'paid' : overdue.length ? 'overdue' : paid > 0 ? 'partial' : 'unpaid';
    return { fees, net, paid, remaining, overdue: sum(overdue.map(f => f.remaining)), overdueCount: overdue.length, status, payments: (Idx().payByStudent.get(id) || []).slice().sort((a, b) => a.paidAt < b.paidAt ? 1 : -1) };
  });
}
function financeTotals() {
  return memo('fintot', () => {
    const infos = Repo.all('fees').map(feeInfo);
    const net = sum(infos.map(i => i.net)), paid = sum(infos.map(i => i.paid)), remaining = sum(infos.map(i => i.remaining));
    const overdue = infos.filter(i => i.status === 'overdue');
    return { net, paid, remaining, rate: net ? paid / net * 100 : 0, overdue: sum(overdue.map(i => i.remaining)), overdueStudents: new Set(overdue.map(i => i.fee.studentId)).size, infos };
  });
}
function nextReceiptNo() {
  const y = new Date().getFullYear(); const pre = `RCP-${y}-`;
  const max = Math.max(0, ...Repo.raw('payments').filter(p => (p.receiptNo || '').startsWith(pre)).map(p => Number(p.receiptNo.slice(pre.length)) || 0));
  return pre + String(max + 1).padStart(6, '0');
}
function recordPayment(studentId, amount, method, note) {
  const fin = studentFinance(studentId);
  amount = Math.round(Number(amount));
  if (!(amount > 0)) return { error: 'أدخل مبلغًا صحيحًا أكبر من صفر.' };
  if (amount > fin.remaining) return { error: 'المبلغ أكبر من إجمالي المستحق (' + fmtMoney(fin.remaining) + ').' };
  const receiptNo = nextReceiptNo(); const paidAt = new Date().toISOString();
  let left = amount; const created = [];
  for (const f of fin.fees.filter(f => f.remaining > 0)) {
    if (left <= 0) break; const amt = Math.min(left, f.remaining);
    created.push(Repo.create('payments', { feeId: f.fee.id, studentId, amount: amt, method, receiptNo, paidAt, receivedBy: Auth.userId(), note: note || '' }));
    left -= amt;
  }
  fin.fees.forEach(f => { const i = feeInfo(f.fee); if (i.status !== f.fee.status) Repo.update('fees', f.fee.id, { status: i.status }, { audit: false }); });
  const st = Repo.get('students', studentId);
  Notify.send([Notify.parentUser(st)], { type: 'payment', title: 'تم استلام دفعة', message: `استلمنا ${fmtMoney(amount)} عن الطالب ${st.fullName}. رقم الإيصال ${receiptNo}.`, link: 'payments', priority: 'normal' });
  return { receiptNo, payments: created };
}
function receipts() {
  return memo('receipts', () => [...groupBy(Repo.all('payments'), p => p.receiptNo).entries()].map(([no, ps]) => ({ receiptNo: no, payments: ps, studentId: ps[0].studentId, amount: sum(ps.map(p => p.amount)), paidAt: ps[0].paidAt, method: ps[0].method, receivedBy: ps[0].receivedBy, note: ps[0].note })).sort((a, b) => a.paidAt < b.paidAt ? 1 : -1));
}

/* ---------- Certificates ---------- */
function issueCertificates(classId) {
  const cls = Repo.get('classes', classId); const year = activeYear(); const S = Settings.get();
  const ranks = classRanking(classId, { publishedOnly: true });
  const startYear = String(year.name || S.academicYear).slice(0, 4);
  let seq = Repo.raw('certificates').filter(c => c.academicYearId === year.id).length + 1;
  let made = 0, updated = 0; const users = [];
  classStudents(classId).forEach(st => {
    const r = studentResults(st, { publishedOnly: true }); if (!r.rows.length) return;
    const payload = {
      studentId: st.id, academicYearId: year.id, term: S.term, classId,
      subjects: r.rows.map(x => ({ subjectId: x.subject.id, name: x.subject.name, score: Math.round(x.percent * 10) / 10, max: 100, pass: passOf(x.subject), gradeLabel: gradeLabel(x.percent) })),
      total: Math.round(sum(r.rows.map(x => x.percent)) * 10) / 10, maxTotal: r.rows.length * 100,
      percentage: Math.round(r.avg * 10) / 10, gradeLabel: gradeLabel(r.avg), rank: ranks.get(st.id) || null, classSize: classStudents(classId).length,
      result: r.result, issuedBy: Auth.userId(), issueDate: todayISO()
    };
    const ex = Repo.all('certificates').find(c => c.studentId === st.id && c.academicYearId === year.id && c.term === S.term);
    if (ex) { Repo.update('certificates', ex.id, payload, { audit: false }); updated++; }
    else { Repo.create('certificates', { ...payload, certNo: `ASS-${startYear}-${cls.gradeLevel}-${String(seq++).padStart(4, '0')}`, verifyCode: randCode(8) }, { audit: false }); made++; }
    users.push(Notify.studentUser(st), Notify.parentUser(st));
  });
  assessmentsFor(classId).forEach(a => (Idx().gradesByAssess.get(a.id) || []).forEach(g => { if (!g.isLocked) Repo.update('grades', g.id, { isLocked: true }, { audit: false }); }));
  Audit.log('create', 'certificates', classId, null, { classId, made, updated });
  Notify.send(users, { type: 'grades', title: 'صدرت الشهادة', message: `صدرت شهادة ${S.termName} للعام ${year.name}. يمكنك عرضها من صفحة الشهادات.`, link: 'certificates', priority: 'normal' });
  return { made, updated };
}
function findCertificate(code) {
  const c = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!c) return null;
  return Repo.all('certificates').find(x => x.verifyCode === c || x.certNo.toUpperCase() === c) || null;
}

/* ---------- Notifications ---------- */
const Notify = {
  send(userIds, { type = 'general', title, message, link = null, priority = 'normal' }) {
    let ids = [...new Set(userIds.filter(Boolean).map(u => typeof u === 'string' ? u : u.id))];
    if (priority !== 'high') ids = ids.filter(id => { const x = Repo.get('users', id); return !x || !x.prefs || x.prefs.digest !== false; });
    if (!ids.length) return 0;
    Repo.bulk('notifications', ids.map(userId => ({ userId, type, title, message, link, priority, read: false, readAt: null })));
    const me = Auth.userId();
    if (TOP && ids.includes(me) && priority === 'high' && document.hidden && 'Notification' in window && Notification.permission === 'granted') { try { new Notification(title, { body: message }); } catch (e) { } }
    return ids.length;
  },
  parentUser: st => st ? userOf('parent', st.parentId) : null,
  studentUser: st => st ? userOf('student', st.id) : null,
  homeroomUser: st => { const c = st && Repo.get('classes', st.classId); return c ? userOf('teacher', c.homeroomTeacherId) : null; },
  adminIds: () => Repo.where('users', u => u.role === 'admin' && u.isActive),
  audience(key) {
    const us = Repo.where('users', u => u.isActive);
    if (key === 'all') return us;
    if (key === 'teachers') return us.filter(u => u.role === 'teacher');
    if (key === 'students') return us.filter(u => u.role === 'student');
    if (key === 'parents') return us.filter(u => u.role === 'parent');
    if (key.startsWith('class:')) { const sts = classStudents(key.slice(6)); return [...sts.map(s => userOf('student', s.id)), ...sts.map(s => userOf('parent', s.parentId))].filter(Boolean); }
    if (key.startsWith('classp:')) { return classStudents(key.slice(7)).map(s => userOf('parent', s.parentId)).filter(Boolean); }
    return [];
  },
  mine(u) { return Repo.where('notifications', n => n.userId === u.id).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1); },
  unread(u) { return memo('unread:' + u.id, () => Repo.where('notifications', n => n.userId === u.id && !n.read).length); },
  markRead(n) { if (!n.read) Repo.update('notifications', n.id, { read: true, readAt: new Date().toISOString() }); },
  markAll(u) { Repo.where('notifications', n => n.userId === u.id && !n.read).forEach(n => Repo.update('notifications', n.id, { read: true, readAt: new Date().toISOString() })); }
};

/* ---------- Smart engine: trend / risk / prediction ---------- */
function trendSlope(ys) {
  const n = ys.length; if (n < 2) return 0;
  const mx = (n - 1) / 2, my = avg(ys); let num = 0, den = 0;
  ys.forEach((y, i) => { num += (i - mx) * (y - my); den += (i - mx) ** 2; });
  return den ? num / den : 0;
}
function gradeSeries(st) {
  const byDate = new Map();
  assessmentsFor(st.classId).forEach(a => { const g = gradeOf(a.id, st.id); if (hasScore(g)) { if (!byDate.has(a.date)) byDate.set(a.date, []); byDate.get(a.date).push(g.score / a.maxScore * 100); } });
  return [...byDate.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([d, v]) => ({ date: d, p: avg(v) }));
}
function risk(st) {
  return memo('risk:' + st.id, () => {
    const T = todayISO(); const S = Settings.get();
    const att = studentAtt(st.id, addDays(T, -30), T);
    const res = studentResults(st); const a = res.avg;
    const series = gradeSeries(st).map(x => x.p).slice(-4);
    const slope = trendSlope(series);
    const absF = clamp(att.absentPct / (S.attendanceAlert || 10), 0, 1);
    const achF = a == null ? 0 : a >= 75 ? 0 : a <= 40 ? 1 : (75 - a) / 35;
    const trendF = slope >= 0 ? 0 : clamp(-slope / 10, 0, 1);
    const failF = clamp(res.failing / 3, 0, 1);
    const lateF = clamp(att.latePct / 10, 0, 1);
    const score = Math.round(100 * (.35 * absF + .30 * achF + .20 * trendF + .10 * failF + .05 * lateF));
    const level = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
    const f = [];
    if (att.absent) f.push({ impact: .35 * absF, text: `غياب بلا عذر ${fmtPct(att.absentPct, 1)} خلال آخر 30 يومًا (${fmtNum(att.absent)} ${att.absent === 1 ? 'يوم' : 'أيام'})` });
    if (a != null && a < 75) f.push({ impact: .30 * achF, text: `المعدل الحالي ${fmtPct(a, 1)}` });
    if (slope < -0.5 && series.length >= 2) f.push({ impact: .20 * trendF, text: `تراجع في الدرجات بمعدل ${fmtNum(-slope, 1)} نقطة في كل تقييم` });
    if (res.failing) f.push({ impact: .10 * failF, text: `${fmtNum(res.failing)} ${res.failing === 1 ? 'مادة' : 'مواد'} تحت خط النجاح` });
    if (att.late) f.push({ impact: .05 * lateF, text: `تأخر صباحي ${fmtNum(att.late)} ${att.late === 1 ? 'مرة' : 'مرات'}` });
    const factors = f.filter(x => x.impact > 0.004).sort((x, y) => y.impact - x.impact);
    const rec = level === 'high' ? 'التواصل مع ولي الأمر هذا الأسبوع، وجلسة دعم مع مربي الصف، ومتابعة الحضور يوميًا.' : level === 'medium' ? 'متابعة أسبوعية من مربي الصف وتنبيه مدرسي المواد الأضعف.' : 'وضع مستقر. يكفي الاستمرار بالمتابعة الاعتيادية.';
    return { score, level, factors, rec, slope, avg: a, att };
  });
}
function atRisk(students, min = 'medium') { const lv = min === 'high' ? ['high'] : ['high', 'medium']; return students.map(s => ({ st: s, r: risk(s) })).filter(x => lv.includes(x.r.level)).sort((a, b) => b.r.score - a.r.score); }
function predictSubject(st, subjectId) {
  const r = subjectResult(st, subjectId); const ps = r.items.map(i => i.p); if (ps.length < 2) return null;
  const slope = trendSlope(ps); const last = ps[ps.length - 1];
  const mid = clamp(r.percent * 0.6 + (last + slope) * 0.4, 0, 100); const spread = clamp(std(ps) / 2, 3, 10);
  return { low: clamp(mid - spread, 0, 100), high: clamp(mid + spread, 0, 100), mid };
}

/* ---------- Smart insights ---------- */
const SEV_ORDER = { bad: 0, warn: 1, info: 2, ok: 3 };
function insights(u) {
  return memo('insights:' + (u ? u.id : ''), () => {
    const out = []; const T = todayISO(); const S = Settings.get();
    const classes = u ? Scope.classes(u) : Repo.all('classes');
    const classIds = new Set(classes.map(c => c.id));
    const sts = u ? Scope.students(u).filter(s => s.status === 'active') : activeStudents();
    const avgOf = a => { const g = (Idx().gradesByAssess.get(a.id) || []).filter(hasScore); return g.length ? avg(g.map(x => x.score / a.maxScore * 100)) : null; };
    for (const c of classes) for (const s of Repo.all('subjects')) {
      if (u && u.role === 'teacher' && !Scope.teaches(u, c.id, s.id)) continue;
      const as = assessmentsFor(c.id, s.id, { publishedOnly: true }).filter(a => a.type === 'monthly' || a.type === 'midterm' || a.type === 'final');
      if (as.length < 2) continue;
      const a1 = avgOf(as[as.length - 2]), a2 = avgOf(as[as.length - 1]);
      if (a1 != null && a2 != null && a1 - a2 >= 8) out.push({ sev: 'bad', ic: 'down', title: `تراجع في ${s.name} — ${c.name}`, text: `انخفض متوسط الفصل من ${fmtPct(a1, 1)} إلى ${fmtPct(a2, 1)} بين آخر اختبارين.`, link: 'grades' });
      else if (a1 != null && a2 != null && a2 - a1 >= 8) out.push({ sev: 'ok', ic: 'up', title: `تحسّن في ${s.name} — ${c.name}`, text: `ارتفع متوسط الفصل من ${fmtPct(a1, 1)} إلى ${fmtPct(a2, 1)}.`, link: 'grades' });
    }
    const from = addDays(T, -30);
    const schoolRate = attStats(Repo.all('attendance').filter(r => r.date >= from)).rate;
    classes.forEach(c => {
      const r = attStats(Repo.all('attendance').filter(x => x.classId === c.id && x.date >= from)).rate;
      if (r != null && schoolRate != null && schoolRate - r >= 3) out.push({ sev: 'warn', ic: 'check', title: `حضور منخفض في ${c.name}`, text: `نسبة الحضور ${fmtPct(r, 1)} مقابل ${fmtPct(schoolRate, 1)} لمتوسط المدرسة خلال 30 يومًا.`, link: 'attendance' });
    });
    if (!u || u.role === 'admin') {
      const byDay = groupBy(Repo.all('attendance').filter(r => r.date >= addDays(T, -42)), r => dow(r.date));
      const rates = [...byDay.entries()].map(([d, rs]) => ({ d, abs: attStats(rs).absentPct }));
      const mean = avg(rates.map(x => x.abs)); const worst = rates.sort((a, b) => b.abs - a.abs)[0];
      if (worst && mean && worst.abs > mean * 1.35 && worst.abs >= 3) out.push({ sev: 'info', ic: 'calendar', title: `يوم ${DAYS[worst.d]} هو الأعلى غيابًا`, text: `نسبة الغياب فيه ${fmtPct(worst.abs, 1)} مقابل ${fmtPct(mean, 1)} لبقية الأيام خلال 6 أسابيع.`, link: 'reports' });
      const pend = Repo.all('assessments').filter(a => a.date <= addDays(T, -1) && !(Idx().gradesByAssess.get(a.id) || []).some(hasScore));
      groupBy(pend, a => (Repo.all('teachingAssignments').find(x => x.classId === a.classId && x.subjectId === a.subjectId) || {}).teacherId).forEach((as, tid) => {
        if (tid) out.push({ sev: 'warn', ic: 'pen', title: `تقييمات بلا درجات — ${nameOf.tch(tid)}`, text: `${fmtNum(as.length)} ${as.length === 1 ? 'تقييم' : 'تقييمات'} مضى موعدها دون إدخال الدرجات (${as.map(a => a.name + ' / ' + nameOf.cls(a.classId)).slice(0, 2).join('، ')}).`, link: 'grades' });
      });
      const ft = financeTotals();
      if (ft.rate < S.collectionTarget) out.push({ sev: ft.rate < S.collectionTarget - 15 ? 'bad' : 'warn', ic: 'wallet', title: 'نسبة التحصيل دون المستهدف', text: `المحصّل ${fmtPct(ft.rate, 1)} من الرسوم المستحقة (المستهدف ${fmtPct(S.collectionTarget)}). ${fmtNum(ft.overdueStudents)} طالبًا متأخرًا بمبلغ ${fmtMoney(ft.overdue)}.`, link: 'payments' });
      classes.forEach(c => { const n = classStudents(c.id).length; if (c.capacity && n / c.capacity >= .95) out.push({ sev: 'info', ic: 'layers', title: `${c.name} قريب من السعة`, text: `${fmtNum(n)} طالبًا من سعة ${fmtNum(c.capacity)}.`, link: 'classes' }); });
    }
    const risky = atRisk(sts, 'high');
    if (risky.length) out.push({ sev: 'bad', ic: 'alert', title: `${fmtNum(risky.length)} ${risky.length === 1 ? 'طالب' : 'طلاب'} في خطر مرتفع`, text: risky.slice(0, 3).map(x => x.st.fullName).join('، ') + (risky.length > 3 ? ' وآخرون.' : '.') + ' السبب الأبرز: ' + (risky[0].r.factors[0] ? risky[0].r.factors[0].text : '') + '.', link: 'students' });
    const improved = sts.map(s => ({ s, slope: trendSlope(gradeSeries(s).map(x => x.p).slice(-4)) })).filter(x => x.slope >= 4).sort((a, b) => b.slope - a.slope).slice(0, 3);
    if (improved.length) out.push({ sev: 'ok', ic: 'up', title: 'أكثر الطلاب تحسّنًا', text: improved.map(x => `${x.s.fullName} (+${fmtNum(x.slope, 1)} لكل تقييم)`).join('، ') + '.', link: 'students' });
    return out.filter(x => !u || u.role === 'admin' || x.link !== 'payments').sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
  });
}

/* ---------- Smart scheduler ---------- */
function autoSchedule(classId, opt = {}) {
  const rng = opt.rng || Math.random;
  const periods = opt.periods || periodsSorted();
  const days = Settings.get().schoolDays;
  const sched = opt.existing || Repo.all('schedules');
  const subjects = opt.subjects || Repo.all('subjects');
  const asg = (opt.assignments || Repo.all('teachingAssignments')).filter(a => a.classId === classId);
  const cls = sched.filter(s => s.classId === classId);
  const busyClass = new Set(cls.map(s => s.dayOfWeek + '|' + s.periodId));
  const busyT = new Set(sched.map(s => s.teacherId + '|' + s.dayOfWeek + '|' + s.periodId));
  const subjDay = new Map(); cls.forEach(s => subjDay.set(s.subjectId + '|' + s.dayOfWeek, (subjDay.get(s.subjectId + '|' + s.dayOfWeek) || 0) + 1));
  const dayCount = {}; days.forEach(d => dayCount[d] = cls.filter(s => s.dayOfWeek === d).length);
  const need = [];
  asg.forEach(a => { const sub = subjects.find(s => s.id === a.subjectId); if (!sub) return; const have = cls.filter(s => s.subjectId === a.subjectId).length; for (let k = have; k < sub.weeklySessions; k++) need.push({ a, sub }); });
  const tLoad = id => sched.filter(s => s.teacherId === id).length;
  need.sort((x, y) => (tLoad(y.a.teacherId) - tLoad(x.a.teacherId)) || (y.sub.weeklySessions - x.sub.weeklySessions));
  const placed = [], missing = {};
  for (const { a, sub } of need) {
    let best = null, bestScore = -1e9;
    for (const d of days) for (const p of periods) {
      const ck = d + '|' + p.id;
      if (busyClass.has(ck) || busyT.has(a.teacherId + '|' + ck)) continue;
      let sc = 10 - (subjDay.get(sub.id + '|' + d) || 0) * 8 - dayCount[d] * 0.6 + rng() * 1.5;
      if (sub.weeklySessions >= 4 && p.order <= 3) sc += 1;
      if (sc > bestScore) { best = { d, p }; bestScore = sc; }
    }
    if (!best) { missing[sub.id] = (missing[sub.id] || 0) + 1; continue; }
    const rec = { classId, dayOfWeek: best.d, periodId: best.p.id, subjectId: sub.id, teacherId: a.teacherId, room: opt.room || '', academicYearId: opt.yearId || activeYear().id };
    placed.push(rec);
    busyClass.add(best.d + '|' + best.p.id); busyT.add(a.teacherId + '|' + best.d + '|' + best.p.id);
    subjDay.set(sub.id + '|' + best.d, (subjDay.get(sub.id + '|' + best.d) || 0) + 1); dayCount[best.d]++;
    sched.push(rec);
  }
  return { placed, missing };
}
function scheduleConflict(rec, ignoreId) {
  const all = Repo.all('schedules').filter(s => s.id !== ignoreId && s.dayOfWeek === rec.dayOfWeek && s.periodId === rec.periodId);
  if (all.some(s => s.classId === rec.classId)) return 'الفصل لديه حصة أخرى في هذا الوقت.';
  const t = all.find(s => s.teacherId === rec.teacherId);
  if (t) return `${nameOf.tch(rec.teacherId)} لديه حصة مع ${nameOf.cls(t.classId)} في هذا الوقت.`;
  if (rec.room) { const r = all.find(s => s.room && s.room === rec.room); if (r) return `القاعة ${rec.room} مشغولة بفصل ${nameOf.cls(r.classId)}.`; }
  return null;
}
const teacherLoad = tid => (Idx().schedByTeacher.get(tid) || []).length;

export { ACTION_LABEL, ATT_CLS, ATT_LABEL, ENTITY_LABEL, EXAM_LABEL, EXP_COLOR, EXP_LABEL, FEE_LABEL, Idx, METHOD_LABEL, NOTIF_ICON, NOTIF_LABEL, Notify, PAY_STATUS, RESULT_LABEL, RISK_LABEL, SEV_ORDER, STATUS_CLS, STATUS_LABEL, T_STATUS, activeStudents, activeYear, assessmentsFor, atRisk, attStats, autoSchedule, canEditAttendance, classRanking, classStudents, displayName, feeInfo, financeTotals, findCertificate, gradeLabel, gradeOf, gradeSeries, gradeTone, hasScore, insights, issueCertificates, lastSchoolDayWithData, nameOf, nextReceiptNo, passOf, periodsSorted, predictSubject, publishAssessment, rankMap, receipts, recordPayment, recordedDates, risk, saveAttendance, scheduleConflict, setGrade, studentAtt, studentFinance, studentResults, subjectRanking, subjectResult, teacherLoad, trendSlope, userOf };
