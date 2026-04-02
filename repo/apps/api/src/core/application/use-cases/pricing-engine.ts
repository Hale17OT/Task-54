import { PricingRuleEntity } from '../../../infrastructure/persistence/entities/pricing-rule.entity';
import {
  PricingRuleType,
  DiscountReasoning,
  EvaluatedRule,
  ExclusionResolution,
  AppliedRule,
} from '@checc/shared/types/pricing.types';

export interface OrderLineInput {
  serviceId: string;
  category: string;
  unitPrice: number;
  quantity: number;
}

export interface LineDiscountResult {
  discountAmount: number;
  finalPrice: number;
  reasoning: DiscountReasoning;
}

export interface OrderDiscountResult {
  lines: Array<{
    line: OrderLineInput;
    discountAmount: number;
    finalPrice: number;
    reasoning: DiscountReasoning;
  }>;
  totalDiscount: number;
  totalFinal: number;
}

/**
 * Pure pricing engine — no database access.
 * Receives rules and order lines, returns discount results.
 */
export class PricingEngine {
  /**
   * Computes the best price for a single order line.
   *
   * Algorithm:
   * 1. FILTER active rules where:
   *    - is_active = true
   *    - valid_from <= now <= valid_until
   *    - applicable_service_ids is null OR contains line.serviceId
   *    - applicable_categories is null OR contains line.category
   *    - line.quantity >= min_quantity
   *
   * 2. SORT by priority_level ASC (stable sort, tie-break by rule ID)
   *
   * 3. GROUP by exclusion_group (null = standalone, always applied)
   *
   * 4. For each exclusion group:
   *    - Compute the discount each member rule would give
   *    - Select the rule yielding MAXIMUM discount for the patient
   *    - Tie-break: lower priority_level, then lower rule ID
   *
   * 5. Standalone rules (no exclusion group): all are selected
   *
   * 6. APPLY selected rules in priority order:
   *    - percentage_off: discount = unit_price * quantity * value / 100
   *    - fixed_off: discount = value * quantity
   *    - fixed_price: discount = (unit_price - value) * quantity
   *    - buy_x_get_y: discount = floor(quantity / (min_quantity + 1)) * unit_price * value
   *
   * 7. Cap total discount at line subtotal (never negative price)
   *
   * 8. Build reasoning object with full evaluation trace
   *
   * 9. Return { discountAmount, finalPrice, reasoning }
   */
  computeLineDiscount(
    line: OrderLineInput,
    rules: PricingRuleEntity[],
    now: Date,
    orderSubtotal?: number,
  ): LineDiscountResult {
    const lineSubtotal = line.unitPrice * line.quantity;
    const evaluatedRules: EvaluatedRule[] = [];
    const exclusionGroupsResolved: ExclusionResolution[] = [];
    const appliedRules: AppliedRule[] = [];

    // Step 1: FILTER applicable rules
    const applicableRules = rules.filter((rule) => {
      const active = rule.isActive;
      const inDateRange =
        new Date(rule.validFrom) <= now && new Date(rule.validUntil) >= now;
      const matchesService =
        rule.applicableServiceIds === null ||
        rule.applicableServiceIds.length === 0 ||
        rule.applicableServiceIds.includes(line.serviceId);
      const matchesCategory =
        rule.applicableCategories === null ||
        rule.applicableCategories.length === 0 ||
        rule.applicableCategories.includes(line.category);
      const meetsMinQuantity = line.quantity >= rule.minQuantity;
      const meetsMinSubtotal =
        rule.minOrderSubtotal === null ||
        rule.minOrderSubtotal === undefined ||
        (orderSubtotal !== undefined && orderSubtotal >= Number(rule.minOrderSubtotal));

      const applicable =
        active && inDateRange && matchesService && matchesCategory && meetsMinQuantity && meetsMinSubtotal;

      const reasons: string[] = [];
      if (!active) reasons.push('rule is inactive');
      if (!inDateRange) reasons.push('outside valid date range');
      if (!matchesService) reasons.push('service ID does not match');
      if (!matchesCategory) reasons.push('category does not match');
      if (!meetsMinQuantity) reasons.push(`quantity ${line.quantity} < min ${rule.minQuantity}`);
      if (!meetsMinSubtotal) reasons.push(`order subtotal ${orderSubtotal ?? 0} < min ${rule.minOrderSubtotal}`);

      evaluatedRules.push({
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.ruleType as PricingRuleType,
        computedDiscount: applicable
          ? this.computeRuleDiscount(rule, line)
          : 0,
        applicable,
        reason: applicable
          ? 'Rule is applicable'
          : `Not applicable: ${reasons.join(', ')}`,
      });

      return applicable;
    });

    // Step 2: SORT by priority_level ASC, tie-break by rule ID
    const sorted = [...applicableRules].sort((a, b) => {
      if (a.priorityLevel !== b.priorityLevel) {
        return a.priorityLevel - b.priorityLevel;
      }
      return a.id.localeCompare(b.id);
    });

    // Step 3: GROUP by exclusion_group
    const standaloneRules: PricingRuleEntity[] = [];
    const exclusionGroups = new Map<string, PricingRuleEntity[]>();

    for (const rule of sorted) {
      if (rule.exclusionGroup === null || rule.exclusionGroup === '') {
        standaloneRules.push(rule);
      } else {
        const group = exclusionGroups.get(rule.exclusionGroup) || [];
        group.push(rule);
        exclusionGroups.set(rule.exclusionGroup, group);
      }
    }

    // Step 4: For each exclusion group, pick max discount (tie-break: lower priority, then lower ID)
    const selectedFromGroups: PricingRuleEntity[] = [];
    for (const [groupName, groupRules] of exclusionGroups) {
      let winner = groupRules[0];
      let winnerDiscount = this.computeRuleDiscount(winner, line);

      for (let i = 1; i < groupRules.length; i++) {
        const candidate = groupRules[i];
        const candidateDiscount = this.computeRuleDiscount(candidate, line);

        if (
          candidateDiscount > winnerDiscount ||
          (candidateDiscount === winnerDiscount &&
            candidate.priorityLevel < winner.priorityLevel) ||
          (candidateDiscount === winnerDiscount &&
            candidate.priorityLevel === winner.priorityLevel &&
            candidate.id.localeCompare(winner.id) < 0)
        ) {
          winner = candidate;
          winnerDiscount = candidateDiscount;
        }
      }

      selectedFromGroups.push(winner);
      exclusionGroupsResolved.push({
        groupName,
        winnerId: winner.id,
        winnerDiscount,
        reason: `Selected from ${groupRules.length} candidates; max discount = ${winnerDiscount}`,
      });
    }

    // Step 5: Combine standalone + group winners
    const selectedRules = [...standaloneRules, ...selectedFromGroups];

    // Step 6: Sort selected rules by priority order for application
    selectedRules.sort((a, b) => {
      if (a.priorityLevel !== b.priorityLevel) {
        return a.priorityLevel - b.priorityLevel;
      }
      return a.id.localeCompare(b.id);
    });

    // Step 6 continued: APPLY selected rules and sum discounts
    let totalDiscount = 0;
    for (const rule of selectedRules) {
      const discount = this.computeRuleDiscount(rule, line);
      totalDiscount += discount;

      appliedRules.push({
        ruleId: rule.id,
        ruleName: rule.name,
        discountAmount: discount,
        description: `${rule.ruleType}: value=${Number(rule.value)}, discount=${discount}`,
      });
    }

    // Step 7: Cap total discount at line subtotal
    totalDiscount = Math.min(totalDiscount, lineSubtotal);

    const finalPrice = lineSubtotal - totalDiscount;

    // Step 8: Build reasoning
    const reasoning: DiscountReasoning = {
      rulesEvaluated: evaluatedRules,
      exclusionGroupsResolved,
      rulesApplied: appliedRules,
      originalPrice: lineSubtotal,
      totalDiscount,
      finalPrice,
    };

    // Step 9: Return result
    return {
      discountAmount: totalDiscount,
      finalPrice,
      reasoning,
    };
  }

