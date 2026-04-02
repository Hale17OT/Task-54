import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentController } from '../controllers/enrollment.controller';
import { OrderController } from '../controllers/order.controller';
import { CatalogController } from '../controllers/catalog.controller';
import { EnrollmentService } from '../../core/application/use-cases/enrollment.service';
import { OrderService } from '../../core/application/use-cases/order.service';
import { OrderTimeoutService } from '../../infrastructure/scheduling/order-timeout.service';
import { EnrollmentEntity } from '../../infrastructure/persistence/entities/enrollment.entity';
import { EnrollmentServiceLineEntity } from '../../infrastructure/persistence/entities/enrollment-service-line.entity';
import { CatalogServiceEntity } from '../../infrastructure/persistence/entities/catalog-service.entity';
import { SeatReservationEntity } from '../../infrastructure/persistence/entities/seat-reservation.entity';
import { OrderEntity } from '../../infrastructure/persistence/entities/order.entity';
import { OrderLineEntity } from '../../infrastructure/persistence/entities/order-line.entity';
import { AuthModule } from './auth.module';
import { PricingModule } from './pricing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EnrollmentEntity,
      EnrollmentServiceLineEntity,
      CatalogServiceEntity,
      SeatReservationEntity,
      OrderEntity,
      OrderLineEntity,
    ]),
    AuthModule,
    PricingModule,
  ],
  controllers: [EnrollmentController, OrderController, CatalogController],
  providers: [EnrollmentService, OrderService, OrderTimeoutService],
  exports: [EnrollmentService, OrderService],
})
export class EnrollmentModule {}
