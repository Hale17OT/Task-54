import { apiClient } from './client';
import type { PricingRuleDto, DiscountAuditDto } from '@checc/shared/types/pricing.types';

export const pricingApi = {
  listRules(page = 1, limit = 20) {
    return apiClient.get<{ data: PricingRuleDto[] }>('/pricing/rules', {
      page: String(page),
      limit: String(limit),
    });
  },

  createRule(data: Record<string, unknown>) {
    return apiClient.post<{ data: PricingRuleDto }>('/pricing/rules', data);
  },

  updateRule(id: string, data: Record<string, unknown>) {
    return apiClient.put<{ data: PricingRuleDto }>(`/pricing/rules/${id}`, data);
  },

  deleteRule(id: string) {
    return apiClient.delete<void>(`/pricing/rules/${id}`);
  },

  compute(lines: { serviceId: string; category: string; unitPrice: number; quantity: number }[]) {
    return apiClient.post<{ data: unknown }>('/pricing/compute', { lines });
  },

  getAuditTrail(orderId: string) {
    return apiClient.get<{ data: DiscountAuditDto[] }>(`/pricing/audit/${orderId}`);
  },
};
