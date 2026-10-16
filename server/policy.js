'use strict';
/* =====================================================================
   الصلاحيات على الخادم (المصدر الوحيد للحقيقة)
   - visible(): ما يُسمح لكل مستخدم بقراءته (المدير كل شيء، المدرس فصوله، الأسرة أبناؤها)
   - clean():   حذف الحقول الحساسة قبل الإرسال
   - checkWrite(): التحقق من كل عملية كتابة قبل قبولها
   ===================================================================== */
let cache = { seq: -1, ix: null };

function index(store) {
  if (cache.seq === store.seq && cache.ix) return cache.ix;
  const ix = { teacherClasses: new Map(), teaches: new Set(), studentClass: new Map(), parentStudents: new Map(), userByLinked: new Map(), assessment: new Map(), classStudents: new Map() };
  const add = (m, k, v) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };
  store.live('teachingAssignments').forEach(a => { add(ix.teacherClasses, a.teacherId, a.classId); ix.teaches.add(a.teacherId + '|' + a.classId + '|' + a.subjectId); });
  store.live('classes').forEach(c => { if (c.homeroomTeacherId) add(ix.teacherClasses, c.homeroomTeacherId, c.id); });
  store.live('students').forEach(s => { ix.studentClass.set(s.id, s.classId); add(ix.parentStudents, s.parentId, s.id); add(ix.classStudents, s.classId, s.id); });
  store.live('users').forEach(u => { if (u.linkedId) ix.userByLinked.set(u.role + '|' + u.linkedId, u.id); });
  for (const a of store.map('assessments').values()) ix.assessment.set(a.id, a);
  cache = { seq: store.seq, ix };
  return ix;
}

/** النطاق المرئي للمستخدم */
function scope(store, user) {
  if (user.role === 'admin') return null;
  const ix = index(store);
  const sc = { classIds: new Set(), studentIds: new Set(), parentIds: new Set(), userIds: new Set([user.id]) };
  if (user.role === 'teacher') {
    (ix.teacherClasses.get(user.linkedId) || new Set()).forEach(c => sc.classIds.add(c));
    for (const s of store.map('students').values()) if (sc.classIds.has(s.classId)) { sc.studentIds.add(s.id); sc.parentIds.add(s.parentId); }
    for (const u of store.map('users').values()) {
      if (u.role === 'admin' || u.role === 'teacher') sc.userIds.add(u.id);
      else if (u.role === 'student' && sc.studentIds.has(u.linkedId)) sc.userIds.add(u.id);
      else if (u.role === 'parent' && sc.parentIds.has(u.linkedId)) sc.userIds.add(u.id);
    }
  } else if (user.role === 'student') {
    const s = store.get('students', user.linkedId);
    if (s) { sc.studentIds.add(s.id); sc.classIds.add(s.classId); sc.parentIds.add(s.parentId); }
  } else if (user.role === 'parent') {
    sc.parentIds.add(user.linkedId);
    for (const s of store.map('students').values()) if (s.parentId === user.linkedId) { sc.studentIds.add(s.id); sc.classIds.add(s.classId); }
  }
  return sc;
}

function visible(store, user, sc, entity, r) {
  if (user.role === 'admin') return true;
  const fam = user.role === 'student' || user.role === 'parent';
  switch (entity) {
    case 'academicYears': case 'classes': case 'subjects': case 'periods': case 'teachers': return true;
    case 'teachingAssignments': case 'schedules': return !fam || sc.classIds.has(r.classId);
    case 'students': return sc.studentIds.has(r.id);
    case 'parents': return sc.parentIds.has(r.id);
    case 'attendance': case 'certificates': return sc.studentIds.has(r.studentId);
    case 'assessments': return sc.classIds.has(r.classId) && (!fam || !!r.isPublished);
    case 'grades': { if (!sc.studentIds.has(r.studentId)) return false; if (!fam) return true; const a = store.get('assessments', r.assessmentId); return !!(a && a.isPublished && !a.deletedAt); }
    case 'fees': case 'payments': return fam && sc.studentIds.has(r.studentId);
    case 'notifications': return r.userId === user.id;
    case 'users': return sc.userIds.has(r.id);
    default: return false; // expenses, auditLog
  }
}

function clean(user, entity, r) {
  const o = { ...r }; delete o._seq;
  if (entity === 'users') {
    delete o.passwordHash; delete o.salt; delete o._cacheKey;
    if (user.role !== 'admin' && o.id !== user.id) return { id: o.id, role: o.role, linkedId: o.linkedId, isActive: o.isActive, username: o.role === 'admin' ? o.username : '', deletedAt: o.deletedAt || null, createdAt: o.createdAt, updatedAt: o.updatedAt };
  }
  if (entity === 'teachers' && (user.role === 'student' || user.role === 'parent')) return { id: o.id, fullName: o.fullName, specialization: o.specialization, status: o.status, weeklyLoad: o.weeklyLoad, deletedAt: o.deletedAt || null, createdAt: o.createdAt, updatedAt: o.updatedAt };
  return o;
}

function snapshot(store, user, since = 0) {
  const sc = scope(store, user); const data = {};
  for (const e of store.entities) {
    const out = [];
    for (const r of store.map(e).values()) { if (since && r._seq <= since) continue; if (visible(store, user, sc, e, r)) out.push(clean(user, e, r)); }
    if (out.length || !since) data[e] = out;
  }
  return data;
}

