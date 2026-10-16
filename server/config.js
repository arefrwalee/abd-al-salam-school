'use strict';
/* إعدادات الخادم — يمكن تغيير أي قيمة عبر متغيرات البيئة */
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');

module.exports = {
  ROOT,
  PUBLIC_DIR: path.join(ROOT, 'public'),
  DATA_DIR: process.env.SCHOOL_DATA_DIR ? path.resolve(process.env.SCHOOL_DATA_DIR) : path.join(ROOT, 'data'),
  PORT: Number(process.env.PORT || 8080),
  HOST: process.env.HOST || '0.0.0.0',
  // HTTPS اختياري: مسار الشهادة والمفتاح (مثلًا من mkcert). مطلوب للتشفير دون اتصال عند الوصول عبر الشبكة المحلية.
  TLS_CERT: process.env.SCHOOL_TLS_CERT || '',
  TLS_KEY: process.env.SCHOOL_TLS_KEY || '',
  SESSION_HOURS: 12,            // مدة الجلسة العادية القصوى
  REMEMBER_DAYS: 30,            // مدة الجلسة مع «تذكرني»
  MAX_BODY: 25 * 1024 * 1024,   // أقصى حجم لطلب (للإعداد الأول والاستعادة)
  BACKUP_KEEP: 14,              // عدد النسخ الاحتياطية التلقائية المحفوظة
  BACKUP_EVERY_HOURS: 24,
  LOCK_ATTEMPTS: 5,
  LOCK_MINUTES: 15,
  ENTITIES: ['users', 'students', 'parents', 'teachers', 'academicYears', 'classes', 'subjects', 'teachingAssignments', 'periods', 'schedules', 'attendance', 'assessments', 'grades', 'certificates', 'fees', 'payments', 'expenses', 'notifications', 'auditLog'],
  DEMO_PW: { admin: 'Admin@123', teacher: 'Teacher@123', student: 'Student@123', parent: 'Parent@123' }
};
