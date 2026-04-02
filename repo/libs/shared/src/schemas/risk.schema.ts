import { z } from 'zod';
import { IncidentStatus } from '../types/risk.types';

export const createIpRuleSchema = z.object({
  ipAddress: z.string().min(1, 'IP address is required').max(45),
  cidrMask: z.number().int().min(0).max(32).optional().default(32),
  ruleType: z.enum(['allow', 'deny']),
  reason: z.string().max(1000).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const updateIncidentSchema = z.object({
  status: z.nativeEnum(IncidentStatus).optional(),
  assignedTo: z.string().uuid().optional(),
  resolutionNotes: z.string().max(2000).optional(),
});

export const verifyCaptchaSchema = z.object({
  id: z.string().uuid(),
  answer: z.string().min(1, 'Answer is required'),
});

export type CreateIpRuleInput = z.infer<typeof createIpRuleSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
export type VerifyCaptchaInput = z.infer<typeof verifyCaptchaSchema>;
