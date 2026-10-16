/* =====================================================================
   Pages A — لوحات التحكم، الطلاب، المدرسون، الفصول، المواد
   ===================================================================== */
const riskBadge = st => { const r = risk(st); const [l, c] = RISK_LABEL[r.level]; return badge(l, c); };
const statusBadge = s => badge(STATUS_LABEL[s] || s, STATUS_CLS[s] || '');
const studentLink = s => person(s.fullName, nameOf.cls(s.classId) + ' · ' + s.studentNo, () => go('student', s.id));
function insightsPanel(u, limit = 6) {
  const list = insights(u).slice(0, limit);
  return card('رؤى ذكية', list.length ? h('div', {}, list.map(i => h('div', { class: 'insight ' + i.sev }, h('div', { class: 'ic' }, icon(i.ic, 17)), h('div', { style: { flex: 1, minWidth: 0 } }, h('b', {}, i.title), h('p', {}, i.text)), i.link ? h('button', { class: 'btn ghost xs', onclick: () => go(i.link) }, 'عرض') : null))) : emptyState('لا توجد ملاحظات تستدعي الانتباه حاليًا.', null, 'ok'), { sub: 'من بياناتك الفعلية', actions: [h('button', { class: 'btn ghost sm', onclick: () => go('assistant') }, icon('sparkles', 15), 'اسأل المساعد')] });
}
function lastDays(n) { const ds = recordedDates(); return ds.slice(-n); }
function riskTable(list, limit = 8) {
  if (!list.length) return emptyState('لا يوجد طلاب بمؤشر خطر حاليًا.', null, 'ok');
  return h('div', { class: 'list' }, list.slice(0, limit).map(({ st, r }) => h('div', { class: 'li' }, avatar(st.fullName), h('div', { class: 'bd' }, h('a', { href: '#student-' + st.id }, h('b', {}, st.fullName)), h('span', {}, nameOf.cls(st.classId) + ' · ' + (r.factors[0] ? r.factors[0].text : ''))), gauge0(r))));
}
const gauge0 = r => h('span', { class: 'badge ' + RISK_LABEL[r.level][1], title: 'درجة الخطر' }, fmtNum(r.score));

