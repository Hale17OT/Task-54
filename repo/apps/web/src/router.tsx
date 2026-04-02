import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RoleGate } from '@/components/layout/RoleGate';
import { LoginPage } from '@/pages/auth/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { EnrollmentListPage } from '@/pages/enrollment/EnrollmentListPage';
import { EnrollmentFormPage } from '@/pages/enrollment/EnrollmentFormPage';
import { EnrollmentDetailPage } from '@/pages/enrollment/EnrollmentDetailPage';
import { OrderHistoryPage } from '@/pages/order/OrderHistoryPage';
import { OrderDetailPage } from '@/pages/order/OrderDetailPage';
import { PaymentRecordPage } from '@/pages/payment/PaymentRecordPage';
import { PaymentHistoryPage } from '@/pages/payment/PaymentHistoryPage';
import { RefundPage } from '@/pages/payment/RefundPage';
import { ReportListPage } from '@/pages/health-check/ReportListPage';
import { ReportDetailPage } from '@/pages/health-check/ReportDetailPage';
import { ReportCreatePage } from '@/pages/health-check/ReportCreatePage';
import { NotificationCenterPage } from '@/pages/notification/NotificationCenterPage';
import { ArticleListPage } from '@/pages/content/ArticleListPage';
import { ArticleDetailPage } from '@/pages/content/ArticleDetailPage';
import { ArticleCreatePage } from '@/pages/content/ArticleCreatePage';
import { PricingRulesPage } from '@/pages/admin/PricingRulesPage';
import { RiskDashboardPage } from '@/pages/admin/RiskDashboardPage';
import { UserRole } from '@checc/shared/constants/roles';

// Role matrix per business domain
const patientAndAbove = [UserRole.PATIENT, UserRole.STAFF, UserRole.ADMIN];
const staffAndAdmin = [UserRole.STAFF, UserRole.ADMIN];
const allClinical = [UserRole.PATIENT, UserRole.STAFF, UserRole.ADMIN, UserRole.REVIEWER];

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },

      // Enrollments — Patient, Staff, Admin
      { path: 'enrollments', element: <RoleGate allowedRoles={patientAndAbove}><EnrollmentListPage /></RoleGate> },
      { path: 'enrollments/new', element: <RoleGate allowedRoles={[UserRole.PATIENT]}><EnrollmentFormPage /></RoleGate> },
      { path: 'enrollments/:id', element: <RoleGate allowedRoles={patientAndAbove}><EnrollmentDetailPage /></RoleGate> },
      { path: 'enrollments/:id/edit', element: <RoleGate allowedRoles={[UserRole.PATIENT]}><EnrollmentFormPage /></RoleGate> },

      // Orders — Patient, Staff, Admin
      { path: 'orders/history', element: <RoleGate allowedRoles={patientAndAbove}><OrderHistoryPage /></RoleGate> },
      { path: 'orders/:id', element: <RoleGate allowedRoles={patientAndAbove}><OrderDetailPage /></RoleGate> },

      // Payments — Staff/Admin only
      { path: 'payments/record', element: <RoleGate allowedRoles={staffAndAdmin}><PaymentRecordPage /></RoleGate> },
      { path: 'payments/history', element: <RoleGate allowedRoles={staffAndAdmin}><PaymentHistoryPage /></RoleGate> },
      { path: 'payments/refund', element: <RoleGate allowedRoles={staffAndAdmin}><RefundPage /></RoleGate> },

      // Health Checks — All clinical roles
      { path: 'reports', element: <RoleGate allowedRoles={allClinical}><ReportListPage /></RoleGate> },
      { path: 'reports/:id', element: <RoleGate allowedRoles={allClinical}><ReportDetailPage /></RoleGate> },
      { path: 'reports/new', element: <RoleGate allowedRoles={staffAndAdmin}><ReportCreatePage /></RoleGate> },

      // Notifications — All clinical roles
      { path: 'notifications', element: <RoleGate allowedRoles={allClinical}><NotificationCenterPage /></RoleGate> },

      // Content — Patient/Staff/Admin browse; Staff/Admin create
      { path: 'content', element: <RoleGate allowedRoles={patientAndAbove}><ArticleListPage /></RoleGate> },
      { path: 'content/new', element: <RoleGate allowedRoles={[UserRole.ADMIN]}><ArticleCreatePage /></RoleGate> },
      { path: 'content/:slug', element: <RoleGate allowedRoles={patientAndAbove}><ArticleDetailPage /></RoleGate> },

      // Admin — Admin only
      { path: 'admin/pricing', element: <RoleGate allowedRoles={[UserRole.ADMIN]}><PricingRulesPage /></RoleGate> },
      { path: 'admin/risk', element: <RoleGate allowedRoles={[UserRole.ADMIN]}><RiskDashboardPage /></RoleGate> },
    ],
  },
]);
