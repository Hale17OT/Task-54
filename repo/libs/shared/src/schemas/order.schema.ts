import { z } from 'zod';

export const orderQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type OrderQueryInput = z.infer<typeof orderQuerySchema>;
