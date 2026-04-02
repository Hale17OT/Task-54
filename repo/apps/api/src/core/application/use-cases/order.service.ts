import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { OrderEntity } from '../../../infrastructure/persistence/entities/order.entity';
import { OrderLineEntity } from '../../../infrastructure/persistence/entities/order-line.entity';
import { EnrollmentEntity } from '../../../infrastructure/persistence/entities/enrollment.entity';
import { SeatReservationEntity } from '../../../infrastructure/persistence/entities/seat-reservation.entity';
import { OrderStatus } from '@checc/shared/types/order.types';
import { EnrollmentStatus } from '@checc/shared/types/enrollment.types';
import { ErrorCodes } from '@checc/shared/constants/error-codes';
import { WinstonLogger } from '../../../infrastructure/logging/winston.logger';

@Injectable()
export class OrderService {
  private readonly logger = new WinstonLogger();

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderLineEntity)
    private readonly orderLineRepo: Repository<OrderLineEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,
    @InjectRepository(SeatReservationEntity)
    private readonly seatRepo: Repository<SeatReservationEntity>,
  ) {}

  async findById(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['lines', 'lines.service'],
    });

    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        errorCode: ErrorCodes.ORDER_NOT_FOUND,
      });
    }

    return this.toDto(order);
  }

  async findByEnrollmentId(enrollmentId: string) {
    const order = await this.orderRepo.findOne({
      where: { enrollmentId },
      relations: ['lines'],
      order: { createdAt: 'DESC' },
    });
    return order ? this.toDto(order) : null;
  }

  async findByPatient(patientId: string, page: number, limit: number) {
    const [items, total] = await this.orderRepo.findAndCount({
      where: { patientId },
      relations: ['lines', 'lines.service'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: items.map((o) => this.toDto(o)),
      total,
      page,
      limit,
    };
  }

  async findAll(page: number, limit: number) {
    const [items, total] = await this.orderRepo.findAndCount({
      relations: ['lines', 'lines.service'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: items.map((o) => this.toDto(o)),
      total,
      page,
      limit,
    };
  }

  async cancel(orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['lines'],
    });

    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        errorCode: ErrorCodes.ORDER_NOT_FOUND,
      });
    }

    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException({
        message: 'Cannot cancel a paid order',
        errorCode: ErrorCodes.ORDER_ALREADY_PAID,
      });
    }

    if (order.status === OrderStatus.CANCELED) {
      throw new BadRequestException({
        message: 'Order is already canceled',
        errorCode: ErrorCodes.ORDER_CANCELED,
      });
    }

    order.status = OrderStatus.CANCELED;
    await this.orderRepo.save(order);

    // Revert enrollment to DRAFT
    await this.enrollmentRepo.update(
      { id: order.enrollmentId },
      { status: EnrollmentStatus.DRAFT, submittedAt: null },
    );

    // Release seat reservations
    await this.seatRepo.update(
      { enrollmentId: order.enrollmentId, status: In(['HELD', 'CONFIRMED']) },
      { status: 'RELEASED' },
    );

    this.logger.log(`Order ${order.orderNumber} canceled`, 'OrderService');
    return this.toDto(order);
  }

  private toDto(order: OrderEntity) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      enrollmentId: order.enrollmentId,
      patientId: order.patientId,
      status: order.status as OrderStatus,
      subtotal: Number(order.subtotal),
      discountTotal: Number(order.discountTotal),
      finalTotal: Number(order.finalTotal),
      lines: (order.lines || []).map((line) => ({
        id: line.id,
        serviceId: line.serviceId,
        serviceName: line.service ? line.service.name : '',
        quantity: line.quantity,
        unitPrice: Number(line.unitPrice),
        discountAmount: Number(line.discountAmount),
        lineTotal: Number(line.lineTotal),
        discountReason: line.discountReason,
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      autoCancelAt: order.autoCancelAt ? order.autoCancelAt.toISOString() : '',
    };
  }
}
