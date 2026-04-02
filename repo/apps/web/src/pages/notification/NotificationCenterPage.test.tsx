import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NotificationCenterPage } from './NotificationCenterPage';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@checc/shared/constants/roles';

vi.mock('@/api/notification.api', () => ({
  notificationApi: {
    list: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    getUnreadCount: vi.fn(),
    getThrottleStatus: vi.fn(),
  },
}));

import { notificationApi } from '@/api/notification.api';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/notifications']}>
      <Routes>
        <Route path="/notifications" element={<NotificationCenterPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NotificationCenterPage — Throttle Status', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'p1', username: 'patient1', role: UserRole.PATIENT, email: '', fullName: 'Patient', canApproveRefunds: false, isActive: true, createdAt: '' },
      isAuthenticated: true,
    });
    vi.restoreAllMocks();
  });

  it('displays throttle frequency limit from backend', async () => {
    vi.mocked(notificationApi.list).mockResolvedValue({
      data: [],
    } as any);
    vi.mocked(notificationApi.getThrottleStatus).mockResolvedValue({
      data: { maxPerItem: 3, windowHours: 24 },
    } as any);

    renderPage();

    await waitFor(() => expect(screen.getByTestId('throttle-status')).toBeVisible());
    expect(screen.getByText('Frequency limit: 3 per item / 24h')).toBeVisible();
  });

  it('shows all-caught-up when no notifications', async () => {
    vi.mocked(notificationApi.list).mockResolvedValue({
      data: [],
    } as any);
    vi.mocked(notificationApi.getThrottleStatus).mockResolvedValue({
      data: { maxPerItem: 3, windowHours: 24 },
    } as any);

    renderPage();

    await waitFor(() => expect(screen.getByText('All caught up')).toBeVisible());
  });

  it('shows unread count when notifications exist', async () => {
    vi.mocked(notificationApi.list).mockResolvedValue({
      data: [
        { id: 'n1', userId: 'p1', type: 'general', title: 'Test', body: 'Body', referenceType: null, referenceId: null, isRead: false, createdAt: '2026-03-15T10:00:00Z' },
      ],
    } as any);
    vi.mocked(notificationApi.getThrottleStatus).mockResolvedValue({
      data: { maxPerItem: 3, windowHours: 24 },
    } as any);

    renderPage();

    await waitFor(() => expect(screen.getByText('1 unread')).toBeVisible());
  });

  it('gracefully handles throttle endpoint failure', async () => {
    vi.mocked(notificationApi.list).mockResolvedValue({
      data: [],
    } as any);
    vi.mocked(notificationApi.getThrottleStatus).mockRejectedValue(new Error('fail'));

    renderPage();

    await waitFor(() => expect(screen.getByText('All caught up')).toBeVisible());
    // Throttle info not shown when endpoint fails — graceful degradation
    expect(screen.queryByTestId('throttle-status')).not.toBeInTheDocument();
  });
});
