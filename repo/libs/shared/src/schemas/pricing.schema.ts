import { z } from 'zod';
import { PricingRuleType } from '../types/pricing.types';

const pricingRuleBaseSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  ruleType: z.nativeEnum(PricingRuleType),
  priorityLevel: z.number().int().min(0),
  value: z.number().positive('Value must be positive'),
  minQuantity: z.number().int().min(1).optional().default(1),
  minOrderSubtotal: z.number().min(0).optional(),
  applicableServiceIds: z.array(z.string().uuid()).optional(),
  applicableCategories: z.array(z.string()).optional(),
  exclusionGroup: z.string().max(100).optional(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
});

export const createPricingRuleSchema = pricingRuleBaseSchema.refine(
  (data) => new Date(data.validUntil) > new Date(data.validFrom),
  { message: 'validUntil must be after validFrom', path: ['validUntil'] },
);

export const updatePricingRuleSchema = pricingRuleBaseSchema.partial();

export type CreatePricingRuleInput = z.infer<typeof createPricingRuleSchema>;
export type UpdatePricingRuleInput = z.infer<typeof updatePricingRuleSchema>;
