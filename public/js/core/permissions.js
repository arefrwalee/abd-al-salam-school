/* الصلاحيات في الواجهة: لإخفاء ما لا يملكه الدور. التحقق الفعلي يتم على الخادم (server/policy.js) */
/* ---------- Permissions (RBAC) ---------- */
const ALL_ROLES = ['admin', 'teacher', 'student', 'parent'];
const PAGES = {
  dashboard: { t: 'الرئيسية', ic: 'home', roles: ALL_ROLES, g: 'main' },
  assistant: { t: 'المساعد الذكي', ic: 'sparkles', roles: ALL_ROLES, g: 'main' },
  students: { t: 'الطلاب', ic: 'users', roles: ['admin', 'teacher'], g: 'acad' },
  teachers: { t: 'المدرسون', ic: 'briefcase', roles: ['admin'], g: 'acad' },
  classes: { t: 'الفصول', ic: 'layers', roles: ['admin', 'teacher'], g: 'acad' },
  subjects: { t: 'المواد', ic: 'book', roles: ['admin', 'teacher'], g: 'acad' },
  schedule: { t: 'الجدول الدراسي', ic: 'calendar', roles: ALL_ROLES, g: 'acad' },
  attendance: { t: 'الحضور والغياب', ic: 'check', roles: ALL_ROLES, g: 'eval' },
  grades: { t: 'الدرجات', ic: 'pen', roles: ALL_ROLES, g: 'eval' },
  certificates: { t: 'الشهادات', ic: 'award', roles: ALL_ROLES, g: 'eval' },
  payments: { t: 'الرسوم والمدفوعات', ic: 'wallet', roles: ['admin', 'student', 'parent'], g: 'fin' },
  expenses: { t: 'المصروفات', ic: 'receipt', roles: ['admin'], g: 'fin' },
  notifications: { t: 'الإشعارات', ic: 'bell', roles: ALL_ROLES, g: 'comm' },
  reports: { t: 'التقارير', ic: 'chart', roles: ['admin', 'teacher'], g: 'comm' },
  users: { t: 'المستخدمون والصلاحيات', ic: 'shield', roles: ['admin'], g: 'sys' },
  audit: { t: 'سجل النشاط', ic: 'clock', roles: ['admin'], g: 'sys' },
  settings: { t: 'الإعدادات', ic: 'sliders', roles: ['admin'], g: 'sys' },
  profile: { t: 'ملفي الشخصي', ic: 'user', roles: ALL_ROLES, hidden: true },
  student: { t: 'ملف الطالب', ic: 'user', roles: ALL_ROLES, hidden: true },
  verify: { t: 'التحقق من شهادة', ic: 'qr', roles: ALL_ROLES, hidden: true }
};
const NAV_GROUPS = [['main', 'عام'], ['acad', 'الشؤون الأكاديمية'], ['eval', 'التقييم والمتابعة'], ['fin', 'المالية'], ['comm', 'التواصل والتقارير'], ['sys', 'إدارة النظام']];
const canSee = (u, p) => !!(u && PAGES[p] && PAGES[p].roles.includes(u.role));
const isAdmin = u => u && u.role === 'admin';
const Scope = {
  assignments(u) { return u.role === 'teacher' ? Repo.where('teachingAssignments', a => a.teacherId === u.linkedId) : Repo.all('teachingAssignments'); },
  classIds(u) {
    if (u.role === 'admin') return Repo.all('classes').map(c => c.id);
    if (u.role === 'teacher') { const s = new Set(this.assignments(u).map(a => a.classId)); Repo.where('classes', c => c.homeroomTeacherId === u.linkedId).forEach(c => s.add(c.id)); return [...s]; }
    return [...new Set(this.students(u).map(s => s.classId))];
  },
  classes(u) { const ids = new Set(this.classIds(u)); return Repo.where('classes', c => ids.has(c.id)).sort(byClass); },
  students(u) {
    if (!u) return [];
    if (u.role === 'admin') return Repo.all('students');
    if (u.role === 'teacher') { const ids = new Set(this.classIds(u)); return Repo.where('students', s => ids.has(s.classId)); }
    if (u.role === 'student') return Repo.where('students', s => s.id === u.linkedId);
    if (u.role === 'parent') return Repo.where('students', s => s.parentId === u.linkedId);
    return [];
  },
  canStudent(u, id) { return this.students(u).some(s => s.id === id); },
  teaches(u, classId, subjectId) { return u.role === 'admin' || this.assignments(u).some(a => a.classId === classId && a.subjectId === subjectId); },
  subjectsFor(u, classId) {
    if (u.role === 'admin') { const ids = new Set(Repo.where('teachingAssignments', a => a.classId === classId).map(a => a.subjectId)); const subs = Repo.all('subjects'); return ids.size ? subs.filter(s => ids.has(s.id)) : subs; }
    const ids = new Set(this.assignments(u).filter(a => a.classId === classId).map(a => a.subjectId));
    return Repo.all('subjects').filter(s => ids.has(s.id));
  }
};
const byClass = (a, b) => (a.gradeLevel - b.gradeLevel) || String(a.section).localeCompare(String(b.section), 'ar');
