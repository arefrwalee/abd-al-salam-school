/* =====================================================================
   Pages C — المالية، الإشعارات، التقارير، المساعد، المستخدمون، السجل، الإعدادات
   ===================================================================== */

/* ---------- Payments ---------- */
PAGE_RENDER.payments = (page) => {
  const u = App.user;
  if (u.role !== 'admin') return paymentsFamily(page, u);
  const ft = financeTotals(); const S = Settings.get();
  page.append(pageHead('الرسوم والمدفوعات', `${S.termName} · العام الدراسي ${S.academicYear}`, h('button', { class: 'btn', onclick: () => bulkFeesForm() }, icon('plus', 16), 'إنشاء رسوم جماعية'), h('button', { class: 'btn primary', onclick: () => paymentForm() }, icon('wallet', 16), 'تسجيل دفعة')));
  page.append(h('div', { class: 'kpis' },
    kpi({ label: 'إجمالي المستحق', value: fmtMoney(ft.net), ic: 'receipt', sub: 'بعد الخصومات' }),
    kpi({ label: 'المحصّل', value: fmtMoney(ft.paid), ic: 'wallet', tone: 'ok', sub: `${fmtPct(ft.rate, 1)} · المستهدف ${fmtPct(S.collectionTarget)}`, extra: progress(ft.rate, ft.rate >= S.collectionTarget ? 'ok' : 'warn') }),
    kpi({ label: 'المتبقي', value: fmtMoney(ft.remaining), ic: 'clock', tone: 'warn' }),
    kpi({ label: 'متأخر السداد', value: fmtMoney(ft.overdue), ic: 'alert', tone: ft.overdue ? 'bad' : 'ok', sub: `${fmtNum(ft.overdueStudents)} طالبًا` })));
  const byType = Object.keys(FEE_LABEL).map(k => { const infos = ft.infos.filter(i => i.fee.feeType === k); return { k, net: sum(infos.map(i => i.net)), paid: sum(infos.map(i => i.paid)) }; }).filter(x => x.net);
  const balances = () => Repo.where('students', s => (Idx().feesByStudent.get(s.id) || []).length).map(s => ({ s, f: studentFinance(s.id) }));
  page.append(tabs([
    { key: 'bal', label: 'أرصدة الطلاب', render: () => card(null, DataTable({ id: 'bal', unit: 'طالب', exportName: 'balances', rows: balances, defaultSort: 4, defaultDir: -1, searchText: x => x.s.fullName + ' ' + x.s.studentNo,
      filters: [{ label: 'كل الحالات', options: Object.entries(PAY_STATUS).map(([k, v]) => [k, v[0]]), test: (x, v) => x.f.status === v }, { label: 'كل الفصول', options: Repo.all('classes').sort(byClass).map(c => [c.id, c.name]), test: (x, v) => x.s.classId === v }],
      columns: [
        { label: 'الطالب', sort: x => x.s.fullName, render: x => studentLink(x.s), csv: x => x.s.fullName },
        { label: 'الفصل', sort: x => nameOf.cls(x.s.classId), render: x => nameOf.cls(x.s.classId) },
        { label: 'المستحق', sort: x => x.f.net, render: x => h('span', { class: 'tabnum' }, fmtMoney(x.f.net)), csv: x => x.f.net },
        { label: 'المدفوع', sort: x => x.f.paid, render: x => h('span', { class: 'tabnum' }, fmtMoney(x.f.paid)), csv: x => x.f.paid },
        { label: 'المتبقي', desc: true, sort: x => x.f.remaining, render: x => h('b', { class: 'tabnum', style: { color: x.f.overdue ? 'var(--red)' : null } }, fmtMoney(x.f.remaining)), csv: x => x.f.remaining },
        { label: 'الحالة', sort: x => x.f.status, render: x => badge(PAY_STATUS[x.f.status][0], PAY_STATUS[x.f.status][1]), csv: x => PAY_STATUS[x.f.status][0] },
        { label: '', sortable: false, cls: 'acts', csv: false, render: x => h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '4px' } }, h('button', { class: 'btn ghost xs', onclick: () => studentFeesModal(x.s) }, 'التفاصيل'), x.f.remaining ? h('button', { class: 'btn soft xs', onclick: () => paymentForm(x.s) }, 'دفعة') : null) }
      ] })) },
    { key: 'rec', label: 'الإيصالات', render: () => card(null, DataTable({ id: 'rec', unit: 'إيصال', exportName: 'receipts', rows: receipts, searchText: r => r.receiptNo + ' ' + nameOf.st(r.studentId),
      filters: [{ label: 'كل الطرق', options: Object.entries(METHOD_LABEL), test: (r, v) => r.method === v }],
      columns: [
        { label: 'رقم الإيصال', sort: r => r.receiptNo, render: r => h('span', { class: 'ltr' }, r.receiptNo) },
        { label: 'التاريخ', desc: true, sort: r => r.paidAt, render: r => fmtDateTime(r.paidAt), csv: r => r.paidAt.slice(0, 10) },
        { label: 'الطالب', sort: r => nameOf.st(r.studentId), render: r => nameOf.st(r.studentId) },
        { label: 'المبلغ', desc: true, sort: r => r.amount, render: r => h('b', { class: 'tabnum' }, fmtMoney(r.amount)), csv: r => r.amount },
        { label: 'الطريقة', sort: r => r.method, render: r => METHOD_LABEL[r.method] },
        { label: 'استلمها', sortable: false, render: r => r.receivedBy ? nameOf.user(r.receivedBy) : 'المحاسبة' },
        { label: '', sortable: false, cls: 'acts', csv: false, render: r => h('button', { class: 'btn ghost xs', onclick: () => showReceipt(r.receiptNo) }, 'عرض') }
      ] })) },
    { key: 'sum', label: 'ملخص حسب البند', render: () => h('div', { class: 'grid g2' }, card('التحصيل حسب نوع الرسوم', hbars(byType.map(x => ({ label: FEE_LABEL[x.k], value: x.paid / x.net * 100, color: x.paid / x.net >= .85 ? 'var(--c2)' : x.paid / x.net >= .6 ? 'var(--c4)' : 'var(--c3)' })), { max: 100 })), card('المستحق والمحصّل', barChart({ labels: byType.map(x => FEE_LABEL[x.k].replace('رسوم ', '').replace('الرسوم ', '')), series: [{ name: 'المستحق', values: byType.map(x => x.net), color: 'var(--c5)' }, { name: 'المحصّل', values: byType.map(x => x.paid), color: 'var(--c2)' }], tip: fmtMoney }))) }
  ], 'bal'));
};
function paymentForm(st) {
  const sts = Repo.where('students', s => studentFinance(s.id).remaining > 0).sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
  if (!sts.length) { toast.info('لا توجد مبالغ مستحقة على أي طالب.'); return; }
  const info = h('div');
  const showInfo = id => { const s = Repo.get('students', id); if (!s) { info.replaceChildren(); return; } const f = studentFinance(id); info.replaceChildren(banner(h('span', {}, `المتبقي على ${s.fullName}: `, h('b', {}, fmtMoney(f.remaining)), f.overdue ? ` (منها ${fmtMoney(f.overdue)} متأخرة)` : '', '. يُوزَّع المبلغ على البنود الأقدم استحقاقًا أولًا: ', f.fees.filter(x => x.remaining).map(x => `${FEE_LABEL[x.fee.feeType]}${x.fee.label ? ' — ' + x.fee.label : ''} (${fmtMoney(x.remaining)})`).join('، ')), f.overdue ? 'warn' : '', 'wallet')); const a = $('#f-amount'); if (a && !a.value) a.value = f.overdue || f.remaining; };
  formModal({
    title: 'تسجيل دفعة', submit: 'تسجيل وإصدار الإيصال', values: { studentId: st ? st.id : '', method: 'cash' }, extra: info,
    fields: [
      { name: 'studentId', label: 'الطالب', type: 'select', required: true, span: true, placeholder: 'اختر الطالب', options: sts.map(s => [s.id, `${s.fullName} — ${nameOf.cls(s.classId)} (متبقٍ ${fmtMoney(studentFinance(s.id).remaining)})`]) },
      { name: 'amount', label: 'المبلغ (' + Settings.get().currency + ')', type: 'number', min: 1, required: true },
      { name: 'method', label: 'طريقة الدفع', type: 'select', required: true, options: Object.entries(METHOD_LABEL) },
      { name: 'note', label: 'ملاحظة', span: true }
    ],
    onSubmit: v => { const r = recordPayment(v.studentId, v.amount, v.method, v.note); if (r.error) return r.error; toast.success('تم تسجيل الدفعة · إيصال ' + r.receiptNo); render(); setTimeout(() => showReceipt(r.receiptNo), 200); }
  });
  setTimeout(() => { const s = $('#f-studentId'); if (s) { s.addEventListener('change', () => { const a = $('#f-amount'); if (a) a.value = ''; showInfo(s.value); }); if (s.value) showInfo(s.value); } }, 50);
}
function receiptNode(no) {
  const ps = Repo.where('payments', p => p.receiptNo === no); if (!ps.length) return h('div');
  const st = Repo.get('students', ps[0].studentId) || {}; const S = Settings.get(); const fin = studentFinance(st.id);
  return h('div', { class: 'receipt' },
    h('div', { class: 'row between' }, h('div', { class: 'row', style: { gap: '10px' } }, h('div', { class: 'crest', style: { boxShadow: 'inset 0 0 0 1px #d7dceb' } }, h('i'), h('i'), h('i')), h('div', {}, h('b', {}, S.schoolName), h('div', { style: { fontSize: '12px', color: '#5a6680' } }, S.address + ' · ' + S.phone))), h('div', { style: { textAlign: 'left', fontSize: '12px', color: '#5a6680' } }, h('div', { class: 'ltr', style: { fontWeight: 700, color: '#14203a' } }, no), fmtDateTime(ps[0].paidAt))),
    h('h4', { style: { margin: '16px 0 8px' } }, 'إيصال استلام'),
    h('div', { style: { fontSize: '13.5px' } }, 'استلمنا من ولي أمر الطالب ', h('b', {}, st.fullName), ' (', nameOf.cls(st.classId), ') المبلغ المبيّن أدناه:'),
    h('table', {}, h('tbody', {}, ps.map(p => { const f = Repo.get('fees', p.feeId) || {}; return h('tr', {}, h('td', {}, FEE_LABEL[f.feeType] + (f.label ? ' — ' + f.label : '')), h('td', { style: { textAlign: 'left' } }, fmtMoney(p.amount))); }), h('tr', {}, h('td', { class: 'tot' }, 'الإجمالي'), h('td', { class: 'tot', style: { textAlign: 'left' } }, fmtMoney(sum(ps.map(p => p.amount))))))),
    h('div', { style: { fontSize: '12.5px', color: '#5a6680', marginTop: '10px' } }, `طريقة الدفع: ${METHOD_LABEL[ps[0].method]} · المتبقي على الطالب بعد هذه الدفعة: ${fmtMoney(fin.remaining)}`),
    ps[0].note ? h('div', { style: { fontSize: '12.5px', marginTop: '4px' } }, 'ملاحظة: ' + ps[0].note) : null,
    h('div', { class: 'row between', style: { marginTop: '26px', fontSize: '12.5px', color: '#5a6680' } }, h('span', {}, 'المستلم: ' + (ps[0].receivedBy ? nameOf.user(ps[0].receivedBy) : 'المحاسبة')), h('span', {}, 'التوقيع ____________')));
}
function showReceipt(no) {
  const node = receiptNode(no);
  const m = openModal({ title: 'إيصال ' + no, size: 'md', body: h('div', { style: { background: 'var(--sunken)', padding: '12px', borderRadius: '12px' } }, node), footer: [printBtn(() => node, 'receipt'), h('button', { class: 'btn ghost', onclick: () => m.close() }, 'إغلاق')].filter(Boolean) });
}
function studentFeesModal(st) {
  const fin = studentFinance(st.id); const admin = isAdmin(App.user);
  const m = openModal({ title: 'رسوم ' + st.fullName, size: 'lg', body: h('div', { class: 'stack' }, financeDetail(st), admin ? h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { m.close(); feeForm(st); } }, icon('plus', 15), 'إضافة بند رسوم'), h('div', { class: 'grow' }), fin.fees.filter(f => !f.paid).length ? h('span', { class: 'muted small' }, 'لتعديل بند أو منح خصم استخدم الأزرار:') : null) : null, admin ? h('div', { class: 'row' }, fin.fees.map(f => h('span', { class: 'chip' }, FEE_LABEL[f.fee.feeType] + (f.fee.label ? ' — ' + f.fee.label : ''), h('button', { class: 'x', title: 'تعديل', 'aria-label': 'تعديل البند', onclick: () => { m.close(); feeForm(st, f.fee); } }, icon('edit', 13))))) : null), footer: [fin.remaining && admin ? h('button', { class: 'btn primary', onclick: () => { m.close(); paymentForm(st); } }, 'تسجيل دفعة') : null, h('button', { class: 'btn ghost', onclick: () => m.close() }, 'إغلاق')].filter(Boolean) });
}
function feeForm(st, fee) {
  formModal({
    title: (fee ? 'تعديل بند — ' : 'بند رسوم جديد — ') + st.fullName, values: fee || { feeType: 'other', dueDate: addDays(todayISO(), 30), discount: 0 },
    fields: [{ name: 'feeType', label: 'النوع', type: 'select', required: true, options: Object.entries(FEE_LABEL) }, { name: 'label', label: 'وصف إضافي', placeholder: 'مثال: القسط الثالث' }, { name: 'amount', label: 'المبلغ', type: 'number', min: 1, required: true }, { name: 'discount', label: 'الخصم', type: 'number', min: 0 }, { name: 'dueDate', label: 'تاريخ الاستحقاق', type: 'date', required: true }],
    onSubmit: v => {
      v.discount = Number(v.discount || 0); if (v.discount >= v.amount) return 'الخصم يجب أن يكون أقل من المبلغ.';
      if (fee) { const paid = feeInfo(fee).paid; if (v.amount - v.discount < paid) return `المدفوع على هذا البند (${fmtMoney(paid)}) أكبر من صافي المبلغ الجديد.`; Repo.update('fees', fee.id, v); }
      else Repo.create('fees', { ...v, studentId: st.id, academicYearId: activeYear().id, status: 'unpaid' });
      toast.success('تم حفظ بند الرسوم'); render();
    }
  });
}
function bulkFeesForm() {
  formModal({
    title: 'إنشاء رسوم جماعية', submit: 'إنشاء', values: { scope: 'all', feeType: 'activities', dueDate: addDays(todayISO(), 30) }, intro: banner('يُنشأ بند رسوم لكل طالب نشط ضمن النطاق المحدد، ويُرسل إشعار لأولياء الأمور.', '', 'info'),
    fields: [{ name: 'scope', label: 'النطاق', type: 'select', required: true, span: true, options: [['all', 'كل الطلاب النشطين'], ...[...new Set(Repo.all('classes').map(c => c.gradeLevel))].sort((a, b) => a - b).map(g => ['g:' + g, gradeName(g)]), ...Repo.all('classes').sort(byClass).map(c => ['c:' + c.id, c.name])] }, { name: 'feeType', label: 'النوع', type: 'select', required: true, options: Object.entries(FEE_LABEL) }, { name: 'label', label: 'الوصف', placeholder: 'مثال: رحلة علمية' }, { name: 'amount', label: 'المبلغ لكل طالب', type: 'number', min: 1, required: true }, { name: 'dueDate', label: 'تاريخ الاستحقاق', type: 'date', required: true }],
    onSubmit: v => {
      let sts = activeStudents(); if (v.scope.startsWith('g:')) sts = sts.filter(s => s.gradeLevel === Number(v.scope.slice(2))); if (v.scope.startsWith('c:')) sts = sts.filter(s => s.classId === v.scope.slice(2));
      if (!sts.length) return 'لا يوجد طلاب في هذا النطاق.';
      const y = activeYear(); sts.forEach(s => Repo.create('fees', { studentId: s.id, academicYearId: y.id, feeType: v.feeType, label: v.label, amount: v.amount, discount: 0, dueDate: v.dueDate, status: 'unpaid' }, { audit: false }));
      Audit.log('create', 'fees', v.scope, null, { count: sts.length, ...v });
      Notify.send(sts.map(s => userOf('parent', s.parentId)), { type: 'payment', title: 'رسوم جديدة', message: `أُضيف بند ${FEE_LABEL[v.feeType]}${v.label ? ' — ' + v.label : ''} بقيمة ${fmtMoney(v.amount)}، يستحق في ${fmtDate(v.dueDate)}.`, link: 'payments' });
      toast.success(`أُنشئ البند لـ${fmtNum(sts.length)} طالبًا`); render();
    }
  });
}
function paymentsFamily(page, u) {
  const kids = Scope.students(u);
  page.append(pageHead('الرسوم والمدفوعات', u.role === 'parent' ? 'الرسوم المستحقة على أبنائك والإيصالات' : 'رسومك الدراسية'));
  kids.forEach(st => { const f = studentFinance(st.id); page.append(h('div', { class: 'stack', style: { gap: '12px' } }, kids.length > 1 ? h('h2', { style: { fontSize: '17px' } }, st.fullName) : null, h('div', { class: 'kpis' }, kpi({ label: 'المستحق', value: fmtMoney(f.net), ic: 'receipt' }), kpi({ label: 'المدفوع', value: fmtMoney(f.paid), ic: 'wallet', tone: 'ok' }), kpi({ label: 'المتبقي', value: fmtMoney(f.remaining), ic: 'clock', tone: f.remaining ? 'warn' : 'ok' }), kpi({ label: 'متأخر السداد', value: fmtMoney(f.overdue), ic: 'alert', tone: f.overdue ? 'bad' : 'ok', sub: f.overdue ? 'يرجى المراجعة مع محاسبة المدرسة' : 'لا متأخرات' })), financeDetail(st))); });
}

