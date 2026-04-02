import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from '../controllers/notification.controller';
import { NotificationService } from '../../core/application/use-cases/notification.service';
import { NotificationSchedulerService } from '../../infrastructure/scheduling/notification-scheduler.service';
import { NotificationEntity } from '../../infrastructure/persistence/entities/notification.entity';
import { NotificationDeliveryLogEntity } from '../../infrastructure/persistence/entities/notification-delivery-log.entity';
import { OrderEntity } from '../../infrastructure/persistence/entities/order.entity';
import { PaymentEntity } from '../../infrastructure/persistence/entities/payment.entity';
import { SeatReservationEntity } from '../../infrastructure/persistence/entities/seat-reservation.entity';
import { HealthCheckEntity } from '../../infrastructure/persistence/entities/health-check.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEntity,
      NotificationDeliveryLogEntity,
      OrderEntity,
      PaymentEntity,
      SeatReservationEntity,
      HealthCheckEntity,
    ]),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationSchedulerService],
  exports: [NotificationService],
})
export class NotificationModule {}
