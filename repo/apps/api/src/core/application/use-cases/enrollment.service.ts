import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { EnrollmentEntity } from '../../../infrastructure/persistence/entities/enrollment.entity';
import { EnrollmentServiceLineEntity } from '../../../infrastructure/persistence/entities/enrollment-service-line.entity';
import { CatalogServiceEntity } from '../../../infrastructure/persistence/entities/catalog-service.entity';
import { SeatReservationEntity } from '../../../infrastructure/persistence/entities/seat-reservation.entity';
import { OrderEntity } from '../../../infrastructure/persistence/entities/order.entity';
import { OrderLineEntity } from '../../../infrastructure/persistence/entities/order-line.entity';
import { PricingService } from './pricing.service';
import { EnrollmentStatus } from '@checc/shared/types/enrollment.types';
import { OrderStatus } from '@checc/shared/types/order.types';
import { ErrorCodes } from '@checc/shared/constants/error-codes';
import { WinstonLogger } from '../../../infrastructure/logging/winston.logger';
import type { CreateEnrollmentInput, UpdateEnrollmentInput } from '@checc/shared/schemas/enrollment.schema';

@Injectable()
export class EnrollmentService {
  private readonly logger = new WinstonLogger();

  constructor(
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,
    @InjectRepository(EnrollmentServiceLineEntity)
    private readonly serviceLineRepo: Repository<EnrollmentServiceLineEntity>,
    @InjectRepository(CatalogServiceEntity)
    private readonly catalogRepo: Repository<CatalogServiceEntity>,
    @InjectRepository(SeatReservationEntity)
    private readonly seatRepo: Repository<SeatReservationEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderLineEntity)
    private readonly orderLineRepo: Repository<OrderLineEntity>,
    private readonly pricingService: PricingService,
    private readonly dataSource: DataSource,
  ) {}

  async create(patientId: string, input: CreateEnrollmentInput) {
    const enrollment = this.enrollmentRepo.create({
      patientId,
      status: EnrollmentStatus.DRAFT,
      notes: input.notes || '',
      enrollmentDate: null,
      submittedAt: null,
    });
    const saved = await this.enrollmentRepo.save(enrollment);

    const lines = input.serviceLines.map((sl) =>
      this.serviceLineRepo.create({
        enrollmentId: saved.id,
        serviceId: sl.serviceId,
        quantity: sl.quantity,
      }),
    );
    saved.serviceLines = await this.serviceLineRepo.save(lines);

    this.logger.log(`Enrollment created: ${saved.id} for patient ${patientId}`, 'EnrollmentService');
    return this.toDto(saved);
  }

  async update(enrollmentId: string, userId: string, input: UpdateEnrollmentInput) {
    const enrollment = await this.enrollmentRepo.findOne({
      where: { id: enrollmentId },
      relations: ['serviceLines'],
    });

    if (!enrollment) {
      throw new NotFoundException({
        message: 'Enrollment not found',
        errorCode: ErrorCodes.ENROLLMENT_NOT_FOUND,
      });
    }

    this.assertOwnership(enrollment, userId);

    if (enrollment.status !== EnrollmentStatus.DRAFT) {
      throw new BadRequestException({
        message: 'Only DRAFT enrollments can be updated',
        errorCode: ErrorCodes.ENROLLMENT_NOT_DRAFT,
      });
    }

    if (input.notes !== undefined) {
      enrollment.notes = input.notes;
    }

    if (input.serviceLines) {
      await this.serviceLineRepo.delete({ enrollmentId: enrollment.id });
      const lines = input.serviceLines.map((sl) =>
        this.serviceLineRepo.create({
          enrollmentId: enrollment.id,
          serviceId: sl.serviceId,
          quantity: sl.quantity,
        }),
      );
      enrollment.serviceLines = await this.serviceLineRepo.save(lines);
    }

    const updated = await this.enrollmentRepo.save(enrollment);
    if (!input.serviceLines) {
      updated.serviceLines = await this.serviceLineRepo.find({
        where: { enrollmentId: enrollment.id },
      });
    }

    this.logger.log(`Enrollment updated: ${enrollmentId}`, 'EnrollmentService');
    return this.toDto(updated);
  }

  async findById(id: string) {
    const enrollment = await this.enrollmentRepo.findOne({
      where: { id },
      relations: ['serviceLines', 'serviceLines.service'],
    });

    if (!enrollment) {
      throw new NotFoundException({
        message: 'Enrollment not found',
        errorCode: ErrorCodes.ENROLLMENT_NOT_FOUND,
      });
    }

    return this.toDto(enrollment);
  }

  async findByPatient(patientId: string, page: number, limit: number) {
    const [items, total] = await this.enrollmentRepo.findAndCount({
      where: { patientId },
      relations: ['serviceLines'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: items.map((e) => this.toDto(e)),
      total,
      page,
      limit,
    };
  }

  async findAll(page: number, limit: number) {
    const [items, total] = await this.enrollmentRepo.findAndCount({
      relations: ['serviceLines'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: items.map((e) => this.toDto(e)),
      total,
      page,
      limit,
    };
  }

  async submit(enrollmentId: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      // Lock enrollment to prevent duplicate submissions
      const enrollment = await manager.findOne(EnrollmentEntity, {
        where: { id: enrollmentId },
        relations: ['serviceLines'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!enrollment) {
        throw new NotFoundException({
          message: 'Enrollment not found',
          errorCode: ErrorCodes.ENROLLMENT_NOT_FOUND,
        });
      }

      this.assertOwnership(enrollment, userId);

      if (enrollment.status !== EnrollmentStatus.DRAFT) {
        throw new BadRequestException({
          message: 'Only DRAFT enrollments can be submitted',
          errorCode: ErrorCodes.ENROLLMENT_NOT_DRAFT,
        });
      }

      if (!enrollment.serviceLines || enrollment.serviceLines.length === 0) {
        throw new BadRequestException({
          message: 'Enrollment must have at least one service line',
          errorCode: ErrorCodes.ENROLLMENT_NO_SERVICES,
        });
      }

      // Fetch catalog services for price snapshot and seat checks
      const serviceIds = enrollment.serviceLines.map((sl) => sl.serviceId);
      const catalogServices = await manager.find(CatalogServiceEntity, {
        where: { id: In(serviceIds) },
      });
      const catalogMap = new Map(catalogServices.map((cs) => [cs.id, cs]));

      // Check seat availability and create reservations (within same transaction)
      const now = new Date();
      const seatExpiresAt = new Date(now.getTime() + 60 * 60 * 1000);

      for (const line of enrollment.serviceLines) {
        const catalogService = catalogMap.get(line.serviceId);
        if (!catalogService) {
          throw new NotFoundException({
            message: `Catalog service ${line.serviceId} not found`,
            errorCode: ErrorCodes.ENROLLMENT_NOT_FOUND,
          });
        }

        if (catalogService.maxSeats !== null) {
          // Count within transaction to prevent overbooking
          const heldOrConfirmed = await manager.count(SeatReservationEntity, {
            where: [
              { serviceId: line.serviceId, status: 'HELD' },
              { serviceId: line.serviceId, status: 'CONFIRMED' },
            ],
          });
          const available = catalogService.maxSeats - heldOrConfirmed;

          if (available < line.quantity) {
            throw new BadRequestException({
              message: `Not enough seats for service "${catalogService.name}". Available: ${available}, requested: ${line.quantity}`,
              errorCode: ErrorCodes.SEAT_UNAVAILABLE,
            });
          }

          for (let i = 0; i < line.quantity; i++) {
            const reservation = manager.create(SeatReservationEntity, {
              serviceId: line.serviceId,
              enrollmentId: enrollment.id,
              reservedAt: now,
              expiresAt: seatExpiresAt,
              status: 'HELD',
            });
            await manager.save(SeatReservationEntity, reservation);
          }
        }
      }

      // Update enrollment status
      enrollment.status = EnrollmentStatus.SUBMITTED;
      enrollment.submittedAt = now;
      enrollment.enrollmentDate = now;
      await manager.save(EnrollmentEntity, enrollment);

      // Create order with price snapshots
      const orderNumber = this.generateOrderNumber();
      const autoCancelAt = new Date(now.getTime() + 30 * 60 * 1000);

      const order = manager.create(OrderEntity, {
        orderNumber,
        enrollmentId: enrollment.id,
        patientId: enrollment.patientId,
        status: OrderStatus.PENDING_PAYMENT,
        subtotal: 0,
        discountTotal: 0,
        finalTotal: 0,
        autoCancelAt,
      });
      const savedOrder = await manager.save(OrderEntity, order);

      let subtotal = 0;
      const orderLines: OrderLineEntity[] = [];
      for (const line of enrollment.serviceLines) {
        const catalogService = catalogMap.get(line.serviceId)!;
        const unitPrice = Number(catalogService.basePrice);
        const lineTotal = unitPrice * line.quantity;
        subtotal += lineTotal;

        const orderLine = manager.create(OrderLineEntity, {
          orderId: savedOrder.id,
          serviceId: line.serviceId,
          quantity: line.quantity,
          unitPrice,
          discountAmount: 0,
          lineTotal,
          discountReason: null,
        });
        orderLines.push(orderLine);
      }

      await manager.save(OrderLineEntity, orderLines);

      savedOrder.subtotal = subtotal;
      savedOrder.finalTotal = subtotal;
      await manager.save(OrderEntity, savedOrder);

      // Apply best-offer pricing and persist discount audit trail
      try {
        await this.pricingService.applyToOrder(savedOrder.id);
      } catch (err) {
        this.logger.warn(
          `Pricing application failed for order ${savedOrder.id}: ${err}`,
          'EnrollmentService',
        );
      }

      this.logger.log(
        `Enrollment ${enrollmentId} submitted. Order ${orderNumber} created.`,
        'EnrollmentService',
      );

      return this.toDto(enrollment);
    });
  }

  async activate(enrollmentId: string) {
    const enrollment = await this.enrollmentRepo.findOne({
      where: { id: enrollmentId },
      relations: ['serviceLines'],
    });

    if (!enrollment) {
      throw new NotFoundException({
        message: 'Enrollment not found',
        errorCode: ErrorCodes.ENROLLMENT_NOT_FOUND,
      });
    }

    if (enrollment.status !== EnrollmentStatus.SUBMITTED) {
      throw new BadRequestException({
        message: 'Only SUBMITTED enrollments can be activated',
        errorCode: ErrorCodes.ENROLLMENT_NOT_DRAFT,
      });
    }

    enrollment.status = EnrollmentStatus.ACTIVE;
    const saved = await this.enrollmentRepo.save(enrollment);

    // Confirm seat reservations
    await this.seatRepo.update(
      { enrollmentId, status: 'HELD' },
      { status: 'CONFIRMED' },
    );

    this.logger.log(`Enrollment ${enrollmentId} activated`, 'EnrollmentService');
    return this.toDto(saved);
  }

  async cancel(enrollmentId: string, requestingUser?: { id: string; role: string }) {
    const enrollment = await this.enrollmentRepo.findOne({
      where: { id: enrollmentId },
      relations: ['serviceLines'],
    });

    if (!enrollment) {
      throw new NotFoundException({
        message: 'Enrollment not found',
        errorCode: ErrorCodes.ENROLLMENT_NOT_FOUND,
      });
    }

    // Enforce ownership when called from user context (not system/cron)
    if (requestingUser && requestingUser.role !== 'staff' && requestingUser.role !== 'admin') {
      this.assertOwnership(enrollment, requestingUser.id);
    }

    if (enrollment.status === EnrollmentStatus.ACTIVE) {
      throw new BadRequestException({
        message: 'ACTIVE enrollments cannot be canceled',
        errorCode: ErrorCodes.ENROLLMENT_NOT_DRAFT,
      });
    }

    if (enrollment.status === EnrollmentStatus.CANCELED) {
      throw new BadRequestException({
        message: 'Enrollment is already canceled',
        errorCode: ErrorCodes.ENROLLMENT_NOT_DRAFT,
      });
    }

    enrollment.status = EnrollmentStatus.CANCELED;
    const saved = await this.enrollmentRepo.save(enrollment);

    // Release seat reservations
    await this.seatRepo.update(
      { enrollmentId, status: In(['HELD', 'CONFIRMED']) },
      { status: 'RELEASED' },
    );

    this.logger.log(`Enrollment ${enrollmentId} canceled`, 'EnrollmentService');
    return this.toDto(saved);
  }

  private assertOwnership(enrollment: EnrollmentEntity, userId: string) {
    if (enrollment.patientId !== userId) {
      throw new ForbiddenException({
        message: 'You can only access your own enrollments',
        errorCode: ErrorCodes.RESOURCE_NOT_OWNED,
      });
    }
  }

  private generateOrderNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(100000 + Math.random() * 900000).toString();
    return `ORD-${dateStr}-${random}`;
  }

  private toDto(enrollment: EnrollmentEntity) {
    return {
      id: enrollment.id,
      patientId: enrollment.patientId,
      status: enrollment.status as EnrollmentStatus,
      enrollmentDate: enrollment.enrollmentDate
        ? enrollment.enrollmentDate.toISOString
          ? enrollment.enrollmentDate.toISOString()
          : String(enrollment.enrollmentDate)
        : null,
      notes: enrollment.notes,
      serviceLines: (enrollment.serviceLines || []).map((sl) => ({
        id: sl.id,
        serviceId: sl.serviceId,
        service: sl.service
          ? {
              id: sl.service.id,
              code: sl.service.code,
              name: sl.service.name,
              description: sl.service.description,
              basePrice: Number(sl.service.basePrice),
              category: sl.service.category,
              isActive: sl.service.isActive,
              maxSeats: sl.service.maxSeats,
              availableSeats: null,
            }
          : undefined,
        quantity: sl.quantity,
      })),
      createdAt: enrollment.createdAt.toISOString(),
      updatedAt: enrollment.updatedAt.toISOString(),
      submittedAt: enrollment.submittedAt ? enrollment.submittedAt.toISOString() : null,
    };
  }
}