/* ---------- Expenses ---------- */
PAGE_RENDER.expenses = (page) => {
  const T = todayISO(); const mk = monthKey(T); const exps = Repo.all('expenses');
  const months = []; { let m = parseISO(T); m.setDate(1); for (let i = 0; i < 4; i++) { months.unshift(iso(m).slice(0, 7)); m.setMonth(m.getMonth() - 1); } }
  const rev = months.map(k => sum(Repo.all('payments').filter(p => p.paidAt.slice(0, 7) === k).map(p => p.amount)));
  const ex = months.map(k => sum(exps.filter(e => e.date.slice(0, 7) === k).map(e => e.amount)));
  const totalRev = sum(Repo.all('payments').map(p => p.amount)); const totalExp = sum(exps.map(e => e.amount));
  page.append(pageHead('المصروفات', 'مصروفات المدرسة التشغيلية ومقارنتها بالإيرادات', h('button', { class: 'btn primary', onclick: () => expenseForm() }, icon('plus', 16), 'إضافة مصروف')));
  page.append(h('div', { class: 'kpis' },
    kpi({ label: 'مصروفات هذا الشهر', value: fmtMoney(sum(exps.filter(e => e.date.slice(0, 7) === mk).map(e => e.amount))), ic: 'receipt', sub: monthLabel(mk) }),
    kpi({ label: 'إجمالي المصروفات', value: fmtMoney(totalExp), ic: 'down', tone: 'bad', sub: 'منذ بداية العام' }),
    kpi({ label: 'إجمالي الإيرادات', value: fmtMoney(totalRev), ic: 'up', tone: 'ok', sub: 'مدفوعات الرسوم' }),
    kpi({ label: 'صافي الدخل', value: fmtMoney(totalRev - totalExp), ic: 'wallet', tone: totalRev >= totalExp ? 'ok' : 'bad' })));
  const byCat = Object.keys(EXP_LABEL).map(k => ({ label: EXP_LABEL[k], value: sum(exps.filter(e => e.category === k).map(e => e.amount)), color: EXP_COLOR[k] })).filter(x => x.value);
  page.append(h('div', { class: 'grid g2' }, card('توزيع المصروفات', donut({ items: byCat, center: shortNum(totalExp), sub: Settings.get().currency, fmt: v => shortNum(v) })), card('الإيرادات مقابل المصروفات', barChart({ labels: months.map(k => monthLabel(k).split(' ')[0]), series: [{ name: 'الإيرادات', values: rev, color: 'var(--c2)' }, { name: 'المصروفات', values: ex, color: 'var(--c3)' }], tip: fmtMoney }), { sub: 'آخر 4 أشهر' })));
  page.append(card(null, DataTable({ id: 'exp', unit: 'مصروف', exportName: 'expenses', rows: () => Repo.all('expenses'), defaultSort: 1, defaultDir: -1,
    filters: [{ label: 'كل التصنيفات', options: Object.entries(EXP_LABEL), test: (e, v) => e.category === v }, { label: 'كل الأشهر', options: [...new Set(exps.map(e => monthKey(e.date)))].sort().reverse().map(k => [k, monthLabel(k)]), test: (e, v) => monthKey(e.date) === v }],
    columns: [
      { label: 'البند', key: 'title', render: e => h('div', {}, h('b', {}, e.title), e.vendor ? h('div', { class: 'muted small' }, e.vendor) : null) },
      { label: 'التاريخ', desc: true, sort: e => e.date, render: e => fmtDate(e.date), csv: e => e.date },
      { label: 'التصنيف', sort: e => e.category, render: e => h('span', { class: 'row', style: { gap: '6px' } }, h('i', { style: { width: '9px', height: '9px', borderRadius: '3px', background: EXP_COLOR[e.category], display: 'inline-block' } }), EXP_LABEL[e.category]), csv: e => EXP_LABEL[e.category] },
      { label: 'المبلغ', desc: true, sort: e => e.amount, render: e => h('b', { class: 'tabnum' }, fmtMoney(e.amount)), csv: e => e.amount },
      { label: '', sortable: false, cls: 'acts', csv: false, render: e => h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '2px' } }, h('button', { class: 'icon-btn sm', 'aria-label': 'تعديل', onclick: () => expenseForm(e) }, icon('edit', 16)), h('button', { class: 'icon-btn sm danger', 'aria-label': 'حذف', onclick: async () => { if (await confirmDialog({ title: 'حذف مصروف', message: `حذف «${e.title}» بقيمة ${fmtMoney(e.amount)}؟`, ok: 'حذف', danger: true })) { Repo.remove('expenses', e.id); render(); toast.success('تم الحذف', { undo: () => { Repo.restore('expenses', e.id); render(); } }); } } }, icon('trash', 16))) }
    ] })));
};
function expenseForm(e) {
  formModal({ title: e ? 'تعديل مصروف' : 'إضافة مصروف', values: e || { date: todayISO(), category: 'supplies' },
    fields: [{ name: 'title', label: 'البند', required: true, span: true }, { name: 'category', label: 'التصنيف', type: 'select', required: true, options: Object.entries(EXP_LABEL) }, { name: 'amount', label: 'المبلغ', type: 'number', min: 1, required: true }, { name: 'date', label: 'التاريخ', type: 'date', required: true, validate: v => v > todayISO() ? 'لا يمكن تسجيل مصروف بتاريخ مستقبلي' : null }, { name: 'vendor', label: 'الجهة / المورّد' }, { name: 'note', label: 'ملاحظة', type: 'textarea', span: true, rows: 2 }],
    onSubmit: v => { if (e) Repo.update('expenses', e.id, v); else Repo.create('expenses', { ...v, approvedBy: Auth.userId() }); toast.success('تم حفظ المصروف'); render(); } });
}

