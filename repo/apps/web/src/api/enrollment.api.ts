import { apiClient } from './client';
import type { EnrollmentDto, CatalogServiceDto } from '@checc/shared/types/enrollment.types';

export const enrollmentApi = {
  list(page = 1, limit = 20) {
    return apiClient.get<{ data: EnrollmentDto[] }>('/enrollments', {
      page: String(page),
      limit: String(limit),
    });
  },

  getById(id: string) {
    return apiClient.get<{ data: EnrollmentDto }>(`/enrollments/${id}`);
  },

  create(data: { notes?: string; serviceLines: { serviceId: string; quantity: number }[] }) {
    return apiClient.post<{ data: EnrollmentDto }>('/enrollments', data);
  },

  update(id: string, data: { notes?: string; serviceLines?: { serviceId: string; quantity: number }[] }) {
    return apiClient.put<{ data: EnrollmentDto }>(`/enrollments/${id}`, data);
  },

  submit(id: string) {
    return apiClient.post<{ data: EnrollmentDto }>(`/enrollments/${id}/submit`);
  },

  cancel(id: string) {
    return apiClient.post<{ data: EnrollmentDto }>(`/enrollments/${id}/cancel`);
  },
};

export const catalogApi = {
  list() {
    return apiClient.get<{ data: CatalogServiceDto[] }>('/catalog');
  },

  getById(id: string) {
    return apiClient.get<{ data: CatalogServiceDto }>(`/catalog/${id}`);
  },
};
