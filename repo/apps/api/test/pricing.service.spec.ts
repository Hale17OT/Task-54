import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PricingService } from '../src/core/application/use-cases/pricing.service';
import { PricingRuleEntity } from '../src/infrastructure/persistence/entities/pricing-rule.entity';
import { DiscountAuditEntity } from '../src/infrastructure/persistence/entities/discount-audit.entity';
import { OrderEntity } from '../src/infrastructure/persistence/entities/order.entity';
import { OrderLineEntity } from '../src/infrastructure/persistence/entities/order-line.entity';
import { CatalogServiceEntity } from '../src/infrastructure/persistence/entities/catalog-service.entity';
import { AnomalyDetectorService } from '../src/core/application/use-cases/anomaly-detector.service';
import { PricingRuleType } from '@checc/shared/types/pricing.types';

describe('PricingService', () => {
  let service: PricingService;
  let ruleRepo: Record<string, jest.Mock>;
  let auditRepo: Record<string, jest.Mock>;
  let orderRepo: Record<string, jest.Mock>;
  let orderLineRepo: Record<string, jest.Mock>;
  let catalogRepo: Record<string, jest.Mock>;

  const adminId = 'admin-uuid-1';

  const mockRule: Partial<PricingRuleEntity> = {
    id: 'rule-uuid-1',
    name: '10% Off Lab',
    description: '10 percent off all lab services',
    ruleType: PricingRuleType.PERCENTAGE_OFF,
    priorityLevel: 1,
    value: 10,
    minQuantity: 1,
    applicableServiceIds: null,
    applicableCategories: ['lab'],
    exclusionGroup: null,
    validFrom: new Date('2026-01-01T00:00:00Z'),
    validUntil: new Date('2026-12-31T23:59:59Z'),
    isActive: true,
    createdBy: adminId,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockOrder = {
    id: 'order-uuid-1',
    orderNumber: 'ORD-0001',
    enrollmentId: 'enrollment-uuid-1',
    patientId: 'patient-uuid-1',
    status: 'PENDING_PAYMENT',
    subtotal: 200,
    discountTotal: 0,
    finalTotal: 200,
    lines: [
      {
        id: 'line-uuid-1',
        orderId: 'order-uuid-1',
        serviceId: 'service-uuid-1',
        quantity: 2,
        unitPrice: 100,
        discountAmount: 0,
        lineTotal: 200,
        discountReason: null,
        service: {
          id: 'service-uuid-1',
          code: 'LAB-001',
          name: 'Blood Test',
          category: 'lab',
          basePrice: 100,
          isActive: true,
        },
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    ruleRepo = {
      create: jest.fn().mockImplementation((data) => ({
        ...data,
        id: 'rule-uuid-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      })),
      save: jest.fn().mockImplementation((data) =>
        Promise.resolve({ ...mockRule, ...data }),
      ),
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[mockRule], 1]),
      find: jest.fn().mockResolvedValue([mockRule]),
    };

    auditRepo = {
      create: jest.fn().mockImplementation((data) => ({
        ...data,
        id: 'audit-uuid-1',
      })),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      find: jest.fn().mockResolvedValue([]),
    };

    orderRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    };

    orderLineRepo = {
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    };

    catalogRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: getRepositoryToken(PricingRuleEntity), useValue: ruleRepo },
        { provide: getRepositoryToken(DiscountAuditEntity), useValue: auditRepo },
        { provide: getRepositoryToken(OrderEntity), useValue: orderRepo },
        { provide: getRepositoryToken(OrderLineEntity), useValue: orderLineRepo },
        { provide: getRepositoryToken(CatalogServiceEntity), useValue: catalogRepo },
        { provide: AnomalyDetectorService, useValue: { checkPromoAbuse: jest.fn().mockResolvedValue(false) } },
      ],
    }).compile();

    service = module.get<PricingService>(PricingService);
  });

  describe('createRule', () => {
    it('should create a pricing rule with valid input', async () => {
      const input = {
        name: '10% Off Lab',
        description: '10 percent off all lab services',
        ruleType: PricingRuleType.PERCENTAGE_OFF,
        priorityLevel: 1,
        value: 10,
        minQuantity: 1,
        applicableCategories: ['lab'],
        validFrom: '2026-01-01T00:00:00Z',
        validUntil: '2026-12-31T23:59:59Z',
      };

      const result = await service.createRule(input, adminId);

      expect(ruleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '10% Off Lab',
          ruleType: PricingRuleType.PERCENTAGE_OFF,
          value: 10,
          createdBy: adminId,
        }),
      );
      expect(ruleRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('10% Off Lab');
      expect(result.isActive).toBe(true);
    });
  });

  describe('listRules', () => {
    it('should list active rules with pagination', async () => {
      const result = await service.listRules(1, 20, true);

      expect(ruleRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should list all rules when activeOnly is not set', async () => {
      await service.listRules(1, 20);

      expect(ruleRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });
  });

  describe('deleteRule', () => {
    it('should soft-delete (deactivate) a rule', async () => {
      ruleRepo.findOne.mockResolvedValue({ ...mockRule });

      const result = await service.deleteRule('rule-uuid-1');

      expect(ruleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
      expect(result.message).toBe('Pricing rule deactivated');
    });

    it('should throw NotFoundException when rule does not exist', async () => {
      ruleRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteRule('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('computeForOrder', () => {
    it('should compute pricing for order lines using active rules', async () => {
      const orderLines = [
        {
          serviceId: 'service-uuid-1',
          category: 'lab',
          unitPrice: 100,
          quantity: 2,
        },
      ];

      const result = await service.computeForOrder(orderLines);

      expect(ruleRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
      expect(result.lines).toHaveLength(1);
      // With the 10% rule on lab: discount = 100 * 2 * 10/100 = 20
      expect(result.totalDiscount).toBe(20);
      expect(result.totalFinal).toBe(180);
    });
  });

  describe('applyToOrder', () => {
    it('should compute discounts, update order lines, and write audit trail', async () => {
      orderRepo.findOne.mockResolvedValue({ ...mockOrder, lines: [...mockOrder.lines] });

      const result = await service.applyToOrder('order-uuid-1');

      // Should update the order line with discount
      expect(orderLineRepo.save).toHaveBeenCalled();

      // Should write audit trail (IMMUTABLE insert)
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-uuid-1',
          orderLineId: 'line-uuid-1',
        }),
      );
      expect(auditRepo.save).toHaveBeenCalled();

      // Should update order totals
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          discountTotal: expect.any(Number),
        }),
      );

      expect(result.orderId).toBe('order-uuid-1');
      expect(result.discountTotal).toBe(20);
      expect(result.finalTotal).toBe(180);
    });

    it('should throw NotFoundException when order does not exist', async () => {
      orderRepo.findOne.mockResolvedValue(null);

      await expect(service.applyToOrder('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAuditTrail', () => {
    it('should return audit trail for an order', async () => {
      const mockAudit = {
        id: 'audit-uuid-1',
        orderId: 'order-uuid-1',
        orderLineId: 'line-uuid-1',
        pricingRuleId: 'rule-uuid-1',
        originalPrice: 200,
        discountAmount: 20,
        finalPrice: 180,
        reasoning: { rulesEvaluated: [], exclusionGroupsResolved: [], rulesApplied: [], originalPrice: 200, totalDiscount: 20, finalPrice: 180 },
        computedAt: new Date('2026-03-15T12:00:00Z'),
      };
      auditRepo.find.mockResolvedValue([mockAudit]);

      const result = await service.getAuditTrail('order-uuid-1');

      expect(auditRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderId: 'order-uuid-1' },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].orderId).toBe('order-uuid-1');
      expect(result[0].discountAmount).toBe(20);
    });
  });

  describe('updateRule', () => {
    it('should update rule fields', async () => {
      ruleRepo.findOne.mockResolvedValue({ ...mockRule });

      const result = await service.updateRule('rule-uuid-1', {
        name: 'Updated Rule Name',
        value: 15,
      });

      expect(ruleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Rule Name',
          value: 15,
        }),
      );
      expect(result.name).toBe('Updated Rule Name');
    });

    it('should throw NotFoundException when rule does not exist', async () => {
      ruleRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateRule('nonexistent', { name: 'Foo' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
