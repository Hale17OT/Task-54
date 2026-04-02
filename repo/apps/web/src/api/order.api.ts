import { apiClient } from './client';
import type { OrderDto } from '@checc/shared/types/order.types';

export const orderApi = {
  list(page = 1, limit = 20, status?: string) {
    const params: Record<string, string> = { page: String(page), limit: String(limit) };
    if (status) params.status = status;
    return apiClient.get<{ data: OrderDto[] }>('/orders', params);
  },

  getById(id: string) {
    return apiClient.get<{ data: OrderDto }>(`/orders/${id}`);
  },

  getByEnrollmentId(enrollmentId: string) {
    return apiClient.get<{ data: OrderDto | null }>(`/orders/by-enrollment/${enrollmentId}`);
  },

  cancel(id: string) {
    return apiClient.post<{ data: OrderDto }>(`/orders/${id}/cancel`);
  },
};
