import { create } from 'zustand';
import type { UserDto, LoginResponse } from '@checc/shared/types/auth.types';
import { apiClient, ApiError } from '@/api/client';
import { generateFingerprint } from '@/utils/fingerprint';
import { tokenStore } from '@/utils/token-store';
import { offlineStorage } from '@/utils/offline-storage';
import { syncQueue } from '@/utils/sync-queue';

interface AuthState {
  user: UserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  captchaRequired: boolean;

  login: (username: string, password: string, captchaId?: string, captchaAnswer?: string) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: tokenStore.hasToken(),
  isLoading: false,
  error: null,
  captchaRequired: false,

  login: async (username: string, password: string, captchaId?: string, captchaAnswer?: string) => {
    set({ isLoading: true, error: null });
    try {
      // Generate fingerprint in memory if not already set
      if (!tokenStore.getFingerprint()) {
        const fp = await generateFingerprint();
        tokenStore.setFingerprint(fp);
      }
      const payload: Record<string, unknown> = {
        username,
        password,
        deviceFingerprint: tokenStore.getFingerprint() || undefined,
      };
      if (captchaId && captchaAnswer) {
        payload.captchaId = captchaId;
        payload.captchaAnswer = captchaAnswer;
      }
      const response = await apiClient.post<{ data: LoginResponse }>('/auth/login', payload);
      const loginData = response.data;
      tokenStore.setTokens(loginData.accessToken, loginData.refreshToken);
      tokenStore.setUserId(loginData.user.id);
      set({ user: loginData.user, isAuthenticated: true, isLoading: false, captchaRequired: false });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed';
      const isCaptchaRequired = err instanceof ApiError && err.errorCode === 'AUTH_008';
      set({ error: message, isLoading: false, captchaRequired: isCaptchaRequired });
      throw err;
    }
  },

  logout: () => {
    const userId = tokenStore.getUserId() || 'anonymous';
    tokenStore.clear();
    set({ user: null, isAuthenticated: false, error: null, captchaRequired: false });

    // Async cleanup of IndexedDB offline data (best-effort)
    offlineStorage.clearForUser(userId).catch(() => {});
    syncQueue.clearForUser(userId).catch(() => {});
  },

  refreshAuth: async () => {
    try {
      const response = await apiClient.get<{ data: { user: UserDto } }>('/auth/me');
      set({ user: response.data.user, isAuthenticated: true });
    } catch {
      tokenStore.clear();
      set({ user: null, isAuthenticated: false });
    }
  },

  clearError: () => set({ error: null }),
}));
