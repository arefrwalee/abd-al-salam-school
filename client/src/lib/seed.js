import { DAYS, GRADE_NAMES, addDays, clamp, dow, fmtDate, iso, mulberry32, parseISO, todayISO, uid } from './utils.js';
import { Repo, Settings, currentYearName, DEFAULT_SETTINGS } from './store.js';
import { makeUser } from './auth.js';
import { autoSchedule, displayName, feeInfo } from './domain.js';

/* =====================================================================
   Seed — بيانات تجريبية واقعية (تُولَّد مرة واحدة عند أول تشغيل)
   ===================================================================== */
async function seedDemo(onProgress = () => { }) {
  const rnd = mulberry32(20261015);
  const pick = a => a[Math.floor(rnd() * a.length)];
  const T = todayISO(); const nowIso = new Date().toISOString();
  const mk = o => ({ id: uid(), createdAt: nowIso, updatedAt: nowIso, createdBy: null, deletedAt: null, ...o });
  Settings.replace({ ...DEFAULT_SETTINGS, academicYear: currentYearName() });
  const S = Settings.get();

  // school days: the last 25 Sun–Thu days up to today
  const days = []; let d = T; while (days.length < 25) { if (S.schoolDays.includes(dow(d))) days.unshift(d); d = addDays(d, -1); }
  const start = days[0]; const last = days[days.length - 1];

  const year = mk({ name: S.academicYear, startDate: addDays(start, -7), endDate: addDays(start, 280), terms: [{ key: 'T1', name: 'الفصل الأول', start: addDays(start, -7), end: addDays(start, 120) }, { key: 'T2', name: 'الفصل الثاني', start: addDays(start, 135), end: addDays(start, 280) }], isActive: true });

  const SUBJ = [['الرياضيات', 'MATH', 5, '#2f63e6'], ['اللغة العربية', 'ARAB', 5, '#1f9a4d'], ['اللغة الإنجليزية', 'ENGL', 4, '#d23a3a'], ['العلوم', 'SCI', 3, '#0e8f9a'], ['الفيزياء', 'PHYS', 2, '#7c5cd6'], ['الكيمياء', 'CHEM', 2, '#c27c0e'], ['التاريخ', 'HIST', 2, '#9a5532'], ['الجغرافيا', 'GEOG', 2, '#4f7a28'], ['الحاسوب', 'COMP', 2, '#5d6b8a']];
  const subjects = SUBJ.map(([name, code, weeklySessions, color]) => mk({ name, code, gradeLevel: null, weeklySessions, maxScore: 100, passScore: 50, color }));
  const sub = code => subjects.find(s => s.code === code);

  const TCH = [['أحمد الحسن', 'الرياضيات', 'm'], ['سمر الخطيب', 'الرياضيات', 'f'], ['خالد العمر', 'اللغة العربية', 'm'], ['هدى الشامي', 'اللغة العربية', 'f'], ['ريم النجار', 'اللغة الإنجليزية', 'f'], ['محمد الأحمد', 'العلوم', 'm'], ['لينا الحلبي', 'الفيزياء والكيمياء', 'f'], ['عمر الدرويش', 'التاريخ والجغرافيا', 'm'], ['نور الصالح', 'الحاسوب', 'f'], ['يوسف الحمدان', 'اللغة الإنجليزية', 'm']];
  const teachers = TCH.map(([fullName, specialization], i) => mk({ employeeNo: 'EMP-' + String(i + 1).padStart(4, '0'), fullName, phone: '09' + String(30000000 + Math.floor(rnd() * 69999999)), email: `t${i + 1}@abdulsalam.edu.sy`, specialization, hireDate: addDays(start, -365 * (1 + Math.floor(rnd() * 9)) - Math.floor(rnd() * 200)), status: 'active', weeklyLoad: i === 6 || i === 7 ? 26 : 24 }));

  const SECTIONS = ['أ', 'ب'];
  const classes = []; [7, 8, 9].forEach((g, gi) => SECTIONS.forEach((sec, si) => classes.push(mk({ name: `${GRADE_NAMES[g - 1]} - ${sec}`, gradeLevel: g, section: sec, homeroomTeacherId: teachers[gi * 2 + si].id, capacity: 24, academicYearId: year.id, room: `${g}0${si + 1}` }))));

  const A = []; const asg = (t, code, idxs) => idxs.forEach(i => A.push(mk({ teacherId: teachers[t].id, subjectId: sub(code).id, classId: classes[i].id, academicYearId: year.id })));
  asg(0, 'MATH', [0, 1, 2]); asg(1, 'MATH', [3, 4, 5]); asg(2, 'ARAB', [0, 1, 2]); asg(3, 'ARAB', [3, 4, 5]);
  asg(4, 'ENGL', [0, 1, 2, 3]); asg(9, 'ENGL', [4, 5]); asg(5, 'SCI', [0, 1, 2, 3, 4, 5]); asg(6, 'PHYS', [0, 1, 2, 3, 4, 5]); asg(6, 'CHEM', [0, 1, 2, 3, 4, 5]);
  asg(7, 'HIST', [0, 1, 2, 3, 4, 5]); asg(7, 'GEOG', [0, 1, 2, 3, 4, 5]); asg(8, 'COMP', [0, 1, 2, 3, 4, 5]);

  const PT = [['08:00', '08:45'], ['08:50', '09:35'], ['09:40', '10:25'], ['10:45', '11:30'], ['11:35', '12:20'], ['12:25', '13:10']];
  const periods = PT.map(([s, e], i) => mk({ order: i + 1, startTime: s, endTime: e, isBreak: false }));

  // schedule: best of several randomized greedy passes
  let best = null;
  for (let attempt = 0; attempt < 24; attempt++) {
    const existing = []; let missing = 0;
    for (const c of classes) { const r = autoSchedule(c.id, { rng: rnd, periods, existing, subjects, assignments: A, room: c.room, yearId: year.id }); missing += Object.values(r.missing).reduce((a, b) => a + b, 0); }
    if (!best || missing < best.missing) best = { existing, missing };
    if (missing === 0) break;
  }
  const schedules = best.existing.map(mk);
  onProgress(20);

  const MALE = ['أحمد', 'محمد', 'عمر', 'علي', 'يوسف', 'خالد', 'حسن', 'إبراهيم', 'مصطفى', 'عبد الرحمن', 'سامر', 'كريم', 'ماهر', 'طارق', 'فادي', 'باسل', 'رامي', 'زياد', 'أنس', 'معاذ', 'حمزة', 'بلال', 'جود', 'تيم', 'آدم', 'وسيم', 'هادي', 'ليث', 'مهند', 'نزار'];
  const FEMALE = ['مريم', 'سارة', 'لين', 'جنى', 'ريم', 'نور', 'هبة', 'رنا', 'لمى', 'ديما', 'سلمى', 'تالا', 'شام', 'ياسمين', 'آية', 'رهف', 'غنى', 'بتول', 'حلا', 'روان', 'سدرة', 'ميس', 'لانا', 'جودي', 'رغد', 'دانة', 'عائشة', 'فرح', 'هيا', 'زينة'];
  const FAM = ['الحسن', 'العلي', 'الأحمد', 'الخطيب', 'الشامي', 'النجار', 'الحلبي', 'الدرويش', 'الصالح', 'الحمدان', 'العمر', 'المصري', 'السيد', 'القاسم', 'البكري', 'الزعبي', 'الحموي', 'الإدلبي', 'الخليل', 'الرفاعي', 'العبد الله', 'الموسى', 'الياسين', 'الجاسم', 'الحريري', 'الشيخ', 'العثمان', 'الكردي', 'العيسى', 'الحاج'];
  const STREETS = ['حي الجميلية', 'حي الفرقان', 'حي الشهباء', 'حي السبيل', 'حي الموكامبو', 'حي الأشرفية', 'حي السليمانية', 'حي سيف الدولة'];
  const RISK_IDX = [3, 27, 45, 61, 78, 92, 100, 115]; const WATCH_IDX = [12, 33, 57, 70, 88, 109];
  const students = [], parents = [], profile = [];
  for (let i = 0; i < 120; i++) {
    const c = classes[Math.floor(i / 20)]; const female = rnd() < 0.48;
    let first = female ? pick(FEMALE) : pick(MALE), father = pick(MALE), fam = pick(FAM), mother = pick(FEMALE) + ' ' + pick(FAM);
    let parent;
    if (i === 100) { const sib = students[0]; father = sib.fatherName; fam = sib._fam; mother = sib.motherName; parent = parents[0]; }
    else { parent = mk({ fullName: father + ' ' + fam, phone: '09' + String(30000000 + Math.floor(rnd() * 69999999)), phone2: '', email: '', relation: 'father', address: 'حلب، ' + pick(STREETS), studentIds: [] }); parents.push(parent); }
    const age = 12 + (c.gradeLevel - 7);
    const st = mk({
      studentNo: `STU-${S.academicYear.slice(0, 4)}-${String(i + 1).padStart(4, '0')}`, fullName: `${first} ${father} ${fam}`, fatherName: father, motherName: mother,
      birthDate: iso(new Date(new Date().getFullYear() - age, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27))), gender: female ? 'female' : 'male',
      phone: parent.phone, address: parent.address, email: '', gradeLevel: c.gradeLevel, classId: c.id, parentId: parent.id,
      registrationDate: addDays(start, -365 * (c.gradeLevel - 6) + Math.floor(rnd() * 20) - 30), status: 'active', photo: '', notes: ''
    });
    Object.defineProperty(st, '_fam', { value: fam, enumerable: false });
    parent.studentIds.push(st.id); students.push(st);
    const isRisk = RISK_IDX.includes(i), isWatch = WATCH_IDX.includes(i);
    profile.push({ ability: isRisk ? 0.45 + rnd() * 0.13 : isWatch ? 0.58 + rnd() * 0.1 : 0.62 + rnd() * 0.34, absP: isRisk ? 0.13 + rnd() * 0.07 : isWatch ? 0.06 + rnd() * 0.03 : 0.01 + rnd() * 0.035, lateP: isRisk ? 0.06 : 0.025, decline: isRisk ? 0.17 + rnd() * 0.06 : 0, offs: subjects.map((_, j) => (rnd() - 0.5) * 0.16 + [-0.07, 0.03, -0.02, 0.01, -0.06, -0.04, 0.05, 0.06, 0.08][j]) });
  }
  // a couple of non-active students for realism
  students[119].status = 'transferred';
  onProgress(35);

  // attendance (two classes left unrecorded today, to show the "not yet recorded" panel)
  const attendance = [];
  const REASONS = ['مراجعة طبية', 'ظرف عائلي', 'مرض', 'سفر'];
  days.forEach((day, di) => classes.forEach((c, ci) => {
    if (day === T && (ci === 3 || ci === 4)) return;
    students.forEach((st, si) => {
      if (st.classId !== c.id || st.status !== 'active') return;
      const p = profile[si]; const recent = di >= days.length - 15 ? 1.25 : 0.7; const r = rnd();
      let status = 'present', reason = '';
      if (r < p.absP * recent) { status = 'absent'; reason = rnd() < 0.2 ? 'لم يُبلَّغ' : ''; }
      else if (r < p.absP * recent + 0.012) { status = 'excused'; reason = pick(REASONS); }
      else if (r < p.absP * recent + 0.012 + p.lateP) status = 'late';
      attendance.push(mk({ studentId: st.id, classId: c.id, date: day, status, reason, recordedBy: null }));
    });
  }));
  onProgress(50);

  // assessments & grades
  const W = S.weights; const assessments = [], grades = [];
  const plan = [['اختبار شهري 1', 'monthly', 6, 20, W.monthly], ['واجبات الشهر الأول', 'homework', 9, 10, W.homework], ['اختبار شهري 2', 'monthly', 20, 20, W.monthly], ['مشاركة صفية', 'participation', 22, 10, W.participation]];
  classes.forEach((c, ci) => subjects.forEach((s, sj) => {
    plan.forEach(([name, type, di, maxScore, weight], k) => {
      const a = mk({ name, subjectId: s.id, classId: c.id, type, term: 'T1', maxScore, weight, date: days[di], isPublished: true });
      assessments.push(a);
      students.forEach((st, si) => {
        if (st.classId !== c.id || st.status !== 'active') return;
        const p = profile[si]; let q = p.ability + p.offs[sj] + (rnd() - 0.5) * 0.14;
        if (k >= 2) q -= p.decline; if (k === 2 && ci === 2 && s.code === 'MATH') q -= 0.15;
        if (type === 'participation' || type === 'homework') q += 0.06;
        const score = Math.round(clamp(q, 0.08, 1) * maxScore * 2) / 2;
        grades.push(mk({ assessmentId: a.id, studentId: st.id, score, comment: '', enteredBy: null, isLocked: false }));
      });
    });
  }));
  assessments.push(mk({ name: 'نشاط: مشروع الكسور', subjectId: sub('MATH').id, classId: classes[0].id, type: 'activity', term: 'T1', maxScore: 10, weight: W.activity, date: addDays(last, -1), isPublished: false }));
  onProgress(65);

  // fees & payments
  const fees = [], payments = []; const yr0 = S.academicYear.slice(0, 4);
  const payDate = (a, b) => { const span = Math.max(1, (parseISO(b) - parseISO(a)) / 864e5); const dd = addDays(a, Math.floor(rnd() * span)); return new Date(parseISO(dd).getTime() + (8 + Math.floor(rnd() * 6)) * 36e5 + Math.floor(rnd() * 60) * 6e4).toISOString(); };
  students.forEach((st, si) => {
    const isRisk = RISK_IDX.includes(si);
    const list = [['registration', 50000, addDays(start, -14)], ['books', 60000, start], ['tuition', 250000, addDays(start, 14)], ['tuition', 250000, addDays(T, 45)]];
    if (rnd() < 0.4) list.push(['transport', 120000, addDays(start, 14)]);
    if (rnd() < 0.3) list.push(['activities', 25000, addDays(T, 20)]);
    list.forEach(([feeType, amount, dueDate], k) => {
      const discount = feeType === 'tuition' && (si % 17 === 0) ? 50000 : 0;
      const f = mk({ studentId: st.id, academicYearId: year.id, feeType, amount, discount, dueDate, status: 'unpaid', label: feeType === 'tuition' ? (k === 2 ? 'القسط الأول' : 'القسط الثاني') : '' });
      fees.push(f); const net = amount - discount; const r = rnd(); let paid = 0;
      if (feeType === 'registration') paid = r < 0.97 ? net : 0;
      else if (feeType === 'books') paid = r < (isRisk ? 0.6 : 0.9) ? net : 0;
      else if (feeType === 'tuition' && k === 2) paid = r < (isRisk ? 0.35 : 0.7) ? net : r < (isRisk ? 0.55 : 0.84) ? Math.round(net * (0.4 + rnd() * 0.4) / 5000) * 5000 : 0;
      else if (feeType === 'tuition') paid = r < 0.08 ? net : 0;
      else if (feeType === 'transport') paid = r < 0.75 ? net : r < 0.88 ? net / 2 : 0;
      else if (feeType === 'activities') paid = r < 0.25 ? net : 0;
      if (paid > 0) payments.push(mk({ feeId: f.id, studentId: st.id, amount: paid, method: rnd() < 0.82 ? 'cash' : 'bank', receiptNo: '', paidAt: payDate(addDays(start, -24), addDays(T, -1)), receivedBy: null, note: '' }));
    });
  });
  payments.sort((a, b) => a.paidAt < b.paidAt ? -1 : 1).forEach((p, i) => p.receiptNo = `RCP-${new Date(p.paidAt).getFullYear()}-${String(i + 1).padStart(6, '0')}`);
  onProgress(75);

  // expenses
  const expenses = [];
  const months = []; { let m = parseISO(addDays(start, -24)); m.setDate(1); while (iso(m) <= T) { months.push(iso(m)); m.setMonth(m.getMonth() + 1); } }
  months.forEach(m0 => {
    const md = (n) => { const x = parseISO(m0); x.setDate(n); return iso(x); };
    const add = (title, category, amount, date, vendor = '') => { if (date <= T) expenses.push(mk({ title, category, amount, date, vendor, note: '', approvedBy: null })); };
    add('رواتب الكادر التدريسي', 'salaries', 10 * 1150000, md(28));
    add('رواتب الكادر الإداري والخدمي', 'salaries', 3 * 850000, md(28));
    add('فاتورة الكهرباء', 'utilities', 420000 + Math.round(rnd() * 120000 / 1000) * 1000, md(10), 'مؤسسة الكهرباء');
    add('فاتورة المياه', 'utilities', 95000, md(12), 'مؤسسة المياه');
    add('وقود الحافلات', 'transport', 780000 + Math.round(rnd() * 200000 / 1000) * 1000, md(5), 'محطة الشهباء');
    add('قرطاسية ومستلزمات', 'supplies', 300000 + Math.round(rnd() * 400000 / 1000) * 1000, md(3), 'مكتبة النور');
  });
  expenses.push(mk({ title: 'صيانة مكيفات الصفوف', category: 'maintenance', amount: 1350000, date: addDays(start, -10), vendor: 'ورشة الأمل', note: '', approvedBy: null }));
  expenses.push(mk({ title: 'إصلاح شبكة الحاسوب', category: 'maintenance', amount: 640000, date: addDays(T, -9), vendor: 'تقنيات الشمال', note: '', approvedBy: null }));
  expenses.push(mk({ title: 'طباعة كتيبات الأنشطة', category: 'other', amount: 210000, date: addDays(T, -16), vendor: 'مطبعة الفجر', note: '', approvedBy: null }));
  onProgress(80);

  // users
  const users = [];
  users.push(mk({ ...(await makeUser('admin', 'admin', null, 'admin@abdulsalam.edu.sy')), prefs: { displayName: S.principalName } }));
  for (let i = 0; i < teachers.length; i++) users.push(mk(await makeUser('teacher', 'teacher' + (i + 1), teachers[i].id, teachers[i].email)));
  for (let i = 0; i < students.length; i++) users.push(mk(await makeUser('student', 'student' + (i + 1), students[i].id, '')));
  for (let i = 0; i < parents.length; i++) users.push(mk(await makeUser('parent', 'parent' + (i + 1), parents[i].id, '')));
  onProgress(92);

  // notifications
  const notifications = [];
  const uOf = (role, id) => users.find(u => u.role === role && u.linkedId === id);
  const n = (u, type, title, message, link, priority = 'normal', ago = 1, read = false) => u && notifications.push(mk({ userId: u.id, type, title, message, link, priority, read, readAt: read ? nowIso : null, createdAt: new Date(Date.now() - ago * 36e5).toISOString() }));
  const riskKid = students[100];
  const lastAbs = attendance.filter(a => a.studentId === riskKid.id && a.status === 'absent').pop();
  if (lastAbs) n(uOf('parent', parents[0].id), 'absence', 'تسجيل غياب', `تم تسجيل غياب الطالب ${riskKid.fullName} يوم ${DAYS[dow(lastAbs.date)]} ${fmtDate(lastAbs.date)}.`, 'student-' + riskKid.id, 'high', 20);
  n(uOf('parent', parents[0].id), 'grades', 'نُشرت درجات جديدة', 'نُشرت نتائج «مشاركة صفية» في جميع المواد.', 'grades', 'normal', 30, true);
  n(uOf('parent', parents[0].id), 'payment', 'تذكير بقسط مستحق', `القسط الأول من الرسوم الدراسية مستحق منذ ${fmtDate(addDays(start, 14))}.`, 'payments', 'high', 50);
  users.filter(u => u.role === 'parent').forEach(u => n(u, 'meeting', 'اجتماع أولياء الأمور', `يسرّ إدارة المدرسة دعوتكم لاجتماع أولياء الأمور يوم الخميس ${fmtDate(addDays(T, 7))} الساعة 12:30 في قاعة المدرسة.`, null, 'normal', 26, false));
  users.filter(u => u.role === 'teacher').forEach(u => n(u, 'announcement', 'موعد تسليم درجات الشهر', `يرجى استكمال إدخال درجات الاختبارات الشهرية قبل ${fmtDate(addDays(T, 3))}.`, 'grades', 'normal', 6));
  n(users[0], 'general', 'مرحبًا بك في النظام', 'تم تجهيز بيانات تجريبية واقعية لتجربة كل الوحدات. يمكنك إعادة ضبطها من الإعدادات.', 'settings', 'normal', 2);

  Repo.hardSet('academicYears', [year]); Repo.hardSet('subjects', subjects); Repo.hardSet('teachers', teachers); Repo.hardSet('classes', classes);
  Repo.hardSet('teachingAssignments', A); Repo.hardSet('periods', periods); Repo.hardSet('schedules', schedules);
  Repo.hardSet('parents', parents); Repo.hardSet('students', students); Repo.hardSet('attendance', attendance);
  Repo.hardSet('assessments', assessments); Repo.hardSet('grades', grades); Repo.hardSet('certificates', []);
  Repo.hardSet('fees', fees); Repo.hardSet('payments', payments); Repo.hardSet('expenses', expenses);
  Repo.hardSet('users', users); Repo.hardSet('notifications', notifications); Repo.hardSet('auditLog', []);
  // persist stored fee status
  Repo.all('fees').forEach(f => { f.status = feeInfo(f).status; }); Repo.hardSet('fees', Repo.raw('fees'));
  onProgress(100);
}

export { seedDemo };
