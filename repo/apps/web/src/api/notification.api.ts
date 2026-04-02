import { apiClient } from './client';
import type { NotificationDto } from '@checc/shared/types/notification.types';

export const notificationApi = {
  list(page = 1, limit = 20, unreadOnly = false) {
    const params: Record<string, string> = { page: String(page), limit: String(limit) };
    if (unreadOnly) params.unreadOnly = 'true';
    return apiClient.get<{ data: NotificationDto[] }>('/notifications', params);
  },

  markAsRead(id: string) {
    return apiClient.patch<void>(`/notifications/${id}/read`);
  },

  markAllAsRead() {
    return apiClient.patch<void>('/notifications/read-all');
  },

  getUnreadCount() {
    return apiClient.get<{ data: { count: number } }>('/notifications/unread-count');
  },

  getThrottleStatus() {
    return apiClient.get<{ data: { maxPerItem: number; windowHours: number } }>('/notifications/throttle-status');
  },
};
