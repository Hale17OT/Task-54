import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock tokenStore before importing client
let mockToken: string | null = null;
let mockFingerprint: string | null = null;
vi.mock('@/utils/token-store', () => ({
  tokenStore: {
    getAccessToken: () => mockToken,
    getRefreshToken: () => null,
    getUserId: () => null,
    getFingerprint: () => mockFingerprint,
    setTokens: vi.fn(),
    setUserId: vi.fn(),
    setFingerprint: vi.fn(),
    clear: vi.fn(),
    hasToken: () => mockToken !== null,
  },
}));

import { ApiError, apiClient } from './client';

describe('ApiError', () => {
  it('creates error with correct properties', () => {
    const err = new ApiError(400, 'VALIDATION_ERROR', 'Bad input', { field: ['required'] });
    expect(err.statusCode).toBe(400);
    expect(err.errorCode).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Bad input');
    expect(err.details).toEqual({ field: ['required'] });
    expect(err.name).toBe('ApiError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockToken = null;
    mockFingerprint = null;
  });

  it('sends GET request with auth header when token exists in memory', async () => {
    mockToken = 'test-token';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ data: 'ok' }),
    });

    const result = await apiClient.get('/test');
    expect(result).toEqual({ data: 'ok' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('sends POST request with JSON body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await apiClient.post('/test', { key: 'value' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ key: 'value' }) }),
    );
  });

  it('sends PUT request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({}),
    });

    await apiClient.put('/test/1', { name: 'updated' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test/1'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('sends DELETE request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({}),
    });

    await apiClient.delete('/test/1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test/1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('throws ApiError on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 404,
      json: () => Promise.resolve({ statusCode: 404, errorCode: 'NOT_FOUND', message: 'Not found' }),
    });

    await expect(apiClient.get('/missing')).rejects.toThrow(ApiError);
  });

  it('handles 204 No Content response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });

    const result = await apiClient.delete('/test/1');
    expect(result).toBeUndefined();
  });

  it('includes device fingerprint header when set', async () => {
    mockFingerprint = 'fp-123';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({}),
    });

    await apiClient.get('/test');
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Device-Fingerprint': 'fp-123' }),
      }),
    );
  });

  it('includes fingerprint in upload requests', async () => {
    mockToken = 'tok';
    mockFingerprint = 'fp-456';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({}),
    });

    await apiClient.upload('/upload', new FormData());
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Device-Fingerprint': 'fp-456',
          Authorization: 'Bearer tok',
        }),
      }),
    );
  });

  it('appends query params to GET requests', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({}),
    });

    await apiClient.get('/items', { page: '2', limit: '10' });
    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('page=2');
    expect(calledUrl).toContain('limit=10');
  });

  it('does not include auth header when no token in memory', async () => {
    mockToken = null;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({}),
    });

    await apiClient.get('/public');
    const headers = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers;
    expect(headers.Authorization).toBeUndefined();
  });
});
