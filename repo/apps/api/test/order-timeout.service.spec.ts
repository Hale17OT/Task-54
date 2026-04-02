import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrderTimeoutService } from '../src/infrastructure/scheduling/order-timeout.service';
import { OrderEntity } from '../src/infrastructure/persistence/entities/order.entity';
import { EnrollmentEntity } from '../src/infrastructure/persistence/entities/enrollment.entity';
import { SeatReservationEntity } from '../src/infrastructure/persistence/entities/seat-reservation.entity';
import { OrderStatus } from '@checc/shared/types/order.types';
import { EnrollmentStatus } from '@checc/shared/types/enrollment.types';

describe('OrderTimeoutService', () => {
  let service: OrderTimeoutService;
  let orderRepo: Record<string, jest.Mock>;
  let enrollmentRepo: Record<string, jest.Mock>;
  let seatRepo: Record<string, jest.Mock & { createQueryBuilder?: jest.Mock }>;

  const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
  const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  const mockOverdueOrder = {
    id: 'order-uuid-1',
    orderNumber: 'ORD-20260401-123456',
    enrollmentId: 'enrollment-uuid-1',
    patientId: 'patient-uuid-1',
    status: OrderStatus.PENDING_PAYMENT,
    autoCancelAt: pastDate,
  };

  const mockNonOverdueOrder = {
    id: 'order-uuid-2',
    orderNumber: 'ORD-20260401-654321',
    enrollmentId: 'enrollment-uuid-2',
    patientId: 'patient-uuid-2',
    status: OrderStatus.PENDING_PAYMENT,
    autoCancelAt: futureDate,
  };

  let mockQueryBuilder: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    orderRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockImplementation((opts: any) => {
        // Default: return mock order matching the queried ID for transaction re-read
        if (opts?.where?.id === mockOverdueOrder.id) return Promise.resolve({ ...mockOverdueOrder });
        return Promise.resolve(null);
      }),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    };

    enrollmentRepo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    seatRepo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const repoMap: Record<string, Record<string, jest.Mock>> = {
      OrderEntity: orderRepo,
      EnrollmentEntity: enrollmentRepo,
      SeatReservationEntity: seatRepo,
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
          save: jest.fn().mockImplementation((entity: any, data: any) => {
            const name = entity.name || entity;
            return (repoMap[name]?.save ?? jest.fn())(data);
          }),
          update: jest.fn().mockImplementation((entity: any, criteria: any, data: any) => {
            const name = entity.name || entity;
            return (repoMap[name]?.update ?? jest.fn())(criteria, data);
          }),
          createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
        };
        return cb(manager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderTimeoutService,
        { provide: getRepositoryToken(OrderEntity), useValue: orderRepo },
        { provide: getRepositoryToken(EnrollmentEntity), useValue: enrollmentRepo },
        { provide: getRepositoryToken(SeatReservationEntity), useValue: seatRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<OrderTimeoutService>(OrderTimeoutService);
  });

  it('should cancel overdue PENDING_PAYMENT orders', async () => {
    orderRepo.find.mockResolvedValue([{ ...mockOverdueOrder }]);

    await service.handleOrderTimeouts();

    expect(orderRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'order-uuid-1',
        status: OrderStatus.CANCELED,
      }),
    );

    expect(enrollmentRepo.update).toHaveBeenCalledWith(
      { id: 'enrollment-uuid-1' },
      { status: EnrollmentStatus.DRAFT, submittedAt: null },
    );

    // Seat reservations are released via manager.createQueryBuilder() inside the transaction
    expect(mockQueryBuilder.update).toHaveBeenCalledWith(SeatReservationEntity);
    expect(mockQueryBuilder.set).toHaveBeenCalledWith({ status: 'RELEASED' });
  });

  it('should release expired seat reservations', async () => {
    mockQueryBuilder.execute.mockResolvedValue({ affected: 3 });

    await service.handleOrderTimeouts();

    expect(seatRepo.createQueryBuilder).toHaveBeenCalled();
    expect(mockQueryBuilder.update).toHaveBeenCalledWith(SeatReservationEntity);
    expect(mockQueryBuilder.set).toHaveBeenCalledWith({ status: 'RELEASED' });
    expect(mockQueryBuilder.where).toHaveBeenCalledWith('status = :status', { status: 'HELD' });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'expires_at < :now',
      expect.objectContaining({ now: expect.any(Date) }),
    );
  });

  it('should not cancel non-overdue orders', async () => {
    orderRepo.find.mockResolvedValue([]); // no overdue orders returned by query

    await service.handleOrderTimeouts();

    expect(orderRepo.save).not.toHaveBeenCalled();
    expect(enrollmentRepo.update).not.toHaveBeenCalled();
  });
});