/* ---------- Notifications ---------- */
(function () {
  let keep = 'all';
  PAGE_RENDER.notifications = (page) => {
    const u = App.user; const canSend = u.role === 'admin' || u.role === 'teacher';
    const box = h('div'); const head = h('div');
    function draw() {
      const all = Notify.mine(u); const types = [...new Set(all.map(n => n.type))];
      let list = all; if (keep === 'unread') list = list.filter(n => !n.read); else if (keep !== 'all') list = list.filter(n => n.type === keep);
      head.replaceChildren(pageHead('الإشعارات', `${fmtNum(Notify.unread(u))} غير مقروء من ${fmtNum(all.length)}`, Notify.unread(u) ? h('button', { class: 'btn', onclick: () => { Notify.markAll(u); draw(); refreshTopbar(); } }, icon('ok', 16), 'تعليم الكل كمقروء') : null, canSend ? h('button', { class: 'btn primary', onclick: () => sendNotifForm(u) }, icon('send', 16), 'إرسال إشعار') : null), h('div', { style: { height: '12px' } }), seg([['all', 'الكل'], ['unread', 'غير مقروء'], ...types.map(t => [t, NOTIF_LABEL[t]])], keep, v => { keep = v; draw(); }));
      box.replaceChildren(card(null, list.length ? h('div', {}, list.slice(0, 100).map(n => notifRow(n))) : emptyState('لا توجد إشعارات هنا.', null, 'bell'), { flush: true }));
    }
    page.append(head, box); draw();
  };
})();
function sendNotifForm(u) {
  const cls = Scope.classes(u);
  const aud = u.role === 'admin' ? [['all', 'الجميع'], ['teachers', 'كل المدرسين'], ['parents', 'كل أولياء الأمور'], ['students', 'كل الطلاب'], ...cls.map(c => ['class:' + c.id, 'طلاب وأولياء أمور ' + c.name])] : cls.flatMap(c => [['class:' + c.id, 'طلاب وأولياء أمور ' + c.name], ['classp:' + c.id, 'أولياء أمور ' + c.name]]);
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
PAGE_RENDER.reports = (page) => {
  const u = App.user; let type = Store.ss.get('ass:report') || 'students_by_class'; const T = todayISO();
  let from = addDays(T, -29), to = T, cls = '', day = lastSchoolDayWithData();
  const out = h('div', { class: 'stack', style: { gap: '14px' } });
  const picker = h('div', { class: 'report-types' });
  const filters = h('div', { class: 'row' });
  function drawPicker() { picker.replaceChildren(...Object.entries(REPORTS).filter(([k, r]) => !r.admin || u.role === 'admin').map(([k, r]) => h('button', { class: k === type ? 'on' : '', onclick: () => { type = k; Store.ss.set('ass:report', k); drawPicker(); run(); } }, h('span', { class: 'small muted' }, r.g), h('b', {}, r.t), h('span', {}, r.d)))); }
  function run() {
    const classes = Scope.classes(u);
    filters.replaceChildren(
      ['att_daily'].includes(type) ? h('label', { class: 'row small' }, 'اليوم', h('input', { type: 'date', class: 'input sm', value: day, onchange: e => { day = e.target.value; run(); } })) : null,
      ['att_top', 'att_monthly', 'fin_period'].includes(type) ? [h('label', { class: 'row small' }, 'من', h('input', { type: 'date', class: 'input sm', value: from, onchange: e => { from = e.target.value; run(); } })), h('label', { class: 'row small' }, 'إلى', h('input', { type: 'date', class: 'input sm', value: to, onchange: e => { to = e.target.value; run(); } }))] : null,
      ['contacts', 'att_top', 'top', 'failing', 'fin_outstanding', 'risk', 'att_monthly'].includes(type) ? selectEl([['', 'كل الفصول'], ...classes.map(c => [c.id, c.name])], cls, v => { cls = v; run(); }, { 'aria-label': 'الفصل' }) : null);
    const pool = (cls ? classStudents(cls) : Scope.students(u).filter(s => s.status === 'active'));
    const R = buildReport(type, { u, pool, classes, from, to, day });
    const tbl = DataTable({ id: 'rep-' + type, unit: 'صف', exportName: 'report-' + type, rows: R.rows, columns: R.columns, pageSize: 15, search: R.rows.length > 8, cards: false });
    const reportNode = () => h('div', { style: { padding: '12px', background: '#fff', color: '#000', fontFamily: 'var(--f-body)' } }, h('h2', { style: { textAlign: 'center' } }, Settings.get().schoolName), h('h3', { style: { textAlign: 'center', margin: '4px 0 10px' } }, R.title), h('div', { style: { textAlign: 'center', fontSize: '12px', marginBottom: '10px' } }, 'تاريخ التقرير: ' + fmtDate(T)), (() => { const t = h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' } }, h('thead', {}, h('tr', {}, R.columns.filter(c => c.csv !== false).map(c => h('th', { style: { border: '1px solid #ccc', padding: '4px' } }, c.label)))), h('tbody', {}, R.rows.map(r => h('tr', {}, R.columns.filter(c => c.csv !== false).map(c => h('td', { style: { border: '1px solid #ccc', padding: '4px' } }, String(c.csv ? c.csv(r) : c.text ? c.text(r) : c.sort ? c.sort(r) : r[c.key] ?? ''))))))); return t; })());
    out.replaceChildren(card(R.title, h('div', { class: 'stack', style: { gap: '14px' } }, R.note ? h('div', { class: 'muted small' }, R.note) : null, R.top || null, R.chart || null, tbl), { actions: [printBtn(reportNode, 'report-' + type)] }));
  }
  page.append(pageHead('التقارير', 'اختر تقريرًا، حدد الفترة أو الفصل، ثم صدّره CSV أو اطبعه'), card(null, picker), filters, out);
  drawPicker(); run();
};
function buildReport(type, { u, pool, classes, from, to, day }) {
  const T = todayISO(); const R = { title: REPORTS[type].t, rows: [], columns: [] };
  const sCol = { label: 'الطالب', sort: x => x.s.fullName, render: x => studentLink(x.s), csv: x => x.s.fullName };
  const cCol = { label: 'الفصل', sort: x => nameOf.cls(x.s.classId), render: x => nameOf.cls(x.s.classId) };
  if (type === 'students_by_class') {
    R.rows = classes.map(c => { const sts = classStudents(c.id); return { c, n: sts.length, m: sts.filter(s => s.gender === 'male').length, f: sts.filter(s => s.gender === 'female').length, att: attStats(Repo.all('attendance').filter(r => r.classId === c.id && r.date >= addDays(T, -29))).rate, avg: avg(sts.map(s => studentResults(s).avg).filter(v => v != null)) }; });
    R.columns = [{ label: 'الفصل', sort: x => x.c.name, render: x => x.c.name }, { label: 'الصف', sort: x => x.c.gradeLevel, render: x => gradeName(x.c.gradeLevel) }, { label: 'الطلاب', key: 'n' }, { label: 'ذكور', key: 'm' }, { label: 'إناث', key: 'f' }, { label: 'الحضور 30 يومًا', sort: x => x.att, render: x => pctCell(x.att), csv: x => fmtNum(x.att, 1) }, { label: 'متوسط الدرجات', sort: x => x.avg, render: x => fmtPct(x.avg, 1), csv: x => fmtNum(x.avg, 1) }];
    R.chart = barChart({ labels: R.rows.map(x => x.c.name.replace(' - ', ' ')), series: [{ name: 'ذكور', values: R.rows.map(x => x.m), color: 'var(--c1)' }, { name: 'إناث', values: R.rows.map(x => x.f), color: 'var(--c3)' }], fmt: v => fmtNum(v), height: 200 });
  } else if (type === 'contacts') {
    R.rows = pool.map(s => ({ s, p: Repo.get('parents', s.parentId) || {} }));
    R.columns = [sCol, cCol, { label: 'الرقم', sort: x => x.s.studentNo, render: x => h('span', { class: 'ltr' }, x.s.studentNo) }, { label: 'ولي الأمر', sort: x => x.p.fullName, render: x => x.p.fullName || '—' }, { label: 'الهاتف', sort: x => x.p.phone, render: x => h('span', { class: 'ltr' }, x.p.phone || '—') }, { label: 'العنوان', sort: x => x.s.address, render: x => x.s.address || '—' }];
  } else if (type === 'att_daily') {
    R.title += ' — ' + DAYS[dow(day)] + ' ' + fmtDate(day);
    const recs = Idx().attByDate.get(day) || [];
    R.rows = classes.map(c => ({ c, a: attStats(recs.filter(r => r.classId === c.id)), n: classStudents(c.id).length }));
    R.columns = [{ label: 'الفصل', sort: x => x.c.name, render: x => x.c.name }, { label: 'الحالة', sort: x => x.a.total, render: x => x.a.total ? badge('مسجّل', 'ok') : badge('لم يُسجَّل', 'bad'), csv: x => x.a.total ? 'مسجل' : 'لم يسجل' }, { label: 'نسبة الحضور', sort: x => x.a.rate, render: x => pctCell(x.a.rate), csv: x => fmtNum(x.a.rate, 1) }, { label: 'حاضر', sort: x => x.a.present, render: x => fmtNum(x.a.present) }, { label: 'غائب', sort: x => x.a.absent, render: x => fmtNum(x.a.absent) }, { label: 'متأخر', sort: x => x.a.late, render: x => fmtNum(x.a.late) }, { label: 'بعذر', sort: x => x.a.excused, render: x => fmtNum(x.a.excused) }];
    R.top = h('div', { class: 'row' }, badge(`نسبة الحضور العامة ${fmtPct(attStats(recs).rate, 1)}`, 'info', true), badge(`الغائبون ${fmtNum(attStats(recs).absent)}`, 'bad', true));
  } else if (type === 'att_top') {
    R.rows = pool.map(s => ({ s, a: studentAtt(s.id, from, to) })).filter(x => x.a.absent + x.a.late).sort((a, b) => b.a.absent - a.a.absent || b.a.late - a.a.late);
    R.columns = [sCol, cCol, { label: 'غياب', desc: true, sort: x => x.a.absent, render: x => h('b', { style: { color: 'var(--red)' } }, fmtNum(x.a.absent)), csv: x => x.a.absent }, { label: 'تأخر', sort: x => x.a.late, render: x => fmtNum(x.a.late), csv: x => x.a.late }, { label: 'بعذر', sort: x => x.a.excused, render: x => fmtNum(x.a.excused), csv: x => x.a.excused }, { label: 'نسبة الحضور', sort: x => x.a.rate, render: x => pctCell(x.a.rate), csv: x => fmtNum(x.a.rate, 1) }];
    R.note = `الفترة من ${fmtDate(from)} إلى ${fmtDate(to)}.`;
  } else if (type === 'att_monthly') {
    const ids = new Set(pool.map(s => s.id)); const ds = recordedDates().filter(d => d >= from && d <= to);
    R.rows = ds.map(d => ({ d, a: attStats((Idx().attByDate.get(d) || []).filter(r => ids.has(r.studentId))) }));
    R.columns = [{ label: 'اليوم', sort: x => x.d, render: x => DAYS[dow(x.d)] + ' ' + fmtDate(x.d), csv: x => x.d }, { label: 'نسبة الحضور', sort: x => x.a.rate, render: x => pctCell(x.a.rate), csv: x => fmtNum(x.a.rate, 1) }, { label: 'غائب', sort: x => x.a.absent, render: x => fmtNum(x.a.absent) }, { label: 'متأخر', sort: x => x.a.late, render: x => fmtNum(x.a.late) }, { label: 'بعذر', sort: x => x.a.excused, render: x => fmtNum(x.a.excused) }];
    R.chart = lineChart({ labels: R.rows.map(x => fmtDateShort(x.d)), series: [{ name: 'الحضور', values: R.rows.map(x => x.a.rate), color: 'var(--c2)' }], min: 70, max: 100, fmt: v => fmtNum(v) + '%', tip: v => fmtPct(v, 1), height: 200 });
  } else if (type === 'grades_matrix') {
    const subs = Repo.all('subjects').filter(s => u.role === 'admin' || Scope.assignments(u).some(a => a.subjectId === s.id));
    R.rows = classes.map(c => ({ c, v: Object.fromEntries(subs.map(s => [s.id, avg(classStudents(c.id).map(st => subjectResult(st, s.id).percent).filter(x => x != null))])) }));
    R.columns = [{ label: 'الفصل', sort: x => x.c.name, render: x => x.c.name }, ...subs.map(s => ({ label: s.name, sort: x => x.v[s.id], render: x => x.v[s.id] == null ? '—' : h('span', { class: 'badge plain ' + gradeTone(x.v[s.id]) }, fmtNum(x.v[s.id], 0)), csv: x => fmtNum(x.v[s.id], 1) }))];
    R.note = 'الألوان: أخضر ≥ 80، أزرق ≥ 60، برتقالي ≥ 50، أحمر < 50.';
  } else if (type === 'top') {
    const by = groupBy(pool, s => s.classId);
    R.rows = [...by.entries()].flatMap(([cid, sts]) => { const rk = classRanking(cid); return sts.map(s => ({ s, a: studentResults(s).avg, r: rk.get(s.id) })).filter(x => x.r && x.r <= 3); }).sort((a, b) => nameOf.cls(a.s.classId).localeCompare(nameOf.cls(b.s.classId), 'ar') || a.r - b.r);
    R.columns = [cCol, { label: 'الترتيب', sort: x => x.r, render: x => h('b', {}, fmtNum(x.r)), csv: x => x.r }, sCol, { label: 'المعدل', sort: x => x.a, render: x => fmtPct(x.a, 1), csv: x => fmtNum(x.a, 1) }, { label: 'التقدير', sortable: false, render: x => badge(gradeLabel(x.a), gradeTone(x.a), true), csv: x => gradeLabel(x.a) }];
  } else if (type === 'failing') {
    R.rows = pool.map(s => ({ s, r: studentResults(s) })).filter(x => x.r.failing).sort((a, b) => b.r.failing - a.r.failing);
    R.columns = [sCol, cCol, { label: 'عدد المواد', desc: true, sort: x => x.r.failing, render: x => h('b', { style: { color: 'var(--red)' } }, fmtNum(x.r.failing)), csv: x => x.r.failing }, { label: 'المواد', sortable: false, render: x => x.r.rows.filter(r => r.percent < passOf(r.subject)).map(r => `${r.subject.name} (${fmtNum(r.percent, 0)})`).join('، '), csv: x => x.r.rows.filter(r => r.percent < passOf(r.subject)).map(r => r.subject.name).join(' | ') }, { label: 'المعدل', sort: x => x.r.avg, render: x => fmtPct(x.r.avg, 1), csv: x => fmtNum(x.r.avg, 1) }];
  } else if (type === 'fin_outstanding') {
    R.rows = pool.map(s => ({ s, f: studentFinance(s.id) })).filter(x => x.f.remaining > 0).sort((a, b) => b.f.overdue - a.f.overdue || b.f.remaining - a.f.remaining);
    R.columns = [sCol, cCol, { label: 'المتبقي', desc: true, sort: x => x.f.remaining, render: x => fmtMoney(x.f.remaining), csv: x => x.f.remaining }, { label: 'متأخر', desc: true, sort: x => x.f.overdue, render: x => h('b', { style: { color: x.f.overdue ? 'var(--red)' : null } }, fmtMoney(x.f.overdue)), csv: x => x.f.overdue }, { label: 'الحالة', sort: x => x.f.status, render: x => badge(PAY_STATUS[x.f.status][0], PAY_STATUS[x.f.status][1]), csv: x => PAY_STATUS[x.f.status][0] }, { label: 'هاتف ولي الأمر', sortable: false, render: x => h('span', { class: 'ltr' }, (Repo.get('parents', x.s.parentId) || {}).phone || '—'), csv: x => (Repo.get('parents', x.s.parentId) || {}).phone || '' }];
    R.top = h('div', { class: 'row' }, badge('إجمالي المتبقي ' + fmtMoney(sum(R.rows.map(x => x.f.remaining))), 'warn', true), badge('المتأخر ' + fmtMoney(sum(R.rows.map(x => x.f.overdue))), 'bad', true));
  } else if (type === 'fin_period') {
    const rs = receipts().filter(r => r.paidAt.slice(0, 10) >= from && r.paidAt.slice(0, 10) <= to);
    R.rows = rs; R.note = `الفترة من ${fmtDate(from)} إلى ${fmtDate(to)} · ${fmtNum(rs.length)} إيصال · الإجمالي ${fmtMoney(sum(rs.map(r => r.amount)))}`;
    R.columns = [{ label: 'رقم الإيصال', sort: r => r.receiptNo, render: r => h('span', { class: 'ltr' }, r.receiptNo) }, { label: 'التاريخ', sort: r => r.paidAt, render: r => fmtDateTime(r.paidAt), csv: r => r.paidAt.slice(0, 10) }, { label: 'الطالب', sort: r => nameOf.st(r.studentId), render: r => nameOf.st(r.studentId) }, { label: 'المبلغ', sort: r => r.amount, render: r => fmtMoney(r.amount), csv: r => r.amount }, { label: 'الطريقة', sort: r => r.method, render: r => METHOD_LABEL[r.method] }];
    const byDay = groupBy(rs, r => r.paidAt.slice(0, 10)); const ds = [...byDay.keys()].sort();
    if (ds.length) R.chart = barChart({ labels: ds.map(fmtDateShort), series: [{ name: 'المقبوض', values: ds.map(d => sum(byDay.get(d).map(r => r.amount))), color: 'var(--c2)' }], tip: fmtMoney, height: 200 });
  } else if (type === 'risk') {
    R.rows = atRisk(pool, 'medium').map(x => ({ s: x.st, r: x.r }));
    R.columns = [sCol, cCol, { label: 'الدرجة', desc: true, sort: x => x.r.score, render: x => gauge0(x.r), csv: x => x.r.score }, { label: 'المستوى', sort: x => x.r.score, render: x => badge(RISK_LABEL[x.r.level][0], RISK_LABEL[x.r.level][1]), csv: x => RISK_LABEL[x.r.level][0] }, { label: 'الأسباب', sortable: false, render: x => x.r.factors.map(f => f.text).join('؛ '), csv: x => x.r.factors.map(f => f.text).join(' | ') }, { label: 'التوصية', sortable: false, render: x => h('span', { class: 'small' }, x.r.rec), csv: x => x.r.rec }];
    R.note = 'درجة الخطر من 100: الغياب بلا عذر 35% · التحصيل 30% · اتجاه الدرجات 20% · المواد الراسبة 10% · التأخر 5%.';
  } else if (type === 'monthly_summary') {
    const sts = pool; const a = attStats(Repo.all('attendance').filter(r => r.date >= addDays(T, -29) && sts.some(s => s.id === r.studentId)));
    const ins = insights(u);
    R.rows = ins; R.columns = [{ label: 'الأهمية', sort: x => SEV_ORDER[x.sev], render: x => badge({ bad: 'عالية', warn: 'متوسطة', info: 'معلومة', ok: 'إيجابية' }[x.sev], x.sev), csv: x => x.sev }, { label: 'الملاحظة', sort: x => x.title, render: x => h('b', {}, x.title), csv: x => x.title }, { label: 'التفاصيل', sortable: false, render: x => x.text, csv: x => x.text }];
    R.top = h('div', { class: 'kpis' }, kpi({ label: 'الطلاب', value: fmtNum(sts.length), ic: 'users' }), kpi({ label: 'الحضور 30 يومًا', value: fmtPct(a.rate, 1), ic: 'check', tone: a.rate >= 92 ? 'ok' : 'warn' }), kpi({ label: 'المعدل العام', value: fmtPct(avg(sts.map(s => studentResults(s).avg).filter(v => v != null)), 1), ic: 'award' }), kpi({ label: 'في خطر مرتفع', value: fmtNum(atRisk(sts, 'high').length), ic: 'alert', tone: 'bad' }));
  }
  return R;
}

/* ---------- AI Assistant ---------- */
PAGE_RENDER.assistant = (page) => {
  const u = App.user;
  const log = h('div', { class: 'chat-log', 'aria-live': 'polite' });
  const inp = h('input', { class: 'input', id: 'ask-in', placeholder: 'اكتب سؤالك بالعربية... مثال: كم طالب غائب اليوم؟', autocomplete: 'off' });
  function bot(res) {
    const m = h('div', { class: 'msg bot' }, h('div', { class: 'bub' }, res.text));
    if (res.bars && res.bars.length) m.append(card(null, hbars(res.bars, { max: 100 })));
    if (res.table && res.table.rows.length) m.append(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, res.table.head.map(x => h('th', {}, x)))), h('tbody', {}, res.table.rows.map(r => h('tr', {}, r.map(c => h('td', {}, c))))))));
    if (res.list && res.list.length) m.append(h('div', { class: 'row' }, res.list.slice(0, 12).map(x => h('a', { class: 'chip', href: '#' + x.route }, x.label + (x.sub ? ' · ' + x.sub : '')))));
    if (res.sug) m.append(h('div', { class: 'sugs' }, res.sug.map(q => h('button', { onclick: () => send(q) }, q))));
    if (res.src) m.append(h('div', { class: 'src' }, res.src));
    log.append(m); log.scrollTop = log.scrollHeight;
  }
  function send(q) {
    q = (q ?? inp.value).trim(); if (!q) return; inp.value = '';
    log.append(h('div', { class: 'msg me' }, h('div', { class: 'bub' }, q)));
    const think = h('div', { class: 'msg bot' }, h('div', { class: 'bub muted' }, 'جارٍ التحليل...')); log.append(think); log.scrollTop = log.scrollHeight;
    setTimeout(() => { think.remove(); try { bot(Assistant.ask(q, u)); } catch (e) { console.error(e); bot({ text: 'حدث خطأ أثناء تحليل السؤال: ' + e.message }); } }, 220);
  }
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  const ins = insights(u).slice(0, 4);
  page.append(pageHead('المساعد الذكي', 'يجيب من بيانات النظام الفعلية ضمن صلاحياتك، ويعمل على هذا الجهاز دون إرسال البيانات لأي جهة خارجية.'),
    h('div', { class: 'grid g-main' },
      h('section', { class: 'card chat' }, log, h('div', { class: 'chat-in' }, inp, h('button', { class: 'btn primary', onclick: () => send(), 'aria-label': 'إرسال' }, icon('send', 16), 'اسأل'))),
      h('div', { class: 'stack', style: { gap: '16px' } }, card('أسئلة مقترحة', h('div', { class: 'sugs' }, (Assistant.SUGGEST[u.role] || []).map(q => h('button', { onclick: () => send(q) }, q)))), ins.length ? card('رؤى اليوم', h('div', {}, ins.map(i => h('div', { class: 'insight ' + i.sev }, h('div', { class: 'ic' }, icon(i.ic, 16)), h('div', {}, h('b', {}, i.title), h('p', {}, i.text)))))) : null, card('كيف يعمل؟', h('p', { class: 'small muted' }, 'يفهم المساعد الأسئلة العربية بالكلمات المفتاحية بعد توحيد الهمزات والتاء المربوطة، ويستخرج الفصل والمادة والفترة واسم الطالب، ثم يحسب الإجابة مباشرة من السجلات. في المرحلة القادمة يمكن ربطه بنموذج لغوي عبر خادم آمن دون تغيير هذه الواجهة.')))));
  bot({ text: `أهلًا ${displayName(u)}. اسألني عن الحضور أو الدرجات أو الرسوم أو الطلاب الذين يحتاجون متابعة.`, sug: (Assistant.SUGGEST[u.role] || []).slice(0, 4) });
  const pre = Store.ss.get('ass:ask'); if (pre) { Store.ss.del('ass:ask'); send(pre); }
  setTimeout(() => inp.focus(), 50);
};