/* ---------- Dashboard ---------- */
PAGE_RENDER.dashboard = (page) => {
  const u = App.user;
  ({ admin: dashAdmin, teacher: dashTeacher, student: dashFamily, parent: dashFamily })[u.role](page, u);
};
function greeting() { const hr = new Date().getHours(); return hr < 12 ? 'صباح الخير' : 'مساء الخير'; }
function dashAdmin(page, u) {
  const T = todayISO(); const S = Settings.get();
  const sts = activeStudents(); const todayRecs = Idx().attByDate.get(T) || [];
  const at = attStats(todayRecs); const ft = financeTotals();
  const recordedCls = new Set(todayRecs.map(r => r.classId)); const classes = Repo.all('classes').sort(byClass);
  const days = lastDays(20); const dayRates = days.map(d => attStats(Idx().attByDate.get(d) || []).rate);
  const prevRate = avg(dayRates.slice(-10, -1).filter(v => v != null));
  page.append(pageHead(`${greeting()}، ${displayName(u)}`, `${DAYS[dow(T)]} ${fmtDate(T)} · ${S.termName} · العام الدراسي ${S.academicYear}`, h('button', { class: 'btn', onclick: () => go('reports') }, icon('chart', 16), 'التقارير'), h('button', { class: 'btn primary', onclick: () => go('attendance') }, icon('check', 16), 'الحضور اليوم')));
  page.append(h('div', { class: 'kpis' },
    kpi({ label: 'إجمالي الطلاب', value: fmtNum(sts.length), sub: `${fmtNum(sts.filter(s => s.gender === 'male').length)} ذكور · ${fmtNum(sts.filter(s => s.gender === 'female').length)} إناث`, ic: 'users' }),
    kpi({ label: 'المدرسون', value: fmtNum(Repo.where('teachers', t => t.status === 'active').length), sub: `${fmtNum(Repo.all('teachers').length)} في الكادر`, ic: 'briefcase' }),
    kpi({ label: 'الفصول', value: fmtNum(classes.length), sub: `${fmtNum(Repo.all('subjects').length)} مادة دراسية`, ic: 'layers' }),
    kpi({ label: 'المواد', value: fmtNum(Repo.all('subjects').length), sub: `${fmtNum(Repo.all('schedules').length)} حصة أسبوعيًا`, ic: 'book' }),
    kpi({ label: 'الحضور اليوم', value: at.total ? fmtPct(at.rate, 1) : '—', tone: at.rate == null ? '' : at.rate >= 92 ? 'ok' : at.rate >= 85 ? 'warn' : 'bad', ic: 'check', sub: at.total ? [prevRate != null ? h('span', { class: at.rate >= prevRate ? 'trend-up' : 'trend-down' }, (at.rate >= prevRate ? '▲ ' : '▼ ') + fmtNum(Math.abs(at.rate - prevRate), 1)) : null, `مقابل متوسط آخر أسبوعين · ${fmtNum(recordedCls.size)}/${fmtNum(classes.length)} فصول سُجّلت`] : 'لم يُسجَّل بعد', extra: spark(dayRates, 'var(--c2)') }),
    kpi({ label: 'الغياب اليوم', value: fmtNum(at.absent), tone: at.absent ? 'bad' : 'ok', ic: 'user', sub: `${fmtNum(at.late)} متأخر · ${fmtNum(at.excused)} بعذر` }),
    kpi({ label: 'الرسوم المدفوعة', value: shortNum(ft.paid), tone: 'ok', ic: 'wallet', sub: `${fmtPct(ft.rate, 1)} من المستحق (${fmtMoney(ft.net)})`, extra: progress(ft.rate, ft.rate >= S.collectionTarget ? 'ok' : 'warn') }),
    kpi({ label: 'الرسوم المتبقية', value: shortNum(ft.remaining), tone: ft.overdue ? 'bad' : 'warn', ic: 'receipt', sub: `منها ${fmtMoney(ft.overdue)} متأخرة لدى ${fmtNum(ft.overdueStudents)} طالبًا` })));

  const missing = classes.filter(c => !recordedCls.has(c.id));
  if (S.schoolDays.includes(dow(T)) && missing.length) page.append(banner(h('span', {}, `لم يُسجَّل حضور اليوم بعد في: ${missing.map(c => c.name).join('، ')}. `, h('a', { href: '#attendance' }, 'افتح صفحة الحضور')), 'warn', 'clock'));

  const perClass = classes.map(c => ({ c, n: classStudents(c.id).length }));
  const subjAvg = Repo.all('subjects').map(s => ({ label: s.name, value: avg(sts.map(st => subjectResult(st, s.id).percent).filter(v => v != null)), color: s.color }));
  const months = []; { let m = parseISO(T); m.setDate(1); for (let i = 0; i < 4; i++) { months.unshift(iso(m).slice(0, 7)); m.setMonth(m.getMonth() - 1); } }
  const rev = months.map(k => sum(Repo.all('payments').filter(p => p.paidAt.slice(0, 7) === k).map(p => p.amount)));
  const exp = months.map(k => sum(Repo.all('expenses').filter(e => e.date.slice(0, 7) === k).map(e => e.amount)));
  const risky = atRisk(sts, 'medium');
  page.append(h('div', { class: 'grid g-main' },
    card('الحضور اليومي', lineChart({ labels: days.map(fmtDateShort), series: [{ name: 'نسبة الحضور', values: dayRates, color: 'var(--c2)' }], min: 70, max: 100, fmt: v => fmtNum(v) + '%', tip: v => fmtPct(v, 1) }), { sub: 'آخر 20 يومًا دراسيًا' }),
    insightsPanel(u, 5)));
  page.append(h('div', { class: 'grid g3' },
    card('الطلاب في كل فصل', hbars(perClass.map(x => ({ label: x.c.name, value: x.n, color: x.n >= (x.c.capacity || 99) ? 'var(--c3)' : 'var(--c1)' })), { max: Math.max(...perClass.map(x => x.c.capacity || x.n)), fmt: v => fmtNum(v) }), { sub: 'من السعة' }),
    card('الطلاب حسب الصف', donut({ items: [...groupBy(sts, s => s.gradeLevel).entries()].sort((a, b) => a[0] - b[0]).map(([g, l], i) => ({ label: gradeName(g), value: l.length, color: ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'][i % 5] })), center: fmtNum(sts.length), sub: 'طالبًا' })),
    card('الطلاب حسب الجنس', donut({ items: [{ label: 'ذكور', value: sts.filter(s => s.gender === 'male').length, color: 'var(--c1)' }, { label: 'إناث', value: sts.filter(s => s.gender === 'female').length, color: 'var(--c3)' }], center: fmtNum(sts.length), sub: 'طالبًا' }))));
  page.append(h('div', { class: 'grid g2' },
    card('متوسط الدرجات حسب المادة', hbars(subjAvg.sort((a, b) => b.value - a.value), { max: 100 }), { sub: 'كل الفصول' }),
    card('الإيرادات والمصروفات', barChart({ labels: months.map(k => monthLabel(k).split(' ')[0]), series: [{ name: 'الإيرادات (مدفوعات)', values: rev, color: 'var(--c2)' }, { name: 'المصروفات', values: exp, color: 'var(--c3)' }], tip: v => fmtMoney(v) }), { sub: 'آخر 4 أشهر' })));
  const recent = Repo.all('auditLog').slice(-7).reverse();
  page.append(h('div', { class: 'grid g2' },
    card('طلاب يحتاجون متابعة', riskTable(risky, 7), { sub: `${fmtNum(risky.length)} طالبًا`, actions: [h('button', { class: 'btn ghost sm', onclick: () => { Store.ss.set('ass:stFilterRisk', '1'); go('students'); } }, 'عرض الكل')] }),
    card('آخر النشاطات', recent.length ? h('div', { class: 'list' }, recent.map(a => h('div', { class: 'li' }, h('span', { class: 'kpi-ic' }, icon(a.action === 'login' ? 'key' : a.action === 'delete' ? 'trash' : a.action === 'create' ? 'plus' : 'edit', 15)), h('div', { class: 'bd' }, h('b', {}, `${ACTION_LABEL[a.action] || a.action} · ${ENTITY_LABEL[a.entity] || a.entity}`), h('span', {}, nameOf.user(a.userId) + ' · ' + relTime(a.at)))))) : emptyState('لا يوجد نشاط مسجّل بعد'), { actions: [h('button', { class: 'btn ghost sm', onclick: () => go('audit') }, 'سجل النشاط')] })));
}

function todayLessons(rows) {
  const ps = periodsSorted(); const now = new Date(); const hm = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  return rows.sort((a, b) => (Repo.get('periods', a.periodId) || {}).order - (Repo.get('periods', b.periodId) || {}).order).map(s => {
    const p = Repo.get('periods', s.periodId) || {}; const subj = Repo.get('subjects', s.subjectId) || {};
    const live = hm >= p.startTime && hm <= p.endTime;
    return { s, p, subj, live };
  });
}
function dashTeacher(page, u) {
  const T = todayISO(); const t = Repo.get('teachers', u.linkedId) || {};
  const myCls = Scope.classes(u); const sts = Scope.students(u).filter(s => s.status === 'active');
  const lessons = todayLessons(Repo.where('schedules', s => s.teacherId === u.linkedId && s.dayOfWeek === dow(T)));
  const recorded = new Set((Idx().attByDate.get(T) || []).map(r => r.classId));
  const asg = Scope.assignments(u);
  const pending = Repo.all('assessments').filter(a => asg.some(x => x.classId === a.classId && x.subjectId === a.subjectId)).filter(a => { const n = (Idx().gradesByAssess.get(a.id) || []).filter(hasScore).length; return n < classStudents(a.classId).length || !a.isPublished; });
  const risky = atRisk(sts, 'medium');
  page.append(pageHead(`${greeting()}، ${t.fullName || displayName(u)}`, `${DAYS[dow(T)]} ${fmtDate(T)} · ${t.specialization || ''}`, h('button', { class: 'btn', onclick: () => go('grades') }, icon('pen', 16), 'إدخال الدرجات'), h('button', { class: 'btn primary', onclick: () => go('attendance') }, icon('check', 16), 'تسجيل الحضور')));
  page.append(h('div', { class: 'kpis' },
    kpi({ label: 'حصص اليوم', value: fmtNum(lessons.length), ic: 'calendar', sub: `${fmtNum(teacherLoad(u.linkedId))} حصة أسبوعيًا` }),
    kpi({ label: 'طلابي', value: fmtNum(sts.length), ic: 'users', sub: `في ${fmtNum(myCls.length)} فصول` }),
    kpi({ label: 'تقييمات تنتظر إجراء', value: fmtNum(pending.length), tone: pending.length ? 'warn' : 'ok', ic: 'pen', sub: 'درجات ناقصة أو غير منشورة' }),
    kpi({ label: 'يحتاجون متابعة', value: fmtNum(risky.length), tone: risky.some(x => x.r.level === 'high') ? 'bad' : risky.length ? 'warn' : 'ok', ic: 'alert', sub: `${fmtNum(risky.filter(x => x.r.level === 'high').length)} في خطر مرتفع` })));
  page.append(h('div', { class: 'grid g-main' },
    card('حصصي اليوم', lessons.length ? h('div', {}, lessons.map(({ s, p, subj, live }) => h('div', { class: 'lesson' }, h('div', { class: 'p' }, h('b', {}, fmtNum(p.order)), h('span', {}, p.startTime)), h('span', { class: 'dot', style: { background: subj.color } }), h('div', { class: 'bd' }, h('b', {}, subj.name + ' — ' + nameOf.cls(s.classId)), h('span', {}, `${p.startTime} – ${p.endTime}` + (live ? ' · الآن' : ''))), recorded.has(s.classId) ? badge('سُجّل الحضور', 'ok') : h('button', { class: 'btn soft sm', onclick: () => { Store.ss.set('ass:attClass', s.classId); go('attendance'); } }, 'سجّل الحضور')))) : emptyState(Settings.get().schoolDays.includes(dow(T)) ? 'لا حصص لك اليوم.' : 'اليوم عطلة.', null, 'calendar')),
    insightsPanel(u, 5)));
  page.append(h('div', { class: 'grid g2' },
    card('تقييمات تنتظر إجراء', pending.length ? h('div', { class: 'list' }, pending.slice(0, 8).map(a => { const n = (Idx().gradesByAssess.get(a.id) || []).filter(hasScore).length; return h('div', { class: 'li' }, h('div', { class: 'bd' }, h('b', {}, a.name), h('span', {}, `${nameOf.subj(a.subjectId)} · ${nameOf.cls(a.classId)} · ${fmtDate(a.date)}`)), badge(`${fmtNum(n)}/${fmtNum(classStudents(a.classId).length)}`, n ? 'warn' : 'bad', true), a.isPublished ? null : badge('غير منشور', '', true), h('button', { class: 'btn ghost xs', onclick: () => { Store.ss.set('ass:gradeSel', a.classId + '|' + a.subjectId); go('grades'); } }, 'فتح')); })) : emptyState('كل التقييمات مكتملة ومنشورة.', null, 'ok')),
    card('طلاب يحتاجون متابعة', riskTable(risky, 7))));
  page.append(card('متوسطات فصولي', hbars(asg.map(a => ({ label: nameOf.subj(a.subjectId) + ' — ' + nameOf.cls(a.classId), value: avg(classStudents(a.classId).map(s => subjectResult(s, a.subjectId).percent).filter(v => v != null)) })).filter(r => r.value != null).sort((a, b) => b.value - a.value), { max: 100 })));
}
function childPicker(u, cur, onPick) {
  const kids = Scope.students(u); if (kids.length <= 1) return null;
  return seg(kids.map(k => [k.id, k.fullName.split(' ')[0]]), cur, onPick);
}
function dashFamily(page, u) {
  const kids = Scope.students(u); const T = todayISO();
  page.append(pageHead(`${greeting()}، ${displayName(u)}`, u.role === 'parent' ? `متابعة ${kids.length > 1 ? 'أبنائك' : 'ابنك'} في ${Settings.get().schoolName}` : `${nameOf.cls(kids[0] && kids[0].classId)} · ${DAYS[dow(T)]} ${fmtDate(T)}`));
  if (!kids.length) { page.append(emptyState('لا يوجد طالب مرتبط بهذا الحساب. تواصل مع إدارة المدرسة.')); return; }
  kids.forEach(st => {
    const res = studentResults(st); const a30 = studentAtt(st.id, addDays(T, -29), T); const fin = studentFinance(st.id); const r = risk(st);
    const series = gradeSeries(st).map(x => x.p); const rank = classRanking(st.classId).get(st.id);
    const lessons = todayLessons(Repo.where('schedules', s => s.classId === st.classId && s.dayOfWeek === dow(T)));
    const recentGrades = assessmentsFor(st.classId, null, { publishedOnly: true }).map(a => ({ a, g: gradeOf(a.id, st.id) })).filter(x => hasScore(x.g)).slice(-6).reverse();
    const sec = h('section', { class: 'stack', style: { gap: '14px' } });
    if (u.role === 'parent') sec.append(h('div', { class: 'row between' }, person(st.fullName, nameOf.cls(st.classId) + ' · ' + st.studentNo), h('div', { class: 'row' }, badge(RISK_LABEL[r.level][0], RISK_LABEL[r.level][1]), h('button', { class: 'btn sm', onclick: () => go('student', st.id) }, 'الملف الكامل'))));
    sec.append(h('div', { class: 'kpis' },
      kpi({ label: 'المعدل الحالي', value: fmtPct(res.avg, 1), ic: 'award', tone: gradeTone(res.avg), sub: [gradeLabel(res.avg), rank ? ` · الترتيب ${fmtNum(rank)} من ${fmtNum(classStudents(st.classId).length)}` : ''], extra: spark(series, 'var(--c1)') }),
      kpi({ label: 'الحضور (30 يومًا)', value: fmtPct(a30.rate, 1), ic: 'check', tone: a30.rate >= 92 ? 'ok' : a30.rate >= 85 ? 'warn' : 'bad', sub: `${fmtNum(a30.absent)} غياب · ${fmtNum(a30.late)} تأخر · ${fmtNum(a30.excused)} بعذر` }),
      kpi({ label: 'المواد', value: fmtNum(res.rows.length), ic: 'book', tone: res.failing ? 'bad' : 'ok', sub: res.failing ? `${fmtNum(res.failing)} تحت خط النجاح` : 'كلها فوق خط النجاح' }),
      kpi({ label: 'الرسوم المتبقية', value: fmtMoney(fin.remaining), ic: 'wallet', tone: fin.overdue ? 'bad' : fin.remaining ? 'warn' : 'ok', sub: fin.overdue ? `منها ${fmtMoney(fin.overdue)} متأخرة` : fin.remaining ? 'لا متأخرات' : 'مسددة بالكامل' })));
    sec.append(h('div', { class: 'grid g2' },
      card('حصص اليوم', lessons.length ? h('div', {}, lessons.map(({ p, subj, s, live }) => h('div', { class: 'lesson' }, h('div', { class: 'p' }, h('b', {}, fmtNum(p.order)), h('span', {}, p.startTime)), h('span', { class: 'dot', style: { background: subj.color } }), h('div', { class: 'bd' }, h('b', {}, subj.name), h('span', {}, nameOf.tch(s.teacherId) + (live ? ' · الآن' : '')))))) : emptyState(Settings.get().schoolDays.includes(dow(T)) ? 'لا حصص اليوم.' : 'اليوم عطلة.', null, 'calendar')),
      card('آخر الدرجات', recentGrades.length ? h('div', { class: 'list' }, recentGrades.map(({ a, g }) => { const p = g.score / a.maxScore * 100; return h('div', { class: 'li' }, h('span', { class: 'dot', style: { width: '10px', height: '10px', borderRadius: '3px', background: (Repo.get('subjects', a.subjectId) || {}).color } }), h('div', { class: 'bd' }, h('b', {}, nameOf.subj(a.subjectId) + ' — ' + a.name), h('span', {}, fmtDate(a.date))), h('b', { class: 'tabnum' }, `${fmtNum(g.score, g.score % 1 ? 1 : 0)}/${fmtNum(a.maxScore)}`), badge(fmtPct(p), gradeTone(p), true)); })) : emptyState('لا درجات منشورة بعد.'), { actions: [h('button', { class: 'btn ghost sm', onclick: () => go('grades') }, 'كل الدرجات')] })));
    if (u.role === 'parent' && r.level !== 'low') sec.append(card('مؤشر المتابعة', riskCard(st)));
    page.append(sec);
  });
  const notes = Notify.mine(u).slice(0, 5);
  page.append(card('آخر الإشعارات', notes.length ? h('div', {}, notes.map(n => notifRow(n))) : emptyState('لا إشعارات', null, 'bell'), { flush: true, actions: [h('button', { class: 'btn ghost sm', onclick: () => go('notifications') }, 'الكل')] }));
}
function riskCard(st) {
  const r = risk(st); const [l, c] = RISK_LABEL[r.level];
  return h('div', { class: 'stack', style: { gap: '12px' } },
    h('div', { class: 'risk' }, gauge(r.score, c), h('div', { class: 'stack', style: { gap: '6px', flex: 1, minWidth: '200px' } }, h('div', { class: 'row' }, badge(l, c), h('span', { class: 'muted small' }, 'درجة من 100 تجمع: الغياب 35% · التحصيل 30% · اتجاه الدرجات 20% · المواد الراسبة 10% · التأخر 5%')),
      r.factors.length ? h('ul', { class: 'factors' }, r.factors.map(f => h('li', {}, f.text))) : h('div', { class: 'muted' }, 'لا عوامل خطر ملحوظة.'))),
    h('div', { class: 'rec' }, h('b', {}, 'التوصية: '), r.rec));
}

/* ---------- Students ---------- */
const genderLabel = g => g === 'female' ? 'أنثى' : 'ذكر';
PAGE_RENDER.students = (page) => {
  const u = App.user; const admin = isAdmin(u);
  const riskPre = Store.ss.get('ass:stFilterRisk'); Store.ss.del('ass:stFilterRisk');
  const classes = Scope.classes(u);
  const T = todayISO();
  const table = DataTable({
    id: 'students', unit: 'طالب', exportName: 'students', searchPh: 'ابحث بالاسم أو الرقم أو ولي الأمر...',
    rows: () => Scope.students(u),
    searchText: s => s.fullName + ' ' + s.studentNo + ' ' + (Repo.get('parents', s.parentId) || {}).fullName + ' ' + s.phone,
    filters: [
      { label: 'كل الفصول', options: classes.map(c => [c.id, c.name]), test: (s, v) => s.classId === v },
      { label: 'كل الحالات', options: Object.entries(STATUS_LABEL), test: (s, v) => s.status === v, value: 'active' },
      { label: 'الجنس', options: [['male', 'ذكور'], ['female', 'إناث']], test: (s, v) => s.gender === v },
      { label: 'مؤشر المتابعة', options: [['high', 'خطر مرتفع'], ['medium', 'يحتاج متابعة'], ['risk', 'مرتفع أو متابعة'], ['low', 'مستقر']], test: (s, v) => v === 'risk' ? risk(s).level !== 'low' : risk(s).level === v, value: riskPre ? 'risk' : '' }
    ],
    columns: [
      { label: 'الطالب', render: s => studentLink(s), sort: s => s.fullName, csv: s => s.fullName },
      { label: 'الرقم', key: 'studentNo', cls: 'tabnum', render: s => h('span', { class: 'ltr muted' }, s.studentNo) },
      { label: 'الفصل', sort: s => nameOf.cls(s.classId), render: s => nameOf.cls(s.classId) },
      { label: 'ولي الأمر', sort: s => (Repo.get('parents', s.parentId) || {}).fullName || '', render: s => { const p = Repo.get('parents', s.parentId); return p ? h('div', {}, h('div', {}, p.fullName), h('div', { class: 'muted small ltr' }, p.phone)) : '—'; } },
      { label: 'الحضور (30 يومًا)', sort: s => studentAtt(s.id, addDays(T, -29), T).rate, render: s => pctCell(studentAtt(s.id, addDays(T, -29), T).rate), csv: s => fmtNum(studentAtt(s.id, addDays(T, -29), T).rate, 1) },
      { label: 'المعدل', desc: true, sort: s => studentResults(s).avg, render: s => { const a = studentResults(s).avg; return a == null ? '—' : h('span', { class: 'tabnum' }, fmtPct(a, 1)); }, csv: s => fmtNum(studentResults(s).avg, 1) },
      { label: 'المتابعة', desc: true, sort: s => risk(s).score, render: s => riskBadge(s), csv: s => RISK_LABEL[risk(s).level][0] },
      { label: 'الحالة', sort: s => s.status, render: s => statusBadge(s.status), csv: s => STATUS_LABEL[s.status] },
      { label: '', sortable: false, cls: 'acts', csv: false, render: s => h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '2px' } }, h('button', { class: 'icon-btn sm', title: 'عرض الملف', 'aria-label': 'عرض الملف', onclick: () => go('student', s.id) }, icon('eye', 16)), admin ? h('button', { class: 'icon-btn sm', title: 'تعديل', 'aria-label': 'تعديل', onclick: () => studentForm(s) }, icon('edit', 16)) : null, admin ? h('button', { class: 'icon-btn sm danger', title: 'حذف', 'aria-label': 'حذف', onclick: () => deleteStudent(s) }, icon('trash', 16)) : null) }
    ],
    onRow: s => go('student', s.id)
  });
  const sts = Scope.students(u).filter(s => s.status === 'active');
  page.append(pageHead(u.role === 'teacher' ? 'طلابي' : 'الطلاب', u.role === 'teacher' ? 'طلاب الفصول المسندة إليك (عرض فقط)' : `${fmtNum(sts.length)} طالبًا نشطًا في ${fmtNum(classes.length)} فصول`, admin ? h('button', { class: 'btn primary', onclick: () => studentForm() }, icon('plus', 16), 'إضافة طالب') : null));
  page.append(card(null, table));
};
function studentForm(st) {
  const classes = Repo.all('classes').sort(byClass);
  const parents = Repo.all('parents').sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
  const p = st ? Repo.get('parents', st.parentId) : null;
  formModal({
    title: st ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد', size: 'lg', submit: st ? 'حفظ التعديلات' : 'إضافة الطالب',
    values: st ? { ...st, parentId: st.parentId } : { status: 'active', registrationDate: todayISO(), gender: 'male' },
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
    onSubmit: async (v) => {
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
      render();
    }
  });
}
async function deleteStudent(s) {
  const hasMoney = (Idx().payByStudent.get(s.id) || []).length; const hasGrades = Repo.all('grades').some(g => g.studentId === s.id && hasScore(g));
  if (hasMoney || hasGrades) {
    const ok = await confirmDialog({ title: 'لا يمكن حذف الطالب', message: `لدى ${s.fullName} ${hasMoney ? 'مدفوعات' : ''}${hasMoney && hasGrades ? ' و' : ''}${hasGrades ? 'درجات' : ''} مسجّلة، والحذف سيُفقد السجل المالي والأكاديمي. يمكنك بدلًا من ذلك تغيير حالته إلى «منقول». هل تريد ذلك؟`, ok: 'تغيير الحالة إلى منقول' });
    if (ok) { Repo.update('students', s.id, { status: 'transferred' }); toast.success('تم تغيير حالة الطالب إلى منقول'); render(); }
    return;
  }
  if (!(await confirmDialog({ title: 'حذف طالب', message: `هل أنت متأكد من حذف الطالب ${s.fullName}؟`, ok: 'حذف', danger: true }))) return;
  Repo.remove('students', s.id); render();
  toast.success('تم حذف الطالب', { undo: () => { Repo.restore('students', s.id); render(); } });
}

function credsModal(title, creds) {
  const text = creds.map(([r, un, pw]) => `${r}: ${un} / ${pw}`).join('\n');
  const m = openModal({ title, size: 'sm', body: [h('p', { class: 'mb muted' }, 'سلّم بيانات الدخول لأصحابها. كلمة المرور مؤقتة وتظهر هذه المرة فقط، ويُطلب تغييرها عند أول دخول.'), h('div', { class: 'stack' }, creds.map(([r, un, pw]) => h('div', { class: 'demo' }, h('b', {}, r), h('code', {}, un + ' / ' + pw))))], footer: [h('button', { class: 'btn primary', onclick: () => m.close() }, 'تم'), h('button', { class: 'btn', onclick: () => copyText(text, 'نُسخت بيانات الدخول') }, icon('copy', 15), 'نسخ')] });
}

/* ---------- Student details ---------- */
PAGE_RENDER.student = (page, id) => {
  const u = App.user; const st = Repo.get('students', id);
  if (!st || !Scope.canStudent(u, id)) { page.append(forbidden()); return; }
  const T = todayISO(); const par = Repo.get('parents', st.parentId); const cls = Repo.get('classes', st.classId);
  const res = studentResults(st); const a30 = studentAtt(st.id, addDays(T, -29), T); const aAll = studentAtt(st.id); const fin = studentFinance(st.id);
  const rank = classRanking(st.classId).get(st.id); const showFin = u.role !== 'teacher';
  page.append(h('div', { class: 'row between' }, h('button', { class: 'btn ghost sm', onclick: () => history.length > 1 ? history.back() : go(u.role === 'admin' || u.role === 'teacher' ? 'students' : 'dashboard') }, icon('back', 16), 'رجوع'), isAdmin(u) ? h('button', { class: 'btn', onclick: () => studentForm(st) }, icon('edit', 16), 'تعديل البيانات') : null));
  page.append(card(null, h('div', { class: 'row', style: { gap: '18px', alignItems: 'flex-start' } }, avatar(st.fullName, 'lg'), h('div', { class: 'stack', style: { gap: '8px', flex: 1, minWidth: '240px' } },
    h('div', { class: 'row' }, h('h1', { style: { font: '600 23px var(--f-display)' } }, st.fullName), statusBadge(st.status), riskBadge(st)),
    h('div', { class: 'row muted small', style: { gap: '16px' } }, h('span', {}, cls ? cls.name : '—'), h('span', { class: 'ltr' }, st.studentNo), h('span', {}, genderLabel(st.gender)), h('span', {}, 'مواليد ' + fmtDate(st.birthDate)), h('span', {}, 'مسجّل منذ ' + fmtDate(st.registrationDate))),
    h('div', { class: 'row small', style: { gap: '16px' } }, h('span', {}, h('span', { class: 'muted' }, 'ولي الأمر: '), par ? par.fullName : '—'), par ? h('span', { class: 'ltr' }, par.phone) : null, h('span', {}, h('span', { class: 'muted' }, 'المربي: '), cls ? nameOf.tch(cls.homeroomTeacherId) : '—'))))));
  page.append(h('div', { class: 'kpis' },
    kpi({ label: 'المعدل الحالي', value: fmtPct(res.avg, 1), ic: 'award', tone: gradeTone(res.avg), sub: gradeLabel(res.avg) + (rank ? ` · الترتيب ${fmtNum(rank)} من ${fmtNum(classStudents(st.classId).length)}` : ''), extra: spark(gradeSeries(st).map(x => x.p)) }),
    kpi({ label: 'الحضور (30 يومًا)', value: fmtPct(a30.rate, 1), ic: 'check', tone: a30.rate >= 92 ? 'ok' : a30.rate >= 85 ? 'warn' : 'bad', sub: `منذ بداية الفصل ${fmtPct(aAll.rate, 1)}` }),
    kpi({ label: 'المواد الراسبة', value: fmtNum(res.failing), ic: 'book', tone: res.failing ? 'bad' : 'ok', sub: res.result ? 'النتيجة المتوقعة: ' + RESULT_LABEL[res.result][0] : '—' }),
    showFin ? kpi({ label: 'الرسوم المتبقية', value: fmtMoney(fin.remaining), ic: 'wallet', tone: fin.overdue ? 'bad' : fin.remaining ? 'warn' : 'ok', sub: `مدفوع ${fmtMoney(fin.paid)} من ${fmtMoney(fin.net)}` }) : kpi({ label: 'التأخر الصباحي', value: fmtNum(aAll.late), ic: 'clock', tone: aAll.late > 3 ? 'warn' : 'ok', sub: 'منذ بداية الفصل' })));
  const items = [
    { key: 'overview', label: 'نظرة عامة', render: () => h('div', { class: 'grid g-main' }, card('النتائج حسب المادة', subjectsTable(st), { flush: true }), card('مؤشر المتابعة الذكي', riskCard(st))) },
    { key: 'att', label: 'الحضور', render: () => { const recs = (Idx().attByStudent.get(st.id) || []).slice().sort((a, b) => a.date < b.date ? 1 : -1); const ds = recordedDates(); return h('div', { class: 'grid g2' }, card('تقويم الحضور', attCalendar(recs, ds[0] || addDays(T, -35), T)), card('سجل الغياب والتأخر', recs.filter(r => r.status !== 'present').length ? h('div', { class: 'list' }, recs.filter(r => r.status !== 'present').map(r => h('div', { class: 'li' }, badge(ATT_LABEL[r.status], ATT_CLS[r.status]), h('div', { class: 'bd' }, h('b', {}, DAYS[dow(r.date)] + ' ' + fmtDate(r.date)), h('span', {}, r.reason || 'بدون سبب مسجّل'))))) : emptyState('لا غياب ولا تأخر. التزام ممتاز.', null, 'ok'))); } },
    { key: 'grades', label: 'الدرجات', render: () => { const ser = gradeSeries(st); return h('div', { class: 'stack', style: { gap: '16px' } }, card('تطور الدرجات', ser.length >= 2 ? lineChart({ labels: ser.map(x => fmtDateShort(x.date)), series: [{ name: 'متوسط الطالب', values: ser.map(x => x.p), color: 'var(--c1)' }], min: 0, max: 100, fmt: v => fmtNum(v) + '%', tip: v => fmtPct(v, 1) }) : emptyState('تحتاج تقييمين على الأقل لعرض الاتجاه.')), card('تفاصيل التقييمات', assessmentsDetail(st), { flush: true })); } },
    showFin ? { key: 'fin', label: 'المالية', render: () => financeDetail(st) } : null,
    { key: 'certs', label: 'الشهادات', render: () => { const cs = Repo.where('certificates', c => c.studentId === st.id); return cs.length ? h('div', { class: 'list' }, cs.map(c => h('div', { class: 'li' }, icon('award', 20), h('div', { class: 'bd' }, h('b', {}, `${c.certNo} · ${fmtPct(c.percentage, 1)} — ${c.gradeLabel}`), h('span', {}, 'صدرت ' + fmtDate(c.issueDate))), badge(RESULT_LABEL[c.result][0], RESULT_LABEL[c.result][1]), h('button', { class: 'btn sm', onclick: () => showCertificate(c) }, 'عرض')))) : emptyState('لم تصدر شهادة لهذا الطالب بعد.', h('button', { class: 'btn sm', onclick: () => showProvisional(st) }, 'عرض كشف الدرجات المؤقت'), 'award'); } }
  ].filter(Boolean);
  page.append(tabs(items, 'overview'));
};
function subjectsTable(st) {
  const res = studentResults(st);
  if (!res.rows.length) return emptyState('لا درجات بعد.');
  return h('div', { class: 'tbl-wrap', style: { border: 0 } }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['المادة', 'النسبة', 'التقدير', 'الترتيب', 'التوقع'].map(x => h('th', {}, x)))), h('tbody', {}, res.rows.map(r => { const pr = predictSubject(st, r.subject.id); const rk = subjectRanking(st.classId, r.subject.id).get(st.id); return h('tr', {}, h('td', {}, h('span', { class: 'row', style: { gap: '8px' } }, h('i', { style: { width: '9px', height: '9px', borderRadius: '3px', background: r.subject.color, display: 'inline-block' } }), r.subject.name)), h('td', {}, pctCell(r.percent, r.percent < passOf(r.subject) ? 'bad' : r.percent >= 80 ? 'ok' : '')), h('td', {}, badge(gradeLabel(r.percent), gradeTone(r.percent), true)), h('td', { class: 'tabnum' }, rk ? fmtNum(rk) : '—'), h('td', { class: 'muted small tabnum', title: 'توقع إرشادي للدرجة النهائية حسب الاتجاه الحالي' }, pr ? `${fmtNum(pr.low)}–${fmtNum(pr.high)}%` : '—')); }))));
}
function assessmentsDetail(st) {
  const as = assessmentsFor(st.classId, null, { publishedOnly: App.user.role === 'student' || App.user.role === 'parent' });
  if (!as.length) return emptyState('لا تقييمات بعد.');
  return h('div', { class: 'tbl-wrap', style: { border: 0 } }, h('table', { class: 'tbl cards' }, h('thead', {}, h('tr', {}, ['التاريخ', 'المادة', 'التقييم', 'النوع', 'الدرجة', 'النسبة'].map(x => h('th', {}, x)))), h('tbody', {}, as.slice().reverse().map(a => { const g = gradeOf(a.id, st.id); const p = hasScore(g) ? g.score / a.maxScore * 100 : null; return h('tr', {}, h('td', { 'data-label': 'التاريخ' }, fmtDate(a.date)), h('td', { 'data-label': 'المادة' }, nameOf.subj(a.subjectId)), h('td', { 'data-label': 'التقييم' }, a.name), h('td', { 'data-label': 'النوع' }, EXAM_LABEL[a.type]), h('td', { 'data-label': 'الدرجة', class: 'tabnum' }, hasScore(g) ? `${fmtNum(g.score, g.score % 1 ? 1 : 0)} / ${fmtNum(a.maxScore)}` : '—'), h('td', { 'data-label': 'النسبة' }, p == null ? '—' : badge(fmtPct(p), gradeTone(p), true))); }))));
}
function financeDetail(st) {
  const fin = studentFinance(st.id);
  return h('div', { class: 'grid g2' },
    card('الرسوم المستحقة', fin.fees.length ? h('div', { class: 'tbl-wrap', style: { border: 0 } }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['البند', 'الاستحقاق', 'الصافي', 'المدفوع', 'الحالة'].map(x => h('th', {}, x)))), h('tbody', {}, fin.fees.map(f => h('tr', {}, h('td', {}, FEE_LABEL[f.fee.feeType] + (f.fee.label ? ' — ' + f.fee.label : '')), h('td', {}, fmtDate(f.fee.dueDate)), h('td', { class: 'tabnum' }, fmtMoney(f.net)), h('td', { class: 'tabnum' }, fmtMoney(f.paid)), h('td', {}, badge(PAY_STATUS[f.status][0], PAY_STATUS[f.status][1]))))))) : emptyState('لا رسوم'), { flush: true, sub: `المتبقي ${fmtMoney(fin.remaining)}` }),
    card('الإيصالات', fin.payments.length ? h('div', { class: 'list' }, [...groupBy(fin.payments, p => p.receiptNo).entries()].map(([no, ps]) => h('div', { class: 'li' }, icon('receipt', 18), h('div', { class: 'bd' }, h('b', { class: 'ltr' }, no), h('span', {}, fmtDateTime(ps[0].paidAt) + ' · ' + METHOD_LABEL[ps[0].method])), h('b', { class: 'tabnum' }, fmtMoney(sum(ps.map(p => p.amount)))), h('button', { class: 'btn ghost xs', onclick: () => showReceipt(no) }, 'عرض')))) : emptyState('لا مدفوعات بعد')));
}

