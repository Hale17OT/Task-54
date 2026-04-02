import { apiClient } from './client';
import { tokenStore } from '@/utils/token-store';
import type {
  HealthCheckDto,
  HealthCheckVersionDto,
  ReportTemplateDto,
  ReportSignatureDto,
} from '@checc/shared/types/health-check.types';
export const healthCheckApi = {
  list(page = 1, limit = 20) {
    return apiClient.get<{ data: HealthCheckDto[] }>('/health-checks', {
      page: String(page),
      limit: String(limit),
    });
  },

  getById(id: string) {
    return apiClient.get<{ data: HealthCheckDto & { currentVersionData: HealthCheckVersionDto } }>(
      `/health-checks/${id}`,
    );
  },

  create(data: Record<string, unknown>) {
    return apiClient.post<{ data: HealthCheckDto }>('/health-checks', data);
  },

  update(id: string, data: Record<string, unknown>) {
    return apiClient.put<{ data: HealthCheckDto }>(`/health-checks/${id}`, data);
  },

  submitForReview(id: string) {
    return apiClient.post<{ data: HealthCheckDto }>(`/health-checks/${id}/submit-review`);
  },

  sign(id: string, data: { username: string; password: string; versionNumber: number }) {
    return apiClient.post<{ data: ReportSignatureDto }>(`/health-checks/${id}/sign`, data);
  },

  getVersions(id: string) {
    return apiClient.get<{ data: HealthCheckVersionDto[] }>(`/health-checks/${id}/versions`);
  },

  async downloadPdf(id: string, versionNumber: number) {
    const token = tokenStore.getAccessToken();
    const url = `${import.meta.env.VITE_API_URL || ''}/api/health-checks/${id}/pdf/${versionNumber}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('PDF download failed');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `report_${id}_v${versionNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  },

  getTemplates() {
    return apiClient.get<{ data: ReportTemplateDto[] }>('/templates');
  },
};
