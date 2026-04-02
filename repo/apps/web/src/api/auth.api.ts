import { apiClient } from './client';
import type { LoginResponse, UserDto } from '@checc/shared/types/auth.types';

export const authApi = {
  login(username: string, password: string) {
    return apiClient.post<{ data: LoginResponse }>('/auth/login', { username, password });
  },

  register(data: { username: string; email: string; password: string; fullName: string }) {
    return apiClient.post<{ data: UserDto }>('/auth/register', data);
  },

  me() {
    return apiClient.get<{ data: { user: UserDto } }>('/auth/me');
  },
};
