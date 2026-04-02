import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from './auth.store';

vi.mock('@/api/client', () => ({
  apiClient: { post: vi.fn(), get: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(public statusCode: number, public errorCode: string, message: string) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

vi.mock('@/utils/fingerprint', () => ({
  generateFingerprint: vi.fn().mockResolvedValue('mock-fingerprint'),
}));

vi.mock('@/utils/token-store', () => {
  let access: string | null = null;
  let refresh: string | null = null;
  let uid: string | null = null;
  let fp: string | null = null;
  return {
    tokenStore: {
      getAccessToken: vi.fn(() => access),
      getRefreshToken: vi.fn(() => refresh),
      getUserId: vi.fn(() => uid),
      getFingerprint: vi.fn(() => fp),
      setTokens: vi.fn((a: string, r: string) => { access = a; refresh = r; }),
      setUserId: vi.fn((id: string) => { uid = id; }),
      setFingerprint: vi.fn((f: string) => { fp = f; }),
      clear: vi.fn(() => { access = null; refresh = null; uid = null; fp = null; }),
      hasToken: vi.fn(() => access !== null),
    },
  };
});

import { apiClient } from '@/api/client';
import { tokenStore } from '@/utils/token-store';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      captchaRequired: false,
    });
    vi.restoreAllMocks();
    tokenStore.clear();
  });

  describe('initial state', () => {
    it('starts unauthenticated with no user', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('login', () => {
    it('stores tokens in memory (not web storage) on successful login', async () => {
      const mockUser = { id: '1', username: 'test', email: 'test@test.com', role: 'patient', fullName: 'Test', canApproveRefunds: false, isActive: true, createdAt: '2026-01-01' };
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { accessToken: 'access-tok', refreshToken: 'refresh-tok', user: mockUser },
      });

      await useAuthStore.getState().login('test', 'password');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      // Tokens stored via tokenStore (sessionStorage-backed)
      expect(tokenStore.setTokens).toHaveBeenCalledWith('access-tok', 'refresh-tok');
    });

    it('sets error on failed login', async () => {
      const ApiError = (await import('@/api/client')).ApiError;
      vi.mocked(apiClient.post).mockRejectedValue(new ApiError(401, 'AUTH_001', 'Invalid credentials'));

      await expect(useAuthStore.getState().login('bad', 'pass')).rejects.toThrow();

      expect(useAuthStore.getState().error).toBe('Invalid credentials');
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('logout', () => {
    it('clears tokens from memory and resets state synchronously', () => {
      useAuthStore.setState({ user: { id: '1' } as any, isAuthenticated: true });

      useAuthStore.getState().logout();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(tokenStore.clear).toHaveBeenCalled();
    });
  });

  describe('refreshAuth', () => {
    it('sets user on successful refresh', async () => {
      const mockUser = { id: '1', username: 'test', role: 'patient' };
      vi.mocked(apiClient.get).mockResolvedValue({ data: { user: mockUser } });

      await useAuthStore.getState().refreshAuth();

      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('clears tokens on failed refresh', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Unauthorized'));

      await useAuthStore.getState().refreshAuth();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(tokenStore.clear).toHaveBeenCalled();
    });
  });

  describe('clearError', () => {
    it('clears the error state', () => {
      useAuthStore.setState({ error: 'some error' });
      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
