import type { ApiErrorResponse } from '@checc/shared/types/common.types';
import { tokenStore } from '@/utils/token-store';
import { clientLogger } from '@/utils/client-logger';

const API_BASE = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
    public details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorBody: ApiErrorResponse;
    try {
      errorBody = await response.json();
    } catch {
      clientLogger.error('ApiClient', `HTTP ${response.status} ${response.statusText} on ${response.url}`);
      throw new ApiError(response.status, 'UNKNOWN', response.statusText);
    }
    clientLogger.error('ApiClient', `HTTP ${errorBody.statusCode} ${errorBody.errorCode} on ${response.url}`);
    throw new ApiError(
      errorBody.statusCode,
      errorBody.errorCode,
      errorBody.message,
      errorBody.details,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token = tokenStore.getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const fingerprint = tokenStore.getFingerprint();
  if (fingerprint) {
    headers['X-Device-Fingerprint'] = fingerprint;
  }
  return headers;
}

export const apiClient = {
  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${API_BASE}/api${path}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const response = await fetch(url.toString(), { headers: getHeaders() });
    return handleResponse<T>(response);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}/api${path}`, {
      method: 'POST',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}/api${path}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}/api${path}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}/api${path}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse<T>(response);
  },

  async upload<T>(path: string, formData: FormData): Promise<T> {
    const headers: HeadersInit = {};
    const token = tokenStore.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const fp = tokenStore.getFingerprint();
    if (fp) headers['X-Device-Fingerprint'] = fp;
    const response = await fetch(`${API_BASE}/api${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return handleResponse<T>(response);
  },
};
