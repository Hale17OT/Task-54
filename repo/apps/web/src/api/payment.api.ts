import { apiClient } from './client';
import type { PaymentDto, RefundDto } from '@checc/shared/types/payment.types';

export const paymentApi = {
  listByOrder(orderId: string) {
    return apiClient.get<{ data: PaymentDto[] }>(`/payments/order/${orderId}`);
  },

  getById(id: string) {
    return apiClient.get<{ data: PaymentDto }>(`/payments/${id}`);
  },

  record(data: { orderId: string; paymentMethod: string; amount: number; referenceNumber?: string }) {
    return apiClient.post<{ data: PaymentDto }>('/payments', data);
  },

  refund(data: {
    paymentId: string;
    amount: number;
    reasonCode: string;
    reasonDetail?: string;
    supervisorUsername?: string;
    supervisorPassword?: string;
  }) {
    return apiClient.post<{ data: RefundDto }>('/payments/refund', data);
  },

  list(page = 1, limit = 20) {
    return apiClient.get<{ data: PaymentDto[] }>('/payments', {
      page: String(page),
      limit: String(limit),
    });
  },
};
