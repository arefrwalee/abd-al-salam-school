import { DAYS, GRADE_NAMES, addDays, avg, dow, fmtDate, fmtDateShort, fmtDateTime, fmtMoney, fmtNum, fmtPct, gradeName, groupBy, normAr, parseISO, todayISO } from './utils.js';
import { Repo, Settings } from './store.js';
import { Scope } from './permissions.js';
import { ATT_LABEL, Idx, RISK_LABEL, activeStudents, atRisk, attStats, classRanking, classStudents, financeTotals, gradeLabel, insights, nameOf, risk, studentAtt, studentFinance, studentResults, subjectResult } from './domain.js';

/* =====================================================================
   المساعد الذكي — فهم الأسئلة العربية والإجابة من بيانات النظام الفعلية
   ===================================================================== */
const Assistant = (() => {
  const has = (q, ...words) => words.some(w => q.includes(normAr(w)));
  function period(q) {
    const T = todayISO();
    if (has(q, 'اليوم')) return { from: T, to: T, label: 'اليوم' };
    if (has(q, 'امس', 'البارحه')) { let d = addDays(T, -1); while (!Settings.get().schoolDays.includes(dow(d))) d = addDays(d, -1); return { from: d, to: d, label: 'أمس (' + fmtDate(d) + ')' }; }
    if (has(q, 'الاسبوع', 'اسبوع')) return { from: addDays(T, -6), to: T, label: 'آخر 7 أيام' };
    if (has(q, 'الفصل الدراسي', 'منذ بدايه')) return { from: '0000', to: T, label: 'منذ بداية الفصل' };
    return { from: addDays(T, -29), to: T, label: 'آخر 30 يومًا' };
  }
  function gradeIn(q) { for (let g = 12; g >= 1; g--) { if (q.includes(normAr(GRADE_NAMES[g - 1]))) return g; } const m = q.match(/الصف\s*(\d{1,2})/); return m ? Number(m[1]) : null; }
  function classIn(q, u) {
    const cs = Scope.classes(u);
    for (const c of cs) { const n = normAr(c.name); if (q.includes(n) || q.includes(n.replace(' - ', ' ')) || q.includes(n.replace(' - ', ''))) return c; }
    const g = gradeIn(q); if (g) { const m = q.match(new RegExp(normAr(GRADE_NAMES[g - 1]) + '\\s*[-/]?\\s*(?:شعبه\\s*)?([اب])(?:\\s|$|\\?|؟)')); if (m) return cs.find(c => c.gradeLevel === g && normAr(c.section) === m[1]); }
    return null;
  }
  function subjectIn(q) { return Repo.all('subjects').find(s => q.includes(normAr(s.name)) || q.includes(normAr(s.name.replace('اللغة ', '')))) || null; }
  function studentIn(q, u) {
    const sts = Scope.students(u);
    let best = null, bestScore = 0;
    for (const s of sts) {
      const parts = normAr(s.fullName).split(' ');
      let sc = 0; if (q.includes(normAr(s.fullName))) sc = 10;
      else { if (q.includes(parts[0] + ' ' + parts[1])) sc = 6; else if (parts.length > 2 && q.includes(parts[0]) && q.includes(parts[parts.length - 1])) sc = 5; }
      if (sc > bestScore) { best = s; bestScore = sc; }
    }
    return best;
  }
  function teacherIn(q) { return Repo.all('teachers').find(t => { const p = normAr(t.fullName).split(' '); return q.includes(normAr(t.fullName)) || (q.includes(p[0]) && q.includes(p[p.length - 1])); }) || null; }
  const studentRow = s => ({ label: s.fullName, sub: nameOf.cls(s.classId), route: 'student-' + s.id });
  const stamp = () => 'المصدر: بيانات النظام حتى ' + fmtDateTime(new Date().toISOString()) + '.';

  const SUGGEST = {
    admin: ['كم طالب غائب اليوم؟', 'ما نسبة الحضور هذا الشهر؟', 'من الطلاب الذين انخفض مستواهم؟', 'ما متوسط درجات الصف التاسع؟', 'كم قيمة الرسوم غير المدفوعة؟', 'ما أضعف مادة في المدرسة؟', 'من الأوائل في الصف السابع؟', 'ملخص المدرسة'],
    teacher: ['من الطلاب الذين يحتاجون متابعة؟', 'كم طالب غائب اليوم؟', 'ما متوسط فصولي في مادتي؟', 'ما حصصي اليوم؟', 'من الأوائل في فصولي؟'],
    student: ['ما معدلي؟', 'ما نسبة حضوري؟', 'ما أضعف مادة عندي؟', 'ما حصصي اليوم؟', 'كم المبلغ المتبقي من الرسوم؟'],
    parent: ['كيف وضع أبنائي؟', 'هل غاب ابني هذا الأسبوع؟', 'ما المبلغ المتبقي من الرسوم؟', 'ما أضعف مادة عند ابني؟']
  };

  function ask(text, u) {
    const q = normAr(text);
    if (!q) return { text: 'اكتب سؤالك عن الطلاب أو الحضور أو الدرجات أو الرسوم.' };
    const sts = Scope.students(u).filter(s => s.status === 'active');
    const mineOnly = u.role === 'student' || u.role === 'parent';
    const T = todayISO();

    if (has(q, 'ماذا تستطيع', 'ماذا يمكنك', 'مساعده', 'كيف استخدم', 'help')) return { text: 'أجيب عن أسئلة مبنية على بيانات النظام الفعلية ضمن صلاحياتك:\n• الحضور والغياب (اليوم، الأسبوع، الشهر)\n• المعدلات والترتيب وأضعف المواد\n• الطلاب الذين يحتاجون متابعة وأسباب ذلك\n• الرسوم المدفوعة والمتبقية' + (u.role === 'admin' ? '\n• ملخص عام للمدرسة' : '') + '\nجرّب أحد الأسئلة المقترحة.', sug: SUGGEST[u.role] };

    // student summary by name (staff) or "my children"
    const named = !mineOnly ? studentIn(q, u) : null;
    const topical = has(q, 'اضعف', 'اقوى', 'رسوم', 'مبلغ', 'قسط', 'معدل', 'متوسط', 'جدول', 'حصص', 'ترتيب', 'اوائل');
    const parentAsk = u.role === 'parent' && !topical && (has(q, 'ابنائي', 'اولادي', 'وضع', 'ملخص') || (has(q, 'ابني', 'ابنتي', 'بنتي') && has(q, 'غاب', 'غياب', 'حضور', 'كيف')));
    if ((named && !topical) || parentAsk) {
      const list = named ? [named] : sts;
      if (has(q, 'غاب', 'غياب', 'حضور') && u.role === 'parent') {
        const p = period(q.includes('الاسبوع') ? q : q + ' الاسبوع');
        return { text: list.map(s => { const recs = (Idx().attByStudent.get(s.id) || []).filter(r => r.date >= p.from && r.date <= p.to && r.status !== 'present'); return `${s.fullName}: ` + (recs.length ? recs.map(r => `${ATT_LABEL[r.status]} يوم ${DAYS[dow(r.date)]} ${fmtDateShort(r.date)}`).join('، ') : 'لا غياب ولا تأخر خلال ' + p.label) + '.'; }).join('\n'), src: stamp() };
      }
      return { text: list.map(s => { const r = risk(s); const res = studentResults(s); const a = studentAtt(s.id, addDays(T, -29), T); const fin = studentFinance(s.id); return `${s.fullName} (${nameOf.cls(s.classId)}): المعدل ${fmtPct(res.avg, 1)}، الحضور ${fmtPct(a.rate, 1)} خلال 30 يومًا، الحالة: ${RISK_LABEL[r.level][0]}.` + (r.factors.length ? ` أبرز الملاحظات: ${r.factors.slice(0, 2).map(f => f.text).join('؛ ')}.` : '') + (fin.remaining ? ` المتبقي من الرسوم: ${fmtMoney(fin.remaining)}.` : ''); }).join('\n\n'), list: list.map(studentRow), src: stamp() };
    }

    // absences
    if (has(q, 'غائب', 'غياب', 'غابوا', 'الغائبين', 'غاب')) {
      const p = period(q); const cls = classIn(q, u);
      let recs = Repo.all('attendance').filter(r => r.date >= p.from && r.date <= p.to && r.status === 'absent');
      const ids = new Set((cls ? sts.filter(s => s.classId === cls.id) : sts).map(s => s.id)); recs = recs.filter(r => ids.has(r.studentId));
      if (p.label === 'اليوم') {
        const recorded = new Set((Idx().attByDate.get(T) || []).map(r => r.classId)); const scopeCls = cls ? [cls] : Scope.classes(u); const missing = scopeCls.filter(c => !recorded.has(c.id));
        const head = recs.length ? `عدد الغائبين اليوم ${fmtNum(recs.length)} ${recs.length <= 10 ? 'طلاب' : 'طالبًا'}${cls ? ' في ' + cls.name : ''}.` : `لا يوجد غياب مسجّل اليوم${cls ? ' في ' + cls.name : ''}.`;
        return { text: head + (missing.length ? `\nتنبيه: لم يُسجَّل حضور اليوم بعد في ${missing.map(c => c.name).join('، ')}، فالعدد قد يزيد.` : ''), list: recs.map(r => ({ ...studentRow(Repo.get('students', r.studentId)), sub: nameOf.cls(r.classId) + (r.reason ? ' — ' + r.reason : '') })), src: stamp() };
      }
      const by = [...groupBy(recs, r => r.studentId).entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 10);
      return { text: `سُجِّل ${fmtNum(recs.length)} يوم غياب بلا عذر خلال ${p.label}${cls ? ' في ' + cls.name : ''}، لدى ${fmtNum(new Set(recs.map(r => r.studentId)).size)} طالبًا.` + (by.length ? ' الأكثر غيابًا:' : ''), table: by.length ? { head: ['الطالب', 'الفصل', 'أيام الغياب'], rows: by.map(([id, rs]) => [nameOf.st(id), nameOf.cls(Repo.get('students', id).classId), fmtNum(rs.length)]) } : null, src: stamp() };
    }

    // attendance rate
    if (has(q, 'نسبه الحضور', 'نسبة حضور', 'الحضور', 'حضوري', 'معدل الحضور', 'التزام')) {
      const p = period(q); const cls = classIn(q, u);
      const ids = new Set((cls ? sts.filter(s => s.classId === cls.id) : sts).map(s => s.id));
      const recs = Repo.all('attendance').filter(r => ids.has(r.studentId) && r.date >= p.from && r.date <= p.to);
      const a = attStats(recs);
      const prevFrom = addDays(p.from, -(parseISO(p.to) - parseISO(p.from)) / 864e5 - 1), prevTo = addDays(p.from, -1);
      const pr = attStats(Repo.all('attendance').filter(r => ids.has(r.studentId) && r.date >= prevFrom && r.date <= prevTo));
      const who = mineOnly ? (sts.length === 1 ? sts[0].fullName : 'أبنائك') : cls ? cls.name : u.role === 'teacher' ? 'فصولك' : 'المدرسة';
      let txt = `نسبة الحضور لـ${who} خلال ${p.label}: ${fmtPct(a.rate, 1)} (حاضر ${fmtNum(a.present)}، غائب ${fmtNum(a.absent)}، متأخر ${fmtNum(a.late)}، بعذر ${fmtNum(a.excused)}).`;
      if (pr.rate != null && a.rate != null && p.from !== '0000') { const dlt = a.rate - pr.rate; txt += `\nمقارنة بالفترة السابقة: ${dlt >= 0 ? 'ارتفاع' : 'انخفاض'} ${fmtNum(Math.abs(dlt), 1)} نقطة (${fmtPct(pr.rate, 1)}).`; }
      if (!mineOnly && !cls) { const rows = Scope.classes(u).map(c => ({ label: c.name, value: attStats(recs.filter(r => r.classId === c.id)).rate })); return { text: txt, bars: rows, src: stamp() }; }
      return { text: txt, src: stamp() };
    }

    // fees
    if (has(q, 'رسوم', 'مستحق', 'غير مدفوع', 'المتبقي', 'متاخر', 'قسط', 'مدفوعات', 'تحصيل')) {
      if (!['admin', 'student', 'parent'].includes(u.role)) return { text: 'المعلومات المالية متاحة لإدارة المدرسة وأولياء الأمور والطلاب فقط.' };
      if (mineOnly) { return { text: sts.map(s => { const f = studentFinance(s.id); return `${s.fullName}: المستحق ${fmtMoney(f.net)}، المدفوع ${fmtMoney(f.paid)}، المتبقي ${fmtMoney(f.remaining)}` + (f.overdue ? `، منها ${fmtMoney(f.overdue)} متأخرة السداد.` : '.'); }).join('\n'), src: stamp() }; }
      const ft = financeTotals(); const top = activeStudents().map(s => ({ s, f: studentFinance(s.id) })).filter(x => x.f.overdue > 0).sort((a, b) => b.f.overdue - a.f.overdue).slice(0, 8);
      return { text: `إجمالي المستحق ${fmtMoney(ft.net)}، المحصّل ${fmtMoney(ft.paid)} (${fmtPct(ft.rate, 1)})، وغير المدفوع ${fmtMoney(ft.remaining)}.\nالمتأخر عن موعده ${fmtMoney(ft.overdue)} لدى ${fmtNum(ft.overdueStudents)} طالبًا.`, table: top.length ? { head: ['الطالب', 'الفصل', 'المتأخر'], rows: top.map(x => [x.s.fullName, nameOf.cls(x.s.classId), fmtMoney(x.f.overdue)]) } : null, src: stamp() };
    }

    // declining / at risk
    if (has(q, 'انخفض', 'تراجع', 'خطر', 'متعثر', 'يحتاج', 'متابعه', 'ضعاف', 'مستواهم')) {
      const list = atRisk(sts, 'medium');
      if (!list.length) return { text: 'لا يوجد طلاب بمؤشر خطر ضمن نطاقك حاليًا.', src: stamp() };
      return { text: `${fmtNum(list.filter(x => x.r.level === 'high').length)} في خطر مرتفع و${fmtNum(list.filter(x => x.r.level === 'medium').length)} يحتاجون متابعة. الترتيب حسب درجة الخطر:`, table: { head: ['الطالب', 'الفصل', 'الدرجة', 'السبب الأبرز'], rows: list.slice(0, 12).map(x => [x.st.fullName, nameOf.cls(x.st.classId), fmtNum(x.r.score), x.r.factors[0] ? x.r.factors[0].text : '—']) }, list: list.slice(0, 5).map(x => studentRow(x.st)), src: stamp() };
    }

    // top students
    if (has(q, 'اوائل', 'الاوائل', 'المتفوقين', 'افضل الطلاب', 'الاول على', 'ترتيب')) {
      const cls = classIn(q, u); const g = gradeIn(q);
      let pool = sts; if (cls) pool = pool.filter(s => s.classId === cls.id); else if (g) pool = pool.filter(s => s.gradeLevel === g);
      const ranked = pool.map(s => ({ s, a: studentResults(s).avg })).filter(x => x.a != null).sort((a, b) => b.a - a.a).slice(0, 10);
      return { text: `الأوائل ${cls ? 'في ' + cls.name : g ? 'في ' + gradeName(g) : 'ضمن نطاقك'} حسب المعدل الحالي:`, table: { head: ['#', 'الطالب', 'الفصل', 'المعدل'], rows: ranked.map((x, i) => [fmtNum(i + 1), x.s.fullName, nameOf.cls(x.s.classId), fmtPct(x.a, 1)]) }, src: stamp() };
    }

    // weakest / strongest subject
    if (has(q, 'اضعف ماده', 'اضعف', 'اصعب ماده', 'اقوى ماده', 'افضل ماده')) {
      const strong = has(q, 'اقوى', 'افضل');
      const rows = Repo.all('subjects').map(s => ({ label: s.name, value: avg(sts.map(st => subjectResult(st, s.id).percent).filter(v => v != null)) })).filter(r => r.value != null).sort((a, b) => strong ? b.value - a.value : a.value - b.value);
      if (!rows.length) return { text: 'لا توجد درجات كافية بعد.' };
      return { text: `${strong ? 'أقوى' : 'أضعف'} مادة ${mineOnly ? (sts.length === 1 ? 'عند ' + sts[0].fullName : 'عند أبنائك') : 'ضمن نطاقك'} هي ${rows[0].label} بمتوسط ${fmtPct(rows[0].value, 1)}.`, bars: rows, src: stamp() };
    }

    // averages
    if (has(q, 'متوسط', 'معدل', 'معدلي', 'معدلات', 'درجات')) {
      const cls = classIn(q, u); const g = gradeIn(q); const subj = subjectIn(q);
      let pool = sts; let who = mineOnly ? (sts.length === 1 ? sts[0].fullName : 'أبنائك') : u.role === 'teacher' ? 'فصولك' : 'المدرسة';
      if (cls) { pool = pool.filter(s => s.classId === cls.id); who = cls.name; } else if (g) { pool = pool.filter(s => s.gradeLevel === g); who = gradeName(g); }
      let subjectsList = Repo.all('subjects'); if (subj) subjectsList = [subj]; else if (u.role === 'teacher' && has(q, 'مادتي', 'موادي')) { const ids = new Set(Scope.assignments(u).map(a => a.subjectId)); subjectsList = subjectsList.filter(s => ids.has(s.id)); }
      if (!pool.length) return { text: 'لا يوجد طلاب ضمن هذا النطاق في صلاحياتك.' };
      const vals = pool.map(s => subj || subjectsList.length < Repo.all('subjects').length ? avg(subjectsList.map(x => subjectResult(s, x.id).percent).filter(v => v != null)) : studentResults(s).avg).filter(v => v != null);
      const a = avg(vals);
      const bars = (mineOnly && sts.length === 1) ? studentResults(sts[0]).rows.map(r => ({ label: r.subject.name, value: r.percent })) : (cls || g) ? null : Scope.classes(u).map(c => ({ label: c.name, value: avg(pool.filter(s => s.classId === c.id).map(s => subj ? subjectResult(s, subj.id).percent : studentResults(s).avg).filter(v => v != null)) })).filter(r => r.value != null);
      return { text: `متوسط ${subj ? 'درجات ' + subj.name : 'الدرجات'} لـ${who}: ${fmtPct(a, 1)} (${gradeLabel(a)})${mineOnly ? '' : ` من ${fmtNum(vals.length)} طالبًا`}.` + (mineOnly && sts.length === 1 ? ` الترتيب في الفصل: ${fmtNum(classRanking(sts[0].classId).get(sts[0].id))} من ${fmtNum(classStudents(sts[0].classId).length)}.` : ''), bars, src: stamp() };
    }

    // schedule
    if (has(q, 'جدول', 'حصص', 'حصتي', 'حصصي')) {
      const t = teacherIn(q); const today = dow(T);
      let rows = []; let who = '';
      if (t && u.role === 'admin') { rows = Repo.where('schedules', s => s.teacherId === t.id); who = t.fullName; }
      else if (u.role === 'teacher') { rows = Repo.where('schedules', s => s.teacherId === u.linkedId); who = 'أنت'; }
      else if (mineOnly && sts[0]) { rows = Repo.where('schedules', s => s.classId === sts[0].classId); who = sts[0].fullName; }
      else return { text: 'اذكر اسم المدرس، مثال: جدول الأستاذ أحمد الحسن.' };
      const todayRows = rows.filter(s => s.dayOfWeek === today).sort((a, b) => (Repo.get('periods', a.periodId) || {}).order - (Repo.get('periods', b.periodId) || {}).order);
      return { text: `${who}: ${fmtNum(rows.length)} حصة أسبوعيًا.` + (Settings.get().schoolDays.includes(today) ? (todayRows.length ? ` حصص اليوم (${DAYS[today]}):` : ' لا حصص اليوم.') : ' اليوم عطلة.'), table: todayRows.length ? { head: ['الحصة', 'الوقت', 'المادة', 'الفصل'], rows: todayRows.map(s => { const p = Repo.get('periods', s.periodId); return [fmtNum(p.order), p.startTime + '–' + p.endTime, nameOf.subj(s.subjectId), nameOf.cls(s.classId)]; }) } : null, src: stamp() };
    }

    // counts / summary
    if (has(q, 'كم عدد الطلاب', 'عدد الطلاب', 'ملخص', 'نظره عامه', 'تقرير سريع')) {
      if (mineOnly) return ask('كيف وضع أبنائي', u);
      const att = attStats((Idx().attByDate.get(T) || []).filter(r => new Set(sts.map(s => s.id)).has(r.studentId)));
      const lines = [`عدد الطلاب النشطين: ${fmtNum(sts.length)} في ${fmtNum(Scope.classes(u).length)} فصول.`, att.total ? `حضور اليوم: ${fmtPct(att.rate, 1)} (${fmtNum(att.absent)} غائب).` : 'لم يُسجَّل حضور اليوم بعد.', `المعدل العام: ${fmtPct(avg(sts.map(s => studentResults(s).avg).filter(v => v != null)), 1)}.`, `طلاب في خطر مرتفع: ${fmtNum(atRisk(sts, 'high').length)}.`];
      if (u.role === 'admin') { const ft = financeTotals(); lines.push(`التحصيل المالي: ${fmtPct(ft.rate, 1)}، والمتبقي ${fmtMoney(ft.remaining)}.`); }
      const ins = insights(u).slice(0, 3); if (ins.length) lines.push('', 'أهم الملاحظات:', ...ins.map(i => '• ' + i.title + ': ' + i.text));
      return { text: lines.join('\n'), src: stamp() };
    }

    return { text: 'لم أفهم السؤال بدقة. جرّب صياغة تتضمن أحد المواضيع: الغياب، الحضور، المعدل، الأوائل، أضعف مادة، الرسوم، الطلاب الذين يحتاجون متابعة، أو اسم طالب.', sug: (SUGGEST[u.role] || []).slice(0, 3) };
  }
  return { ask, SUGGEST };
})();

export { Assistant };
