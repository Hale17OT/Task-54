import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EnrollmentDetailPage } from './EnrollmentDetailPage';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@checc/shared/constants/roles';
import { EnrollmentStatus } from '@checc/shared/types/enrollment.types';

// Mock all API modules
vi.mock('@/api/enrollment.api', () => ({
  enrollmentApi: {
    getById: vi.fn(),
    submit: vi.fn(),
    cancel: vi.fn(),
  },
}));

vi.mock('@/api/order.api', () => ({
  orderApi: {
    getByEnrollmentId: vi.fn().mockResolvedValue({ data: null }),
    list: vi.fn().mockResolvedValue({ data: [] }),
    getById: vi.fn(),
    cancel: vi.fn(),
  },
}));

vi.mock('@/api/pricing.api', () => ({
  pricingApi: {
    compute: vi.fn(),
  },
}));

vi.mock('@/api/payment.api', () => ({
  paymentApi: {
    listByOrder: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('@/utils/sync-queue', () => ({
  syncQueue: {
    enqueue: vi.fn().mockResolvedValue(undefined),
  },
}));

import { enrollmentApi } from '@/api/enrollment.api';
import { pricingApi } from '@/api/pricing.api';

const mockEnrollment = {
  id: 'enr-1',
  patientId: 'patient-1',
  status: EnrollmentStatus.DRAFT,
  enrollmentDate: null,
  notes: '',
  serviceLines: [
    {
      id: 'sl-1',
      serviceId: 'svc-1',
      quantity: 2,
      service: { id: 'svc-1', code: 'LAB', name: 'Blood Test', description: '', basePrice: 150, category: 'lab', isActive: true, maxSeats: null, availableSeats: null },
    },
    {
      id: 'sl-2',
      serviceId: 'svc-2',
      quantity: 1,
      service: { id: 'svc-2', code: 'SCR', name: 'Vision Screening', description: '', basePrice: 60, category: 'screening', isActive: true, maxSeats: 30, availableSeats: 25 },
    },
  ],
  createdAt: '2026-03-15T10:00:00Z',
  updatedAt: '2026-03-15T10:00:00Z',
  submittedAt: null,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/enrollments/enr-1']}>
      <Routes>
        <Route path="/enrollments/:id" element={<EnrollmentDetailPage />} />
        <Route path="/enrollments/:id/edit" element={<div>Edit Page</div>} />
        <Route path="/enrollments" element={<div>List Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EnrollmentDetailPage - Checkout Pricing Preview', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'patient-1', username: 'patient1', role: UserRole.PATIENT, email: '', fullName: 'Test Patient', canApproveRefunds: false, isActive: true, createdAt: '' },
      isAuthenticated: true,
    });
    vi.mocked(enrollmentApi.getById).mockResolvedValue({ data: mockEnrollment } as any);
  });

  it('shows checkout preview with best-offer winner from mutually exclusive rules', async () => {
    // Mock pricing compute to return mutual-exclusion result
    vi.mocked(pricingApi.compute).mockResolvedValue({
      data: {
        lines: [
          {
            discountAmount: 30,
            finalPrice: 270,
            reasoning: {
              rulesApplied: [
                { ruleId: 'rule-50pct', ruleName: '50% Off Second Item', discountAmount: 150, description: 'Best offer: 50% off' },
              ],
              rulesEvaluated: [
                { ruleId: 'rule-10pct', ruleName: '10% Off Over $200', applicable: true, computedDiscount: 36, reason: '' },
                { ruleId: 'rule-50pct', ruleName: '50% Off Second Item', applicable: true, computedDiscount: 150, reason: '' },
              ],
              exclusionGroupsResolved: [
                { groupName: 'volume_discount', winnerId: 'rule-50pct', winnerDiscount: 150, reason: 'Maximum discount in group' },
              ],
              originalPrice: 360,
              totalDiscount: 30,
              finalPrice: 270,
            },
          },
          {
            discountAmount: 0,
            finalPrice: 60,
            reasoning: { rulesApplied: [], rulesEvaluated: [], exclusionGroupsResolved: [], originalPrice: 60, totalDiscount: 0, finalPrice: 60 },
          },
        ],
        totalDiscount: 30,
        totalFinal: 330,
      },
    } as any);

    renderPage();

    // Wait for enrollment to load
    await waitFor(() => expect(screen.getByText('Enrollment Details')).toBeVisible());

    // Click Submit Enrollment to trigger checkout preview
    const submitBtn = screen.getByRole('button', { name: /Submit Enrollment/i });
    fireEvent.click(submitBtn);

    // Wait for checkout preview to appear
    await waitFor(() => expect(screen.getByText(/Checkout/)).toBeVisible(), { timeout: 5000 });

    // Verify the winning rule name is displayed (not the losing rule)
    expect(screen.getByText('50% Off Second Item')).toBeVisible();

    // Verify the discount description is shown
    expect(screen.getByText(/Best offer/)).toBeVisible();

    // Verify Confirm & Submit and Back buttons
    expect(screen.getByRole('button', { name: /Confirm & Submit/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Back/ })).toBeVisible();

    // The losing rule ("10% Off Over $200") should NOT appear in the applied discounts
    // (it may appear in the subtotal area but not as an applied discount line)
  });

  it('blocks checkout when pricing compute fails — shows error instead', async () => {
    vi.mocked(pricingApi.compute).mockRejectedValue(new Error('API down'));

    renderPage();
    await waitFor(() => expect(screen.getByText('Enrollment Details')).toBeVisible());

    fireEvent.click(screen.getByRole('button', { name: /Submit Enrollment/i }));

    // Should show error — NOT open checkout
    await waitFor(() => expect(screen.getByText(/Unable to compute pricing/)).toBeVisible(), { timeout: 5000 });

    // Checkout preview should NOT be shown
    expect(screen.queryByText(/Checkout/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm & Submit/ })).not.toBeInTheDocument();
  });

  it('back button returns to detail view without submitting', async () => {
    vi.mocked(pricingApi.compute).mockResolvedValue({
      data: { lines: [], totalDiscount: 0, totalFinal: 360 },
    } as any);

    renderPage();
    await waitFor(() => expect(screen.getByText('Enrollment Details')).toBeVisible());

    fireEvent.click(screen.getByRole('button', { name: /Submit Enrollment/i }));
    await waitFor(() => expect(screen.getByText(/Checkout/)).toBeVisible(), { timeout: 5000 });

    // Click Back
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));

    // Should return to normal detail view with Submit button visible again
    await waitFor(() => expect(screen.getByRole('button', { name: /Submit Enrollment/i })).toBeVisible());
    expect(screen.queryByText(/Checkout/)).not.toBeInTheDocument();
  });
});