/* ---------- write validation ---------- */
const SYSTEM_KEYS = new Set(['updatedAt', 'createdAt', 'createdBy', '_seq']);
function changedKeys(old, rec) { const keys = new Set([...Object.keys(old || {}), ...Object.keys(rec || {})]); return [...keys].filter(k => !SYSTEM_KEYS.has(k) && JSON.stringify(old ? old[k] : undefined) !== JSON.stringify(rec[k])); }
const onlyChanged = (old, rec, allowed) => changedKeys(old, rec).every(k => allowed.includes(k));
const isoDay = d => d.toISOString().slice(0, 10);
function localDay(offsetDays = 0) { const d = new Date(); d.setDate(d.getDate() + offsetDays); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
void isoDay;

function checkWrite(store, user, entity, rec, old, settings) {
  if (!store.entities.includes(entity)) return 'قسم غير معروف';
  if (!rec || typeof rec !== 'object' || Array.isArray(rec) || typeof rec.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(rec.id)) return 'سجل غير صالح';
  if (JSON.stringify(rec).length > 200000) return 'السجل كبير جدًا';
  if (entity === 'users') {
    if (!old) return 'إنشاء الحسابات يتم من صفحة المستخدمين فقط';
    if (user.role === 'admin') {
      if (!onlyChanged(old, rec, ['isActive', 'lockedUntil', 'failedAttempts', 'mustChangePassword', 'email', 'prefs', 'deletedAt', 'lastActivity'])) return 'لا يمكن تغيير الدور أو اسم الدخول أو الربط';
      if (old.id === user.id && (rec.isActive === false || rec.deletedAt)) return 'لا يمكنك تعطيل حسابك الحالي';
      return null;
    }
    return old.id === user.id && onlyChanged(old, rec, ['prefs', 'lastActivity']) ? null : 'غير مسموح';
  }
  if (user.role === 'admin') return null;
  const me = store.get('users', user.id);
  if (me && me.mustChangePassword) return 'غيّر كلمة المرور المؤقتة أولًا';
  if (entity === 'notifications') {
    if (!old) { if (user.role !== 'teacher') return 'غير مسموح'; const sc = scope(store, user); return sc.userIds.has(rec.userId) && !rec.read ? null : 'لا يمكنك إرسال إشعار لهذا المستخدم'; }
    return old.userId === user.id && onlyChanged(old, rec, ['read', 'readAt']) ? null : 'غير مسموح';
  }
  if (user.role !== 'teacher') return 'لا تملك صلاحية تعديل هذه البيانات';
  const ix = index(store);
  const myClasses = ix.teacherClasses.get(user.linkedId) || new Set();
  const teaches = (c, s) => ix.teaches.has(user.linkedId + '|' + c + '|' + s);
  if (entity === 'attendance') {
    if (rec.deletedAt) return 'لا يمكن حذف سجلات الحضور';
    if (!myClasses.has(rec.classId) || (old && !myClasses.has(old.classId))) return 'هذا الفصل خارج صلاحياتك';
    if (ix.studentClass.get(rec.studentId) !== rec.classId) return 'الطالب ليس في هذا الفصل';
    if (!['present', 'absent', 'late', 'excused'].includes(rec.status)) return 'حالة حضور غير صالحة';
    const days = Number(settings && settings.teacherEditDays != null ? settings.teacherEditDays : 3);
    const dates = [rec.date, old && old.date].filter(Boolean);
    if (dates.some(d => d > localDay(0) || d < localDay(-days))) return 'انتهت مهلة تعديل الحضور لهذا اليوم';
    return null;
  }
  if (entity === 'assessments') {
    if (!teaches(rec.classId, rec.subjectId) || (old && !teaches(old.classId, old.subjectId))) return 'هذه المادة غير مسندة إليك';
    if (rec.deletedAt) { for (const g of store.map('grades').values()) if (g.assessmentId === rec.id && g.isLocked && !g.deletedAt) return 'لا يمكن حذف تقييم بدرجات مقفلة'; }
    if (!(Number(rec.maxScore) > 0) || !(Number(rec.weight) >= 0)) return 'قيم التقييم غير صالحة';
    return null;
  }
  if (entity === 'grades') {
    const a = ix.assessment.get(rec.assessmentId);
    if (!a || a.deletedAt) return 'التقييم غير موجود';
    if (!teaches(a.classId, a.subjectId)) return 'هذه المادة غير مسندة إليك';
    if (old && old.assessmentId !== rec.assessmentId) return 'غير مسموح';
    if (old && old.isLocked) return 'الدرجة مقفلة بعد إصدار الشهادة';
    if (rec.isLocked) return 'قفل الدرجات من صلاحية الإدارة';
    if (ix.studentClass.get(rec.studentId) !== a.classId) return 'الطالب ليس في هذا الفصل';
    if (rec.score !== null && rec.score !== undefined && !(typeof rec.score === 'number' && rec.score >= 0 && rec.score <= Number(a.maxScore))) return 'الدرجة خارج الحدود';
    return null;
  }
  return 'لا تملك صلاحية تعديل هذه البيانات';
}

module.exports = { scope, visible, clean, snapshot, checkWrite, index };
