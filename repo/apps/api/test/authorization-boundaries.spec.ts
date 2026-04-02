import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EnrollmentService } from '../src/core/application/use-cases/enrollment.service';
import { OrderService } from '../src/core/application/use-cases/order.service';
import { PaymentService } from '../src/core/application/use-cases/payment.service';
import { ContentService } from '../src/core/application/use-cases/content.service';
import { SignatureService } from '../src/core/application/use-cases/signature.service';
import { EnrollmentEntity } from '../src/infrastructure/persistence/entities/enrollment.entity';
import { EnrollmentServiceLineEntity } from '../src/infrastructure/persistence/entities/enrollment-service-line.entity';
import { CatalogServiceEntity } from '../src/infrastructure/persistence/entities/catalog-service.entity';
import { SeatReservationEntity } from '../src/infrastructure/persistence/entities/seat-reservation.entity';
import { OrderEntity } from '../src/infrastructure/persistence/entities/order.entity';
import { OrderLineEntity } from '../src/infrastructure/persistence/entities/order-line.entity';
import { PaymentEntity } from '../src/infrastructure/persistence/entities/payment.entity';
import { RefundEntity } from '../src/infrastructure/persistence/entities/refund.entity';
import { EnrollmentEntity as EnrollmentEnt2 } from '../src/infrastructure/persistence/entities/enrollment.entity';
import { ArticleEntity } from '../src/infrastructure/persistence/entities/article.entity';
import { ArticleVersionEntity } from '../src/infrastructure/persistence/entities/article-version.entity';
import { MediaAssetEntity } from '../src/infrastructure/persistence/entities/media-asset.entity';
import { HealthCheckEntity } from '../src/infrastructure/persistence/entities/health-check.entity';
import { HealthCheckVersionEntity } from '../src/infrastructure/persistence/entities/health-check-version.entity';
import { ReportSignatureEntity } from '../src/infrastructure/persistence/entities/report-signature.entity';
import { AuthService } from '../src/core/application/use-cases/auth.service';
import { PricingService } from '../src/core/application/use-cases/pricing.service';
import { AnomalyDetectorService } from '../src/core/application/use-cases/anomaly-detector.service';
import { SensitiveWordService } from '../src/core/application/use-cases/sensitive-word.service';
import { PdfExportService } from '../src/infrastructure/pdf/pdf-export.service';
import { EnrollmentStatus } from '@checc/shared/types/enrollment.types';
import { OrderStatus } from '@checc/shared/types/order.types';
import { PaymentStatus } from '@checc/shared/types/payment.types';
import { HealthCheckStatus } from '@checc/shared/types/health-check.types';
import { ContentStatus } from '@checc/shared/types/content.types';
import { UserRole } from '@checc/shared/constants/roles';

/**
 * Authorization Boundary Tests
 *
 * These verify 403 Forbidden / ownership-check behavior at the service layer,
 * ensuring cross-user access is blocked for all patient-scoped resources.
 */
