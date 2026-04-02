import { z } from 'zod';

export const resultItemSchema = z.object({
  testName: z.string().min(1).max(200),
  testCode: z.string().min(1).max(50),
  value: z.string().min(1).max(100),
  unit: z.string().max(50).optional().default(''),
  referenceLow: z.number().optional(),
  referenceHigh: z.number().optional(),
});

export const createHealthCheckSchema = z.object({
  patientId: z.string().uuid(),
  templateId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  resultItems: z.array(resultItemSchema).min(1, 'At least one result item is required'),
});

export const updateHealthCheckSchema = z.object({
  resultItems: z.array(resultItemSchema).min(1),
  changeSummary: z.string().max(500).optional(),
});

export const signHealthCheckSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  versionNumber: z.number().int().min(1),
});

export type CreateHealthCheckInput = z.infer<typeof createHealthCheckSchema>;
export type UpdateHealthCheckInput = z.infer<typeof updateHealthCheckSchema>;
export type SignHealthCheckInput = z.infer<typeof signHealthCheckSchema>;
