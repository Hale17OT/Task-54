import { z } from 'zod';
import { AUTH_LIMITS } from '../constants/limits';
import { UserRole } from '../constants/roles';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  deviceFingerprint: z.string().optional(),
  captchaId: z.string().uuid().optional(),
  captchaAnswer: z.string().optional(),
});

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(100)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, dots, dashes, and underscores'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(AUTH_LIMITS.MIN_PASSWORD_LENGTH, `Password must be at least ${AUTH_LIMITS.MIN_PASSWORD_LENGTH} characters`)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
  fullName: z.string().min(1, 'Full name is required').max(200),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