describe('Authorization Boundaries', () => {
  const patientA = 'patient-a-uuid';
  const patientB = 'patient-b-uuid';
  const staffUser = 'staff-uuid';

  describe('Enrollment ownership', () => {
    let service: EnrollmentService;
    let enrollmentRepo: Record<string, jest.Mock>;

    beforeEach(async () => {
      enrollmentRepo = {
        findOne: jest.fn(),
        findAndCount: jest.fn().mockResolvedValue([[], 0]),
        save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
        create: jest.fn().mockImplementation((d) => d),
      };

      const mockDataSource = {
        transaction: jest.fn().mockImplementation(async (cb: Function) => {
          const manager = {
            findOne: jest.fn().mockImplementation((_entity: any, opts: any) => enrollmentRepo.findOne(opts)),
            find: jest.fn(),
            create: jest.fn().mockImplementation((_entity: any, d: any) => d),
            save: jest.fn().mockImplementation((_entity: any, d: any) => Promise.resolve(d)),
            count: jest.fn().mockResolvedValue(0),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
          };
          return cb(manager);
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EnrollmentService,
          { provide: getRepositoryToken(EnrollmentEntity), useValue: enrollmentRepo },
          { provide: getRepositoryToken(EnrollmentServiceLineEntity), useValue: { find: jest.fn().mockResolvedValue([]), save: jest.fn(), delete: jest.fn(), create: jest.fn() } },
          { provide: getRepositoryToken(CatalogServiceEntity), useValue: { find: jest.fn().mockResolvedValue([]) } },
          { provide: getRepositoryToken(SeatReservationEntity), useValue: { count: jest.fn().mockResolvedValue(0), save: jest.fn(), create: jest.fn(), update: jest.fn() } },
          { provide: getRepositoryToken(OrderEntity), useValue: { create: jest.fn(), save: jest.fn() } },
          { provide: getRepositoryToken(OrderLineEntity), useValue: { create: jest.fn(), save: jest.fn() } },
          { provide: PricingService, useValue: { applyToOrder: jest.fn() } },
          { provide: DataSource, useValue: mockDataSource },
        ],
      }).compile();

      service = module.get<EnrollmentService>(EnrollmentService);
    });

    it('should reject update by non-owner patient', async () => {
      enrollmentRepo.findOne.mockResolvedValue({
        id: 'enr-1', patientId: patientA, status: EnrollmentStatus.DRAFT,
        serviceLines: [], createdAt: new Date(), updatedAt: new Date(),
      });

      await expect(
        service.update('enr-1', patientB, { notes: 'hacked' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject submit by non-owner patient', async () => {
      enrollmentRepo.findOne.mockResolvedValue({
        id: 'enr-1', patientId: patientA, status: EnrollmentStatus.DRAFT,
        serviceLines: [{ serviceId: 's1', quantity: 1 }],
        createdAt: new Date(), updatedAt: new Date(),
      });

      await expect(
        service.submit('enr-1', patientB),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow owner to update their enrollment', async () => {
      enrollmentRepo.findOne.mockResolvedValue({
        id: 'enr-1', patientId: patientA, status: EnrollmentStatus.DRAFT,
        notes: 'old', serviceLines: [], createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.update('enr-1', patientA, { notes: 'new' });
      expect(result.notes).toBe('new');
    });
  });

  describe('Payment ownership', () => {
    let service: PaymentService;
    let paymentRepo: Record<string, jest.Mock>;
    let orderRepo: Record<string, jest.Mock>;

    beforeEach(async () => {
      paymentRepo = {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
        findAndCount: jest.fn().mockResolvedValue([[], 0]),
        save: jest.fn(), create: jest.fn(),
      };
      orderRepo = {
        findOne: jest.fn(),
        save: jest.fn(),
      };

      const mockPaymentDataSource = {
        transaction: jest.fn().mockImplementation(async (cb: Function) => {
          const manager = {
            findOne: jest.fn().mockImplementation((entity: any, opts: any) => {
              const name = entity.name || entity;
              if (name === 'OrderEntity') return orderRepo.findOne(opts);
              if (name === 'PaymentEntity') return paymentRepo.findOne(opts);
              return jest.fn()(opts);
            }),
            save: jest.fn().mockImplementation((_entity: any, d: any) => Promise.resolve(d)),
            create: jest.fn().mockImplementation((_entity: any, d: any) => d),
          };
          return cb(manager);
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaymentService,
          { provide: getRepositoryToken(PaymentEntity), useValue: paymentRepo },
          { provide: getRepositoryToken(RefundEntity), useValue: { create: jest.fn(), save: jest.fn() } },
          { provide: getRepositoryToken(OrderEntity), useValue: orderRepo },
          { provide: getRepositoryToken(EnrollmentEnt2), useValue: { findOne: jest.fn(), save: jest.fn() } },
          { provide: AuthService, useValue: { verifyCredentials: jest.fn() } },
          { provide: AnomalyDetectorService, useValue: { checkRepeatedRefunds: jest.fn() } },
          { provide: DataSource, useValue: mockPaymentDataSource },
        ],
      }).compile();

      service = module.get<PaymentService>(PaymentService);
    });

    it('should reject patient viewing another patient\'s order payments', async () => {
      orderRepo.findOne.mockResolvedValue({ id: 'ord-1', patientId: patientA });

      await expect(
        service.getPaymentsByOrder('ord-1', { id: patientB, role: 'patient' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow patient to view their own order payments', async () => {
      orderRepo.findOne.mockResolvedValue({ id: 'ord-1', patientId: patientA });
      paymentRepo.find.mockResolvedValue([]);

      const result = await service.getPaymentsByOrder('ord-1', { id: patientA, role: 'patient' });
      expect(result).toEqual([]);
    });

    it('should allow staff to view any order payments', async () => {
      orderRepo.findOne.mockResolvedValue({ id: 'ord-1', patientId: patientA });
      paymentRepo.find.mockResolvedValue([]);

      const result = await service.getPaymentsByOrder('ord-1', { id: staffUser, role: 'staff' });
      expect(result).toEqual([]);
    });

    it('should reject patient viewing payment for another patient\'s order', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: 'pay-1', orderId: 'ord-1' });
      orderRepo.findOne.mockResolvedValue({ id: 'ord-1', patientId: patientA });

      await expect(
        service.getPaymentById('pay-1', { id: patientB, role: 'patient' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Content ownership', () => {
    let service: ContentService;
    let articleRepo: Record<string, jest.Mock>;

    beforeEach(async () => {
      articleRepo = {
        findOne: jest.fn(),
        findAndCount: jest.fn().mockResolvedValue([[], 0]),
        save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
        create: jest.fn().mockImplementation((d) => d),
      };

      const mockContentDataSource = {
        transaction: jest.fn().mockImplementation(async (cb: Function) => {
          const manager = {
            findOne: jest.fn().mockImplementation((_entity: any, opts: any) => articleRepo.findOne(opts)),
            save: jest.fn().mockImplementation((_entity: any, d: any) => articleRepo.save(d)),
            create: jest.fn().mockImplementation((_entity: any, d: any) => articleRepo.create(d)),
          };
          return cb(manager);
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ContentService,
          { provide: getRepositoryToken(ArticleEntity), useValue: articleRepo },
          { provide: getRepositoryToken(ArticleVersionEntity), useValue: { create: jest.fn().mockImplementation((d) => d), save: jest.fn(), find: jest.fn().mockResolvedValue([]) } },
          { provide: getRepositoryToken(MediaAssetEntity), useValue: { create: jest.fn(), save: jest.fn(), count: jest.fn().mockResolvedValue(0) } },
          { provide: SensitiveWordService, useValue: { scan: jest.fn().mockResolvedValue([]) } },
          { provide: DataSource, useValue: mockContentDataSource },
        ],
      }).compile();

      service = module.get<ContentService>(ContentService);
    });

    it('should reject update by non-author', async () => {
      articleRepo.findOne.mockResolvedValue({
        id: 'art-1', authorId: patientA, status: ContentStatus.DRAFT,
        title: 'Test', slug: 'test', body: 'body',
      });

      await expect(
        service.update('art-1', { title: 'Hacked' }, patientB),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject submitForReview by non-author', async () => {
      articleRepo.findOne.mockResolvedValue({
        id: 'art-1', authorId: patientA, status: ContentStatus.DRAFT,
      });

      await expect(
        service.submitForReview('art-1', patientB),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should only return published articles via getBySlug', async () => {
      articleRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getBySlug('draft-article-slug'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Signature identity binding', () => {
    let service: SignatureService;
    let authService: Record<string, jest.Mock>;

    beforeEach(async () => {
      authService = {
        verifyCredentials: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SignatureService,
          { provide: getRepositoryToken(HealthCheckEntity), useValue: { findOne: jest.fn(), save: jest.fn() } },
          { provide: getRepositoryToken(HealthCheckVersionEntity), useValue: { findOne: jest.fn(), save: jest.fn() } },
          { provide: getRepositoryToken(ReportSignatureEntity), useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn().mockImplementation((d) => d) } },
          { provide: AuthService, useValue: authService },
          { provide: PdfExportService, useValue: { generateReport: jest.fn() } },
        ],
      }).compile();

      service = module.get<SignatureService>(SignatureService);
    });

    it('should reject signing when credentials belong to different user than JWT', async () => {
      const reviewerA = { id: 'reviewer-a', username: 'rev_a', role: UserRole.REVIEWER };
      authService.verifyCredentials.mockResolvedValue(reviewerA);

      await expect(
        service.sign('hc-1', { username: 'rev_a', password: 'pass', versionNumber: 1 }, '127.0.0.1', 'reviewer-b-jwt'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject signing by non-reviewer role', async () => {
      const staffUser = { id: 'staff-1', username: 'staff', role: UserRole.STAFF };
      authService.verifyCredentials.mockResolvedValue(staffUser);

      await expect(
        service.sign('hc-1', { username: 'staff', password: 'pass', versionNumber: 1 }, '127.0.0.1', 'staff-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
