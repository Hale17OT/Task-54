import { apiClient } from './client';
import type { ArticleDto } from '@checc/shared/types/content.types';

export const contentApi = {
  list(page = 1, limit = 20, status?: string) {
    const params: Record<string, string> = { page: String(page), limit: String(limit) };
    if (status) params.status = status;
    return apiClient.get<{ data: ArticleDto[] }>('/content', params);
  },

  listPublished(page = 1, limit = 20) {
    return apiClient.get<{ data: ArticleDto[] }>('/content/published', {
      page: String(page),
      limit: String(limit),
    });
  },

  getBySlug(slug: string) {
    return apiClient.get<{ data: ArticleDto }>(`/content/${slug}`);
  },

  create(data: { title: string; body: string; contentType: string }) {
    return apiClient.post<{ data: ArticleDto }>('/content', data);
  },

  update(id: string, data: { title?: string; body?: string }) {
    return apiClient.put<{ data: ArticleDto }>(`/content/${id}`, data);
  },

  submitForReview(id: string) {
    return apiClient.post<{ data: ArticleDto }>(`/content/${id}/submit-review`);
  },

  review(id: string, data: { approved: boolean; reviewNotes?: string }) {
    return apiClient.post<{ data: ArticleDto }>(`/content/${id}/review`, data);
  },

  archive(id: string) {
    return apiClient.post<{ data: ArticleDto }>(`/content/${id}/archive`);
  },

  uploadMedia(articleId: string, formData: FormData) {
    return apiClient.upload<{ data: unknown }>(`/content/${articleId}/media`, formData);
  },
};
