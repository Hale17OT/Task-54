export enum PricingRuleType {
  PERCENTAGE_OFF = 'percentage_off',
  FIXED_OFF = 'fixed_off',
  FIXED_PRICE = 'fixed_price',
  BUY_X_GET_Y = 'buy_x_get_y',
}

export interface PricingRuleDto {
  id: string;
  name: string;
  description: string;
  ruleType: PricingRuleType;
  priorityLevel: number;
  value: number;
  minQuantity: number;
  minOrderSubtotal: number | null;
  applicableServiceIds: string[] | null;
  applicableCategories: string[] | null;
  exclusionGroup: string | null;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreatePricingRuleRequest {
  name: string;
  description?: string;
  ruleType: PricingRuleType;
  priorityLevel: number;
  value: number;
  minQuantity?: number;
  minOrderSubtotal?: number;
  applicableServiceIds?: string[];
  applicableCategories?: string[];
  exclusionGroup?: string;
  validFrom: string;
  validUntil: string;
}

export interface DiscountAuditDto {
  id: string;
  orderId: string;
  orderLineId: string;
  pricingRuleId: string;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  reasoning: DiscountReasoning;
  computedAt: string;
}

export interface DiscountReasoning {
  rulesEvaluated: EvaluatedRule[];
  exclusionGroupsResolved: ExclusionResolution[];
  rulesApplied: AppliedRule[];
  originalPrice: number;
  totalDiscount: number;
  finalPrice: number;
}

export interface EvaluatedRule {
  ruleId: string;
  ruleName: string;
  ruleType: PricingRuleType;
  computedDiscount: number;
  applicable: boolean;
  reason: string;
}

export interface ExclusionResolution {
  groupName: string;
  winnerId: string;
  winnerDiscount: number;
  reason: string;
}

export interface AppliedRule {
  ruleId: string;
  ruleName: string;
  discountAmount: number;
  description: string;
}
