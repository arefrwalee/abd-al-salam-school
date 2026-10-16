/* =====================================================================
   المالية: الرسوم والمدفوعات والإيصالات، والمصروفات
   ===================================================================== */
import { useRef } from 'react';
import {
  Repo, Settings, Audit, Auth, Idx, Scope, isAdmin, byClass, Notify, activeYear, activeStudents, financeTotals, studentFinance, feeInfo, recordPayment, receipts, nameOf, userOf, useUser,
  FEE_LABEL, PAY_STATUS, METHOD_LABEL, EXP_LABEL, EXP_COLOR,
  fmtNum, fmtPct, fmtMoney, fmtDate, fmtDateTime, todayISO, addDays, sum, parseISO, iso, monthKey, monthLabel, gradeName,
  Icon, Badge, PageHead, Card, Kpi, Empty, Progress, Tabs, Banner, BarChart, Donut, HBars, shortNum,
  DataTable, openModal, ModalBody, ModalFoot, confirmDialog, formModal, PrintButton, toast, useData
} from './common.js';
import { StudentLink, FinanceDetail } from './Academic.jsx';

const lastMonths = (T, n = 4) => { const out = []; const m = parseISO(T); m.setDate(1); for (let i = 0; i < n; i++) { out.unshift(iso(m).slice(0, 7)); m.setMonth(m.getMonth() - 1); } return out; };

