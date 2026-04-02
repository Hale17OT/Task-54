import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PaymentEntity } from '../../../infrastructure/persistence/entities/payment.entity';
import { RefundEntity } from '../../../infrastructure/persistence/entities/refund.entity';
import { OrderEntity } from '../../../infrastructure/persistence/entities/order.entity';
import { EnrollmentEntity } from '../../../infrastructure/persistence/entities/enrollment.entity';
import { AuthService } from './auth.service';
import { AnomalyDetectorService } from './anomaly-detector.service';
import { PaymentStatus } from '@checc/shared/types/payment.types';
import { OrderStatus } from '@checc/shared/types/order.types';
import { EnrollmentStatus } from '@checc/shared/types/enrollment.types';
import { ErrorCodes } from '@checc/shared/constants/error-codes';
import { UserRole } from '@checc/shared/constants/roles';
import { WinstonLogger } from '../../../infrastructure/logging/winston.logger';
import type { RecordPaymentInput, RefundInput } from '@checc/shared/schemas/payment.schema';

@Injectable()
export class PaymentService {
  private readonly logger = new WinstonLogger();

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepo: Repository<PaymentEntity>,
    @InjectRepository(RefundEntity)
    private readonly refundRepo: Repository<RefundEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,
    private readonly authService: AuthService,
    private readonly anomalyDetector: AnomalyDetectorService,
    private readonly dataSource: DataSource,
  ) {}

  async recordPayment(input: RecordPaymentInput, staffUserId: string) {
    return this.dataSource.transaction(async (manager) => {
      // Lock the order row to prevent concurrent payment + auto-cancel races
      const order = await manager.findOne(OrderEntity, {
        where: { id: input.orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException({
          message: 'Order not found',
          errorCode: ErrorCodes.ORDER_NOT_FOUND,
        });
      }

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new BadRequestException({
          message: 'Order is not pending payment',
          errorCode: ErrorCodes.ORDER_ALREADY_PAID,
        });
      }

      if (Number(input.amount) !== Number(order.finalTotal)) {
        throw new BadRequestException({
          message: `Payment amount (${input.amount}) does not match order total (${order.finalTotal})`,
          errorCode: ErrorCodes.PAYMENT_ALREADY_PROCESSED,
        });
      }

      const now = new Date();

      const payment = manager.create(PaymentEntity, {
        orderId: input.orderId,
        paymentMethod: input.paymentMethod,
        amount: input.amount,
        referenceNumber: input.referenceNumber || null,
        status: PaymentStatus.PAID,
        recordedBy: staffUserId,
        paidAt: now,
      });
      const savedPayment = await manager.save(PaymentEntity, payment);

      // Update order status to PAID
      order.status = OrderStatus.PAID;
      order.autoCancelAt = null;
      await manager.save(OrderEntity, order);

      // Activate the enrollment
      const enrollment = await manager.findOne(EnrollmentEntity, {
        where: { id: order.enrollmentId },
      });
      if (enrollment) {
        enrollment.status = EnrollmentStatus.ACTIVE;
        await manager.save(EnrollmentEntity, enrollment);
      }

      this.logger.log(
        `Payment ${savedPayment.id} recorded for order ${order.id} by staff ${staffUserId}`,
        'PaymentService',
      );

      return this.toPaymentDto(savedPayment);
    });
  }

  async getPaymentsByOrder(orderId: string, requestingUser: { id: string; role: string }) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        errorCode: ErrorCodes.ORDER_NOT_FOUND,
      });
    }

    // Patients can only see payments for their own orders
    if (requestingUser.role === UserRole.PATIENT && order.patientId !== requestingUser.id) {
      throw new ForbiddenException({
        message: 'You can only view payments for your own orders',
        errorCode: ErrorCodes.RESOURCE_NOT_OWNED,
      });
    }

    const payments = await this.paymentRepo.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });

    return payments.map((p) => this.toPaymentDto(p));
  }

  async getPaymentById(id: string, requestingUser: { id: string; role: string }) {
    const payment = await this.paymentRepo.findOne({ where: { id } });

    if (!payment) {
      throw new NotFoundException({
        message: 'Payment not found',
        errorCode: ErrorCodes.PAYMENT_NOT_FOUND,
      });
    }

    // Patients can only see payments for their own orders
    if (requestingUser.role === UserRole.PATIENT) {
      const order = await this.orderRepo.findOne({ where: { id: payment.orderId } });
      if (!order || order.patientId !== requestingUser.id) {
        throw new ForbiddenException({
          message: 'You can only view payments for your own orders',
          errorCode: ErrorCodes.RESOURCE_NOT_OWNED,
        });
      }
    }

    return this.toPaymentDto(payment);
  }

  async initiateRefund(input: RefundInput, requestingUserId: string, requestingUserCanApprove: boolean) {
    if (!input.reasonCode) {
      throw new BadRequestException({
        message: 'Reason code is required for refunds',
        errorCode: ErrorCodes.REFUND_REASON_REQUIRED,
      });
    }

    // Validate supervisor credentials BEFORE entering the transaction
    let approvedById: string;
    if (requestingUserCanApprove) {
      approvedById = requestingUserId;
    } else {
      if (!input.supervisorUsername || !input.supervisorPassword) {
        throw new ForbiddenException({
          message: 'Supervisor credentials are required to approve this refund',
          errorCode: ErrorCodes.REFUND_SUPERVISOR_REQUIRED,
        });
      }
      const supervisor = await this.authService.verifyCredentials(
        input.supervisorUsername,
        input.supervisorPassword,
      );
      if (!supervisor) {
        throw new ForbiddenException({
          message: 'Invalid supervisor credentials',
          errorCode: ErrorCodes.REFUND_INVALID_SUPERVISOR,
        });
      }
      if (!supervisor.canApproveRefunds) {
        throw new ForbiddenException({
          message: 'Supervisor does not have refund approval permission',
          errorCode: ErrorCodes.REFUND_INVALID_SUPERVISOR,
        });
      }
      approvedById = supervisor.id;
    }

    const result = await this.dataSource.transaction(async (manager) => {
      // Lock payment row to prevent concurrent double-refund
      const payment = await manager.findOne(PaymentEntity, {
        where: { id: input.paymentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        throw new NotFoundException({
          message: 'Payment not found',
          errorCode: ErrorCodes.PAYMENT_NOT_FOUND,
        });
      }

      if (payment.status !== PaymentStatus.PAID) {
        throw new BadRequestException({
          message: 'Payment is not in PAID status',
          errorCode: ErrorCodes.PAYMENT_ALREADY_PROCESSED,
        });
      }

      if (Number(input.amount) > Number(payment.amount)) {
        throw new BadRequestException({
          message: `Refund amount (${input.amount}) exceeds payment amount (${payment.amount})`,
          errorCode: ErrorCodes.PAYMENT_ALREADY_PROCESSED,
        });
      }

      const now = new Date();

      const refund = manager.create(RefundEntity, {
        paymentId: payment.id,
        amount: input.amount,
        reasonCode: input.reasonCode,
        reasonDetail: input.reasonDetail || null,
        requestedBy: requestingUserId,
        approvedBy: approvedById,
        approvedAt: now,
      });
      const savedRefund = await manager.save(RefundEntity, refund);

      payment.status = PaymentStatus.REFUNDED;
      await manager.save(PaymentEntity, payment);

      const order = await manager.findOne(OrderEntity, { where: { id: payment.orderId } });
      if (order) {
        order.status = OrderStatus.REFUNDED;
        await manager.save(OrderEntity, order);
      }

      this.logger.log(
        `Refund ${savedRefund.id} processed for payment ${payment.id} by ${requestingUserId}, approved by ${approvedById}`,
        'PaymentService',
      );

      return this.toRefundDto(savedRefund);
    });

    // Asynchronous anomaly check AFTER transaction commits
    this.anomalyDetector.checkRepeatedRefunds(requestingUserId).catch(() => {});

    return result;
  }

  async listPayments(page: number, limit: number) {
    const [items, total] = await this.paymentRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: items.map((p) => this.toPaymentDto(p)),
      total,
      page,
      limit,
    };
  }

  private toPaymentDto(payment: PaymentEntity) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      paymentMethod: payment.paymentMethod,
      amount: Number(payment.amount),
      referenceNumber: payment.referenceNumber,
      status: payment.status,
      recordedBy: payment.recordedBy,
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      createdAt: payment.createdAt.toISOString(),
    };
  }

  private toRefundDto(refund: RefundEntity) {
    return {
      id: refund.id,
      paymentId: refund.paymentId,
      amount: Number(refund.amount),
      reasonCode: refund.reasonCode,
      reasonDetail: refund.reasonDetail,
      requestedBy: refund.requestedBy,
      approvedBy: refund.approvedBy,
      approvedAt: refund.approvedAt.toISOString(),
      createdAt: refund.createdAt.toISOString(),
    };
  }
}