/* ---------- Users ---------- */
PAGE_RENDER.users = (page) => {
  const me = App.user;
  page.append(pageHead('المستخدمون والصلاحيات', 'الحسابات وأدوارها. الصلاحيات تُحدَّد حسب الدور وتُفحص في كل عملية.', h('button', { class: 'btn primary', onclick: () => adminUserForm() }, icon('plus', 16), 'حساب إداري جديد')));
  page.append(tabs([
    { key: 'list', label: 'الحسابات', render: () => card(null, DataTable({ id: 'users', unit: 'حساب', exportName: 'users', rows: () => Repo.all('users'), searchText: x => x.username + ' ' + displayName(x) + ' ' + (x.email || ''),
      filters: [{ label: 'كل الأدوار', options: Object.entries(ROLE_LABEL), test: (x, v) => x.role === v }, { label: 'كل الحالات', options: [['active', 'فعّال'], ['inactive', 'معطّل'], ['locked', 'مقفل']], test: (x, v) => v === 'active' ? x.isActive : v === 'inactive' ? !x.isActive : x.lockedUntil && new Date(x.lockedUntil) > new Date() }],
      columns: [
        { label: 'المستخدم', sort: x => displayName(x), render: x => person(displayName(x), x.username), csv: x => displayName(x) },
        { label: 'اسم الدخول', key: 'username', render: x => h('span', { class: 'ltr' }, x.username) },
        { label: 'الدور', sort: x => x.role, render: x => badge(ROLE_LABEL[x.role], { admin: 'violet', teacher: 'info', student: '', parent: 'ok' }[x.role], true), csv: x => ROLE_LABEL[x.role] },
        { label: 'آخر دخول', desc: true, sort: x => x.lastLogin || '', render: x => x.lastLogin ? relTime(x.lastLogin) : h('span', { class: 'muted' }, 'لم يدخل بعد'), csv: x => x.lastLogin || '' },
        { label: 'الحالة', sort: x => x.isActive, render: x => x.lockedUntil && new Date(x.lockedUntil) > new Date() ? badge('مقفل مؤقتًا', 'bad') : x.isActive ? badge('فعّال', 'ok') : badge('معطّل', ''), csv: x => x.isActive ? 'فعال' : 'معطل' },
        { label: '', sortable: false, cls: 'acts', csv: false, render: x => h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '4px' } },
          x.lockedUntil && new Date(x.lockedUntil) > new Date() ? h('button', { class: 'btn ghost xs', onclick: () => { Repo.update('users', x.id, { lockedUntil: null, failedAttempts: 0 }); toast.success('تم فك القفل'); render(); } }, icon('unlock', 14), 'فك القفل') : null,
          h('button', { class: 'btn ghost xs', onclick: () => resetPassword(x) }, icon('key', 14), 'كلمة المرور'),
          x.id !== me.id ? h('button', { class: 'btn ghost xs', onclick: () => { Repo.update('users', x.id, { isActive: !x.isActive }); toast.success(x.isActive ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب'); render(); } }, x.isActive ? 'تعطيل' : 'تفعيل') : null) }
      ] })) },
    { key: 'matrix', label: 'مصفوفة الصلاحيات', render: () => {
      const rows = Object.entries(PAGES).filter(([k, p]) => !p.hidden).map(([k, p]) => h('tr', {}, h('td', {}, h('span', { class: 'row', style: { gap: '8px' } }, icon(p.ic, 16), p.t)), ALL_ROLES.map(r => h('td', { class: 'c' }, p.roles.includes(r) ? h('span', { style: { color: 'var(--green)' }, 'aria-label': 'مسموح' }, icon('ok', 18)) : h('span', { class: 'muted', 'aria-label': 'غير مسموح' }, '—')))));
      const table = h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, 'الصفحة'), ALL_ROLES.map(r => h('th', { class: 'c' }, ROLE_LABEL[r])))), h('tbody', {}, rows)));
      const note = h('p', { class: 'muted small', style: { marginTop: '10px' } }, 'إضافة لذلك: المدرس يرى فقط طلاب وفصول ومواد الإسناد الخاص به، وولي الأمر يرى أبناءه فقط، والطالب يرى بياناته فقط. يمكن للمدرس تعديل الحضور لليوم و' + fmtNum(Settings.get().teacherEditDays) + ' أيام سابقة، ولا يعدّل الدرجات المقفلة بعد إصدار الشهادات.');
      return card('ما يستطيع كل دور الوصول إليه', [table, note]);
    } }
  ], 'list'));
};
function resetPassword(x) {
  formModal({ title: 'تعيين كلمة مرور — ' + displayName(x), size: 'sm', submit: 'حفظ', values: { pw: genPassword(), must: true },
    intro: h('p', { class: 'muted small' }, 'اقترحنا كلمة مرور عشوائية قوية. سلّمها للمستخدم، وسيُطلب منه تغييرها عند الدخول.'),
    fields: [{ name: 'pw', label: 'كلمة المرور الجديدة', required: true, ltr: true, validate: passwordRule }, { name: 'must', label: 'إلزام المستخدم بتغييرها عند الدخول التالي', type: 'checkbox' }],
    onSubmit: async v => { try { const pw = await Accounts.resetPassword(x.id, v.pw, !!v.must); credsModal('كلمة المرور الجديدة', [[displayName(x), x.username, pw]]); render(); } catch (e) { return e.message; } } });
}
function adminUserForm() {
  formModal({ title: 'حساب إداري جديد', size: 'sm', submit: 'إنشاء',
    fields: [{ name: 'username', label: 'اسم الدخول', required: true, ltr: true, validate: v => /^[a-z0-9._-]{3,30}$/i.test(v) ? (Repo.raw('users').some(u => u.username.toLowerCase() === v.toLowerCase()) ? 'اسم الدخول مستخدم' : null) : 'حروف لاتينية وأرقام فقط (3–30)' }, { name: 'email', label: 'البريد الإلكتروني', type: 'email', ltr: true }, { name: 'pw', label: 'كلمة مرور مؤقتة', required: true, ltr: true, default: genPassword(), validate: passwordRule }],
    onSubmit: async v => { try { await Accounts.createAdmin(v.username, v.email, v.pw); toast.success('تم إنشاء الحساب ' + v.username); render(); } catch (e) { return e.message; } } });
}