/* ---------- Teachers ---------- */
PAGE_RENDER.teachers = (page) => {
  const table = DataTable({
    id: 'teachers', unit: 'مدرس', exportName: 'teachers', searchPh: 'ابحث بالاسم أو التخصص...',
    rows: () => Repo.all('teachers'),
    filters: [{ label: 'كل الحالات', options: Object.entries(T_STATUS).map(([k, v]) => [k, v[0]]), test: (t, v) => t.status === v }],
    columns: [
      { label: 'المدرس', sort: t => t.fullName, render: t => person(t.fullName, t.email), csv: t => t.fullName },
      { label: 'الرقم الوظيفي', key: 'employeeNo', render: t => h('span', { class: 'ltr muted' }, t.employeeNo) },
      { label: 'التخصص', key: 'specialization' },
      { label: 'الإسناد', sortable: false, render: t => { const as = Repo.where('teachingAssignments', a => a.teacherId === t.id); const g = groupBy(as, a => a.subjectId); return h('div', { class: 'stack', style: { gap: '4px' } }, [...g.entries()].map(([sid, l]) => h('span', { class: 'small' }, h('b', {}, nameOf.subj(sid)), ': ' + l.map(a => nameOf.cls(a.classId)).join('، ')))); }, csv: t => Repo.where('teachingAssignments', a => a.teacherId === t.id).map(a => nameOf.subj(a.subjectId) + '/' + nameOf.cls(a.classId)).join(' | ') },
      { label: 'الحمل الأسبوعي', desc: true, sort: t => teacherLoad(t.id), render: t => { const l = teacherLoad(t.id); return h('div', { class: 'pct-cell' }, h('b', { class: 'tabnum' }, `${fmtNum(l)}/${fmtNum(t.weeklyLoad)}`), progress(l / t.weeklyLoad * 100, l > t.weeklyLoad ? 'bad' : l / t.weeklyLoad > .9 ? 'warn' : 'ok')); }, csv: t => teacherLoad(t.id) },
      { label: 'الحالة', sort: t => t.status, render: t => badge(T_STATUS[t.status][0], T_STATUS[t.status][1]), csv: t => T_STATUS[t.status][0] },
      { label: '', sortable: false, cls: 'acts', csv: false, render: t => h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '2px' } }, h('button', { class: 'btn ghost xs', onclick: () => assignmentsModal(t) }, 'الإسناد'), h('button', { class: 'icon-btn sm', 'aria-label': 'الجدول', title: 'الجدول', onclick: () => { Store.ss.set('ass:schedMode', 'teacher|' + t.id); go('schedule'); } }, icon('calendar', 16)), h('button', { class: 'icon-btn sm', 'aria-label': 'تعديل', title: 'تعديل', onclick: () => teacherForm(t) }, icon('edit', 16)), h('button', { class: 'icon-btn sm danger', 'aria-label': 'حذف', title: 'حذف', onclick: () => deleteTeacher(t) }, icon('trash', 16))) }
    ]
  });
  const over = Repo.all('teachers').filter(t => teacherLoad(t.id) > t.weeklyLoad);
  page.append(pageHead('المدرسون', `${fmtNum(Repo.all('teachers').length)} مدرسًا · ${fmtNum(Repo.all('teachingAssignments').length)} إسنادًا (مادة × فصل)`, h('button', { class: 'btn primary', onclick: () => teacherForm() }, icon('plus', 16), 'إضافة مدرس')));
  if (over.length) page.append(banner(`تجاوز الحمل الأسبوعي: ${over.map(t => `${t.fullName} (${fmtNum(teacherLoad(t.id))}/${fmtNum(t.weeklyLoad)})`).join('، ')}.`, 'warn', 'alert'));
  page.append(card(null, table));
};
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
      if (t) { Repo.update('teachers', t.id, v); toast.success('تم حفظ بيانات المدرس'); }
      else {
        const no = v.employeeNo || 'EMP-' + String(Repo.raw('teachers').length + 1).padStart(4, '0');
        const nt = Repo.create('teachers', { ...v, employeeNo: no });
        try { const a = await Accounts.create('teacher', nt.id, v.email); credsModal(`حساب ${v.fullName}`, [['المدرس', a.username, a.password]]); } catch (e) { toast.error(e.message); }
        setTimeout(() => assignmentsModal(nt), 250);
      }
      render();
    }
  });
}
function assignmentsModal(t) {
  const body = h('div', { class: 'stack', style: { gap: '14px' } });
  const clsSel = h('select', { class: 'select', id: 'asg-class', 'aria-label': 'الفصل' }, Repo.all('classes').sort(byClass).map(c => h('option', { value: c.id }, c.name)));
  const subSel = h('select', { class: 'select', id: 'asg-subj', 'aria-label': 'المادة' }, Repo.all('subjects').map(s => h('option', { value: s.id }, s.name)));
  function draw() {
    const as = Repo.where('teachingAssignments', a => a.teacherId === t.id).sort((a, b) => nameOf.cls(a.classId).localeCompare(nameOf.cls(b.classId), 'ar'));
    body.replaceChildren(
      h('p', { class: 'muted' }, 'الإسناد يحدد المواد والفصول التي يدرّسها المدرس، ومنه تُبنى صلاحياته في الحضور والدرجات والجدول.'),
      h('div', { class: 'row' }, as.length ? as.map(a => h('span', { class: 'chip' }, nameOf.subj(a.subjectId) + ' — ' + nameOf.cls(a.classId), h('button', { class: 'x', 'aria-label': 'إزالة', onclick: async () => { const n = Repo.all('schedules').filter(s => s.teacherId === t.id && s.classId === a.classId && s.subjectId === a.subjectId).length; if (await confirmDialog({ title: 'إزالة إسناد', message: `إزالة ${nameOf.subj(a.subjectId)} لـ${nameOf.cls(a.classId)}${n ? ` وحذف ${fmtNum(n)} حصة من الجدول` : ''}؟`, ok: 'إزالة', danger: true })) { Repo.remove('teachingAssignments', a.id); Repo.all('schedules').filter(s => s.teacherId === t.id && s.classId === a.classId && s.subjectId === a.subjectId).forEach(s => Repo.remove('schedules', s.id, { audit: false })); draw(); } } }, icon('x', 14)))) : h('span', { class: 'muted' }, 'لا يوجد إسناد بعد.')),
      h('div', { class: 'form-sec' }, 'إضافة إسناد'),
      h('div', { class: 'row', style: { flexWrap: 'wrap' } }, h('div', { style: { flex: '1 1 160px' } }, clsSel), h('div', { style: { flex: '1 1 160px' } }, subSel), h('button', { class: 'btn primary', onclick: async () => {
        const classId = clsSel.value, subjectId = subSel.value;
        if (as.some(a => a.classId === classId && a.subjectId === subjectId)) { toast.info('هذا الإسناد موجود مسبقًا'); return; }
        const other = Repo.all('teachingAssignments').find(a => a.classId === classId && a.subjectId === subjectId);
        if (other) { if (!(await confirmDialog({ title: 'المادة مسندة لمدرس آخر', message: `${nameOf.subj(subjectId)} في ${nameOf.cls(classId)} مسندة إلى ${nameOf.tch(other.teacherId)}. هل تريد نقلها إلى ${t.fullName}؟ ستنتقل حصصها في الجدول أيضًا إن لم يكن هناك تعارض.`, ok: 'نقل الإسناد' }))) return; Repo.remove('teachingAssignments', other.id); Repo.all('schedules').filter(s => s.classId === classId && s.subjectId === subjectId).forEach(s => { if (scheduleConflict({ ...s, teacherId: t.id }, s.id)) Repo.remove('schedules', s.id, { audit: false }); else Repo.update('schedules', s.id, { teacherId: t.id }, { audit: false }); }); }
        Repo.create('teachingAssignments', { teacherId: t.id, subjectId, classId, academicYearId: activeYear().id }); toast.success('تمت إضافة الإسناد'); draw();
      } }, icon('plus', 16), 'إضافة')));
  }
  draw();
  openModal({ title: 'إسناد المواد والفصول — ' + t.fullName, size: 'md', body, footer: [h('button', { class: 'btn primary', onclick: e => { e.target.closest('.modal-back').remove(); render(); } }, 'تم')], onClose: () => render() });
}
async function deleteTeacher(t) {
  const as = Repo.where('teachingAssignments', a => a.teacherId === t.id).length;
  if (as) { toast.error(`لا يمكن حذف ${t.fullName} لأن لديه ${fmtNum(as)} إسنادًا. انقل الإسناد أولًا أو غيّر حالته إلى «غير فعّال».`); return; }
  if (!(await confirmDialog({ title: 'حذف مدرس', message: `هل أنت متأكد من حذف ${t.fullName}؟ سيُعطَّل حساب دخوله أيضًا.`, ok: 'حذف', danger: true }))) return;
  Repo.remove('teachers', t.id); const tu = userOf('teacher', t.id); if (tu) Repo.update('users', tu.id, { isActive: false });
  Repo.where('classes', c => c.homeroomTeacherId === t.id).forEach(c => Repo.update('classes', c.id, { homeroomTeacherId: '' }));
  render(); toast.success('تم حذف المدرس', { undo: () => { Repo.restore('teachers', t.id); if (tu) Repo.update('users', tu.id, { isActive: true }); render(); } });
}

