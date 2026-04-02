import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource } from 'typeorm';
import { OrderEntity } from '../persistence/entities/order.entity';
import { EnrollmentEntity } from '../persistence/entities/enrollment.entity';
import { SeatReservationEntity } from '../persistence/entities/seat-reservation.entity';
import { OrderStatus } from '@checc/shared/types/order.types';
import { EnrollmentStatus } from '@checc/shared/types/enrollment.types';
import { WinstonLogger } from '../logging/winston.logger';

@Injectable()
export class OrderTimeoutService {
  private readonly logger = new WinstonLogger();

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,
    @InjectRepository(SeatReservationEntity)
    private readonly seatRepo: Repository<SeatReservationEntity>,
    private readonly dataSource: DataSource,
  ) {}

  @Cron('0 */5 * * * *')
  async handleOrderTimeouts() {
    const now = new Date();

    // Find candidates (unlocked read for discovery)
    const overdueOrders = await this.orderRepo.find({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        autoCancelAt: LessThan(now),
      },
    });

    let canceledCount = 0;
    for (const candidate of overdueOrders) {
      try {
        await this.dataSource.transaction(async (manager) => {
          // Re-read with lock to prevent race with concurrent payment recording
          const order = await manager.findOne(OrderEntity, {
            where: { id: candidate.id },
            lock: { mode: 'pessimistic_write' },
          });

          // Skip if already paid/canceled between discovery and lock acquisition
          if (!order || order.status !== OrderStatus.PENDING_PAYMENT) return;

          order.status = OrderStatus.CANCELED;
          await manager.save(OrderEntity, order);

          await manager.update(EnrollmentEntity,
            { id: order.enrollmentId },
            { status: EnrollmentStatus.DRAFT, submittedAt: null },
          );

          await manager
            .createQueryBuilder()
            .update(SeatReservationEntity)
            .set({ status: 'RELEASED' })
            .where('enrollment_id = :eid', { eid: order.enrollmentId })
            .andWhere('status IN (:...statuses)', { statuses: ['HELD', 'CONFIRMED'] })
            .execute();

          canceledCount++;
          this.logger.log(`Auto-canceled overdue order ${order.orderNumber}`, 'OrderTimeoutService');
        });
      } catch (err) {
        this.logger.error(
          `Failed to auto-cancel order ${candidate.id}: ${err instanceof Error ? err.message : 'unknown'}`,
          undefined,
          'OrderTimeoutService',
        );
      }
    }

    if (canceledCount > 0) {
      this.logger.log(`Auto-canceled ${canceledCount} overdue order(s)`, 'OrderTimeoutService');
    }

    // Release expired seat reservations (atomic, no race concern)
    const expiredCount = await this.seatRepo
      .createQueryBuilder()
      .update(SeatReservationEntity)
      .set({ status: 'RELEASED' })
      .where('status = :status', { status: 'HELD' })
      .andWhere('expires_at < :now', { now })
      .execute();

    if (expiredCount.affected && expiredCount.affected > 0) {
      this.logger.log(`Released ${expiredCount.affected} expired seat reservation(s)`, 'OrderTimeoutService');
    }
  }
}
