import { apiClient } from './client';
import type { IpRuleDto, RiskEventDto, IncidentTicketDto, CaptchaChallengeDto } from '@checc/shared/types/risk.types';

export const riskApi = {
  // IP Rules
  listIpRules(page = 1, limit = 20) {
    return apiClient.get<{ data: IpRuleDto[] }>('/risk/ip-rules', {
      page: String(page),
      limit: String(limit),
    });
  },

  createIpRule(data: { ipAddress: string; cidrMask?: number; ruleType: string; reason?: string; expiresAt?: string }) {
    return apiClient.post<{ data: IpRuleDto }>('/risk/ip-rules', data);
  },

  deleteIpRule(id: string) {
    return apiClient.delete<void>(`/risk/ip-rules/${id}`);
  },

  // Risk Events
  listRiskEvents(page = 1, limit = 20) {
    return apiClient.get<{ data: RiskEventDto[] }>('/risk/events', {
      page: String(page),
      limit: String(limit),
    });
  },

  // Incident Tickets
  listIncidents(page = 1, limit = 20, status?: string) {
    const params: Record<string, string> = { page: String(page), limit: String(limit) };
    if (status) params.status = status;
    return apiClient.get<{ data: IncidentTicketDto[] }>('/risk/incidents', params);
  },

  updateIncident(id: string, data: { status?: string; assignedTo?: string; resolutionNotes?: string }) {
    return apiClient.patch<{ data: IncidentTicketDto }>(`/risk/incidents/${id}`, data);
  },

  // CAPTCHA
  getCaptcha() {
    return apiClient.get<{ data: CaptchaChallengeDto }>('/risk/captcha');
  },
};