/* ---------- Audit log ---------- */
PAGE_RENDER.audit = (page) => {
  page.append(pageHead('سجل النشاط', 'كل عملية إنشاء أو تعديل أو حذف أو دخول، مع القيم قبل وبعد'));
  page.append(card(null, DataTable({ id: 'audit', unit: 'عملية', exportName: 'audit-log', rows: () => Repo.all('auditLog').slice().reverse(), pageSize: 20, cards: true,
    searchText: a => nameOf.user(a.userId) + ' ' + (ENTITY_LABEL[a.entity] || a.entity) + ' ' + (ACTION_LABEL[a.action] || a.action),
    filters: [{ label: 'كل العمليات', options: Object.entries(ACTION_LABEL), test: (a, v) => a.action === v }, { label: 'كل الأقسام', options: Object.entries(ENTITY_LABEL), test: (a, v) => a.entity === v }],
    columns: [
      { label: 'الوقت', desc: true, sort: a => a.at, render: a => h('div', {}, h('div', {}, relTime(a.at)), h('div', { class: 'muted small' }, fmtDateTime(a.at))), csv: a => a.at },
      { label: 'المستخدم', sort: a => nameOf.user(a.userId), render: a => nameOf.user(a.userId) },
      { label: 'العملية', sort: a => a.action, render: a => badge(ACTION_LABEL[a.action] || a.action, { create: 'ok', update: 'info', delete: 'bad', login: '', logout: '', lock: 'bad' }[a.action] || '', true), csv: a => ACTION_LABEL[a.action] || a.action },
      { label: 'القسم', sort: a => a.entity, render: a => ENTITY_LABEL[a.entity] || a.entity },
      { label: 'العنصر', sortable: false, render: a => { const o = a.after || a.before || {}; return o.fullName || o.name || o.title || o.receiptNo || o.certNo || o.username || (a.entity === 'attendance' && o.date ? nameOf.cls(o.classId) + ' · ' + fmtDate(o.date) : '—'); } },
      { label: '', sortable: false, cls: 'acts', csv: false, render: a => (a.before || a.after) ? h('button', { class: 'btn ghost xs', onclick: () => openModal({ title: (ACTION_LABEL[a.action] || a.action) + ' · ' + (ENTITY_LABEL[a.entity] || a.entity), size: 'lg', body: h('div', { class: 'diff' }, h('div', {}, h('div', { class: 'small muted mb' }, 'قبل'), h('pre', {}, a.before ? JSON.stringify(a.before, null, 2) : '—')), h('div', {}, h('div', { class: 'small muted mb' }, 'بعد'), h('pre', {}, a.after ? JSON.stringify(a.after, null, 2) : '—'))) }) }, 'التفاصيل') : null }
    ] })));
};

