import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PricingRuleEntity } from '../../../infrastructure/persistence/entities/pricing-rule.entity';
import { DiscountAuditEntity } from '../../../infrastructure/persistence/entities/discount-audit.entity';
import { OrderEntity } from '../../../infrastructure/persistence/entities/order.entity';
import { OrderLineEntity } from '../../../infrastructure/persistence/entities/order-line.entity';
import { CatalogServiceEntity } from '../../../infrastructure/persistence/entities/catalog-service.entity';
import { PricingEngine, OrderLineInput } from './pricing-engine';
import { AnomalyDetectorService } from './anomaly-detector.service';
import { ErrorCodes } from '@checc/shared/constants/error-codes';
import { WinstonLogger } from '../../../infrastructure/logging/winston.logger';
import type { CreatePricingRuleInput, UpdatePricingRuleInput } from '@checc/shared/schemas/pricing.schema';

@Injectable()
export class PricingService {
  private readonly logger = new WinstonLogger();
  private readonly pricingEngine = new PricingEngine();

  constructor(
    @InjectRepository(PricingRuleEntity)
    private readonly ruleRepo: Repository<PricingRuleEntity>,
    @InjectRepository(DiscountAuditEntity)
    private readonly auditRepo: Repository<DiscountAuditEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderLineEntity)
    private readonly orderLineRepo: Repository<OrderLineEntity>,
    @InjectRepository(CatalogServiceEntity)
    private readonly catalogRepo: Repository<CatalogServiceEntity>,
    private readonly anomalyDetector: AnomalyDetectorService,
  ) {}

  async createRule(input: CreatePricingRuleInput, userId: string) {
    const rule = this.ruleRepo.create({
      name: input.name,
      description: input.description || '',
      ruleType: input.ruleType,
      priorityLevel: input.priorityLevel,
      value: input.value,
      minQuantity: input.minQuantity ?? 1,
      minOrderSubtotal: input.minOrderSubtotal ?? null,
      applicableServiceIds: input.applicableServiceIds || null,
      applicableCategories: input.applicableCategories || null,
      exclusionGroup: input.exclusionGroup || null,
      validFrom: new Date(input.validFrom),
      validUntil: new Date(input.validUntil),
      isActive: true,
      createdBy: userId,
    });

    const saved = await this.ruleRepo.save(rule);
    this.logger.log(`Pricing rule created: ${saved.id}`, 'PricingService');
    return this.toRuleDto(saved);
  }

  async updateRule(id: string, input: UpdatePricingRuleInput) {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException({
        message: 'Pricing rule not found',
        errorCode: ErrorCodes.PRICING_RULE_NOT_FOUND,
      });
    }

    if (input.name !== undefined) rule.name = input.name;
    if (input.description !== undefined) rule.description = input.description;
    if (input.ruleType !== undefined) rule.ruleType = input.ruleType;
    if (input.priorityLevel !== undefined) rule.priorityLevel = input.priorityLevel;
    if (input.value !== undefined) rule.value = input.value;
    if (input.minQuantity !== undefined) rule.minQuantity = input.minQuantity;
    if (input.minOrderSubtotal !== undefined) rule.minOrderSubtotal = input.minOrderSubtotal ?? null;
    if (input.applicableServiceIds !== undefined)
      rule.applicableServiceIds = input.applicableServiceIds || null;
    if (input.applicableCategories !== undefined)
      rule.applicableCategories = input.applicableCategories || null;
    if (input.exclusionGroup !== undefined)
      rule.exclusionGroup = input.exclusionGroup || null;
    if (input.validFrom !== undefined) rule.validFrom = new Date(input.validFrom);
    if (input.validUntil !== undefined) rule.validUntil = new Date(input.validUntil);

    const saved = await this.ruleRepo.save(rule);
    this.logger.log(`Pricing rule updated: ${saved.id}`, 'PricingService');
    return this.toRuleDto(saved);
  }

  async deleteRule(id: string) {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException({
        message: 'Pricing rule not found',
        errorCode: ErrorCodes.PRICING_RULE_NOT_FOUND,
      });
    }

    rule.isActive = false;
    await this.ruleRepo.save(rule);
    this.logger.log(`Pricing rule deactivated: ${id}`, 'PricingService');
    return { message: 'Pricing rule deactivated' };
  }

  async listRules(page: number, limit: number, activeOnly?: boolean) {
    const where: Record<string, unknown> = {};
    if (activeOnly) {
      where.isActive = true;
    }

    const [items, total] = await this.ruleRepo.findAndCount({
      where,
      order: { priorityLevel: 'ASC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: items.map((r) => this.toRuleDto(r)),
      total,
      page,
      limit,
    };
  }

  async computeForOrder(orderLines: OrderLineInput[]) {
    const activeRules = await this.getActiveRules();
    const result = this.pricingEngine.computeOrderDiscounts(
      orderLines,
      activeRules,
    );
    return result;
  }

  async applyToOrder(orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['lines', 'lines.service'],
    });

    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        errorCode: ErrorCodes.ORDER_NOT_FOUND,
      });
    }

    const activeRules = await this.getActiveRules();

    const lines: OrderLineInput[] = order.lines.map((line) => ({
      serviceId: line.serviceId,
      category: line.service?.category || '',
      unitPrice: Number(line.unitPrice),
      quantity: line.quantity,
    }));

    const result = this.pricingEngine.computeOrderDiscounts(lines, activeRules);

    let orderDiscountTotal = 0;

    // Update each order line and write audit trail
    for (let i = 0; i < order.lines.length; i++) {
      const lineResult = result.lines[i];
      const orderLine = order.lines[i];

      orderLine.discountAmount = lineResult.discountAmount;
      orderLine.lineTotal = lineResult.finalPrice;
      orderLine.discountReason = JSON.stringify(lineResult.reasoning);
      await this.orderLineRepo.save(orderLine);

      orderDiscountTotal += lineResult.discountAmount;

      // Determine the primary pricing rule ID (first applied rule, if any)
      const primaryRuleId =
        lineResult.reasoning.rulesApplied.length > 0
          ? lineResult.reasoning.rulesApplied[0].ruleId
          : null;

      // IMMUTABLE insert — never update audit records
      const audit = this.auditRepo.create({
        orderId: order.id,
        orderLineId: orderLine.id,
        pricingRuleId: primaryRuleId,
        originalPrice: lineResult.reasoning.originalPrice,
        discountAmount: lineResult.discountAmount,
        finalPrice: lineResult.finalPrice,
        reasoning: lineResult.reasoning,
        computedAt: new Date(),
      });
      await this.auditRepo.save(audit);
    }

    // Update order totals
    order.discountTotal = orderDiscountTotal;
    order.finalTotal = Number(order.subtotal) - orderDiscountTotal;
    await this.orderRepo.save(order);

    this.logger.log(
      `Pricing applied to order ${order.id}: discount=${orderDiscountTotal}`,
      'PricingService',
    );

    // Check for promo abuse when discounts were applied
    if (orderDiscountTotal > 0 && order.patientId) {
      this.anomalyDetector.checkPromoAbuse(order.patientId).catch(() => {});
    }

    return {
      orderId: order.id,
      subtotal: Number(order.subtotal),
      discountTotal: orderDiscountTotal,
      finalTotal: order.finalTotal,
      lines: result.lines,
    };
  }

  async getAuditTrail(orderId: string) {
    const audits = await this.auditRepo.find({
      where: { orderId },
      order: { computedAt: 'DESC' },
    });
    return audits.map((a) => ({
      id: a.id,
      orderId: a.orderId,
      orderLineId: a.orderLineId,
      pricingRuleId: a.pricingRuleId,
      originalPrice: Number(a.originalPrice),
      discountAmount: Number(a.discountAmount),
      finalPrice: Number(a.finalPrice),
      reasoning: a.reasoning,
      computedAt: a.computedAt.toISOString(),
    }));
  }

  private async getActiveRules(): Promise<PricingRuleEntity[]> {
    return this.ruleRepo.find({
      where: { isActive: true },
      order: { priorityLevel: 'ASC' },
    });
  }

  private toRuleDto(rule: PricingRuleEntity) {
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      ruleType: rule.ruleType,
      priorityLevel: rule.priorityLevel,
      value: Number(rule.value),
      minQuantity: rule.minQuantity,
      minOrderSubtotal: rule.minOrderSubtotal ? Number(rule.minOrderSubtotal) : null,
      applicableServiceIds: rule.applicableServiceIds,
      applicableCategories: rule.applicableCategories,
      exclusionGroup: rule.exclusionGroup,
      validFrom: rule.validFrom.toISOString(),
      validUntil: rule.validUntil.toISOString(),
      isActive: rule.isActive,
      createdBy: rule.createdBy,
      createdAt: rule.createdAt.toISOString(),
    };
  }
}