/* ---------- Payments ---------- */
export function Payments({ user: u }) {
  if (u.role !== 'admin') return <PaymentsFamily u={u} />;
  const ft = financeTotals(); const S = Settings.get();
  const byType = Object.keys(FEE_LABEL).map(k => { const infos = ft.infos.filter(i => i.fee.feeType === k); return { k, net: sum(infos.map(i => i.net)), paid: sum(infos.map(i => i.paid)) }; }).filter(x => x.net);
  const balances = Repo.where('students', s => (Idx().feesByStudent.get(s.id) || []).length).map(s => ({ id: s.id, s, f: studentFinance(s.id) }));
  const recs = receipts().map(r => ({ ...r, id: r.receiptNo }));
  return <>
    <PageHead title="الرسوم والمدفوعات" sub={`${S.termName} · العام الدراسي ${S.academicYear}`}>
      <button className="btn" onClick={() => bulkFeesForm()}><Icon name="plus" size={16} />إنشاء رسوم جماعية</button>
      <button className="btn primary" onClick={() => paymentForm()}><Icon name="wallet" size={16} />تسجيل دفعة</button>
    </PageHead>
    <div className="kpis">
      <Kpi label="إجمالي المستحق" value={fmtMoney(ft.net)} ic="receipt" sub="بعد الخصومات" />
      <Kpi label="المحصّل" value={fmtMoney(ft.paid)} ic="wallet" tone="ok" sub={`${fmtPct(ft.rate, 1)} · المستهدف ${fmtPct(S.collectionTarget)}`} extra={<Progress p={ft.rate} tone={ft.rate >= S.collectionTarget ? 'ok' : 'warn'} />} />
      <Kpi label="المتبقي" value={fmtMoney(ft.remaining)} ic="clock" tone="warn" />
      <Kpi label="متأخر السداد" value={fmtMoney(ft.overdue)} ic="alert" tone={ft.overdue ? 'bad' : 'ok'} sub={`${fmtNum(ft.overdueStudents)} طالبًا`} />
    </div>
    <Tabs initial="bal" items={[
      { key: 'bal', label: 'أرصدة الطلاب', render: () => <Card><DataTable id="bal" unit="طالب" exportName="balances" rows={balances} defaultSort={4} defaultDir={-1} searchText={x => x.s.fullName + ' ' + x.s.studentNo}
        filters={[{ label: 'كل الحالات', options: Object.entries(PAY_STATUS).map(([k, v]) => [k, v[0]]), test: (x, v) => x.f.status === v }, { label: 'كل الفصول', options: Repo.all('classes').sort(byClass).map(c => [c.id, c.name]), test: (x, v) => x.s.classId === v }]}
        columns={[
          { label: 'الطالب', sort: x => x.s.fullName, render: x => <StudentLink s={x.s} />, csv: x => x.s.fullName },
          { label: 'الفصل', sort: x => nameOf.cls(x.s.classId), render: x => nameOf.cls(x.s.classId) },
          { label: 'المستحق', sort: x => x.f.net, render: x => <span className="tabnum">{fmtMoney(x.f.net)}</span>, csv: x => x.f.net },
          { label: 'المدفوع', sort: x => x.f.paid, render: x => <span className="tabnum">{fmtMoney(x.f.paid)}</span>, csv: x => x.f.paid },
          { label: 'المتبقي', desc: true, sort: x => x.f.remaining, render: x => <b className="tabnum" style={{ color: x.f.overdue ? 'var(--red)' : undefined }}>{fmtMoney(x.f.remaining)}</b>, csv: x => x.f.remaining },
          { label: 'الحالة', sort: x => x.f.status, render: x => <Badge tone={PAY_STATUS[x.f.status][1]}>{PAY_STATUS[x.f.status][0]}</Badge>, csv: x => PAY_STATUS[x.f.status][0] },
          { label: '', sortable: false, cls: 'acts', csv: false, render: x => <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}><button className="btn ghost xs" onClick={() => studentFeesModal(x.s)}>التفاصيل</button>{x.f.remaining > 0 && <button className="btn soft xs" onClick={() => paymentForm(x.s)}>دفعة</button>}</div> }
        ]} /></Card> },
      { key: 'rec', label: 'الإيصالات', render: () => <Card><DataTable id="rec" unit="إيصال" exportName="receipts" rows={recs} searchText={r => r.receiptNo + ' ' + nameOf.st(r.studentId)}
        filters={[{ label: 'كل الطرق', options: Object.entries(METHOD_LABEL), test: (r, v) => r.method === v }]}
        columns={[
          { label: 'رقم الإيصال', sort: r => r.receiptNo, render: r => <span className="ltr">{r.receiptNo}</span> },
          { label: 'التاريخ', desc: true, sort: r => r.paidAt, render: r => fmtDateTime(r.paidAt), csv: r => r.paidAt.slice(0, 10) },
          { label: 'الطالب', sort: r => nameOf.st(r.studentId), render: r => nameOf.st(r.studentId) },
          { label: 'المبلغ', desc: true, sort: r => r.amount, render: r => <b className="tabnum">{fmtMoney(r.amount)}</b>, csv: r => r.amount },
          { label: 'الطريقة', sort: r => r.method, render: r => METHOD_LABEL[r.method] },
          { label: 'استلمها', sortable: false, render: r => r.receivedBy ? nameOf.user(r.receivedBy) : 'المحاسبة' },
          { label: '', sortable: false, cls: 'acts', csv: false, render: r => <button className="btn ghost xs" onClick={() => showReceipt(r.receiptNo)}>عرض</button> }
        ]} /></Card> },
      { key: 'sum', label: 'ملخص حسب البند', render: () => <div className="grid g2">
        <Card title="التحصيل حسب نوع الرسوم"><HBars rows={byType.map(x => ({ label: FEE_LABEL[x.k], value: x.paid / x.net * 100, color: x.paid / x.net >= .85 ? 'var(--c2)' : x.paid / x.net >= .6 ? 'var(--c4)' : 'var(--c3)' }))} max={100} /></Card>
        <Card title="المستحق والمحصّل"><BarChart labels={byType.map(x => FEE_LABEL[x.k].replace('رسوم ', '').replace('الرسوم ', ''))} series={[{ name: 'المستحق', values: byType.map(x => x.net), color: 'var(--c5)' }, { name: 'المحصّل', values: byType.map(x => x.paid), color: 'var(--c2)' }]} tip={fmtMoney} /></Card>
      </div> }
    ]} />
  </>;
}
function PayInfo({ id }) {
  const s = Repo.get('students', id); if (!s) return null; const f = studentFinance(id);
  return <Banner tone={f.overdue ? 'warn' : ''} ic="wallet">{`المتبقي على ${s.fullName}: `}<b>{fmtMoney(f.remaining)}</b>{f.overdue ? ` (منها ${fmtMoney(f.overdue)} متأخرة)` : ''}{'. يُوزَّع المبلغ على البنود الأقدم استحقاقًا أولًا: ' + f.fees.filter(x => x.remaining).map(x => `${FEE_LABEL[x.fee.feeType]}${x.fee.label ? ' — ' + x.fee.label : ''} (${fmtMoney(x.remaining)})`).join('، ')}</Banner>;
}
export function paymentForm(st) {
  const sts = Repo.where('students', s => studentFinance(s.id).remaining > 0).sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
  if (!sts.length) { toast.info('لا توجد مبالغ مستحقة على أي طالب.'); return; }
  const due = id => { const f = studentFinance(id); return f.overdue || f.remaining; };
  formModal({
    title: 'تسجيل دفعة', submit: 'تسجيل وإصدار الإيصال', values: { studentId: st ? st.id : '', method: 'cash', amount: st ? due(st.id) : '' },
    extra: v => <PayInfo id={v.studentId} />,
    onFieldChange: (name, v) => (name === 'studentId' ? { amount: v ? due(v) : '' } : null),
    fields: [
      { name: 'studentId', label: 'الطالب', type: 'select', required: true, span: true, placeholder: 'اختر الطالب', options: sts.map(s => [s.id, `${s.fullName} — ${nameOf.cls(s.classId)} (متبقٍ ${fmtMoney(studentFinance(s.id).remaining)})`]) },
      { name: 'amount', label: 'المبلغ (' + Settings.get().currency + ')', type: 'number', min: 1, required: true },
      { name: 'method', label: 'طريقة الدفع', type: 'select', required: true, options: Object.entries(METHOD_LABEL) },
      { name: 'note', label: 'ملاحظة', span: true }
    ],
    onSubmit: v => { const r = recordPayment(v.studentId, v.amount, v.method, v.note); if (r.error) return r.error; toast.success('تم تسجيل الدفعة · إيصال ' + r.receiptNo); setTimeout(() => showReceipt(r.receiptNo), 200); }
  });
}
function Receipt({ no }) {
  const ps = Repo.where('payments', p => p.receiptNo === no); if (!ps.length) return <div />;
  const st = Repo.get('students', ps[0].studentId) || {}; const S = Settings.get(); const fin = studentFinance(st.id);
  return <div className="receipt">
    <div className="row between"><div className="row" style={{ gap: 10 }}><div className="crest" style={{ boxShadow: 'inset 0 0 0 1px #d7dceb' }}><i /><i /><i /></div><div><b>{S.schoolName}</b><div style={{ fontSize: 12, color: '#5a6680' }}>{S.address + ' · ' + S.phone}</div></div></div>
      <div style={{ textAlign: 'left', fontSize: 12, color: '#5a6680' }}><div className="ltr" style={{ fontWeight: 700, color: '#14203a' }}>{no}</div>{fmtDateTime(ps[0].paidAt)}</div></div>
    <h4 style={{ margin: '16px 0 8px' }}>إيصال استلام</h4>
    <div style={{ fontSize: 13.5 }}>استلمنا من ولي أمر الطالب <b>{st.fullName}</b> ({nameOf.cls(st.classId)}) المبلغ المبيّن أدناه:</div>
    <table><tbody>{ps.map(p => { const f = Repo.get('fees', p.feeId) || {}; return <tr key={p.id}><td>{FEE_LABEL[f.feeType] + (f.label ? ' — ' + f.label : '')}</td><td style={{ textAlign: 'left' }}>{fmtMoney(p.amount)}</td></tr>; })}
      <tr><td className="tot">الإجمالي</td><td className="tot" style={{ textAlign: 'left' }}>{fmtMoney(sum(ps.map(p => p.amount)))}</td></tr></tbody></table>
    <div style={{ fontSize: 12.5, color: '#5a6680', marginTop: 10 }}>{`طريقة الدفع: ${METHOD_LABEL[ps[0].method]} · المتبقي على الطالب بعد هذه الدفعة: ${fmtMoney(fin.remaining)}`}</div>
    {ps[0].note && <div style={{ fontSize: 12.5, marginTop: 4 }}>{'ملاحظة: ' + ps[0].note}</div>}
    <div className="row between" style={{ marginTop: 26, fontSize: 12.5, color: '#5a6680' }}><span>{'المستلم: ' + (ps[0].receivedBy ? nameOf.user(ps[0].receivedBy) : 'المحاسبة')}</span><span>التوقيع ____________</span></div>
  </div>;
}
function ReceiptModal({ no, close }) {
  const ref = useRef(null);
  return <><ModalBody><div style={{ background: 'var(--sunken)', padding: 12, borderRadius: 12 }} ref={ref}><Receipt no={no} /></div></ModalBody>
    <ModalFoot><PrintButton target={() => ref.current && ref.current.firstChild} what="receipt" /><button className="btn ghost" onClick={close}>إغلاق</button></ModalFoot></>;
}
export function showReceipt(no) { openModal({ title: 'إيصال ' + no, size: 'md', render: ({ close }) => <ReceiptModal no={no} close={close} /> }); }