/* ---------- Profile ---------- */
PAGE_RENDER.profile = (page) => {
  const u = App.user; const map = { teacher: 'teachers', student: 'students', parent: 'parents' };
  const p = u.role === 'admin' ? null : Repo.get(map[u.role], u.linkedId);
  page.append(pageHead('ملفي الشخصي', ROLE_LABEL[u.role]));
  if (u.mustChangePassword) page.append(banner('يُرجى تغيير كلمة المرور المؤقتة الآن لحماية حسابك.', 'warn', 'lock'));
  const pwForm = h('form', { class: 'stack', style: { gap: '12px', maxWidth: '420px' }, novalidate: true });
  const f = (id, label) => h('div', { class: 'field' }, h('label', { for: id }, label), h('input', { class: 'input', id, type: 'password', dir: 'ltr', autocomplete: id === 'pw-old' ? 'current-password' : 'new-password' }));
  const msg = h('div', { class: 'form-err', role: 'alert' });
  pwForm.append(f('pw-old', 'كلمة المرور الحالية'), f('pw-new', 'كلمة المرور الجديدة'), f('pw-new2', 'تأكيد كلمة المرور الجديدة'), h('div', { class: 'hint small muted' }, '8 أحرف على الأقل، وتحتوي حرفًا ورقمًا.'), msg, h('div', {}, h('button', { class: 'btn primary', type: 'submit' }, 'تغيير كلمة المرور')));
  pwForm.addEventListener('submit', async e => { e.preventDefault(); msg.textContent = ''; const o = $('#pw-old').value, n = $('#pw-new').value, n2 = $('#pw-new2').value; if (n !== n2) { msg.textContent = 'كلمتا المرور غير متطابقتين.'; return; } const err = await Auth.changePassword(o, n); if (err) { msg.textContent = err; return; } toast.success('تم تغيير كلمة المرور'); pwForm.reset(); App.user = Auth.current(); render(); });
  const prefs = u.prefs || {};
  page.append(h('div', { class: 'grid g2' },
    card('بياناتي', h('div', { class: 'stack', style: { gap: '14px' } }, person(displayName(u), ROLE_LABEL[u.role]), kv([['اسم الدخول', h('span', { class: 'ltr' }, u.username)], ['البريد الإلكتروني', u.email || (p && p.email) || '—'], ['الهاتف', p && p.phone ? h('span', { class: 'ltr' }, p.phone) : '—'], ['آخر دخول', u.lastLogin ? fmtDateTime(u.lastLogin) : '—'], u.role === 'teacher' && p ? ['التخصص', p.specialization] : null, u.role === 'parent' ? ['الأبناء', Scope.students(u).map(s => s.fullName).join('، ')] : null, u.role === 'student' && p ? ['الفصل', nameOf.cls(p.classId)] : null].filter(Boolean)))),
    card('تغيير كلمة المرور', pwForm),
    card('المظهر والتنبيهات', h('div', { class: 'stack', style: { gap: '14px' } },
      h('div', { class: 'row between' }, h('span', {}, 'المظهر'), seg([['light', 'فاتح'], ['dark', 'داكن'], ['system', 'حسب الجهاز']], themePref(), v => { Store.set('ass:theme', v); applyTheme(v); render(); })),
      h('label', { class: 'check' }, (() => { const c = h('input', { type: 'checkbox', id: 'pref-email' }); c.checked = prefs.digest !== false; c.addEventListener('change', () => { Repo.update('users', u.id, { prefs: { ...prefs, digest: c.checked } }, { audit: false }); toast.success('تم حفظ التفضيل'); }); return c; })(), 'إظهار الإشعارات العادية (الإشعارات العاجلة تظهر دائمًا)'),
      isServer() ? h('div', { class: 'stack', style: { gap: '6px' } }, h('div', { class: 'row between' }, h('span', { class: 'small' }, 'نسخة العمل دون اتصال على هذا الجهاز: ', h('b', {}, Vault.active ? 'مفعّلة ومشفّرة' : 'غير مفعّلة')), Vault.active ? h('button', { class: 'btn sm', onclick: async () => { if (!(await confirmDialog({ title: 'حذف النسخة من هذا الجهاز', message: 'ستُحذف النسخة المشفّرة من هذا الجهاز ويُسجَّل خروجك. التعديلات غير المرسلة ستُفقد إن لم يكن هناك اتصال.', ok: 'حذف وتسجيل الخروج', danger: true }))) return; await Sync.flush(); await Vault.wipe(); Auth.logout('حُذفت النسخة المحلية من هذا الجهاز.'); } }, 'حذف من هذا الجهاز') : null), h('div', { class: 'muted small' }, Vault.supported() ? 'تُفتح النسخة بكلمة مرورك فقط، ولا يمكن قراءتها بدونها.' : 'يتطلب اتصالًا آمنًا HTTPS أو localhost.')) : null,
      TOP && 'Notification' in window ? h('div', { class: 'row between' }, h('span', { class: 'small' }, 'إشعارات المتصفح للتنبيهات العاجلة: ', h('b', {}, { granted: 'مفعّلة', denied: 'مرفوضة من المتصفح', default: 'غير مفعّلة' }[Notification.permission])), Notification.permission === 'default' ? h('button', { class: 'btn sm', onclick: async () => { try { await Notification.requestPermission(); } catch (e) { } render(); } }, 'تفعيل') : null) : h('div', { class: 'small muted' }, 'إشعارات المتصفح متاحة عند فتح التطبيق مباشرة في المتصفح.')))));
};

