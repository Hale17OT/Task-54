import { UserRole } from '../constants/roles';

export interface UserDto {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  fullName: string;
  canApproveRefunds: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  deviceFingerprint?: string;
  captchaId?: string;
  captchaAnswer?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface TokenPayload {
  sub: string;
  username: string;
  role: UserRole;
  canApproveRefunds: boolean;
  iat?: number;
  exp?: number;
}