/* ---------- Classes ---------- */
PAGE_RENDER.classes = (page) => {
  const u = App.user; const admin = isAdmin(u); const T = todayISO();
  const classes = Scope.classes(u);
  page.append(pageHead('الفصول', `${fmtNum(classes.length)} فصول · العام الدراسي ${Settings.get().academicYear}`, admin ? h('button', { class: 'btn primary', onclick: () => classForm() }, icon('plus', 16), 'إضافة فصل') : null));
  if (!classes.length) { page.append(emptyState('لا توجد فصول ضمن صلاحياتك.')); return; }
  const grid = h('div', { class: 'grid g3' });
  classes.forEach(c => {
    const sts = classStudents(c.id); const n = sts.length;
    const att = attStats(Repo.all('attendance').filter(r => r.classId === c.id && r.date >= addDays(T, -29))).rate;
    const av = avg(sts.map(s => studentResults(s).avg).filter(v => v != null));
    const rk = atRisk(sts, 'high').length;
    grid.append(h('section', { class: 'card class-card' },
      h('div', { class: 'row between' }, h('div', {}, h('h3', {}, c.name), h('div', { class: 'muted small' }, `${gradeName(c.gradeLevel)} · القاعة ${c.room || '—'}`)), rk ? badge(`${fmtNum(rk)} في خطر`, 'bad') : badge('مستقر', 'ok')),
      h('div', { class: 'small' }, h('span', { class: 'muted' }, 'مربي الصف: '), nameOf.tch(c.homeroomTeacherId)),
      h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'row between small' }, h('span', { class: 'muted' }, 'الطلاب / السعة'), h('b', { class: 'tabnum' }, `${fmtNum(n)} / ${fmtNum(c.capacity)}`)), progress(n / c.capacity * 100, n >= c.capacity ? 'bad' : n / c.capacity > .9 ? 'warn' : '')),
      h('div', { class: 'cc-stats' }, h('div', {}, h('b', {}, fmtPct(att, 0)), h('span', {}, 'الحضور 30 يومًا')), h('div', {}, h('b', {}, fmtPct(av, 0)), h('span', {}, 'متوسط الدرجات')), h('div', {}, h('b', {}, fmtNum((Idx().schedByClass.get(c.id) || []).length)), h('span', {}, 'حصة أسبوعيًا'))),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => classStudentsModal(c) }, icon('users', 15), 'الطلاب'), h('button', { class: 'btn ghost sm', onclick: () => { Store.ss.set('ass:schedMode', 'class|' + c.id); go('schedule'); } }, icon('calendar', 15), 'الجدول'), admin ? h('div', { class: 'grow' }) : null, admin ? h('button', { class: 'icon-btn sm', 'aria-label': 'تعديل', title: 'تعديل', onclick: () => classForm(c) }, icon('edit', 16)) : null, admin ? h('button', { class: 'icon-btn sm danger', 'aria-label': 'حذف', title: 'حذف', onclick: () => deleteClass(c) }, icon('trash', 16)) : null)));
  });
  page.append(grid);
};
function classForm(c) {
  formModal({
    title: c ? 'تعديل الفصل' : 'إضافة فصل', values: c || { capacity: 24, gradeLevel: 7, section: 'أ' },
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
      toast.success(c ? 'تم حفظ الفصل' : 'تمت إضافة الفصل ' + name); render();
    }
  });
}
async function deleteClass(c) {
  const n = classStudents(c.id).length;
  if (n) { toast.error(`لا يمكن حذف ${c.name} لأن فيه ${fmtNum(n)} طالبًا. انقلهم أولًا من زر «الطلاب».`); return; }
  if (!(await confirmDialog({ title: 'حذف فصل', message: `هل أنت متأكد من حذف ${c.name}؟ سيُحذف جدوله وإسناداته أيضًا.`, ok: 'حذف', danger: true }))) return;
  Repo.remove('classes', c.id); Repo.all('schedules').filter(s => s.classId === c.id).forEach(s => Repo.remove('schedules', s.id, { audit: false })); Repo.all('teachingAssignments').filter(a => a.classId === c.id).forEach(a => Repo.remove('teachingAssignments', a.id, { audit: false }));
  render(); toast.success('تم حذف الفصل');
}
function classStudentsModal(c) {
  const admin = isAdmin(App.user);
  const body = h('div');
  function draw() {
    const sts = classStudents(c.id); const ranks = classRanking(c.id);
    body.replaceChildren(sts.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['الطالب', 'المعدل', 'الترتيب', 'المتابعة', admin ? 'نقل إلى' : ''].map(x => h('th', {}, x)))), h('tbody', {}, sts.map(s => h('tr', {}, h('td', {}, h('a', { href: '#student-' + s.id, onclick: () => body.closest('.modal-back').remove() }, s.fullName)), h('td', { class: 'tabnum' }, fmtPct(studentResults(s).avg, 1)), h('td', { class: 'tabnum' }, fmtNum(ranks.get(s.id))), h('td', {}, riskBadge(s)), h('td', {}, admin ? selectEl([['', '—'], ...Repo.all('classes').filter(x => x.id !== c.id && x.gradeLevel === c.gradeLevel).map(x => [x.id, x.name])], '', async v => { if (!v) return; const to = Repo.get('classes', v); if (classStudents(v).length >= to.capacity) { toast.error(to.name + ' ممتلئ'); draw(); return; } Repo.update('students', s.id, { classId: v }); toast.success(`نُقل ${s.fullName} إلى ${to.name}`); draw(); }, { 'aria-label': 'نقل ' + s.fullName }) : null)))))) : emptyState('لا طلاب في هذا الفصل.'));
  }
  draw();
  openModal({ title: `طلاب ${c.name} (${fmtNum(classStudents(c.id).length)})`, size: 'lg', body, onClose: () => render() });
}

