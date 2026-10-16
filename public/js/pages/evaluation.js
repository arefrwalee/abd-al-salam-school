/* =====================================================================
   Pages B — الجدول، الحضور، الدرجات، الشهادات
   ===================================================================== */

/* ---------- Schedule ---------- */
PAGE_RENDER.schedule = (page) => {
  const u = App.user; const admin = isAdmin(u);
  let mode = 'class', ent = null;
  const pre = Store.ss.get('ass:schedMode'); Store.ss.del('ass:schedMode');
  if (u.role === 'teacher') { mode = 'teacher'; ent = u.linkedId; }
  else if (u.role === 'student' || u.role === 'parent') { mode = 'class'; ent = (Scope.students(u)[0] || {}).classId; }
  else if (pre) { [mode, ent] = pre.split('|'); }
  if (!ent && mode === 'class') ent = (Repo.all('classes').sort(byClass)[0] || {}).id;
  if (!ent && mode === 'teacher') ent = (Repo.all('teachers')[0] || {}).id;
  const head = h('div'); const body = h('div', { class: 'stack', style: { gap: '14px' } });
  page.append(head, body);
  function draw() {
    const kids = Scope.students(u);
    const controls = [];
    if (admin) {
      controls.push(seg([['class', 'حسب الفصل'], ['teacher', 'حسب المدرس']], mode, v => { mode = v; ent = v === 'class' ? Repo.all('classes').sort(byClass)[0].id : Repo.all('teachers')[0].id; draw(); }));
      controls.push(mode === 'class' ? selectEl(Repo.all('classes').sort(byClass).map(c => [c.id, c.name]), ent, v => { ent = v; draw(); }, { 'aria-label': 'الفصل' }) : selectEl(Repo.all('teachers').map(t => [t.id, t.fullName]), ent, v => { ent = v; draw(); }, { 'aria-label': 'المدرس' }));
    } else if (u.role === 'parent' && kids.length > 1) controls.push(selectEl(kids.map(k => [k.classId, k.fullName + ' — ' + nameOf.cls(k.classId)]), ent, v => { ent = v; draw(); }, { 'aria-label': 'الابن' }));
    const title = mode === 'class' ? 'جدول ' + nameOf.cls(ent) : 'جدول ' + nameOf.tch(ent);
    const acts = admin && mode === 'class' ? [h('button', { class: 'btn soft', onclick: () => smartFill(ent) }, icon('wand', 16), 'اقتراح ذكي للحصص الناقصة'), h('button', { class: 'btn ghost', onclick: () => clearClass(ent) }, icon('trash', 16), 'مسح الجدول')] : [];
    const pb = printBtn(() => h('div', { style: { padding: '12px', background: '#fff', color: '#000' } }, h('h2', { style: { textAlign: 'center', marginBottom: '10px' } }, Settings.get().schoolName + ' — ' + title), grid.cloneNode(true)), 'schedule');
    head.replaceChildren(pageHead('الجدول الدراسي', admin ? 'انقر خانة فارغة لإضافة حصة، أو اسحب حصة لنقلها. يُمنع أي تعارض للمدرس أو الفصل أو القاعة.' : 'الجدول الأسبوعي · ' + Settings.get().termName, ...controls, ...acts, pb));
    const rows = mode === 'class' ? (Idx().schedByClass.get(ent) || []) : (Idx().schedByTeacher.get(ent) || []);
    const grid = scheduleGrid(rows, mode, ent, admin && mode === 'class', draw);
    const summary = mode === 'class' ? classSummary(ent) : teacherSummary(ent);
    body.replaceChildren(card(title, h('div', { class: 'sched-wrap' }, grid), { flush: false, sub: `${fmtNum(rows.length)} حصة أسبوعيًا` }), summary);
  }
  draw();
};
function scheduleGrid(rows, mode, ent, editable, redraw) {
  const ps = periodsSorted(); const days = Settings.get().schoolDays; const today = dow(todayISO());
  const map = new Map(rows.map(r => [r.dayOfWeek + '|' + r.periodId, r]));
  const t = h('table', { class: 'sched' });
  t.append(h('thead', {}, h('tr', {}, h('th', {}, 'الحصة'), days.map(d => h('th', { style: d === today ? { color: 'var(--blue-ink)' } : null }, DAYS[d] + (d === today ? ' (اليوم)' : ''))))));
  const tb = h('tbody'); t.append(tb);
  ps.forEach((p, pi) => {
    if (pi === 3) tb.append(h('tr', { class: 'brk' }, h('td', { colspan: days.length + 1 }, 'الاستراحة 10:25 – 10:45')));
    tb.append(h('tr', {}, h('td', {}, h('b', {}, 'الحصة ' + fmtNum(p.order)), h('span', { class: 'ltr' }, p.startTime + '–' + p.endTime)), days.map(d => {
      const r = map.get(d + '|' + p.id); const cellKey = { dayOfWeek: d, periodId: p.id };
      let slot;
      if (r) {
        const s = Repo.get('subjects', r.subjectId) || {};
        slot = h('div', { class: 'slot filled' + (editable ? ' can' : '') + (d === today ? ' today' : ''), style: { background: `color-mix(in srgb, ${s.color} 12%, var(--surface))`, borderColor: `color-mix(in srgb, ${s.color} 35%, var(--line))` }, draggable: editable ? 'true' : null, title: `${s.name} — ${nameOf.tch(r.teacherId)} — ${nameOf.cls(r.classId)}`, onclick: editable ? () => editSlot(r, redraw) : null },
          h('b', {}, h('i', { style: { background: s.color } }), s.name), h('span', {}, mode === 'class' ? nameOf.tch(r.teacherId) : nameOf.cls(r.classId)), r.room ? h('span', {}, 'القاعة ' + r.room) : null);
        if (editable) slot.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', r.id); e.dataTransfer.effectAllowed = 'move'; });
      } else {
        slot = h('div', { class: 'slot empty' + (editable ? ' can' : ''), onclick: editable ? () => addSlot(ent, cellKey, redraw) : null }, editable ? icon('plus', 16) : '');
      }
      if (editable) {
        slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('drag-over'); });
        slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
        slot.addEventListener('drop', e => {
          e.preventDefault(); slot.classList.remove('drag-over'); const id = e.dataTransfer.getData('text/plain'); const src = Repo.get('schedules', id); if (!src) return;
          if (r && r.id === id) return;
          if (r) { // swap
            const a = { ...src, dayOfWeek: d, periodId: p.id }, b = { ...r, dayOfWeek: src.dayOfWeek, periodId: src.periodId };
            const ca = scheduleConflictExcept(a, [src.id, r.id]), cb = scheduleConflictExcept(b, [src.id, r.id]);
            if (ca || cb) { slot.classList.add('conflict'); toast.error('تعذّر التبديل: ' + (ca || cb)); setTimeout(redraw, 900); return; }
            Repo.update('schedules', src.id, { dayOfWeek: d, periodId: p.id }); Repo.update('schedules', r.id, { dayOfWeek: b.dayOfWeek, periodId: b.periodId }); notifySchedule(ent); toast.success('تم تبديل الحصتين'); redraw();
          } else {
            const rec = { ...src, dayOfWeek: d, periodId: p.id }; const c = scheduleConflict(rec, src.id);
            if (c) { slot.classList.add('conflict'); toast.error('تعذّر النقل: ' + c); setTimeout(redraw, 900); return; }
            Repo.update('schedules', src.id, { dayOfWeek: d, periodId: p.id }); notifySchedule(ent); toast.success('تم نقل الحصة إلى ' + DAYS[d] + ' — الحصة ' + fmtNum(p.order)); redraw();
          }
        });
      }
      return h('td', {}, slot);
    })));
  });
  return t;
}
function scheduleConflictExcept(rec, ids) {
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
function addSlot(classId, key, redraw) {
  const asg = Repo.where('teachingAssignments', a => a.classId === classId);
  if (!asg.length) { toast.error('لا يوجد إسناد مواد لهذا الفصل. أضف الإسناد من صفحة المدرسين.'); return; }
  const cls = Repo.get('classes', classId); const have = (Idx().schedByClass.get(classId) || []);
  formModal({
    title: `إضافة حصة — ${DAYS[key.dayOfWeek]}، الحصة ${fmtNum((Repo.get('periods', key.periodId) || {}).order)}`, size: 'sm', submit: 'إضافة',
    values: { room: cls.room },
    fields: [{ name: 'asg', label: 'المادة والمدرس', type: 'select', required: true, placeholder: 'اختر', options: asg.map(a => { const s = Repo.get('subjects', a.subjectId); const n = have.filter(x => x.subjectId === a.subjectId).length; return [a.id, `${s.name} — ${nameOf.tch(a.teacherId)} (${fmtNum(n)}/${fmtNum(s.weeklySessions)})`]; }) }, { name: 'room', label: 'القاعة' }],
    onSubmit: v => {
      const a = Repo.get('teachingAssignments', v.asg);
      const rec = { classId, ...key, subjectId: a.subjectId, teacherId: a.teacherId, room: v.room, academicYearId: activeYear().id };
      const c = scheduleConflict(rec); if (c) return 'تعارض: ' + c;
      const t = Repo.get('teachers', a.teacherId); if (t && teacherLoad(t.id) + 1 > t.weeklyLoad) toast.warning(`${t.fullName} سيتجاوز حمله الأسبوعي (${fmtNum(teacherLoad(t.id) + 1)}/${fmtNum(t.weeklyLoad)}).`);
      Repo.create('schedules', rec); notifySchedule(classId); toast.success('تمت إضافة الحصة'); redraw();
    }
  });
}
function editSlot(r, redraw) {
  const s = Repo.get('subjects', r.subjectId); const p = Repo.get('periods', r.periodId);
  const m = openModal({ title: `${s.name} — ${nameOf.cls(r.classId)}`, size: 'sm', body: kv([['اليوم', DAYS[r.dayOfWeek]], ['الحصة', `${fmtNum(p.order)} (${p.startTime}–${p.endTime})`], ['المدرس', nameOf.tch(r.teacherId)], ['القاعة', r.room || '—']]),
    footer: [h('button', { class: 'btn danger', onclick: () => { Repo.remove('schedules', r.id); notifySchedule(r.classId); m.close(); redraw(); toast.success('تم حذف الحصة', { undo: () => { Repo.restore('schedules', r.id); redraw(); } }); } }, icon('trash', 16), 'حذف الحصة'), h('button', { class: 'btn ghost', onclick: () => m.close() }, 'إغلاق')] });
}
async function smartFill(classId) {
  const res = autoSchedule(classId, { room: (Repo.get('classes', classId) || {}).room, existing: Repo.all('schedules') });
  const missing = Object.entries(res.missing);
  if (!res.placed.length && !missing.length) { toast.info('جدول هذا الفصل مكتمل. لا حصص ناقصة.'); return; }
  const list = h('div', { class: 'stack' },
    h('p', {}, `يقترح المساعد إضافة ${fmtNum(res.placed.length)} حصة دون أي تعارض، مع توزيع حصص المادة الواحدة على أيام مختلفة قدر الإمكان:`),
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['اليوم', 'الحصة', 'المادة', 'المدرس'].map(x => h('th', {}, x)))), h('tbody', {}, res.placed.map(r => h('tr', {}, h('td', {}, DAYS[r.dayOfWeek]), h('td', { class: 'tabnum' }, fmtNum((Repo.get('periods', r.periodId) || {}).order)), h('td', {}, nameOf.subj(r.subjectId)), h('td', {}, nameOf.tch(r.teacherId))))))),
    missing.length ? banner(`تعذّر جدولة: ${missing.map(([sid, n]) => `${nameOf.subj(sid)} (${fmtNum(n)})`).join('، ')} — لا توجد خانة متاحة للمدرس والفصل معًا.`, 'warn', 'alert') : null);
  const m = openModal({ title: 'اقتراح ذكي للجدول — ' + nameOf.cls(classId), size: 'md', body: list, footer: res.placed.length ? [h('button', { class: 'btn primary', onclick: () => { res.placed.forEach(r => Repo.create('schedules', r, { audit: false })); Audit.log('create', 'schedules', classId, null, { smartFill: res.placed.length }); notifySchedule(classId); m.close(); render(); toast.success(`أُضيفت ${fmtNum(res.placed.length)} حصة`); } }, 'اعتماد الاقتراح'), h('button', { class: 'btn ghost', onclick: () => m.close() }, 'إلغاء')] : [h('button', { class: 'btn', onclick: () => m.close() }, 'إغلاق')] });
}
async function clearClass(classId) {
  const rows = Idx().schedByClass.get(classId) || []; if (!rows.length) return;
  if (!(await confirmDialog({ title: 'مسح الجدول', message: `حذف كل حصص ${nameOf.cls(classId)} (${fmtNum(rows.length)} حصة)؟ يمكنك بعدها استخدام الاقتراح الذكي لإعادة بنائه.`, ok: 'مسح', danger: true }))) return;
  rows.forEach(r => Repo.remove('schedules', r.id, { audit: false })); Audit.log('delete', 'schedules', classId, { count: rows.length }, null); render(); toast.success('تم مسح الجدول');
}
function classSummary(classId) {
  const rows = Idx().schedByClass.get(classId) || [];
  const asg = Repo.where('teachingAssignments', a => a.classId === classId);
  return card('اكتمال الحصص حسب المادة', h('div', { class: 'row' }, asg.map(a => { const s = Repo.get('subjects', a.subjectId); const n = rows.filter(r => r.subjectId === a.subjectId).length; return h('span', { class: 'chip', title: nameOf.tch(a.teacherId) }, h('i', { style: { width: '8px', height: '8px', borderRadius: '50%', background: s.color, display: 'inline-block' } }), s.name, badge(`${fmtNum(n)}/${fmtNum(s.weeklySessions)}`, n >= s.weeklySessions ? 'ok' : n ? 'warn' : 'bad', true)); })));
}
function teacherSummary(tid) {
  const t = Repo.get('teachers', tid); if (!t) return null; const l = teacherLoad(tid);
  return card('الحمل الأسبوعي', h('div', { class: 'stack' }, h('div', { class: 'row between' }, h('span', {}, `${fmtNum(l)} حصة من حد أعلى ${fmtNum(t.weeklyLoad)}`), badge(l > t.weeklyLoad ? 'تجاوز الحد' : 'ضمن الحد', l > t.weeklyLoad ? 'bad' : 'ok')), progress(l / t.weeklyLoad * 100, l > t.weeklyLoad ? 'bad' : 'ok'), h('div', { class: 'row' }, [...groupBy(Idx().schedByTeacher.get(tid) || [], s => s.dayOfWeek).entries()].sort((a, b) => a[0] - b[0]).map(([d, l2]) => h('span', { class: 'chip' }, DAYS[d] + ': ' + fmtNum(l2.length))))));
}