  /**
   * Compute discounts for an entire order (all lines).
   */
  computeOrderDiscounts(
    lines: OrderLineInput[],
    rules: PricingRuleEntity[],
    now?: Date,
  ): OrderDiscountResult {
    const effectiveNow = now || new Date();
    const orderSubtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    let totalDiscount = 0;
    let totalFinal = 0;

    const lineResults = lines.map((line) => {
      const result = this.computeLineDiscount(line, rules, effectiveNow, orderSubtotal);
      totalDiscount += result.discountAmount;
      totalFinal += result.finalPrice;
      return {
        line,
        discountAmount: result.discountAmount,
        finalPrice: result.finalPrice,
        reasoning: result.reasoning,
      };
    });

    return {
      lines: lineResults,
      totalDiscount,
      totalFinal,
    };
  }

  /**
   * Compute the discount a single rule would yield for a given line.
   */
  private computeRuleDiscount(
    rule: PricingRuleEntity,
    line: OrderLineInput,
  ): number {
    const value = Number(rule.value);
    const unitPrice = line.unitPrice;
    const quantity = line.quantity;

    switch (rule.ruleType) {
      case PricingRuleType.PERCENTAGE_OFF:
        return unitPrice * quantity * value / 100;

      case PricingRuleType.FIXED_OFF:
        return value * quantity;

      case PricingRuleType.FIXED_PRICE:
        return Math.max(0, (unitPrice - value) * quantity);

      case PricingRuleType.BUY_X_GET_Y:
        return Math.floor(quantity / (rule.minQuantity + 1)) * unitPrice * value;

      default:
        return 0;
    }
  }
}
