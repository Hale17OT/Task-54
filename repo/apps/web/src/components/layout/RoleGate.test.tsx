import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RoleGate } from './RoleGate';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@checc/shared/constants/roles';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('RoleGate', () => {
  it('renders children when user has allowed role', () => {
    useAuthStore.setState({
      user: { id: '1', username: 'admin', role: UserRole.ADMIN, email: '', fullName: '', canApproveRefunds: false, isActive: true, createdAt: '' },
    });

    renderWithRouter(
      <RoleGate allowedRoles={[UserRole.ADMIN]}>
        <div>Admin Content</div>
      </RoleGate>,
    );

    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('shows access denied when user lacks required role', () => {
    useAuthStore.setState({
      user: { id: '1', username: 'patient', role: UserRole.PATIENT, email: '', fullName: '', canApproveRefunds: false, isActive: true, createdAt: '' },
    });

    renderWithRouter(
      <RoleGate allowedRoles={[UserRole.ADMIN]}>
        <div>Admin Only</div>
      </RoleGate>,
    );

    expect(screen.queryByText('Admin Only')).not.toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/patient/)).toBeInTheDocument();
  });

  it('shows access denied when user is null', () => {
    useAuthStore.setState({ user: null });

    renderWithRouter(
      <RoleGate allowedRoles={[UserRole.STAFF]}>
        <div>Staff Content</div>
      </RoleGate>,
    );

    expect(screen.queryByText('Staff Content')).not.toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('allows when user has one of multiple allowed roles', () => {
    useAuthStore.setState({
      user: { id: '1', username: 'staff', role: UserRole.STAFF, email: '', fullName: '', canApproveRefunds: false, isActive: true, createdAt: '' },
    });

    renderWithRouter(
      <RoleGate allowedRoles={[UserRole.STAFF, UserRole.ADMIN]}>
        <div>Staff or Admin</div>
      </RoleGate>,
    );

    expect(screen.getByText('Staff or Admin')).toBeInTheDocument();
  });

  it('shows return to dashboard button on access denied', () => {
    useAuthStore.setState({
      user: { id: '1', username: 'patient', role: UserRole.PATIENT, email: '', fullName: '', canApproveRefunds: false, isActive: true, createdAt: '' },
    });

    renderWithRouter(
      <RoleGate allowedRoles={[UserRole.ADMIN]}>
        <div>Admin Only</div>
      </RoleGate>,
    );

    expect(screen.getByRole('button', { name: 'Return to Dashboard' })).toBeInTheDocument();
  });
});