/* ---------- Attendance ---------- */
PAGE_RENDER.attendance = (page) => {
  const u = App.user;
  if (u.role === 'student' || u.role === 'parent') return attendanceFamily(page, u);
  const T = todayISO(); const classes = Scope.classes(u);
  const pre = Store.ss.get('ass:attClass'); Store.ss.del('ass:attClass');
  let classId = pre && classes.some(c => c.id === pre) ? pre : (u.role === 'teacher' ? ((Repo.where('schedules', s => s.teacherId === u.linkedId && s.dayOfWeek === dow(T))[0] || {}).classId || (classes[0] || {}).id) : (classes[0] || {}).id);
  let date = T; let view = 'take';
  const head = h('div'), body = h('div', { class: 'stack', style: { gap: '14px' } });
  page.append(head, body);
  function draw() {
    const controls = [seg([['take', 'تسجيل الحضور'], ['today', 'لوحة اليوم'], ['report', 'تقرير الحضور']], view, v => { view = v; draw(); })];
    head.replaceChildren(pageHead('الحضور والغياب', u.role === 'teacher' ? `يمكنك تسجيل الحضور وتعديله لليوم و${fmtNum(Settings.get().teacherEditDays)} أيام سابقة.` : 'سجل الحضور اليومي لكل الفصول', ...controls));
    if (!classes.length) { body.replaceChildren(emptyState('لا فصول ضمن صلاحياتك.')); return; }
    if (view === 'today') return drawToday();
    if (view === 'report') return drawReport();
    drawTake();
  }
  function drawTake() {
    const editable = canEditAttendance(u, date);
    const sts = classStudents(classId);
    const existing = new Map((Idx().attByDate.get(date) || []).filter(r => r.classId === classId).map(r => [r.studentId, r]));
    const state = new Map(sts.map(s => { const e = existing.get(s.id); return [s.id, { status: e ? e.status : 'present', reason: e ? e.reason : '' }]; }));
    const holiday = !Settings.get().schoolDays.includes(dow(date));
    const dateIn = h('input', { type: 'date', class: 'input sm', id: 'att-date', value: date, max: T, 'aria-label': 'التاريخ', onchange: e => { date = e.target.value || T; draw(); } });
    const counts = h('div', { class: 'row' });
    const list = h('div');
    function drawCounts() { const c = { present: 0, absent: 0, late: 0, excused: 0 }; state.forEach(v => c[v.status]++); counts.replaceChildren(...Object.entries(c).map(([k, n]) => badge(`${ATT_LABEL[k]}: ${fmtNum(n)}`, ATT_CLS[k]))); }
    sts.forEach(s => {
      const st = state.get(s.id); const btns = h('div', { class: 'att-btns', role: 'radiogroup', 'aria-label': 'حالة ' + s.fullName });
      const reason = h('input', { class: 'input sm att-reason', id: 'reason-' + s.id, placeholder: 'سبب الغياب أو التأخر (اختياري)', value: st.reason, disabled: !editable, hidden: st.status === 'present', oninput: e => { st.reason = e.target.value; } });
      function drawBtns() { btns.replaceChildren(...Object.keys(ATT_LABEL).map(k => h('button', { class: (st.status === k ? 'on ' : '') + k, role: 'radio', 'aria-checked': String(st.status === k), disabled: !editable, onclick: () => { st.status = k; reason.hidden = k === 'present'; drawBtns(); drawCounts(); } }, ATT_LABEL[k]))); }
      drawBtns();
      const a = studentAtt(s.id, addDays(T, -29), T);
      list.append(h('div', { class: 'att-row' }, h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, avatar(s.fullName), h('div', { style: { minWidth: 0 } }, h('a', { href: '#student-' + s.id, class: 'nm' }, s.fullName), h('div', { class: 'small muted' }, `حضور 30 يومًا: ${fmtPct(a.rate, 0)}`, a.absent >= 3 ? h('span', { style: { color: 'var(--red)' } }, ` · ${fmtNum(a.absent)} غياب`) : null)), existing.get(s.id) ? null : null), btns, reason));
    });
    drawCounts();
    const saveBtn = h('button', { class: 'btn primary', disabled: !editable || holiday, onclick: () => {
      const entries = sts.map(s => ({ studentId: s.id, ...state.get(s.id) }));
      const r = saveAttendance(classId, date, entries);
      toast.success(`تم حفظ حضور ${nameOf.cls(classId)} ليوم ${fmtDate(date)}` + (r.absences ? ` · أُرسل ${fmtNum(r.absences)} إشعار غياب لأولياء الأمور` : ''));
      draw();
    } }, icon('ok', 16), existing.size ? 'حفظ التعديلات' : 'حفظ الحضور');
    body.replaceChildren(
      h('div', { class: 'row' }, selectEl(classes.map(c => [c.id, c.name]), classId, v => { classId = v; draw(); }, { 'aria-label': 'الفصل', id: 'att-class' }), dateIn, existing.size ? badge('مسجّل مسبقًا · آخر تعديل ' + relTime([...existing.values()].map(r => r.updatedAt).sort().pop()), 'info', true) : badge('لم يُسجَّل بعد', 'warn', true)),
      holiday ? banner(DAYS[dow(date)] + ' يوم عطلة. اختر يومًا دراسيًا.', 'warn', 'calendar') : null,
      !editable && !holiday ? banner('عرض فقط: انتهت مهلة تعديل هذا اليوم للمدرسين. تواصل مع الإدارة للتعديل.', 'warn', 'lock') : null,
      sts.length ? card(null, list, { flush: true }) : emptyState('لا طلاب نشطين في هذا الفصل.'),
      sts.length ? h('div', { class: 'savebar' }, counts, h('div', { class: 'grow' }), h('button', { class: 'btn ghost', disabled: !editable, onclick: () => { state.forEach(v => { v.status = 'present'; v.reason = ''; }); $$('.att-reason', list).forEach(x => { x.hidden = true; x.value = ''; }); $$('.att-btns', list).forEach(b => { $$('button', b).forEach(x => { x.classList.toggle('on', x.classList.contains('present')); x.setAttribute('aria-checked', String(x.classList.contains('present'))); }); }); drawCounts(); } }, 'الكل حاضر'), saveBtn) : null);
  }
  function drawToday() {
    const recs = Idx().attByDate.get(T) || [];
    const rows = classes.map(c => { const r = recs.filter(x => x.classId === c.id); const s = attStats(r); return { c, n: classStudents(c.id).length, s, done: r.length > 0, by: r[0] ? nameOf.user(r[0].recordedBy) : '' }; });
    const absents = recs.filter(r => r.status !== 'present' && classes.some(c => c.id === r.classId));
    body.replaceChildren(h('div', { class: 'grid g-main' },
      card('حالة التسجيل اليوم — ' + fmtDate(T), h('div', { class: 'list' }, rows.map(x => h('div', { class: 'li' }, h('div', { class: 'bd' }, h('b', {}, x.c.name), h('span', {}, x.done ? `حضور ${fmtPct(x.s.rate, 0)} · ${fmtNum(x.s.absent)} غائب · ${fmtNum(x.s.late)} متأخر` : `${fmtNum(x.n)} طالبًا · لم يُسجَّل بعد`)), x.done ? badge('سُجّل', 'ok') : badge('لم يُسجَّل', 'bad'), h('button', { class: 'btn ghost xs', onclick: () => { classId = x.c.id; date = T; view = 'take'; draw(); } }, x.done ? 'عرض' : 'تسجيل'))))),
      card('الغائبون والمتأخرون اليوم', absents.length ? h('div', { class: 'list' }, absents.map(r => h('div', { class: 'li' }, badge(ATT_LABEL[r.status], ATT_CLS[r.status]), h('div', { class: 'bd' }, h('a', { href: '#student-' + r.studentId }, h('b', {}, nameOf.st(r.studentId))), h('span', {}, nameOf.cls(r.classId) + (r.reason ? ' · ' + r.reason : '')))))) : emptyState('لا غياب مسجّل اليوم.', null, 'ok'))));
  }
  function drawReport() {
    let from = addDays(T, -29), to = T, cls = '';
    const out = h('div');
    const run = () => {
      const pool = (cls ? classStudents(cls) : Scope.students(u).filter(s => s.status === 'active'));
      const rows = pool.map(s => ({ s, a: studentAtt(s.id, from, to) }));
      const tot = attStats(Repo.all('attendance').filter(r => r.date >= from && r.date <= to && pool.some(s => s.id === r.studentId)));
      out.replaceChildren(h('div', { class: 'kpis', style: { marginBottom: '14px' } }, kpi({ label: 'نسبة الحضور', value: fmtPct(tot.rate, 1), ic: 'check', tone: tot.rate >= 92 ? 'ok' : 'warn' }), kpi({ label: 'أيام الغياب', value: fmtNum(tot.absent), ic: 'user', tone: 'bad' }), kpi({ label: 'التأخر', value: fmtNum(tot.late), ic: 'clock', tone: 'warn' }), kpi({ label: 'غياب بعذر', value: fmtNum(tot.excused), ic: 'info' })),
        DataTable({ id: 'att-rep', unit: 'طالب', exportName: 'attendance-report', rows, defaultSort: 3, defaultDir: -1, searchText: x => x.s.fullName, columns: [
          { label: 'الطالب', sort: x => x.s.fullName, render: x => studentLink(x.s), csv: x => x.s.fullName },
          { label: 'الفصل', sort: x => nameOf.cls(x.s.classId), render: x => nameOf.cls(x.s.classId) },
          { label: 'نسبة الحضور', sort: x => x.a.rate, render: x => pctCell(x.a.rate), csv: x => fmtNum(x.a.rate, 1) },
          { label: 'غياب', desc: true, sort: x => x.a.absent, render: x => h('b', { class: 'tabnum', style: { color: x.a.absent ? 'var(--red)' : null } }, fmtNum(x.a.absent)), csv: x => x.a.absent },
          { label: 'تأخر', desc: true, sort: x => x.a.late, render: x => fmtNum(x.a.late), csv: x => x.a.late },
          { label: 'بعذر', desc: true, sort: x => x.a.excused, render: x => fmtNum(x.a.excused), csv: x => x.a.excused },
          { label: 'أيام مسجّلة', sort: x => x.a.total, render: x => fmtNum(x.a.total), csv: x => x.a.total }
        ] }));
    };
    body.replaceChildren(card(null, h('div', { class: 'stack', style: { gap: '14px' } }, h('div', { class: 'row' }, selectEl([['', 'كل الفصول'], ...classes.map(c => [c.id, c.name])], cls, v => { cls = v; run(); }, { 'aria-label': 'الفصل' }), h('label', { class: 'row small' }, 'من', h('input', { type: 'date', class: 'input sm', value: from, onchange: e => { from = e.target.value; run(); } })), h('label', { class: 'row small' }, 'إلى', h('input', { type: 'date', class: 'input sm', value: to, onchange: e => { to = e.target.value; run(); } }))), out)));
    run();
  }
  draw();
};
function attendanceFamily(page, u) {
  const kids = Scope.students(u); let cur = (kids[0] || {}).id; const T = todayISO();
  const body = h('div', { class: 'stack', style: { gap: '14px' } });
  function draw() {
    const st = Repo.get('students', cur); if (!st) { body.replaceChildren(emptyState('لا يوجد طالب مرتبط بالحساب.')); return; }
    const recs = (Idx().attByStudent.get(st.id) || []).slice().sort((a, b) => a.date < b.date ? 1 : -1);
    const a = studentAtt(st.id); const a30 = studentAtt(st.id, addDays(T, -29), T); const ds = recordedDates();
    body.replaceChildren(
      h('div', { class: 'kpis' }, kpi({ label: 'الحضور (30 يومًا)', value: fmtPct(a30.rate, 1), ic: 'check', tone: a30.rate >= 92 ? 'ok' : a30.rate >= 85 ? 'warn' : 'bad' }), kpi({ label: 'أيام الغياب', value: fmtNum(a.absent), ic: 'user', tone: a.absent ? 'bad' : 'ok', sub: 'منذ بداية الفصل' }), kpi({ label: 'التأخر', value: fmtNum(a.late), ic: 'clock', tone: a.late ? 'warn' : 'ok' }), kpi({ label: 'غياب بعذر', value: fmtNum(a.excused), ic: 'info' })),
      h('div', { class: 'grid g2' }, card('تقويم الحضور', attCalendar(recs, ds[0] || addDays(T, -35), T)), card('السجل', recs.filter(r => r.status !== 'present').length ? h('div', { class: 'list' }, recs.filter(r => r.status !== 'present').map(r => h('div', { class: 'li' }, badge(ATT_LABEL[r.status], ATT_CLS[r.status]), h('div', { class: 'bd' }, h('b', {}, DAYS[dow(r.date)] + ' ' + fmtDate(r.date)), h('span', {}, r.reason || '—'))))) : emptyState('لا غياب ولا تأخر. التزام ممتاز.', null, 'ok'))));
  }
  const hd = h('div');
  const drawHead = () => hd.replaceChildren(pageHead('الحضور والغياب', u.role === 'parent' ? 'سجل حضور أبنائك' : 'سجل حضورك', childPicker(u, cur, v => { cur = v; drawHead(); draw(); })));
  page.append(hd, body); drawHead(); draw();
}

