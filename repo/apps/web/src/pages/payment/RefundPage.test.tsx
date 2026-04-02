import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RefundPage } from './RefundPage';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@checc/shared/constants/roles';

vi.mock('@/api/payment.api', () => ({
  paymentApi: {
    refund: vi.fn(),
  },
}));

import { paymentApi } from '@/api/payment.api';

function renderPage(params = '?paymentId=pay-1&amount=100') {
  return render(
    <MemoryRouter initialEntries={[`/payments/refund${params}`]}>
      <Routes>
        <Route path="/payments/refund" element={<RefundPage />} />
        <Route path="/payments/history" element={<div>History</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RefundPage — Backend Constraint UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('non-approver staff sees supervisor credential fields', () => {
    useAuthStore.setState({
      user: { id: 's1', username: 'staff1', role: UserRole.STAFF, email: '', fullName: 'Staff', canApproveRefunds: false, isActive: true, createdAt: '' },
      isAuthenticated: true,
    });
    renderPage();
    expect(screen.getByText('Supervisor approval required')).toBeVisible();
    expect(screen.getByLabelText('Supervisor Username')).toBeVisible();
    expect(screen.getByLabelText('Supervisor Password')).toBeVisible();
  });

  it('approver does NOT see supervisor fields', () => {
    useAuthStore.setState({
      user: { id: 's2', username: 'supervisor', role: UserRole.STAFF, email: '', fullName: 'Sup', canApproveRefunds: true, isActive: true, createdAt: '' },
      isAuthenticated: true,
    });
    renderPage();
    expect(screen.queryByText('Supervisor approval required')).not.toBeInTheDocument();
  });

  it('validates refund amount cannot exceed original payment', () => {
    useAuthStore.setState({
      user: { id: 's1', username: 'staff1', role: UserRole.STAFF, email: '', fullName: 'Staff', canApproveRefunds: true, isActive: true, createdAt: '' },
      isAuthenticated: true,
    });
    renderPage('?paymentId=pay-1&amount=100');
    // Set refund amount higher than max
    fireEvent.change(screen.getByLabelText('Refund Amount'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: /Process Refund/ }));
    expect(screen.getByText(/cannot exceed/i)).toBeVisible();
  });

  it('shows success confirmation after approved refund', async () => {
    useAuthStore.setState({
      user: { id: 's2', username: 'supervisor', role: UserRole.STAFF, email: '', fullName: 'Sup', canApproveRefunds: true, isActive: true, createdAt: '' },
      isAuthenticated: true,
    });
    vi.mocked(paymentApi.refund).mockResolvedValue({ data: { id: 'ref-1' } } as any);
    renderPage('?paymentId=pay-1&amount=100');
    fireEvent.click(screen.getByRole('button', { name: /Process Refund/ }));
    await waitFor(() => expect(screen.getByText('Refund Processed')).toBeVisible());
  });

  it('shows backend error when supervisor credentials are invalid', async () => {
    useAuthStore.setState({
      user: { id: 's1', username: 'staff1', role: UserRole.STAFF, email: '', fullName: 'Staff', canApproveRefunds: false, isActive: true, createdAt: '' },
      isAuthenticated: true,
    });
    vi.mocked(paymentApi.refund).mockRejectedValue(new Error('Invalid supervisor credentials'));
    renderPage('?paymentId=pay-1&amount=100');
    fireEvent.change(screen.getByLabelText('Supervisor Username'), { target: { value: 'bad' } });
    fireEvent.change(screen.getByLabelText('Supervisor Password'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: /Process Refund/ }));
    await waitFor(() => expect(screen.getByText(/Invalid supervisor credentials/)).toBeVisible());
  });
});
