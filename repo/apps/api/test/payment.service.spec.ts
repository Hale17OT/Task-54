import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PaymentService } from '../src/core/application/use-cases/payment.service';
import { AuthService } from '../src/core/application/use-cases/auth.service';
import { PaymentEntity } from '../src/infrastructure/persistence/entities/payment.entity';
import { RefundEntity } from '../src/infrastructure/persistence/entities/refund.entity';
import { OrderEntity } from '../src/infrastructure/persistence/entities/order.entity';
import { EnrollmentEntity } from '../src/infrastructure/persistence/entities/enrollment.entity';
import { AnomalyDetectorService } from '../src/core/application/use-cases/anomaly-detector.service';
import { PaymentStatus, PaymentMethod, RefundReasonCode } from '@checc/shared/types/payment.types';
import { OrderStatus } from '@checc/shared/types/order.types';
import { EnrollmentStatus } from '@checc/shared/types/enrollment.types';
import { DataSource } from 'typeorm';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepo: Record<string, jest.Mock>;
  let refundRepo: Record<string, jest.Mock>;
  let orderRepo: Record<string, jest.Mock>;
  let enrollmentRepo: Record<string, jest.Mock>;
  let authService: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;

  const staffUserId = 'staff-uuid-1';
  const supervisorId = 'supervisor-uuid-1';

  const mockOrder = {
    id: 'order-uuid-1',
    orderNumber: 'ORD-20260401-123456',
    enrollmentId: 'enrollment-uuid-1',
    patientId: 'patient-uuid-1',
    status: OrderStatus.PENDING_PAYMENT,
    subtotal: 100,
    discountTotal: 0,
    finalTotal: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    autoCancelAt: new Date(Date.now() + 30 * 60 * 1000),
  };

  const mockEnrollment = {
    id: 'enrollment-uuid-1',
    patientId: 'patient-uuid-1',
    status: EnrollmentStatus.SUBMITTED,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPayment = {
    id: 'payment-uuid-1',
    orderId: 'order-uuid-1',
    paymentMethod: PaymentMethod.CASH,
    amount: 100,
    referenceNumber: null,
    status: PaymentStatus.PAID,
    recordedBy: staffUserId,
    paidAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSupervisor = {
    id: supervisorId,
    username: 'supervisor',
    canApproveRefunds: true,
    passwordHash: 'hashed',
    role: 'admin',
  };

  beforeEach(async () => {
    paymentRepo = {
      create: jest.fn().mockImplementation((data) => ({
        ...data,
        id: 'payment-uuid-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      save: jest.fn().mockImplementation((data) => Promise.resolve({
        ...mockPayment,
        ...data,
        id: data.id || 'payment-uuid-1',
      })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([mockPayment]),
      findAndCount: jest.fn().mockResolvedValue([[mockPayment], 1]),
    };

    refundRepo = {
      create: jest.fn().mockImplementation((data) => ({
        ...data,
        id: 'refund-uuid-1',
        createdAt: new Date(),
      })),
      save: jest.fn().mockImplementation((data) => Promise.resolve({
        ...data,
        id: data.id || 'refund-uuid-1',
        createdAt: data.createdAt || new Date(),
      })),
    };

    orderRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    };

    enrollmentRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    };

    authService = {
      verifyCredentials: jest.fn(),
    };

    // Mock DataSource.transaction — passes an EntityManager-like object that delegates to repo mocks
    const entityMap = new Map<Function, Record<string, jest.Mock>>([
      [PaymentEntity, paymentRepo],
      [RefundEntity, refundRepo],
      [OrderEntity, orderRepo],
      [EnrollmentEntity, enrollmentRepo],
    ]);

    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          findOne: jest.fn().mockImplementation((entity: Function, opts: Record<string, unknown>) => {
            const repo = entityMap.get(entity);
            return repo?.findOne(opts?.where ?? opts) ?? null;
          }),
          find: jest.fn().mockImplementation((entity: Function, opts: Record<string, unknown>) => {
            const repo = entityMap.get(entity);
            return repo?.find?.(opts) ?? [];
          }),
          create: jest.fn().mockImplementation((entity: Function, data: unknown) => {
            const repo = entityMap.get(entity);
            return repo?.create(data) ?? data;
          }),
          save: jest.fn().mockImplementation((_entity: Function, data: unknown) => {
            const repo = entityMap.get(_entity);
            return repo?.save(data) ?? Promise.resolve(data);
          }),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
          count: jest.fn().mockResolvedValue(0),
          createQueryBuilder: jest.fn().mockReturnValue({
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue({ affected: 0 }),
          }),
        };
        return cb(manager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(PaymentEntity), useValue: paymentRepo },
        { provide: getRepositoryToken(RefundEntity), useValue: refundRepo },
        { provide: getRepositoryToken(OrderEntity), useValue: orderRepo },
        { provide: getRepositoryToken(EnrollmentEntity), useValue: enrollmentRepo },
        { provide: AuthService, useValue: authService },
        { provide: AnomalyDetectorService, useValue: { checkRepeatedRefunds: jest.fn().mockResolvedValue(false) } },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  describe('recordPayment', () => {
    it('should create payment and update order to PAID', async () => {
      orderRepo.findOne.mockResolvedValue({ ...mockOrder });
      enrollmentRepo.findOne.mockResolvedValue({ ...mockEnrollment });

      const input = {
        orderId: 'order-uuid-1',
        paymentMethod: PaymentMethod.CASH,
        amount: 100,
      };

      const result = await service.recordPayment(input, staffUserId);

      expect(paymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-uuid-1',
          paymentMethod: PaymentMethod.CASH,
          amount: 100,
          status: PaymentStatus.PAID,
          recordedBy: staffUserId,
        }),
      );
      expect(paymentRepo.save).toHaveBeenCalled();
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.PAID }),
      );
      expect(enrollmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: EnrollmentStatus.ACTIVE }),
      );
      expect(result.status).toBe(PaymentStatus.PAID);
    });

    it('should reject if order is not PENDING_PAYMENT', async () => {
      orderRepo.findOne.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PAID,
      });

      const input = {
        orderId: 'order-uuid-1',
        paymentMethod: PaymentMethod.CASH,
        amount: 100,
      };

      await expect(service.recordPayment(input, staffUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject if amount does not match order total', async () => {
      orderRepo.findOne.mockResolvedValue({ ...mockOrder });

      const input = {
        orderId: 'order-uuid-1',
        paymentMethod: PaymentMethod.CASH,
        amount: 50, // order total is 100
      };

      await expect(service.recordPayment(input, staffUserId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('initiateRefund', () => {
    it('should self-approve when user has can_approve_refunds', async () => {
      paymentRepo.findOne.mockResolvedValue({ ...mockPayment });
      orderRepo.findOne.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PAID,
      });

      const input = {
        paymentId: 'payment-uuid-1',
        amount: 100,
        reasonCode: RefundReasonCode.PATIENT_REQUEST,
        reasonDetail: 'Patient changed mind',
      };

      const result = await service.initiateRefund(input, staffUserId, true);

      expect(refundRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 'payment-uuid-1',
          amount: 100,
          reasonCode: RefundReasonCode.PATIENT_REQUEST,
          requestedBy: staffUserId,
          approvedBy: staffUserId,
        }),
      );
      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.REFUNDED }),
      );
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.REFUNDED }),
      );
      expect(result.approvedBy).toBe(staffUserId);
    });

    it('should require supervisor credentials when user lacks can_approve_refunds', async () => {
      paymentRepo.findOne.mockResolvedValue({ ...mockPayment });

      const input = {
        paymentId: 'payment-uuid-1',
        amount: 100,
        reasonCode: RefundReasonCode.PATIENT_REQUEST,
      };

      await expect(
        service.initiateRefund(input, staffUserId, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject with invalid supervisor credentials', async () => {
      paymentRepo.findOne.mockResolvedValue({ ...mockPayment });
      authService.verifyCredentials.mockResolvedValue(null);

      const input = {
        paymentId: 'payment-uuid-1',
        amount: 100,
        reasonCode: RefundReasonCode.PATIENT_REQUEST,
        supervisorUsername: 'badsupervisor',
        supervisorPassword: 'wrongpass',
      };

      await expect(
        service.initiateRefund(input, staffUserId, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject when supervisor lacks can_approve_refunds', async () => {
      paymentRepo.findOne.mockResolvedValue({ ...mockPayment });
      authService.verifyCredentials.mockResolvedValue({
        ...mockSupervisor,
        canApproveRefunds: false,
      });

      const input = {
        paymentId: 'payment-uuid-1',
        amount: 100,
        reasonCode: RefundReasonCode.PATIENT_REQUEST,
        supervisorUsername: 'supervisor',
        supervisorPassword: 'password123',
      };

      await expect(
        service.initiateRefund(input, staffUserId, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should process refund with valid supervisor credentials', async () => {
      paymentRepo.findOne.mockResolvedValue({ ...mockPayment });
      orderRepo.findOne.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PAID,
      });
      authService.verifyCredentials.mockResolvedValue(mockSupervisor);

      const input = {
        paymentId: 'payment-uuid-1',
        amount: 100,
        reasonCode: RefundReasonCode.BILLING_ERROR,
        supervisorUsername: 'supervisor',
        supervisorPassword: 'password123',
      };

      const result = await service.initiateRefund(input, staffUserId, false);

      expect(authService.verifyCredentials).toHaveBeenCalledWith(
        'supervisor',
        'password123',
      );
      expect(refundRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedBy: staffUserId,
          approvedBy: supervisorId,
        }),
      );
      expect(result.approvedBy).toBe(supervisorId);
    });

    it('should reject refund when supervisor account is deactivated', async () => {
      paymentRepo.findOne.mockResolvedValue({ ...mockPayment });
      // verifyCredentials returns null for inactive accounts
      authService.verifyCredentials.mockResolvedValue(null);

      const input = {
        paymentId: 'payment-uuid-1',
        amount: 100,
        reasonCode: RefundReasonCode.PATIENT_REQUEST,
        supervisorUsername: 'deactivated_supervisor',
        supervisorPassword: 'password123',
      };

      await expect(
        service.initiateRefund(input, staffUserId, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject refund when supervisor account is locked', async () => {
      paymentRepo.findOne.mockResolvedValue({ ...mockPayment });
      // verifyCredentials returns null for locked accounts
      authService.verifyCredentials.mockResolvedValue(null);

      const input = {
        paymentId: 'payment-uuid-1',
        amount: 100,
        reasonCode: RefundReasonCode.PATIENT_REQUEST,
        supervisorUsername: 'locked_supervisor',
        supervisorPassword: 'password123',
      };

      await expect(
        service.initiateRefund(input, staffUserId, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should require reason code', async () => {
      paymentRepo.findOne.mockResolvedValue({ ...mockPayment });

      const input = {
        paymentId: 'payment-uuid-1',
        amount: 100,
        reasonCode: '' as RefundReasonCode,
      };

      await expect(
        service.initiateRefund(input, staffUserId, true),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPaymentsByOrder', () => {
    const staffUser = { id: 'staff-uuid-1', role: 'staff' };
    const patientOwner = { id: 'patient-uuid-1', role: 'patient' };
    const patientOther = { id: 'patient-uuid-other', role: 'patient' };

    it('should return payments for an order (staff)', async () => {
      orderRepo.findOne.mockResolvedValue({ id: 'order-uuid-1', patientId: 'patient-uuid-1' });
      paymentRepo.find.mockResolvedValue([mockPayment]);

      const result = await service.getPaymentsByOrder('order-uuid-1', staffUser);

      expect(result).toHaveLength(1);
      expect(result[0].orderId).toBe('order-uuid-1');
      expect(paymentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderId: 'order-uuid-1' },
        }),
      );
    });

    it('should allow patient to view their own order payments', async () => {
      orderRepo.findOne.mockResolvedValue({ id: 'order-uuid-1', patientId: 'patient-uuid-1' });
      paymentRepo.find.mockResolvedValue([mockPayment]);

      const result = await service.getPaymentsByOrder('order-uuid-1', patientOwner);
      expect(result).toHaveLength(1);
    });

    it('should reject patient viewing another patient\'s order payments', async () => {
      orderRepo.findOne.mockResolvedValue({ id: 'order-uuid-1', patientId: 'patient-uuid-1' });

      await expect(
        service.getPaymentsByOrder('order-uuid-1', patientOther),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when order does not exist', async () => {
      orderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getPaymentsByOrder('nonexistent', staffUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPaymentById', () => {
    const staffUser = { id: 'staff-uuid-1', role: 'staff' };
    const patientOwner = { id: 'patient-uuid-1', role: 'patient' };
    const patientOther = { id: 'patient-uuid-other', role: 'patient' };

    it('should return payment when found (staff)', async () => {
      paymentRepo.findOne.mockResolvedValue({ ...mockPayment });

      const result = await service.getPaymentById('payment-uuid-1', staffUser);
      expect(result.id).toBe('payment-uuid-1');
    });

    it('should allow patient to view payment for their own order', async () => {
      paymentRepo.findOne.mockResolvedValue({ ...mockPayment });
      orderRepo.findOne.mockResolvedValue({ id: 'order-uuid-1', patientId: 'patient-uuid-1' });

      const result = await service.getPaymentById('payment-uuid-1', patientOwner);
      expect(result.id).toBe('payment-uuid-1');
    });

    it('should reject patient viewing payment for another patient\'s order', async () => {
      paymentRepo.findOne.mockResolvedValue({ ...mockPayment });
      orderRepo.findOne.mockResolvedValue({ id: 'order-uuid-1', patientId: 'patient-uuid-1' });

      await expect(
        service.getPaymentById('payment-uuid-1', patientOther),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null);

      await expect(service.getPaymentById('nonexistent', staffUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listPayments', () => {
    it('should return paginated payments', async () => {
      const result = await service.listPayments(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(paymentRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });
  });
});
