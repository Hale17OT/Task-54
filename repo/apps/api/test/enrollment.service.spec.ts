import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EnrollmentService } from '../src/core/application/use-cases/enrollment.service';
import { EnrollmentEntity } from '../src/infrastructure/persistence/entities/enrollment.entity';
import { EnrollmentServiceLineEntity } from '../src/infrastructure/persistence/entities/enrollment-service-line.entity';
import { CatalogServiceEntity } from '../src/infrastructure/persistence/entities/catalog-service.entity';
import { SeatReservationEntity } from '../src/infrastructure/persistence/entities/seat-reservation.entity';
import { OrderEntity } from '../src/infrastructure/persistence/entities/order.entity';
import { OrderLineEntity } from '../src/infrastructure/persistence/entities/order-line.entity';
import { PricingService } from '../src/core/application/use-cases/pricing.service';
import { EnrollmentStatus } from '@checc/shared/types/enrollment.types';

describe('EnrollmentService', () => {
  let service: EnrollmentService;
  let enrollmentRepo: Record<string, jest.Mock>;
  let serviceLineRepo: Record<string, jest.Mock>;
  let catalogRepo: Record<string, jest.Mock>;
  let seatRepo: Record<string, jest.Mock>;
  let orderRepo: Record<string, jest.Mock>;
  let orderLineRepo: Record<string, jest.Mock>;
  let pricingService: { applyToOrder: jest.Mock };

  const patientId = 'patient-uuid-1';
  const otherPatientId = 'patient-uuid-2';

  const mockCatalogService = {
    id: 'service-uuid-1',
    code: 'SVC-001',
    name: 'Blood Test',
    description: 'Standard blood test',
    basePrice: 50.0,
    category: 'lab',
    isActive: true,
    maxSeats: 10,
    createdAt: new Date(),
  };

  const mockEnrollment = {
    id: 'enrollment-uuid-1',
    patientId,
    status: EnrollmentStatus.DRAFT,
    enrollmentDate: null,
    notes: 'Test enrollment',
    createdAt: new Date(),
    updatedAt: new Date(),
    submittedAt: null,
    serviceLines: [
      {
        id: 'line-uuid-1',
        enrollmentId: 'enrollment-uuid-1',
        serviceId: 'service-uuid-1',
        quantity: 2,
        createdAt: new Date(),
        service: mockCatalogService,
      },
    ],
  };

  beforeEach(async () => {
    enrollmentRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'enrollment-uuid-1', createdAt: new Date(), updatedAt: new Date() })),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ ...mockEnrollment, ...data })),
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[mockEnrollment], 1]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    serviceLineRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'line-uuid-new', createdAt: new Date() })),
      save: jest.fn().mockImplementation((data) => Promise.resolve(Array.isArray(data) ? data : [data])),
      find: jest.fn().mockResolvedValue(mockEnrollment.serviceLines),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    catalogRepo = {
      find: jest.fn().mockResolvedValue([mockCatalogService]),
      findOne: jest.fn().mockResolvedValue(mockCatalogService),
    };

    seatRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'seat-uuid-1' })),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    orderRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'order-uuid-1' })),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, id: data.id || 'order-uuid-1' })),
    };

    orderLineRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'order-line-uuid-1' })),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    };

    const repoMap: Record<string, Record<string, jest.Mock>> = {
      EnrollmentEntity: enrollmentRepo,
      EnrollmentServiceLineEntity: serviceLineRepo,
      CatalogServiceEntity: catalogRepo,
      SeatReservationEntity: seatRepo,
      OrderEntity: orderRepo,
      OrderLineEntity: orderLineRepo,
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb: Function) => {
        const manager = {
          findOne: jest.fn().mockImplementation((entity: any, opts: any) => {
            const name = entity.name || entity;
            return (repoMap[name]?.findOne ?? jest.fn())(opts);
          }),
          find: jest.fn().mockImplementation((entity: any, opts: any) => {
            const name = entity.name || entity;
            return (repoMap[name]?.find ?? jest.fn())(opts);
          }),
          create: jest.fn().mockImplementation((entity: any, data: any) => {
            const name = entity.name || entity;
            return (repoMap[name]?.create ?? jest.fn())(data);
          }),
          save: jest.fn().mockImplementation((entity: any, data: any) => {
            const name = entity.name || entity;
            return (repoMap[name]?.save ?? jest.fn())(data);
          }),
          count: jest.fn().mockImplementation((entity: any, opts: any) => {
            const name = entity.name || entity;
            return (repoMap[name]?.count ?? jest.fn())(opts);
          }),
          update: jest.fn().mockImplementation((entity: any, criteria: any, data: any) => {
            const name = entity.name || entity;
            return (repoMap[name]?.update ?? jest.fn())(criteria, data);
          }),
        };
        return cb(manager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentService,
        { provide: getRepositoryToken(EnrollmentEntity), useValue: enrollmentRepo },
        { provide: getRepositoryToken(EnrollmentServiceLineEntity), useValue: serviceLineRepo },
        { provide: getRepositoryToken(CatalogServiceEntity), useValue: catalogRepo },
        { provide: getRepositoryToken(SeatReservationEntity), useValue: seatRepo },
        { provide: getRepositoryToken(OrderEntity), useValue: orderRepo },
        { provide: getRepositoryToken(OrderLineEntity), useValue: orderLineRepo },
        { provide: PricingService, useFactory: () => { pricingService = { applyToOrder: jest.fn().mockResolvedValue({}) }; return pricingService; } },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<EnrollmentService>(EnrollmentService);
  });

  describe('create', () => {
    it('should create an enrollment with service lines', async () => {
      const input = {
        notes: 'New enrollment',
        serviceLines: [{ serviceId: 'service-uuid-1', quantity: 2 }],
      };

      const result = await service.create(patientId, input);

      expect(enrollmentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId,
          status: EnrollmentStatus.DRAFT,
          notes: 'New enrollment',
        }),
      );
      expect(enrollmentRepo.save).toHaveBeenCalled();
      expect(serviceLineRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: 'service-uuid-1',
          quantity: 2,
        }),
      );
      expect(result.patientId).toBe(patientId);
      expect(result.status).toBe(EnrollmentStatus.DRAFT);
    });
  });

  describe('update', () => {
    it('should update a DRAFT enrollment', async () => {
      enrollmentRepo.findOne.mockResolvedValue({ ...mockEnrollment });

      const result = await service.update('enrollment-uuid-1', patientId, {
        notes: 'Updated notes',
      });

      expect(enrollmentRepo.save).toHaveBeenCalled();
      expect(result.notes).toBe('Updated notes');
    });

    it('should reject update of non-DRAFT enrollment', async () => {
      enrollmentRepo.findOne.mockResolvedValue({
        ...mockEnrollment,
        status: EnrollmentStatus.SUBMITTED,
      });

      await expect(
        service.update('enrollment-uuid-1', patientId, { notes: 'Updated' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submit', () => {
    it('should submit enrollment, create order, and reserve seats', async () => {
      enrollmentRepo.findOne.mockResolvedValue({ ...mockEnrollment });

      const result = await service.submit('enrollment-uuid-1', patientId);

      expect(result.status).toBe(EnrollmentStatus.SUBMITTED);
      expect(result.submittedAt).not.toBeNull();

      // Should have created seat reservations (quantity=2, so 2 saves)
      expect(seatRepo.save).toHaveBeenCalledTimes(2);

      // Should have created order
      expect(orderRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          enrollmentId: 'enrollment-uuid-1',
          patientId,
          status: 'PENDING_PAYMENT',
        }),
      );

      // Should have created order lines
      expect(orderLineRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: 'service-uuid-1',
          quantity: 2,
          unitPrice: 50.0,
        }),
      );
    });

    it('should apply pricing to order after creation', async () => {
      enrollmentRepo.findOne.mockResolvedValue({ ...mockEnrollment });

      await service.submit('enrollment-uuid-1', patientId);

      // Pricing should be called with the created order ID
      expect(pricingService.applyToOrder).toHaveBeenCalledWith('order-uuid-1');
    });

    it('should reject submit if seats unavailable', async () => {
      enrollmentRepo.findOne.mockResolvedValue({ ...mockEnrollment });
      seatRepo.count.mockResolvedValue(9); // 9 out of 10 seats taken, need 2

      await expect(
        service.submit('enrollment-uuid-1', patientId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject submit if enrollment is not DRAFT', async () => {
      enrollmentRepo.findOne.mockResolvedValue({
        ...mockEnrollment,
        status: EnrollmentStatus.ACTIVE,
      });

      await expect(
        service.submit('enrollment-uuid-1', patientId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel enrollment and release seat reservations', async () => {
      enrollmentRepo.findOne.mockResolvedValue({
        ...mockEnrollment,
        status: EnrollmentStatus.SUBMITTED,
      });

      const result = await service.cancel('enrollment-uuid-1');

      expect(result.status).toBe(EnrollmentStatus.CANCELED);
      expect(seatRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ enrollmentId: 'enrollment-uuid-1' }),
        { status: 'RELEASED' },
      );
    });
  });

  describe('object-level auth', () => {
    it('should reject update by non-owner patient', async () => {
      enrollmentRepo.findOne.mockResolvedValue({ ...mockEnrollment });

      await expect(
        service.update('enrollment-uuid-1', otherPatientId, { notes: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject submit by non-owner patient', async () => {
      enrollmentRepo.findOne.mockResolvedValue({ ...mockEnrollment });

      await expect(
        service.submit('enrollment-uuid-1', otherPatientId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findById', () => {
    it('should return enrollment when found', async () => {
      enrollmentRepo.findOne.mockResolvedValue({ ...mockEnrollment });

      const result = await service.findById('enrollment-uuid-1');
      expect(result.id).toBe('enrollment-uuid-1');
    });

    it('should throw NotFoundException when not found', async () => {
      enrollmentRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByPatient', () => {
    it('should return paginated enrollments for patient', async () => {
      const result = await service.findByPatient(patientId, 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(enrollmentRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { patientId } }),
      );
    });
  });
});