function studentFeesModal(st) { openModal({ title: 'رسوم ' + st.fullName, size: 'lg', render: ({ close }) => <StudentFees st={st} close={close} /> }); }
function StudentFees({ st, close }) {
  useData(); const u = useUser(); const admin = isAdmin(u); const fin = studentFinance(st.id);
  return <><ModalBody><div className="stack">
    <FinanceDetail st={st} />
    {admin && <div className="row"><button className="btn sm" onClick={() => { close(); feeForm(st); }}><Icon name="plus" size={15} />إضافة بند رسوم</button><div className="grow" />{fin.fees.some(f => !f.paid) && <span className="muted small">لتعديل بند أو منح خصم استخدم الأزرار:</span>}</div>}
    {admin && <div className="row">{fin.fees.map(f => <span className="chip" key={f.fee.id}>{FEE_LABEL[f.fee.feeType] + (f.fee.label ? ' — ' + f.fee.label : '')}<button className="x" title="تعديل" aria-label="تعديل البند" onClick={() => { close(); feeForm(st, f.fee); }}><Icon name="edit" size={13} /></button></span>)}</div>}
  </div></ModalBody>
    <ModalFoot>{fin.remaining > 0 && admin && <button className="btn primary" onClick={() => { close(); paymentForm(st); }}>تسجيل دفعة</button>}<button className="btn ghost" onClick={close}>إغلاق</button></ModalFoot></>;
}
function feeForm(st, fee) {
  formModal({
    title: (fee ? 'تعديل بند — ' : 'بند رسوم جديد — ') + st.fullName, values: fee || { feeType: 'other', dueDate: addDays(todayISO(), 30), discount: 0 },
    fields: [{ name: 'feeType', label: 'النوع', type: 'select', required: true, options: Object.entries(FEE_LABEL) }, { name: 'label', label: 'وصف إضافي', placeholder: 'مثال: القسط الثالث' }, { name: 'amount', label: 'المبلغ', type: 'number', min: 1, required: true }, { name: 'discount', label: 'الخصم', type: 'number', min: 0 }, { name: 'dueDate', label: 'تاريخ الاستحقاق', type: 'date', required: true }],
    onSubmit: v => {
      v.discount = Number(v.discount || 0); if (v.discount >= v.amount) return 'الخصم يجب أن يكون أقل من المبلغ.';
      if (fee) { const paid = feeInfo(fee).paid; if (v.amount - v.discount < paid) return `المدفوع على هذا البند (${fmtMoney(paid)}) أكبر من صافي المبلغ الجديد.`; Repo.update('fees', fee.id, v); }
      else Repo.create('fees', { ...v, studentId: st.id, academicYearId: activeYear().id, status: 'unpaid' });
      toast.success('تم حفظ بند الرسوم');
    }
  });
}
function bulkFeesForm() {
  formModal({
    title: 'إنشاء رسوم جماعية', submit: 'إنشاء', values: { scope: 'all', feeType: 'activities', dueDate: addDays(todayISO(), 30) }, intro: <Banner>يُنشأ بند رسوم لكل طالب نشط ضمن النطاق المحدد، ويُرسل إشعار لأولياء الأمور.</Banner>,
    fields: [{ name: 'scope', label: 'النطاق', type: 'select', required: true, span: true, options: [['all', 'كل الطلاب النشطين'], ...[...new Set(Repo.all('classes').map(c => c.gradeLevel))].sort((a, b) => a - b).map(g => ['g:' + g, gradeName(g)]), ...Repo.all('classes').sort(byClass).map(c => ['c:' + c.id, c.name])] }, { name: 'feeType', label: 'النوع', type: 'select', required: true, options: Object.entries(FEE_LABEL) }, { name: 'label', label: 'الوصف', placeholder: 'مثال: رحلة علمية' }, { name: 'amount', label: 'المبلغ لكل طالب', type: 'number', min: 1, required: true }, { name: 'dueDate', label: 'تاريخ الاستحقاق', type: 'date', required: true }],
    onSubmit: v => {
      let sts = activeStudents(); if (v.scope.startsWith('g:')) sts = sts.filter(s => s.gradeLevel === Number(v.scope.slice(2))); if (v.scope.startsWith('c:')) sts = sts.filter(s => s.classId === v.scope.slice(2));
      if (!sts.length) return 'لا يوجد طلاب في هذا النطاق.';
      const y = activeYear(); sts.forEach(s => Repo.create('fees', { studentId: s.id, academicYearId: y.id, feeType: v.feeType, label: v.label, amount: v.amount, discount: 0, dueDate: v.dueDate, status: 'unpaid' }, { audit: false }));
      Audit.log('create', 'fees', v.scope, null, { count: sts.length, ...v });
      Notify.send(sts.map(s => userOf('parent', s.parentId)), { type: 'payment', title: 'رسوم جديدة', message: `أُضيف بند ${FEE_LABEL[v.feeType]}${v.label ? ' — ' + v.label : ''} بقيمة ${fmtMoney(v.amount)}، يستحق في ${fmtDate(v.dueDate)}.`, link: 'payments' });
      toast.success(`أُنشئ البند لـ${fmtNum(sts.length)} طالبًا`);
    }
  });
}
function PaymentsFamily({ u }) {
  const kids = Scope.students(u);
  return <>
    <PageHead title="الرسوم والمدفوعات" sub={u.role === 'parent' ? 'الرسوم المستحقة على أبنائك والإيصالات' : 'رسومك الدراسية'} />
    {!kids.length && <Empty text="لا يوجد طالب مرتبط بالحساب." />}
    {kids.map(st => { const f = studentFinance(st.id); return <div className="stack" style={{ gap: 12 }} key={st.id}>
      {kids.length > 1 && <h2 style={{ fontSize: 17 }}>{st.fullName}</h2>}
      <div className="kpis">
        <Kpi label="المستحق" value={fmtMoney(f.net)} ic="receipt" />
        <Kpi label="المدفوع" value={fmtMoney(f.paid)} ic="wallet" tone="ok" />
        <Kpi label="المتبقي" value={fmtMoney(f.remaining)} ic="clock" tone={f.remaining ? 'warn' : 'ok'} />
        <Kpi label="متأخر السداد" value={fmtMoney(f.overdue)} ic="alert" tone={f.overdue ? 'bad' : 'ok'} sub={f.overdue ? 'يرجى المراجعة مع محاسبة المدرسة' : 'لا متأخرات'} />
      </div>
      <FinanceDetail st={st} />
    </div>; })}
  </>;
}