/* ---------- Settings ---------- */
PAGE_RENDER.settings = (page) => {
  const S = Settings.get();
  const formOf = (fields, onSave) => {
    const form = h('form', { class: 'form-grid', novalidate: true }); const inputs = {};
    fields.forEach(f => { if (f.section) { form.append(h('div', { class: 'form-sec span2' }, f.section)); return; } const id = 's-' + f.name; const inp = f.type === 'select' ? h('select', { class: 'select', id }, f.options.map(([v, l]) => h('option', { value: v }, l))) : h('input', { class: 'input', id, type: f.type || 'text', min: f.min, max: f.max, dir: f.ltr ? 'ltr' : null }); inp.value = f.value ?? ''; inputs[f.name] = inp; form.append(h('div', { class: 'field' + (f.span ? ' span2' : '') }, h('label', { for: id }, f.label), inp, f.hint ? h('div', { class: 'hint' }, f.hint) : null)); });
    const err = h('div', { class: 'form-err' });
    form.append(err, h('div', { class: 'span2' }, h('button', { class: 'btn primary', type: 'submit' }, 'حفظ التغييرات')));
    form.addEventListener('submit', e => { e.preventDefault(); err.textContent = ''; const v = {}; for (const f of fields) { if (f.section) continue; let x = inputs[f.name].value.trim(); if (f.type === 'number') { x = Number(x); if (isNaN(x) || (f.min != null && x < f.min) || (f.max != null && x > f.max)) { err.textContent = `قيمة «${f.label}» خارج الحدود المسموحة.`; inputs[f.name].focus(); return; } } if (f.required && x === '') { err.textContent = `«${f.label}» مطلوب.`; inputs[f.name].focus(); return; } v[f.name] = x; } const r = onSave(v); if (typeof r === 'string') { err.textContent = r; return; } toast.success('تم حفظ الإعدادات'); render(); });
    return form;
  };
  page.append(pageHead('الإعدادات', 'إعدادات المدرسة وقواعد التقييم والتنبيهات والنسخ الاحتياطي'));
  page.append(tabs([
    { key: 'school', label: 'المدرسة', render: () => card(null, formOf([
      { name: 'schoolName', label: 'اسم المدرسة', value: S.schoolName, required: true }, { name: 'schoolNameEn', label: 'الاسم بالإنجليزية', value: S.schoolNameEn, ltr: true },
      { name: 'principalName', label: 'اسم المدير (يظهر على الشهادات)', value: S.principalName, required: true }, { name: 'address', label: 'العنوان', value: S.address },
      { name: 'phone', label: 'الهاتف', value: S.phone, ltr: true }, { name: 'email', label: 'البريد الإلكتروني', value: S.email, ltr: true },
      { section: 'العام الدراسي' }, { name: 'academicYear', label: 'العام الدراسي', value: S.academicYear, required: true, ltr: true }, { name: 'termName', label: 'الفصل الدراسي الحالي', value: S.termName, required: true },
      { name: 'currency', label: 'العملة', value: S.currency, required: true }
    ], v => { Settings.save(v); const y = activeYear(); if (y.id && y.name !== v.academicYear) Repo.update('academicYears', y.id, { name: v.academicYear }); shellUser = null; })) },
    { key: 'eval', label: 'التقييم والتنبيهات', render: () => card(null, formOf([
      { section: 'الأوزان الافتراضية لأنواع التقييم' }, ...Object.entries(S.weights).map(([k, v]) => ({ name: 'w_' + k, label: EXAM_LABEL[k], type: 'number', min: 0, max: 100, value: v })),
      { section: 'قواعد النجاح والتنبيهات الذكية' },
      { name: 'passPercent', label: 'نسبة النجاح الافتراضية %', type: 'number', min: 1, max: 99, value: S.passPercent },
      { name: 'attendanceAlert', label: 'عتبة تنبيه الغياب بلا عذر % (30 يومًا)', type: 'number', min: 1, max: 50, value: S.attendanceAlert },
      { name: 'gradeDrop', label: 'تنبيه انخفاض الدرجات (نقاط بين تقييمين)', type: 'number', min: 5, max: 50, value: S.gradeDrop },
      { name: 'teacherEditDays', label: 'أيام تعديل الحضور المسموحة للمدرس', type: 'number', min: 0, max: 14, value: S.teacherEditDays },
      { name: 'collectionTarget', label: 'المستهدف من تحصيل الرسوم %', type: 'number', min: 10, max: 100, value: S.collectionTarget },
      { name: 'sessionTimeoutMin', label: 'إنهاء الجلسة بعد خمول (دقيقة)', type: 'number', min: 5, max: 240, value: S.sessionTimeoutMin }
    ], v => { const weights = {}; Object.keys(S.weights).forEach(k => { weights[k] = v['w_' + k]; delete v['w_' + k]; }); Settings.save({ ...v, weights }); })) },
    { key: 'periods', label: 'أوقات الحصص', render: () => { const ps = periodsSorted(); return card('أوقات الحصص اليومية', h('div', { class: 'stack' }, ps.map(p => h('div', { class: 'row' }, h('b', { style: { width: '70px' } }, 'الحصة ' + fmtNum(p.order)), h('input', { type: 'time', class: 'input sm', value: p.startTime, 'aria-label': 'بداية الحصة ' + p.order, onchange: e => Repo.update('periods', p.id, { startTime: e.target.value }) }), h('span', {}, '—'), h('input', { type: 'time', class: 'input sm', value: p.endTime, 'aria-label': 'نهاية الحصة ' + p.order, onchange: e => { Repo.update('periods', p.id, { endTime: e.target.value }); toast.success('تم الحفظ'); } }))), h('p', { class: 'muted small' }, 'أيام الدراسة: ' + Settings.get().schoolDays.map(d => DAYS[d]).join('، ') + '. تُحفظ التغييرات فورًا.'))); } },
    { key: 'backup', label: 'النسخ الاحتياطي والبيانات', render: () => backupTab() }
  ], 'school'));
};

