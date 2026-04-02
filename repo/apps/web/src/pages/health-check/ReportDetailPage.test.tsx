import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReportDetailPage } from './ReportDetailPage';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@checc/shared/constants/roles';
import { HealthCheckStatus } from '@checc/shared/types/health-check.types';

vi.mock('@/api/health-check.api', () => ({
  healthCheckApi: {
    getById: vi.fn(),
    getVersions: vi.fn(),
    submitForReview: vi.fn(),
    sign: vi.fn(),
    update: vi.fn(),
    downloadPdf: vi.fn(),
  },
}));

import { healthCheckApi } from '@/api/health-check.api';

const mockReport = (status: string, version = 1) => ({
  id: 'hc-1', patientId: 'p-1', templateId: 't-1', orderId: null,
  status, currentVersion: version, complianceBreach: false,
  createdBy: 'staff-1', createdAt: '2026-03-15T10:00:00Z', updatedAt: '2026-03-15T10:00:00Z',
});

const mockVersion = (status: string, versionNumber = 1) => ({
  id: 'v-1', healthCheckId: 'hc-1', versionNumber, status,
  changeSummary: null, createdBy: 'staff-1', createdAt: '2026-03-15T10:00:00Z',
  resultItems: [
    { id: 'ri-1', testName: 'BP Systolic', testCode: 'BP_SYS', value: '130', unit: 'mmHg',
      referenceLow: 90, referenceHigh: 120, isAbnormal: true, flag: 'H', priorValue: null, priorDate: null },
  ],
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/reports/hc-1']}>
      <Routes>
        <Route path="/reports/:id" element={<ReportDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReportDetailPage — Backend Constraint UI Rendering', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders abnormal flag H for out-of-range value', async () => {
    useAuthStore.setState({
      user: { id: 'staff-1', username: 'staff', role: UserRole.STAFF, email: '', fullName: 'Staff', canApproveRefunds: false, isActive: true, createdAt: '' },
      isAuthenticated: true,
    });
    vi.mocked(healthCheckApi.getById).mockResolvedValue({ data: mockReport(HealthCheckStatus.DRAFT) } as any);
    vi.mocked(healthCheckApi.getVersions).mockResolvedValue({ data: [mockVersion(HealthCheckStatus.DRAFT)] } as any);

    renderPage();
    await waitFor(() => expect(screen.getByText('BP Systolic')).toBeVisible());
    // Abnormal flag H should be displayed
    expect(screen.getByText('H')).toBeVisible();
  });

  it('staff sees Submit for Review on DRAFT report', async () => {
    useAuthStore.setState({
      user: { id: 'staff-1', username: 'staff', role: UserRole.STAFF, email: '', fullName: 'Staff', canApproveRefunds: false, isActive: true, createdAt: '' },
      isAuthenticated: true,
    });
    vi.mocked(healthCheckApi.getById).mockResolvedValue({ data: mockReport(HealthCheckStatus.DRAFT) } as any);
    vi.mocked(healthCheckApi.getVersions).mockResolvedValue({ data: [mockVersion(HealthCheckStatus.DRAFT)] } as any);

    renderPage();
    await waitFor(() => expect(screen.getByText('Health Check Report')).toBeVisible());
    expect(screen.getByRole('button', { name: /Submit for Review/ })).toBeVisible();
  });

  it('reviewer sees sign form on AWAITING_REVIEW report', async () => {
    useAuthStore.setState({
      user: { id: 'rev-1', username: 'reviewer', role: UserRole.REVIEWER, email: '', fullName: 'Reviewer', canApproveRefunds: false, isActive: true, createdAt: '' },
      isAuthenticated: true,
    });
    vi.mocked(healthCheckApi.getById).mockResolvedValue({ data: mockReport(HealthCheckStatus.AWAITING_REVIEW) } as any);
    vi.mocked(healthCheckApi.getVersions).mockResolvedValue({ data: [mockVersion(HealthCheckStatus.AWAITING_REVIEW)] } as any);

    renderPage();
    await waitFor(() => expect(screen.getByText('Re-enter your credentials to sign this report.')).toBeVisible());
    expect(screen.getByLabelText('Username')).toBeVisible();
    expect(screen.getByLabelText('Password')).toBeVisible();
    expect(screen.getByRole('button', { name: /Sign Report/ })).toBeVisible();
  });

  it('signed report shows PDF download and version lock indicator', async () => {
    useAuthStore.setState({
      user: { id: 'staff-1', username: 'staff', role: UserRole.STAFF, email: '', fullName: 'Staff', canApproveRefunds: false, isActive: true, createdAt: '' },
      isAuthenticated: true,
    });
    vi.mocked(healthCheckApi.getById).mockResolvedValue({ data: mockReport(HealthCheckStatus.SIGNED) } as any);
    vi.mocked(healthCheckApi.getVersions).mockResolvedValue({ data: [mockVersion(HealthCheckStatus.SIGNED)] } as any);

    renderPage();
    await waitFor(() => expect(screen.getByText('Health Check Report')).toBeVisible());
    expect(screen.getByText('Reviewed')).toBeVisible(); // StatusBadge maps SIGNED -> "Reviewed"
    expect(screen.getByRole('button', { name: /Download PDF/ })).toBeVisible();
  });

  it('staff can edit signed report — creates new version (AMENDED)', async () => {
    useAuthStore.setState({
      user: { id: 'staff-1', username: 'staff', role: UserRole.STAFF, email: '', fullName: 'Staff', canApproveRefunds: false, isActive: true, createdAt: '' },
      isAuthenticated: true,
    });
    vi.mocked(healthCheckApi.getById).mockResolvedValue({ data: mockReport(HealthCheckStatus.SIGNED) } as any);
    vi.mocked(healthCheckApi.getVersions).mockResolvedValue({ data: [mockVersion(HealthCheckStatus.SIGNED)] } as any);

    renderPage();
    await waitFor(() => expect(screen.getByText('Health Check Report')).toBeVisible());
    // Edit button should be available for signed reports
    expect(screen.getByRole('button', { name: /Edit Report/ })).toBeVisible();
    // Click edit
    fireEvent.click(screen.getByRole('button', { name: /Edit Report/ }));
    // Should show version creation message
    await waitFor(() => expect(screen.getByText(/Creates Version 2/)).toBeVisible());
    expect(screen.getByText(/signed.*AMENDED/i)).toBeVisible();
  });

  it('SLA breach indicator shown on breached reports', async () => {
    useAuthStore.setState({
      user: { id: 'staff-1', username: 'staff', role: UserRole.STAFF, email: '', fullName: 'Staff', canApproveRefunds: false, isActive: true, createdAt: '' },
      isAuthenticated: true,
    });
    vi.mocked(healthCheckApi.getById).mockResolvedValue({ data: { ...mockReport(HealthCheckStatus.AWAITING_REVIEW), complianceBreach: true } } as any);
    vi.mocked(healthCheckApi.getVersions).mockResolvedValue({ data: [mockVersion(HealthCheckStatus.AWAITING_REVIEW)] } as any);

    renderPage();
    await waitFor(() => expect(screen.getByText('Health Check Report')).toBeVisible());
    expect(screen.getByText('SLA Breach')).toBeVisible();
  });
});