/* ---------- Expenses ---------- */
export function Expenses() {
  const T = todayISO(); const mk = monthKey(T); const exps = Repo.all('expenses'); const months = lastMonths(T);
  const pays = Repo.all('payments');
  const rev = months.map(k => sum(pays.filter(p => p.paidAt.slice(0, 7) === k).map(p => p.amount)));
  const ex = months.map(k => sum(exps.filter(e => e.date.slice(0, 7) === k).map(e => e.amount)));
  const totalRev = sum(pays.map(p => p.amount)); const totalExp = sum(exps.map(e => e.amount));
  const byCat = Object.keys(EXP_LABEL).map(k => ({ label: EXP_LABEL[k], value: sum(exps.filter(e => e.category === k).map(e => e.amount)), color: EXP_COLOR[k] })).filter(x => x.value);
  const del = async e => { if (await confirmDialog({ title: 'حذف مصروف', message: `حذف «${e.title}» بقيمة ${fmtMoney(e.amount)}؟`, ok: 'حذف', danger: true })) { Repo.remove('expenses', e.id); toast.success('تم الحذف', { undo: () => Repo.restore('expenses', e.id) }); } };
  return <>
    <PageHead title="المصروفات" sub="مصروفات المدرسة التشغيلية ومقارنتها بالإيرادات"><button className="btn primary" onClick={() => expenseForm()}><Icon name="plus" size={16} />إضافة مصروف</button></PageHead>
    <div className="kpis">
      <Kpi label="مصروفات هذا الشهر" value={fmtMoney(sum(exps.filter(e => e.date.slice(0, 7) === mk).map(e => e.amount)))} ic="receipt" sub={monthLabel(mk)} />
      <Kpi label="إجمالي المصروفات" value={fmtMoney(totalExp)} ic="down" tone="bad" sub="منذ بداية العام" />
      <Kpi label="إجمالي الإيرادات" value={fmtMoney(totalRev)} ic="up" tone="ok" sub="مدفوعات الرسوم" />
      <Kpi label="صافي الدخل" value={fmtMoney(totalRev - totalExp)} ic="wallet" tone={totalRev >= totalExp ? 'ok' : 'bad'} />
    </div>
    <div className="grid g2">
      <Card title="توزيع المصروفات">{byCat.length ? <Donut items={byCat} center={shortNum(totalExp)} sub={Settings.get().currency} fmt={v => shortNum(v)} /> : <Empty text="لا مصروفات بعد." />}</Card>
      <Card title="الإيرادات مقابل المصروفات" sub="آخر 4 أشهر"><BarChart labels={months.map(k => monthLabel(k).split(' ')[0])} series={[{ name: 'الإيرادات', values: rev, color: 'var(--c2)' }, { name: 'المصروفات', values: ex, color: 'var(--c3)' }]} tip={fmtMoney} /></Card>
    </div>
    <Card><DataTable id="exp" unit="مصروف" exportName="expenses" rows={exps} defaultSort={1} defaultDir={-1}
      filters={[{ label: 'كل التصنيفات', options: Object.entries(EXP_LABEL), test: (e, v) => e.category === v }, { label: 'كل الأشهر', options: [...new Set(exps.map(e => monthKey(e.date)))].sort().reverse().map(k => [k, monthLabel(k)]), test: (e, v) => monthKey(e.date) === v }]}
      columns={[
        { label: 'البند', key: 'title', render: e => <div><b>{e.title}</b>{e.vendor && <div className="muted small">{e.vendor}</div>}</div> },
        { label: 'التاريخ', desc: true, sort: e => e.date, render: e => fmtDate(e.date), csv: e => e.date },
        { label: 'التصنيف', sort: e => e.category, render: e => <span className="row" style={{ gap: 6 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: EXP_COLOR[e.category], display: 'inline-block' }} />{EXP_LABEL[e.category]}</span>, csv: e => EXP_LABEL[e.category] },
        { label: 'المبلغ', desc: true, sort: e => e.amount, render: e => <b className="tabnum">{fmtMoney(e.amount)}</b>, csv: e => e.amount },
        { label: '', sortable: false, cls: 'acts', csv: false, render: e => <div className="row" style={{ justifyContent: 'flex-end', gap: 2 }}><button className="icon-btn sm" aria-label="تعديل" onClick={() => expenseForm(e)}><Icon name="edit" size={16} /></button><button className="icon-btn sm danger" aria-label="حذف" onClick={() => del(e)}><Icon name="trash" size={16} /></button></div> }
      ]} /></Card>
  </>;
}
function expenseForm(e) {
  formModal({ title: e ? 'تعديل مصروف' : 'إضافة مصروف', values: e || { date: todayISO(), category: 'supplies' },
    fields: [{ name: 'title', label: 'البند', required: true, span: true }, { name: 'category', label: 'التصنيف', type: 'select', required: true, options: Object.entries(EXP_LABEL) }, { name: 'amount', label: 'المبلغ', type: 'number', min: 1, required: true }, { name: 'date', label: 'التاريخ', type: 'date', required: true, validate: v => v > todayISO() ? 'لا يمكن تسجيل مصروف بتاريخ مستقبلي' : null }, { name: 'vendor', label: 'الجهة / المورّد' }, { name: 'note', label: 'ملاحظة', type: 'textarea', span: true, rows: 2 }],
    onSubmit: v => { if (e) Repo.update('expenses', e.id, v); else Repo.create('expenses', { ...v, approvedBy: Auth.userId() }); toast.success('تم حفظ المصروف'); } });
}
