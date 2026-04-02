import { z } from 'zod';

export const serviceLineSchema = z.object({
  serviceId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
});

export const createEnrollmentSchema = z.object({
  notes: z.string().max(2000).optional().default(''),
  serviceLines: z.array(serviceLineSchema).min(1, 'At least one service is required'),
});

export const updateEnrollmentSchema = z.object({
  notes: z.string().max(2000).optional(),
  serviceLines: z.array(serviceLineSchema).min(1).optional(),
});

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;