/* ---------- Grades ---------- */
PAGE_RENDER.grades = (page) => {
  const u = App.user;
  if (u.role === 'student' || u.role === 'parent') return gradesFamily(page, u);
  const classes = Scope.classes(u).filter(c => u.role === 'admin' || Scope.assignments(u).some(a => a.classId === c.id));
  const pre = Store.ss.get('ass:gradeSel'); Store.ss.del('ass:gradeSel');
  let classId = (classes[0] || {}).id, subjectId = null;
  if (pre) { const [c, s] = pre.split('|'); if (classes.some(x => x.id === c)) { classId = c; subjectId = s; } }
  const head = h('div'), body = h('div', { class: 'stack', style: { gap: '14px' } });
  page.append(head, body);
  function draw() {
    if (!classes.length) { head.replaceChildren(pageHead('الدرجات')); body.replaceChildren(emptyState('لا توجد مواد مسندة إليك.')); return; }
    const subs = Scope.subjectsFor(u, classId); if (!subs.some(s => s.id === subjectId)) subjectId = (subs[0] || {}).id;
    const canEdit = Scope.teaches(u, classId, subjectId);
    head.replaceChildren(pageHead('الدرجات', 'إدخال الدرجات بأوزان مرنة، مع حساب النسبة والتقدير والترتيب تلقائيًا', selectEl(classes.map(c => [c.id, c.name]), classId, v => { classId = v; draw(); }, { 'aria-label': 'الفصل' }), selectEl(subs.map(s => [s.id, s.name]), subjectId, v => { subjectId = v; draw(); }, { 'aria-label': 'المادة' }), canEdit ? h('button', { class: 'btn primary', onclick: () => assessmentForm(classId, subjectId, null, draw) }, icon('plus', 16), 'تقييم جديد') : null));
    body.replaceChildren(gradeGrid(classId, subjectId, canEdit, draw));
  }
  draw();
};
function gradeGrid(classId, subjectId, canEdit, redraw) {
  const u = App.user; const subj = Repo.get('subjects', subjectId);
  const as = assessmentsFor(classId, subjectId); const sts = classStudents(classId);
  if (!subj) return emptyState('اختر مادة.');
  const saveInd = h('span', { class: 'save-ind', 'aria-live': 'polite' });
  const computed = new Map();
  const ranksCell = new Map();
  function recompute() {
    const ranks = rankMap(sts.map(s => ({ id: s.id, val: subjectResult(s, subjectId).percent })));
    sts.forEach(s => { const r = subjectResult(s, subjectId).percent; const c = computed.get(s.id); if (!c) return; c.p.replaceChildren(r == null ? '—' : pctCell(r, r < passOf(subj) ? 'bad' : r >= 80 ? 'ok' : '')); c.g.replaceChildren(badge(gradeLabel(r), gradeTone(r), true)); c.r.textContent = ranks.get(s.id) ? fmtNum(ranks.get(s.id)) : '—'; });
    statsBox.replaceChildren(gradeStats(classId, subjectId));
  }
  const statsBox = h('div');
  const head = h('tr', {}, h('th', {}, 'الطالب'), as.map(a => h('th', {}, h('div', { class: 'ah' }, h('span', {}, a.name), h('small', {}, `${EXAM_LABEL[a.type]} · من ${fmtNum(a.maxScore)} · وزن ${fmtNum(a.weight)}`), h('div', { class: 'row', style: { gap: '2px', justifyContent: 'center' } }, a.isPublished ? badge('منشور', 'ok', true) : badge('مسودة', 'warn', true), canEdit ? h('button', { class: 'icon-btn sm', 'aria-label': 'خيارات ' + a.name, title: 'خيارات', onclick: () => assessmentMenu(a, redraw) }, icon('sliders', 14)) : null)))), h('th', {}, 'النسبة'), h('th', {}, 'التقدير'), h('th', {}, 'الترتيب'));
  const tb = h('tbody');
  sts.forEach((s, si) => {
    const tr = h('tr', {}, h('td', {}, h('a', { href: '#student-' + s.id }, s.fullName)));
    as.forEach((a, ai) => {
      const g = gradeOf(a.id, s.id); const locked = g && g.isLocked && u.role !== 'admin';
      const inp = h('input', { type: 'number', step: '0.5', min: 0, max: a.maxScore, inputmode: 'decimal', value: hasScore(g) ? g.score : '', disabled: !canEdit || locked, 'aria-label': `${s.fullName} — ${a.name}`, 'data-r': si, 'data-c': ai, title: locked ? 'مقفلة بعد إصدار الشهادة' : '' });
      inp.addEventListener('change', () => {
        const v = inp.value.trim(); inp.classList.remove('invalid', 'saved');
        if (v !== '' && (isNaN(v) || Number(v) < 0 || Number(v) > a.maxScore)) { inp.classList.add('invalid'); toast.error(`الدرجة يجب أن تكون بين 0 و${fmtNum(a.maxScore)}`); return; }
        const r = setGrade(a, s.id, v);
        if (r === 'locked') { toast.error('هذه الدرجة مقفلة بعد إصدار الشهادة.'); return; }
        if (r === 'ok') { inp.classList.add('saved'); saveInd.replaceChildren(icon('ok', 14), 'حُفظ تلقائيًا ' + fmtTime(new Date().toISOString())); recompute(); }
      });
      inp.addEventListener('keydown', e => {
        const mv = (r, c) => { const t = tb.querySelector(`input[data-r="${r}"][data-c="${c}"]`); if (t) { e.preventDefault(); t.focus(); t.select(); } };
        if (e.key === 'Enter' || e.key === 'ArrowDown') mv(si + 1, ai); else if (e.key === 'ArrowUp') mv(si - 1, ai);
        else if (e.key === 'ArrowLeft' && (inp.selectionStart === undefined || true) && e.altKey) mv(si, ai + 1); else if (e.key === 'ArrowRight' && e.altKey) mv(si, ai - 1);
      });
      tr.append(h('td', {}, inp, locked ? h('span', { class: 'muted', title: 'مقفلة' }, ' ', icon('lock', 12)) : null));
    });
    const p = h('td'), gcell = h('td'), r = h('td', { class: 'tabnum' });
    computed.set(s.id, { p, g: gcell, r }); tr.append(p, gcell, r); tb.append(tr);
  });
  const table = h('table', { class: 'tbl gtbl' }, h('thead', {}, head), tb);
  recompute();
  const locked = as.some(a => (Idx().gradesByAssess.get(a.id) || []).some(g => g.isLocked));
  return h('div', { class: 'stack', style: { gap: '14px' } },
    !canEdit ? banner('عرض فقط: هذه المادة غير مسندة إليك في هذا الفصل.', '', 'eye') : null,
    locked ? banner(h('span', {}, 'بعض الدرجات مقفلة لأن الشهادات صدرت. ', u.role === 'admin' ? h('a', { href: '#', onclick: e => { e.preventDefault(); unlockGrades(classId, subjectId, redraw); } }, 'فك القفل لهذه المادة') : 'التعديل متاح للإدارة فقط.'), 'warn', 'lock') : null,
    statsBox,
    as.length ? card(`${subj.name} — ${nameOf.cls(classId)}`, h('div', { class: 'stack' }, h('div', { class: 'row between small muted' }, h('span', {}, 'Enter أو السهم للأسفل للانتقال للطالب التالي. يُحفظ كل إدخال تلقائيًا. النسبة = مجموع (الدرجة ÷ الحد الأعلى × الوزن) ÷ مجموع الأوزان.'), saveInd), h('div', { class: 'tbl-wrap' }, table))) : emptyState('لا تقييمات لهذه المادة بعد.', canEdit ? h('button', { class: 'btn primary', onclick: () => assessmentForm(classId, subjectId, null, redraw) }, 'إنشاء أول تقييم') : null, 'pen'));
}
function gradeStats(classId, subjectId) {
  const subj = Repo.get('subjects', subjectId); const ps = classStudents(classId).map(s => subjectResult(s, subjectId).percent).filter(v => v != null);
  if (!ps.length) return h('div');
  const pass = ps.filter(p => p >= passOf(subj)).length;
  const bins = [0, 50, 60, 70, 80, 90].map((lo, i, arr) => ({ label: i === 0 ? '<50' : `${lo}–${(arr[i + 1] || 101) - 1}`, value: ps.filter(p => p >= lo && p < (arr[i + 1] || 101)).length }));
  return h('div', { class: 'grid g-main' }, h('div', { class: 'kpis', style: { gridTemplateColumns: 'repeat(2,minmax(0,1fr))' } },
    kpi({ label: 'متوسط الفصل', value: fmtPct(avg(ps), 1), ic: 'chart', tone: gradeTone(avg(ps)) }), kpi({ label: 'نسبة النجاح', value: fmtPct(pass / ps.length * 100, 0), ic: 'award', tone: pass / ps.length >= .85 ? 'ok' : 'warn', sub: `${fmtNum(pass)} من ${fmtNum(ps.length)}` }),
    kpi({ label: 'أعلى نسبة', value: fmtPct(Math.max(...ps), 1), ic: 'up', tone: 'ok' }), kpi({ label: 'أدنى نسبة', value: fmtPct(Math.min(...ps), 1), ic: 'down', tone: Math.min(...ps) < 50 ? 'bad' : '' })),
    card('توزيع النسب', barChart({ labels: bins.map(b => b.label), series: [{ name: 'عدد الطلاب', values: bins.map(b => b.value), color: 'var(--c1)' }], height: 200, fmt: v => fmtNum(v), showVals: true })));
}
function assessmentForm(classId, subjectId, a, redraw) {
  const W = Settings.get().weights;
  formModal({
    title: a ? 'تعديل التقييم' : 'تقييم جديد — ' + nameOf.subj(subjectId), values: a || { type: 'monthly', maxScore: 20, weight: W.monthly, date: todayISO() },
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
      toast.success(a ? 'تم تعديل التقييم' : 'أُضيف التقييم كمسودة. أدخل الدرجات ثم انشره.'); redraw();
    }
  });
  setTimeout(() => { const t = $('#f-type'), w = $('#f-weight'); if (t && w && !a) t.addEventListener('change', () => { w.value = W[t.value] ?? w.value; }); }, 60);
}
function assessmentMenu(a, redraw) {
  const n = (Idx().gradesByAssess.get(a.id) || []).filter(hasScore).length; const total = classStudents(a.classId).length;
  const m = openModal({ title: a.name, size: 'sm', body: h('div', { class: 'stack' }, kv([['المادة', nameOf.subj(a.subjectId)], ['الفصل', nameOf.cls(a.classId)], ['النوع', EXAM_LABEL[a.type]], ['التاريخ', fmtDate(a.date)], ['الدرجات المدخلة', `${fmtNum(n)} من ${fmtNum(total)}`], ['الحالة', a.isPublished ? 'منشور للطلاب وأولياء الأمور' : 'مسودة (غير مرئي للطلاب)']]), n < total && !a.isPublished ? banner('لم تُدخل كل الدرجات بعد. يمكنك النشر وسيرى الطلاب الدرجات المدخلة فقط.', 'warn', 'alert') : null),
    footer: [
      a.isPublished ? h('button', { class: 'btn', onclick: () => { Repo.update('assessments', a.id, { isPublished: false }); m.close(); redraw(); toast.info('أُلغي نشر التقييم'); } }, 'إلغاء النشر') : h('button', { class: 'btn success', disabled: !n, onclick: () => { const r = publishAssessment(a); m.close(); redraw(); toast.success(`نُشر التقييم وأُرسل ${fmtNum(r.notified)} إشعارًا` + (r.alerts ? ` · ${fmtNum(r.alerts)} تنبيه انخفاض لأولياء الأمور` : '')); } }, icon('send', 15), 'نشر الدرجات'),
      h('button', { class: 'btn', onclick: () => { m.close(); assessmentForm(a.classId, a.subjectId, a, redraw); } }, icon('edit', 15), 'تعديل'),
      h('button', { class: 'btn ghost', style: { color: 'var(--red)' }, onclick: async () => { m.close(); if (await confirmDialog({ title: 'حذف التقييم', message: `حذف «${a.name}»${n ? ` مع ${fmtNum(n)} درجة مدخلة` : ''}؟`, ok: 'حذف', danger: true })) { if ((Idx().gradesByAssess.get(a.id) || []).some(g => g.isLocked) && App.user.role !== 'admin') { toast.error('لا يمكن حذف تقييم بدرجات مقفلة.'); return; } Repo.remove('assessments', a.id); (Idx().gradesByAssess.get(a.id) || []).forEach(g => Repo.remove('grades', g.id, { audit: false })); redraw(); toast.success('تم حذف التقييم'); } } }, icon('trash', 15), 'حذف')
    ] });
}
async function unlockGrades(classId, subjectId, redraw) {
  if (!(await confirmDialog({ title: 'فك قفل الدرجات', message: `فك قفل درجات ${nameOf.subj(subjectId)} في ${nameOf.cls(classId)}؟ يُسجَّل هذا الإجراء في سجل النشاط، ويجب إعادة إصدار الشهادات بعد التعديل.`, ok: 'فك القفل' }))) return;
  assessmentsFor(classId, subjectId).forEach(a => (Idx().gradesByAssess.get(a.id) || []).forEach(g => { if (g.isLocked) Repo.update('grades', g.id, { isLocked: false }, { audit: false }); }));
  Audit.log('update', 'grades', classId, { locked: true }, { locked: false, subjectId }); toast.success('تم فك القفل'); redraw();
}
function gradesFamily(page, u) {
  const kids = Scope.students(u); let cur = (kids[0] || {}).id;
  const body = h('div', { class: 'stack', style: { gap: '14px' } });
  function draw() {
    const st = Repo.get('students', cur); if (!st) { body.replaceChildren(emptyState('لا يوجد طالب مرتبط بالحساب.')); return; }
    const res = studentResults(st, { publishedOnly: true }); const ser = gradeSeries(st);
    const rank = classRanking(st.classId, { publishedOnly: true }).get(st.id);
    body.replaceChildren(
      h('div', { class: 'kpis' }, kpi({ label: 'المعدل', value: fmtPct(res.avg, 1), ic: 'award', tone: gradeTone(res.avg), sub: gradeLabel(res.avg) }), kpi({ label: 'الترتيب في الفصل', value: rank ? fmtNum(rank) : '—', ic: 'chart', sub: 'من ' + fmtNum(classStudents(st.classId).length) }), kpi({ label: 'المواد', value: fmtNum(res.rows.length), ic: 'book', tone: res.failing ? 'bad' : 'ok', sub: res.failing ? `${fmtNum(res.failing)} تحت خط النجاح` : 'كلها ناجحة' }), kpi({ label: 'النتيجة المتوقعة', value: res.result ? RESULT_LABEL[res.result][0] : '—', ic: 'pen', tone: res.result ? RESULT_LABEL[res.result][1] : '' })),
      h('div', { class: 'grid g2' }, card('النتائج حسب المادة', subjectsTable(st), { flush: true }), card('تطور المستوى', ser.length >= 2 ? lineChart({ labels: ser.map(x => fmtDateShort(x.date)), series: [{ name: 'المتوسط', values: ser.map(x => x.p), color: 'var(--c1)' }], min: 0, max: 100, fmt: v => fmtNum(v) + '%', tip: v => fmtPct(v, 1) }) : emptyState('بيانات غير كافية.'))),
      card('كل التقييمات المنشورة', assessmentsDetail(st), { flush: true }));
  }
  const hd = h('div');
  const drawHead = () => hd.replaceChildren(pageHead('الدرجات', u.role === 'parent' ? 'درجات أبنائك المنشورة' : 'درجاتك المنشورة', childPicker(u, cur, v => { cur = v; drawHead(); draw(); })));
  page.append(hd, body); drawHead(); draw();
}