/* ---------- Backup / restore / reset ---------- */
function backupTab() {
  const srv = isServer();
  const exportCard = card('تصدير نسخة احتياطية مشفّرة', h('div', { class: 'stack' },
    h('p', { class: 'muted' }, srv ? 'تُنشأ على الخادم نسخة كاملة مشفّرة AES-256 بكلمة سر تختارها الآن. احفظ الملف وكلمة السر في مكانين مختلفين؛ بدون كلمة السر لا يمكن فتح النسخة.' : 'في وضع العرض تُصدَّر البيانات الحالية كملف JSON.'),
    h('div', {}, h('button', { class: 'btn primary', onclick: () => srv ? exportEncrypted() : exportText(`abd-al-salam-demo-${todayISO()}.json`, JSON.stringify(Repo.exportAll()), 'application/json') }, icon('download', 16), 'تصدير النسخة')),
    srv ? h('div', { class: 'muted small' }, 'إضافة لذلك يحفظ الخادم نسخة تلقائية مشفّرة كل 24 ساعة في مجلد data/backups (آخر 14 نسخة).') : null));
  const fi = h('input', { type: 'file', accept: 'application/json,.json', id: 'restore-file', class: 'input' });
  const restoreCard = card('استعادة نسخة', h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'تستبدل الاستعادة كل البيانات الحالية. ' + (srv ? 'يحتفظ الخادم بنسخة من الوضع الحالي قبل الاستبدال.' : '')), fi));
  fi.addEventListener('change', () => { const f = fi.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => restoreFrom(String(r.result)); r.readAsText(f); fi.value = ''; });
  const resetCard = card('البيانات التجريبية', h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'إعادة إنشاء بيانات تجريبية جديدة (120 طالبًا، 6 فصول، 10 مدرسين، حضور ودرجات ورسوم). تُحذف كل البيانات الحالية ويُسجَّل خروج الجميع.'), h('div', {}, h('button', { class: 'btn danger', onclick: resetDemo }, icon('refresh', 16), 'إعادة ضبط البيانات التجريبية'))));
  const about = card('عن النظام', kv([['النظام', Settings.get().systemName], ['إصدار المخطط', SCHEMA_V], ['مكان الحفظ', srv ? 'خادم المدرسة: قاعدة SQLite مشفّرة AES-256-GCM لكل سجل، وكلمات المرور scrypt' : 'الذاكرة فقط (وضع العرض) — لا يُحفظ شيء'], ['على هذا الجهاز', srv ? (Vault.active ? 'نسخة مشفّرة للعمل دون اتصال (IndexedDB)' : 'لا شيء (العمل دون اتصال يتطلب HTTPS أو localhost)') : 'لا شيء'], ['السجلات المحمّلة', fmtNum(sum(ENTITIES.map(e => Repo.raw(e).length)))], ['البنية', 'HTML + CSS + JavaScript بدون أطر عمل · خادم Node.js بدون حزم خارجية']]));
  return h('div', { class: 'grid g2' }, exportCard, restoreCard, resetCard, about);
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
    try { Repo.importAll(json); toast.success('تمت الاستعادة'); shellUser = null; render(); } catch (e) { toast.error(e.message); } return;
  }
  if (json.format !== 'abd-al-salam-backup') { toast.error('هذا الملف ليس نسخة احتياطية مشفّرة من الخادم.'); return; }
  formModal({ title: 'استعادة نسخة احتياطية', size: 'sm', submit: 'استعادة', intro: banner(`ستُستبدل كل البيانات بنسخة ${fmtDateTime(json.createdAt)} ويُسجَّل خروج الجميع. يحتفظ الخادم بنسخة من الوضع الحالي.`, 'warn', 'alert'),
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
    await bootSeed(true); Auth.logout('أُعيد ضبط البيانات التجريبية.'); return;
  }
  formModal({ title: 'إعادة ضبط البيانات التجريبية', size: 'sm', submit: 'إعادة الضبط', intro: banner('ستُحذف كل بيانات المدرسة على الخادم وتُستبدل ببيانات تجريبية. يحتفظ الخادم بنسخة من الوضع الحالي في data/backups. سيبقى اسم دخولك وكلمة مرورك كما هي.', 'bad', 'alert'),
    fields: [{ name: 'pw', label: 'كلمة مرورك (للتأكيد)', type: 'password', required: true, ltr: true }],
    onSubmit: async (v, m) => {
      m.body.append(h('div', { class: 'muted small' }, 'جارٍ إنشاء البيانات التجريبية...'));
      const keepSettings = { ...Settings.get() };
      await seedDemo(); const ds = { settings: { ...Settings.get(), schoolName: keepSettings.schoolName, principalName: keepSettings.principalName }, data: Object.fromEntries(ENTITIES.map(e => [e, Repo.raw(e)])) };
      let r; try { r = await api('POST', 'api/reset', { password: v.pw, dataset: ds }); } catch (e) { r = { ok: false, error: 'لا يوجد اتصال بالخادم.' }; }
      if (!r.ok) { await Sync.pull(true).catch(() => { }); return r.error || 'تعذّرت إعادة الضبط'; }
      setTimeout(() => Auth.logout('أُعيد ضبط البيانات التجريبية. سجّل الدخول من جديد.'), 50);
    } });
}
