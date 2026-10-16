/* خريطة الصفحات: اسم المسار ← المكوّن (الصلاحيات في lib/permissions.js) */
import { Dashboard, Students, StudentPage, Teachers, Classes, Subjects } from './Academic.jsx';
import { Schedule, Attendance, Grades, Certificates } from './Evaluation.jsx';
import { Payments, Expenses } from './Finance.jsx';
import { Notifications, Reports, AssistantPage, Users, AuditPage, Profile, SettingsPage } from './Admin.jsx';
import { VerifyPage } from './Auth.jsx';

export const ROUTES = {
  dashboard: Dashboard, assistant: AssistantPage, students: Students, student: StudentPage, teachers: Teachers, classes: Classes, subjects: Subjects,
  schedule: Schedule, attendance: Attendance, grades: Grades, certificates: Certificates,
  payments: Payments, expenses: Expenses, notifications: Notifications, reports: Reports,
  users: Users, audit: AuditPage, settings: SettingsPage, profile: Profile, verify: VerifyPage
};
