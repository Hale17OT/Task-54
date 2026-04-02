import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnomalyDetectorService } from '../src/core/application/use-cases/anomaly-detector.service';
import { RiskEventEntity } from '../src/infrastructure/persistence/entities/risk-event.entity';
import { IncidentTicketEntity } from '../src/infrastructure/persistence/entities/incident-ticket.entity';
import { RefundEntity } from '../src/infrastructure/persistence/entities/refund.entity';
import { LoginAttemptEntity } from '../src/infrastructure/persistence/entities/login-attempt.entity';
import { DiscountAuditEntity } from '../src/infrastructure/persistence/entities/discount-audit.entity';

describe('AnomalyDetectorService', () => {
  let service: AnomalyDetectorService;
  let riskEventRepo: Record<string, jest.Mock>;
  let incidentRepo: Record<string, jest.Mock>;
  let refundRepo: Record<string, jest.Mock>;
  let loginAttemptRepo: Record<string, jest.Mock>;
  let discountAuditGetCount: jest.Mock;

  const userId = 'user-uuid-1';
  const testIp = '10.0.0.5';

  beforeEach(async () => {
    riskEventRepo = {
      create: jest.fn().mockImplementation((data) => ({
        ...data,
        id: 'event-uuid-1',
        detectedAt: new Date(),
      })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      count: jest.fn().mockResolvedValue(0),
    };

    incidentRepo = {
      create: jest.fn().mockImplementation((data) => ({
        ...data,
        id: 'incident-uuid-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    refundRepo = {
      count: jest.fn().mockResolvedValue(0),
    };

    loginAttemptRepo = {
      count: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnomalyDetectorService,
        { provide: getRepositoryToken(RiskEventEntity), useValue: riskEventRepo },
        { provide: getRepositoryToken(IncidentTicketEntity), useValue: incidentRepo },
        { provide: getRepositoryToken(RefundEntity), useValue: refundRepo },
        { provide: getRepositoryToken(LoginAttemptEntity), useValue: loginAttemptRepo },
        { provide: getRepositoryToken(DiscountAuditEntity), useFactory: () => { discountAuditGetCount = jest.fn().mockResolvedValue(0); return { createQueryBuilder: jest.fn().mockReturnValue({ innerJoin: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getCount: discountAuditGetCount }) }; } },
      ],
    }).compile();

    service = module.get<AnomalyDetectorService>(AnomalyDetectorService);
  });

  describe('checkPromoAbuse', () => {
    it('should detect promo abuse above threshold', async () => {
      discountAuditGetCount.mockResolvedValue(5);

      const result = await service.checkPromoAbuse(userId);

      expect(result).toBe(true);
      expect(riskEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'promo_abuse',
          severity: 'high',
        }),
      );
      expect(incidentRepo.create).toHaveBeenCalled();
    });

    it('should not alert below threshold', async () => {
      riskEventRepo.count.mockResolvedValue(2);

      const result = await service.checkPromoAbuse(userId);

      expect(result).toBe(false);
      expect(riskEventRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('checkBulkRegistration', () => {
    it('should detect bulk registration from same IP', async () => {
      loginAttemptRepo.count.mockResolvedValue(3);

      const result = await service.checkBulkRegistration(testIp);

      expect(result).toBe(true);
      expect(riskEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'bulk_registration',
          severity: 'medium',
        }),
      );
      expect(incidentRepo.create).toHaveBeenCalled();
    });
  });

  describe('checkRepeatedRefunds', () => {
    it('should detect repeated refunds', async () => {
      refundRepo.count.mockResolvedValue(3);

      const result = await service.checkRepeatedRefunds(userId);

      expect(result).toBe(true);
      expect(riskEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'repeated_refund',
          severity: 'medium',
        }),
      );
    });
  });
});
