import { PricingEngine, OrderLineInput } from '../src/core/application/use-cases/pricing-engine';
import { PricingRuleEntity } from '../src/infrastructure/persistence/entities/pricing-rule.entity';
import { PricingRuleType } from '@checc/shared/types/pricing.types';

describe('PricingEngine', () => {
  let engine: PricingEngine;
  const now = new Date('2026-03-15T12:00:00Z');

  const baseLine: OrderLineInput = {
    serviceId: 'service-uuid-1',
    category: 'lab',
    unitPrice: 100,
    quantity: 2,
  };

  function makeRule(overrides: Partial<PricingRuleEntity> = {}): PricingRuleEntity {
    return {
      id: 'rule-uuid-1',
      name: 'Test Rule',
      description: 'A test rule',
      ruleType: PricingRuleType.PERCENTAGE_OFF,
      priorityLevel: 1,
      value: 10,
      minQuantity: 1,
      applicableServiceIds: null,
      applicableCategories: null,
      exclusionGroup: null,
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validUntil: new Date('2026-12-31T23:59:59Z'),
      isActive: true,
      createdBy: 'admin-uuid-1',
      creator: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    } as PricingRuleEntity;
  }

  beforeEach(() => {
    engine = new PricingEngine();
  });

  // Test 1: No applicable rules -> zero discount
  it('should return zero discount when no rules are applicable', () => {
    const result = engine.computeLineDiscount(baseLine, [], now);

    expect(result.discountAmount).toBe(0);
    expect(result.finalPrice).toBe(200); // 100 * 2
    expect(result.reasoning.rulesApplied).toHaveLength(0);
  });

  // Test 2: Single percentage_off rule applies correctly
  it('should apply a percentage_off rule correctly', () => {
    const rule = makeRule({
      ruleType: PricingRuleType.PERCENTAGE_OFF,
      value: 10, // 10%
    });

    const result = engine.computeLineDiscount(baseLine, [rule], now);

    // 100 * 2 * 10 / 100 = 20
    expect(result.discountAmount).toBe(20);
    expect(result.finalPrice).toBe(180);
  });

  // Test 3: Single fixed_off rule applies correctly
  it('should apply a fixed_off rule correctly', () => {
    const rule = makeRule({
      ruleType: PricingRuleType.FIXED_OFF,
      value: 15, // $15 off per unit
    });

    const result = engine.computeLineDiscount(baseLine, [rule], now);

    // 15 * 2 = 30
    expect(result.discountAmount).toBe(30);
    expect(result.finalPrice).toBe(170);
  });

  // Test 4: Single fixed_price rule applies correctly
  it('should apply a fixed_price rule correctly', () => {
    const rule = makeRule({
      ruleType: PricingRuleType.FIXED_PRICE,
      value: 80, // Fixed price $80 per unit
    });

    const result = engine.computeLineDiscount(baseLine, [rule], now);

    // (100 - 80) * 2 = 40
    expect(result.discountAmount).toBe(40);
    expect(result.finalPrice).toBe(160);
  });

  // Test 5: buy_x_get_y rule: quantity=3, buy 2 get 1 -> 1 free item
  it('should apply buy_x_get_y rule: quantity=3, buy 2 get 1 free', () => {
    const line: OrderLineInput = {
      serviceId: 'service-uuid-1',
      category: 'lab',
      unitPrice: 100,
      quantity: 3,
    };

    const rule = makeRule({
      ruleType: PricingRuleType.BUY_X_GET_Y,
      value: 1, // 1 free item per group
      minQuantity: 2, // buy 2
    });

    const result = engine.computeLineDiscount(line, [rule], now);

    // floor(3 / (2 + 1)) * 100 * 1 = 1 * 100 = 100
    expect(result.discountAmount).toBe(100);
    expect(result.finalPrice).toBe(200);
  });

  // Test 6: buy_x_get_y rule: quantity=1 (below min) -> no discount
  it('should not apply buy_x_get_y when quantity is below min_quantity', () => {
    const line: OrderLineInput = {
      serviceId: 'service-uuid-1',
      category: 'lab',
      unitPrice: 100,
      quantity: 1,
    };

    const rule = makeRule({
      ruleType: PricingRuleType.BUY_X_GET_Y,
      value: 1,
      minQuantity: 2,
    });

    const result = engine.computeLineDiscount(line, [rule], now);

    expect(result.discountAmount).toBe(0);
    expect(result.finalPrice).toBe(100);
    expect(result.reasoning.rulesEvaluated[0].applicable).toBe(false);
  });

  // Test 7: Exclusion group: two mutually exclusive rules, picks max discount
  it('should pick the rule with the maximum discount in an exclusion group', () => {
    const rule1 = makeRule({
      id: 'rule-uuid-1',
      name: 'Small Discount',
      ruleType: PricingRuleType.PERCENTAGE_OFF,
      value: 5, // 5% = 10
      exclusionGroup: 'promo-group',
      priorityLevel: 1,
    });

    const rule2 = makeRule({
      id: 'rule-uuid-2',
      name: 'Big Discount',
      ruleType: PricingRuleType.PERCENTAGE_OFF,
      value: 20, // 20% = 40
      exclusionGroup: 'promo-group',
      priorityLevel: 2,
    });

    const result = engine.computeLineDiscount(baseLine, [rule1, rule2], now);

    // Should pick rule2 (20%) for discount = 40
    expect(result.discountAmount).toBe(40);
    expect(result.finalPrice).toBe(160);
    expect(result.reasoning.rulesApplied).toHaveLength(1);
    expect(result.reasoning.rulesApplied[0].ruleId).toBe('rule-uuid-2');
    expect(result.reasoning.exclusionGroupsResolved).toHaveLength(1);
    expect(result.reasoning.exclusionGroupsResolved[0].winnerId).toBe('rule-uuid-2');
  });

  // Test 8: Exclusion group tie-break: equal discount, picks lower priority
  it('should tie-break by lower priority_level when discounts are equal', () => {
    const rule1 = makeRule({
      id: 'rule-uuid-1',
      name: 'Priority 2 Rule',
      ruleType: PricingRuleType.PERCENTAGE_OFF,
      value: 10,
      exclusionGroup: 'promo-group',
      priorityLevel: 2,
    });

    const rule2 = makeRule({
      id: 'rule-uuid-2',
      name: 'Priority 1 Rule',
      ruleType: PricingRuleType.PERCENTAGE_OFF,
      value: 10,
      exclusionGroup: 'promo-group',
      priorityLevel: 1,
    });

    const result = engine.computeLineDiscount(baseLine, [rule1, rule2], now);

    // Both give same discount (20), pick lower priority_level -> rule2
    expect(result.discountAmount).toBe(20);
    expect(result.reasoning.rulesApplied[0].ruleId).toBe('rule-uuid-2');
  });

  // Test 9: Standalone rules: both apply (no exclusion group)
  it('should apply all standalone rules (no exclusion group)', () => {
    const rule1 = makeRule({
      id: 'rule-uuid-1',
      name: 'Standalone A',
      ruleType: PricingRuleType.PERCENTAGE_OFF,
      value: 10, // 20 discount
      exclusionGroup: null,
    });

    const rule2 = makeRule({
      id: 'rule-uuid-2',
      name: 'Standalone B',
      ruleType: PricingRuleType.FIXED_OFF,
      value: 5, // 10 discount
      exclusionGroup: null,
    });

    const result = engine.computeLineDiscount(baseLine, [rule1, rule2], now);

    // 20 + 10 = 30
    expect(result.discountAmount).toBe(30);
    expect(result.finalPrice).toBe(170);
    expect(result.reasoning.rulesApplied).toHaveLength(2);
  });

  // Test 10: Mixed: standalone + exclusion group rules combine correctly
  it('should combine standalone and exclusion group winners', () => {
    const standalone = makeRule({
      id: 'rule-uuid-1',
      name: 'Standalone',
      ruleType: PricingRuleType.FIXED_OFF,
      value: 5, // 10 discount
      exclusionGroup: null,
      priorityLevel: 0,
    });

    const groupRuleA = makeRule({
      id: 'rule-uuid-2',
      name: 'Group A',
      ruleType: PricingRuleType.PERCENTAGE_OFF,
      value: 5, // 10 discount
      exclusionGroup: 'seasonal',
      priorityLevel: 1,
    });

    const groupRuleB = makeRule({
      id: 'rule-uuid-3',
      name: 'Group B',
      ruleType: PricingRuleType.PERCENTAGE_OFF,
      value: 15, // 30 discount
      exclusionGroup: 'seasonal',
      priorityLevel: 2,
    });

    const result = engine.computeLineDiscount(
      baseLine,
      [standalone, groupRuleA, groupRuleB],
      now,
    );

    // Standalone: 10, Group winner (B): 30 => total 40
    expect(result.discountAmount).toBe(40);
    expect(result.finalPrice).toBe(160);
    expect(result.reasoning.rulesApplied).toHaveLength(2);
  });

  // Test 11: Expired rule is filtered out
  it('should filter out expired rules', () => {
    const rule = makeRule({
      validFrom: new Date('2025-01-01T00:00:00Z'),
      validUntil: new Date('2025-12-31T23:59:59Z'), // expired before now (2026-03-15)
    });

    const result = engine.computeLineDiscount(baseLine, [rule], now);

    expect(result.discountAmount).toBe(0);
    expect(result.reasoning.rulesEvaluated[0].applicable).toBe(false);
    expect(result.reasoning.rulesEvaluated[0].reason).toContain('outside valid date range');
  });

  // Test 12: Future rule is filtered out
  it('should filter out future rules (not yet valid)', () => {
    const rule = makeRule({
      validFrom: new Date('2027-01-01T00:00:00Z'),
      validUntil: new Date('2027-12-31T23:59:59Z'),
    });

    const result = engine.computeLineDiscount(baseLine, [rule], now);

    expect(result.discountAmount).toBe(0);
    expect(result.reasoning.rulesEvaluated[0].applicable).toBe(false);
    expect(result.reasoning.rulesEvaluated[0].reason).toContain('outside valid date range');
  });

  // Test 13: Rule with wrong service ID is filtered out
  it('should filter out rules with non-matching service ID', () => {
    const rule = makeRule({
      applicableServiceIds: ['other-service-uuid'],
    });

    const result = engine.computeLineDiscount(baseLine, [rule], now);

    expect(result.discountAmount).toBe(0);
    expect(result.reasoning.rulesEvaluated[0].applicable).toBe(false);
    expect(result.reasoning.rulesEvaluated[0].reason).toContain('service ID does not match');
  });

  // Test 14: Rule with wrong category is filtered out
  it('should filter out rules with non-matching category', () => {
    const rule = makeRule({
      applicableCategories: ['imaging'], // line.category = 'lab'
    });

    const result = engine.computeLineDiscount(baseLine, [rule], now);

    expect(result.discountAmount).toBe(0);
    expect(result.reasoning.rulesEvaluated[0].applicable).toBe(false);
    expect(result.reasoning.rulesEvaluated[0].reason).toContain('category does not match');
  });

  // Test 15: Discount capped at line subtotal (never negative)
  it('should cap total discount at line subtotal (never negative price)', () => {
    const rule1 = makeRule({
      id: 'rule-uuid-1',
      ruleType: PricingRuleType.FIXED_OFF,
      value: 80, // 80 * 2 = 160
      exclusionGroup: null,
    });

    const rule2 = makeRule({
      id: 'rule-uuid-2',
      ruleType: PricingRuleType.FIXED_OFF,
      value: 80, // 80 * 2 = 160
      exclusionGroup: null,
    });

    // Total raw discount = 320, subtotal = 200
    const result = engine.computeLineDiscount(baseLine, [rule1, rule2], now);

    expect(result.discountAmount).toBe(200); // Capped at subtotal
    expect(result.finalPrice).toBe(0);
  });

  // Test 16: Priority order is respected (lower priority_level = higher priority)
  it('should apply rules in priority order (lower priority_level first)', () => {
    const rule1 = makeRule({
      id: 'rule-uuid-1',
      name: 'Low Priority',
      ruleType: PricingRuleType.FIXED_OFF,
      value: 5,
      priorityLevel: 10,
      exclusionGroup: null,
    });

    const rule2 = makeRule({
      id: 'rule-uuid-2',
      name: 'High Priority',
      ruleType: PricingRuleType.PERCENTAGE_OFF,
      value: 10,
      priorityLevel: 1,
      exclusionGroup: null,
    });

    const result = engine.computeLineDiscount(baseLine, [rule1, rule2], now);

    // Both apply; order of rulesApplied should be priority 1 first, then 10
    expect(result.reasoning.rulesApplied[0].ruleId).toBe('rule-uuid-2');
    expect(result.reasoning.rulesApplied[1].ruleId).toBe('rule-uuid-1');
  });

  // Test 17: Reasoning object contains all evaluated rules and applied rules
  it('should build a complete reasoning object with all evaluated and applied rules', () => {
    const applicableRule = makeRule({
      id: 'rule-uuid-1',
      name: 'Applicable',
      ruleType: PricingRuleType.PERCENTAGE_OFF,
      value: 10,
    });

    const expiredRule = makeRule({
      id: 'rule-uuid-2',
      name: 'Expired',
      validFrom: new Date('2025-01-01T00:00:00Z'),
      validUntil: new Date('2025-06-01T00:00:00Z'),
    });

    const wrongCategoryRule = makeRule({
      id: 'rule-uuid-3',
      name: 'Wrong Category',
      applicableCategories: ['imaging'],
    });

    const result = engine.computeLineDiscount(
      baseLine,
      [applicableRule, expiredRule, wrongCategoryRule],
      now,
    );

    // All 3 evaluated
    expect(result.reasoning.rulesEvaluated).toHaveLength(3);

    // Only 1 applied
    expect(result.reasoning.rulesApplied).toHaveLength(1);
    expect(result.reasoning.rulesApplied[0].ruleId).toBe('rule-uuid-1');

    // Check evaluated details
    const evaluated1 = result.reasoning.rulesEvaluated.find(
      (r) => r.ruleId === 'rule-uuid-1',
    );
    expect(evaluated1!.applicable).toBe(true);

    const evaluated2 = result.reasoning.rulesEvaluated.find(
      (r) => r.ruleId === 'rule-uuid-2',
    );
    expect(evaluated2!.applicable).toBe(false);

    const evaluated3 = result.reasoning.rulesEvaluated.find(
      (r) => r.ruleId === 'rule-uuid-3',
    );
    expect(evaluated3!.applicable).toBe(false);

    // Totals
    expect(result.reasoning.originalPrice).toBe(200);
    expect(result.reasoning.totalDiscount).toBe(20);
    expect(result.reasoning.finalPrice).toBe(180);
  });

  // computeOrderDiscounts tests
  describe('computeOrderDiscounts', () => {
    it('should compute discounts for multiple order lines', () => {
      const lines: OrderLineInput[] = [
        { serviceId: 'service-uuid-1', category: 'lab', unitPrice: 100, quantity: 2 },
        { serviceId: 'service-uuid-2', category: 'imaging', unitPrice: 200, quantity: 1 },
      ];

      const labRule = makeRule({
        id: 'rule-uuid-1',
        ruleType: PricingRuleType.PERCENTAGE_OFF,
        value: 10,
        applicableCategories: ['lab'],
      });

      const result = engine.computeOrderDiscounts(lines, [labRule], now);

      // Line 1: 100 * 2 * 10/100 = 20 discount
      expect(result.lines[0].discountAmount).toBe(20);
      expect(result.lines[0].finalPrice).toBe(180);

      // Line 2: imaging category, rule only for lab -> no discount
      expect(result.lines[1].discountAmount).toBe(0);
      expect(result.lines[1].finalPrice).toBe(200);

      expect(result.totalDiscount).toBe(20);
      expect(result.totalFinal).toBe(380);
    });

    it('should default to current date when now is not provided', () => {
      const lines: OrderLineInput[] = [
        { serviceId: 'service-uuid-1', category: 'lab', unitPrice: 50, quantity: 1 },
      ];

      // Rule valid from far past to far future
      const rule = makeRule({
        validFrom: new Date('2020-01-01T00:00:00Z'),
        validUntil: new Date('2030-12-31T23:59:59Z'),
        ruleType: PricingRuleType.PERCENTAGE_OFF,
        value: 10,
      });

      const result = engine.computeOrderDiscounts(lines, [rule]);

      expect(result.totalDiscount).toBe(5);
      expect(result.totalFinal).toBe(45);
    });
  });

  // Test inactive rule is filtered
  it('should filter out inactive rules', () => {
    const rule = makeRule({ isActive: false });

    const result = engine.computeLineDiscount(baseLine, [rule], now);

    expect(result.discountAmount).toBe(0);
    expect(result.reasoning.rulesEvaluated[0].applicable).toBe(false);
    expect(result.reasoning.rulesEvaluated[0].reason).toContain('rule is inactive');
  });

  // Test service-specific rule matches correctly
  it('should apply rule when applicableServiceIds includes the line serviceId', () => {
    const rule = makeRule({
      applicableServiceIds: ['service-uuid-1', 'service-uuid-2'],
      ruleType: PricingRuleType.PERCENTAGE_OFF,
      value: 15,
    });

    const result = engine.computeLineDiscount(baseLine, [rule], now);

    expect(result.discountAmount).toBe(30); // 100 * 2 * 15/100
    expect(result.reasoning.rulesEvaluated[0].applicable).toBe(true);
  });

  // Test exclusion group tie-break by rule ID when priority is also equal
  it('should tie-break by rule ID when discount and priority are equal in exclusion group', () => {
    const rule1 = makeRule({
      id: 'rule-uuid-b',
      ruleType: PricingRuleType.PERCENTAGE_OFF,
      value: 10,
      exclusionGroup: 'group-x',
      priorityLevel: 1,
    });

    const rule2 = makeRule({
      id: 'rule-uuid-a',
      ruleType: PricingRuleType.PERCENTAGE_OFF,
      value: 10,
      exclusionGroup: 'group-x',
      priorityLevel: 1,
    });

    const result = engine.computeLineDiscount(baseLine, [rule1, rule2], now);

    // Same discount, same priority -> lower ID wins
    expect(result.reasoning.rulesApplied[0].ruleId).toBe('rule-uuid-a');
  });

  describe('mutual exclusion and best-offer determinism', () => {
    it('picks maximum discount from exclusion group and ignores the other', () => {
      const rule10pct = makeRule({
        id: 'rule-10pct',
        name: '10% Off',
        ruleType: PricingRuleType.PERCENTAGE_OFF,
        value: 10,
        exclusionGroup: 'volume_discount',
        priorityLevel: 10,
      });
      const rule50pct = makeRule({
        id: 'rule-50pct',
        name: '50% Off 2nd',
        ruleType: PricingRuleType.PERCENTAGE_OFF,
        value: 50,
        minQuantity: 2,
        exclusionGroup: 'volume_discount',
        priorityLevel: 8,
      });
      // line: 2 x $100 = $200
      const result = engine.computeLineDiscount(baseLine, [rule10pct, rule50pct], now);

      // 50% off is $100 discount vs 10% off is $20 — best offer is 50%
      expect(result.discountAmount).toBe(100);
      expect(result.reasoning.rulesApplied).toHaveLength(1);
      expect(result.reasoning.rulesApplied[0].ruleId).toBe('rule-50pct');
      expect(result.reasoning.rulesApplied[0].ruleName).toBe('50% Off 2nd');

      // Exclusion resolution should document the decision
      expect(result.reasoning.exclusionGroupsResolved).toHaveLength(1);
      expect(result.reasoning.exclusionGroupsResolved[0].groupName).toBe('volume_discount');
      expect(result.reasoning.exclusionGroupsResolved[0].winnerId).toBe('rule-50pct');
    });

    it('applies standalone rule AND exclusion group winner (no stacking within group)', () => {
      const standaloneRule = makeRule({
        id: 'rule-standalone',
        name: 'Loyalty $5 Off',
        ruleType: PricingRuleType.FIXED_OFF,
        value: 5,
        exclusionGroup: null, // standalone — always applied
        priorityLevel: 1,
      });
      const groupRule1 = makeRule({
        id: 'rule-group-a',
        name: '10% Off',
        ruleType: PricingRuleType.PERCENTAGE_OFF,
        value: 10,
        exclusionGroup: 'promo',
        priorityLevel: 5,
      });
      const groupRule2 = makeRule({
        id: 'rule-group-b',
        name: '15% Off',
        ruleType: PricingRuleType.PERCENTAGE_OFF,
        value: 15,
        exclusionGroup: 'promo',
        priorityLevel: 3,
      });

      // line: 2 x $100 = $200
      const result = engine.computeLineDiscount(baseLine, [standaloneRule, groupRule1, groupRule2], now);

      // Standalone: $5*2 = $10 discount
      // Exclusion group "promo": 15% = $30 beats 10% = $20
      // Total: $10 + $30 = $40
      expect(result.discountAmount).toBe(40);
      expect(result.reasoning.rulesApplied).toHaveLength(2);
      expect(result.reasoning.rulesApplied.map((r: { ruleId: string }) => r.ruleId)).toContain('rule-standalone');
      expect(result.reasoning.rulesApplied.map((r: { ruleId: string }) => r.ruleId)).toContain('rule-group-b');
      // Group-a should NOT be applied (mutual exclusion)
      expect(result.reasoning.rulesApplied.map((r: { ruleId: string }) => r.ruleId)).not.toContain('rule-group-a');
    });

    it('enforces minOrderSubtotal threshold at order level', () => {
      const thresholdRule = makeRule({
        id: 'rule-threshold',
        name: '10% Off Over $200',
        ruleType: PricingRuleType.PERCENTAGE_OFF,
        value: 10,
        minOrderSubtotal: 200,
      });

      // Single line: 1 x $100 = $100 subtotal (below $200 threshold)
      const smallLine: OrderLineInput = { serviceId: 'svc-1', category: 'lab', unitPrice: 100, quantity: 1 };
      const smallResult = engine.computeOrderDiscounts([smallLine], [thresholdRule], now);
      expect(smallResult.totalDiscount).toBe(0);
      // Should document why rule was not applicable
      expect(smallResult.lines[0].reasoning.rulesEvaluated[0].applicable).toBe(false);

      // Two lines: 2 x $150 = $300 subtotal (above $200 threshold)
      const bigLine: OrderLineInput = { serviceId: 'svc-1', category: 'lab', unitPrice: 150, quantity: 2 };
      const bigResult = engine.computeOrderDiscounts([bigLine], [thresholdRule], now);
      expect(bigResult.totalDiscount).toBe(30); // 10% of $300
      expect(bigResult.lines[0].reasoning.rulesApplied[0].ruleName).toBe('10% Off Over $200');
    });
  });
});