/* ---------- Certificates ---------- */
PAGE_RENDER.certificates = (page) => {
  const u = App.user;
  if (u.role === 'student' || u.role === 'parent') {
    const kids = Scope.students(u);
    page.append(pageHead('الشهادات', 'الشهادات الصادرة وكشف الدرجات المؤقت', h('button', { class: 'btn ghost', onclick: () => go('verify') }, icon('qr', 16), 'التحقق من شهادة')));
    kids.forEach(st => {
      const cs = Repo.where('certificates', c => c.studentId === st.id);
      page.append(card(st.fullName + ' — ' + nameOf.cls(st.classId), cs.length ? h('div', { class: 'list' }, cs.map(c => h('div', { class: 'li' }, icon('award', 22), h('div', { class: 'bd' }, h('b', {}, `${Settings.get().termName} ${(Repo.get('academicYears', c.academicYearId) || {}).name || ''} · ${fmtPct(c.percentage, 1)} — ${c.gradeLabel}`), h('span', { class: 'ltr' }, c.certNo)), badge(RESULT_LABEL[c.result][0], RESULT_LABEL[c.result][1]), h('button', { class: 'btn primary sm', onclick: () => showCertificate(c) }, 'عرض الشهادة')))) : emptyState('لم تصدر الشهادة الرسمية بعد. يمكنك عرض كشف الدرجات المؤقت.', h('button', { class: 'btn sm', onclick: () => showProvisional(st) }, 'عرض الكشف المؤقت'), 'award')));
    });
    return;
  }
  const classes = Scope.classes(u); let classId = (classes[0] || {}).id;
  const body = h('div');
  function draw() {
    const sts = classStudents(classId); const ranks = classRanking(classId, { publishedOnly: true }); const year = activeYear(); const S = Settings.get();
    const certs = new Map(Repo.where('certificates', c => c.academicYearId === year.id && c.term === S.term).map(c => [c.studentId, c]));
    const issued = sts.filter(s => certs.has(s.id)).length;
    const pending = Repo.all('assessments').filter(a => a.classId === classId && !a.isPublished).length;
    body.replaceChildren(h('div', { class: 'stack', style: { gap: '14px' } },
      h('div', { class: 'row' }, selectEl(classes.map(c => [c.id, c.name]), classId, v => { classId = v; draw(); }, { 'aria-label': 'الفصل' }), badge(`صدر ${fmtNum(issued)} من ${fmtNum(sts.length)}`, issued === sts.length && sts.length ? 'ok' : 'warn', true), h('div', { class: 'grow' }),
        isAdmin(u) ? h('button', { class: 'btn primary', onclick: async () => { if (!(await confirmDialog({ title: 'إصدار شهادات ' + nameOf.cls(classId), message: `ستُحسب النتائج من التقييمات المنشورة فقط، وتُقفل درجات الفصل بعد الإصدار، ويُشعَر الطلاب وأولياء الأمور.${pending ? ` تنبيه: يوجد ${fmtNum(pending)} تقييم غير منشور لن يُحتسب.` : ''}`, ok: issued ? 'إعادة الإصدار' : 'إصدار الشهادات' }))) return; const r = issueCertificates(classId); toast.success(`صدرت ${fmtNum(r.made)} شهادة جديدة` + (r.updated ? ` وحُدّثت ${fmtNum(r.updated)}` : '')); draw(); } }, icon('award', 16), issued ? 'إعادة إصدار الشهادات' : 'إصدار شهادات الفصل') : null),
      pending ? banner(`يوجد ${fmtNum(pending)} تقييم غير منشور في هذا الفصل ولن يدخل في حساب الشهادة.`, 'warn', 'alert') : null,
      card(null, DataTable({ id: 'certs', unit: 'طالب', rows: sts, defaultSort: 2, exportName: 'results-' + nameOf.cls(classId), columns: [
        { label: 'الطالب', sort: s => s.fullName, render: s => studentLink(s), csv: s => s.fullName },
        { label: 'المعدل', desc: true, sort: s => studentResults(s, { publishedOnly: true }).avg, render: s => pctCell(studentResults(s, { publishedOnly: true }).avg), csv: s => fmtNum(studentResults(s, { publishedOnly: true }).avg, 1) },
        { label: 'الترتيب', sort: s => ranks.get(s.id) ?? 999, render: s => h('b', { class: 'tabnum' }, ranks.get(s.id) ? fmtNum(ranks.get(s.id)) : '—'), csv: s => ranks.get(s.id) || '' },
        { label: 'التقدير', sortable: false, render: s => { const a = studentResults(s, { publishedOnly: true }).avg; return badge(gradeLabel(a), gradeTone(a), true); }, csv: s => gradeLabel(studentResults(s, { publishedOnly: true }).avg) },
        { label: 'النتيجة', sort: s => studentResults(s, { publishedOnly: true }).result, render: s => { const r = studentResults(s, { publishedOnly: true }); return r.result ? badge(RESULT_LABEL[r.result][0] + (r.failing ? ` (${fmtNum(r.failing)})` : ''), RESULT_LABEL[r.result][1]) : '—'; }, csv: s => (RESULT_LABEL[studentResults(s, { publishedOnly: true }).result] || [''])[0] },
        { label: 'الشهادة', sortable: false, render: s => { const c = certs.get(s.id); return c ? h('span', { class: 'ltr small' }, c.certNo) : h('span', { class: 'muted small' }, 'لم تصدر'); }, csv: s => (certs.get(s.id) || {}).certNo || '' },
        { label: '', sortable: false, cls: 'acts', csv: false, render: s => { const c = certs.get(s.id); return c ? h('button', { class: 'btn sm', onclick: () => showCertificate(c) }, 'عرض') : h('button', { class: 'btn ghost sm', onclick: () => showProvisional(s) }, 'معاينة'); } }
      ] }))));
  }
  page.append(pageHead('الشهادات', 'نتائج الفصل الدراسي وإصدار الشهادات الموثّقة برقم فريد ورمز تحقق', h('button', { class: 'btn ghost', onclick: () => go('verify') }, icon('qr', 16), 'التحقق من شهادة')), body);
  draw();
};
function certificateNode(st, data, provisional) {
  const S = Settings.get(); const year = Repo.get('academicYears', data.academicYearId) || activeYear();
  const fail = data.subjects.filter(x => x.score < x.pass).length;
  const qrText = provisional ? null : `${S.schoolNameEn.toUpperCase()} | CERT ${data.certNo} | VERIFY ${data.verifyCode}`;
  return h('div', { class: 'cert' }, h('div', { class: 'cert-in' },
    h('div', { class: 'cert-head' }, h('div', { class: 'row', style: { gap: '12px' } }, h('div', { class: 'crest lg', style: { boxShadow: 'inset 0 0 0 1px #d7dceb' } }, h('i'), h('i'), h('i')), h('div', {}, h('div', { class: 'sch' }, S.schoolName), h('div', { class: 'en' }, S.schoolNameEn.toUpperCase()), h('div', { style: { fontSize: '12px', color: '#5a6680' } }, S.address))), h('div', { class: 'meta' }, h('div', {}, 'العام الدراسي ' + (year.name || S.academicYear)), h('div', {}, S.termName), provisional ? h('div', {}, 'تاريخ الطباعة ' + fmtDate(todayISO())) : h('div', {}, 'رقم الشهادة ', h('b', { class: 'ltr', style: { color: '#14203a' } }, data.certNo)))),
    h('div', { class: 'cert-title' + (provisional ? ' prov' : '') }, provisional ? 'كشف درجات مؤقت' : (data.result === 'pass' ? 'شهادة نجاح' : 'شهادة نتائج الفصل')),
    h('div', { class: 'cert-sub' }, provisional ? 'غير رسمي — للاطلاع فقط، ويُحتسب من التقييمات المنشورة حتى تاريخه' : 'تشهد إدارة المدرسة بأن الطالب المذكور أدناه قد حصل على النتائج التالية'),
    h('div', { class: 'cert-stripes' }, h('i', { style: { background: '#c42b2b' } }), h('i', { style: { background: '#13803b' } }), h('i', { style: { background: '#1f4fd8' } })),
    h('div', { class: 'cert-info' }, [['اسم الطالب', st.fullName], ['الصف', gradeName(st.gradeLevel)], ['الفصل', nameOf.cls(data.classId || st.classId)], ['الرقم المدرسي', h('span', { class: 'ltr' }, st.studentNo)], ['تاريخ الميلاد', fmtDate(st.birthDate)], ['اسم الأم', st.motherName || '—']].map(([k, v]) => h('div', {}, h('span', {}, k), h('b', {}, v)))),
    h('table', {}, h('thead', {}, h('tr', {}, ['المادة', 'الدرجة النهائية', 'درجة النجاح', 'الدرجة', 'التقدير'].map(x => h('th', {}, x)))), h('tbody', {}, data.subjects.map(x => h('tr', {}, h('td', {}, x.name), h('td', {}, fmtNum(x.max)), h('td', {}, fmtNum(x.pass)), h('td', { class: x.score < x.pass ? 'fail-mark' : '' }, fmtNum(x.score, 1)), h('td', {}, x.gradeLabel))))),
    h('div', { class: 'cert-sum' }, [['المجموع', `${fmtNum(data.total, 1)} / ${fmtNum(data.maxTotal)}`], ['النسبة', fmtPct(data.percentage, 1)], ['التقدير', data.gradeLabel], ['الترتيب', data.rank ? `${fmtNum(data.rank)} من ${fmtNum(data.classSize)}` : '—']].map(([k, v]) => h('div', {}, h('span', {}, k), h('b', {}, v)))),
    h('div', { style: { textAlign: 'center', fontWeight: 600, color: data.result === 'pass' ? '#13803b' : data.result === 'fail' ? '#c42b2b' : '#a35a05' } }, 'النتيجة: ' + RESULT_LABEL[data.result][0] + (fail ? ` — ${fmtNum(fail)} ${fail === 1 ? 'مادة' : 'مواد'} تحت خط النجاح` : '')),
    h('div', { class: 'cert-foot' },
      provisional ? h('div', { class: 'cert-qr' }, 'هذا الكشف لا يُعتمد رسميًا.') : h('div', { class: 'cert-qr' }, QR.svg(qrText, 92), h('div', {}, 'للتحقق من صحة الشهادة أدخل الرمز', h('br'), h('b', {}, data.verifyCode), h('br'), 'في صفحة «التحقق من شهادة»', h('br'), 'تاريخ الإصدار ' + fmtDate(data.issueDate))),
      provisional ? null : h('div', { class: 'stamp' }, S.schoolName, h('br'), year.name || ''),
      h('div', { class: 'cert-sign' }, 'مدير المدرسة', h('div', { class: 'ln' }, S.principalName)))));
}
function showCertificate(c) {
  const st = Repo.get('students', c.studentId); if (!st) return;
  const node = certificateNode(st, c, false);
  const m = openModal({ title: 'شهادة ' + st.fullName, size: 'xl', body: h('div', { style: { background: 'var(--sunken)', padding: '12px', borderRadius: '12px', overflowX: 'auto' } }, node), footer: [printBtn(() => node, 'certificate', 'طباعة / حفظ PDF'), h('button', { class: 'btn', onclick: () => copyText(c.verifyCode, 'نُسخ رمز التحقق ' + c.verifyCode) }, icon('copy', 15), 'نسخ رمز التحقق'), h('button', { class: 'btn ghost', onclick: () => m.close() }, 'إغلاق')].filter(Boolean) });
}
function showProvisional(st) {
  const r = studentResults(st, { publishedOnly: true });
  if (!r.rows.length) { toast.info('لا توجد درجات منشورة بعد.'); return; }
  const data = { academicYearId: activeYear().id, classId: st.classId, subjects: r.rows.map(x => ({ name: x.subject.name, score: Math.round(x.percent * 10) / 10, max: 100, pass: passOf(x.subject), gradeLabel: gradeLabel(x.percent) })), total: sum(r.rows.map(x => x.percent)), maxTotal: r.rows.length * 100, percentage: r.avg, gradeLabel: gradeLabel(r.avg), rank: classRanking(st.classId, { publishedOnly: true }).get(st.id), classSize: classStudents(st.classId).length, result: r.result };
  const node = certificateNode(st, data, true);
  const m = openModal({ title: 'كشف درجات مؤقت — ' + st.fullName, size: 'xl', body: h('div', { style: { background: 'var(--sunken)', padding: '12px', borderRadius: '12px', overflowX: 'auto' } }, node), footer: [printBtn(() => node, 'transcript'), h('button', { class: 'btn ghost', onclick: () => m.close() }, 'إغلاق')].filter(Boolean) });
}