/* ---------- Subjects ---------- */
PAGE_RENDER.subjects = (page) => {
  const u = App.user; const admin = isAdmin(u);
  const myIds = u.role === 'teacher' ? new Set(Scope.assignments(u).map(a => a.subjectId)) : null;
  const sts = activeStudents();
  const table = DataTable({
    id: 'subjects', unit: 'مادة', search: true, exportName: admin ? 'subjects' : null, pageSize: 20,
    rows: () => Repo.all('subjects').filter(s => !myIds || myIds.has(s.id)),
    columns: [
      { label: 'المادة', sort: s => s.name, render: s => h('span', { class: 'row', style: { gap: '8px' } }, h('i', { style: { width: '12px', height: '12px', borderRadius: '4px', background: s.color, display: 'inline-block' } }), h('b', {}, s.name)), csv: s => s.name },
      { label: 'الرمز', key: 'code', render: s => h('span', { class: 'ltr muted' }, s.code) },
      { label: 'الحصص أسبوعيًا', key: 'weeklySessions', cls: 'tabnum' },
      { label: 'الدرجة النهائية', key: 'maxScore', cls: 'tabnum' },
      { label: 'درجة النجاح', key: 'passScore', cls: 'tabnum' },
      { label: 'المدرسون', sortable: false, render: s => [...new Set(Repo.where('teachingAssignments', a => a.subjectId === s.id).map(a => nameOf.tch(a.teacherId)))].join('، ') || '—' },
      { label: 'متوسط المدرسة', desc: true, sort: s => avg(sts.map(st => subjectResult(st, s.id).percent).filter(v => v != null)), render: s => pctCell(avg(sts.map(st => subjectResult(st, s.id).percent).filter(v => v != null))) },
      admin ? { label: '', sortable: false, cls: 'acts', csv: false, render: s => h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '2px' } }, h('button', { class: 'icon-btn sm', 'aria-label': 'تعديل', onclick: () => subjectForm(s) }, icon('edit', 16)), h('button', { class: 'icon-btn sm danger', 'aria-label': 'حذف', onclick: () => deleteSubject(s) }, icon('trash', 16))) } : null
    ].filter(Boolean)
  });
  page.append(pageHead('المواد الدراسية', u.role === 'teacher' ? 'المواد التي تدرّسها' : `${fmtNum(Repo.all('subjects').length)} مادة · ${fmtNum(sum(Repo.all('subjects').map(s => s.weeklySessions)))} حصة أسبوعية لكل فصل`, admin ? h('button', { class: 'btn primary', onclick: () => subjectForm() }, icon('plus', 16), 'إضافة مادة') : null), card(null, table));
};
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
      toast.success('تم حفظ المادة'); render();
    }
  });
}
async function deleteSubject(s) {
  if (Repo.all('assessments').some(a => a.subjectId === s.id)) { toast.error('لا يمكن حذف مادة لديها تقييمات ودرجات مسجّلة.'); return; }
  if (!(await confirmDialog({ title: 'حذف مادة', message: `حذف ${s.name} مع إسناداتها وحصصها في الجدول؟`, ok: 'حذف', danger: true }))) return;
  Repo.remove('subjects', s.id); Repo.all('teachingAssignments').filter(a => a.subjectId === s.id).forEach(a => Repo.remove('teachingAssignments', a.id, { audit: false })); Repo.all('schedules').filter(x => x.subjectId === s.id).forEach(x => Repo.remove('schedules', x.id, { audit: false }));
  render(); toast.success('تم حذف المادة');
}
