import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from '../controllers/payment.controller';
import { PaymentService } from '../../core/application/use-cases/payment.service';
import { PaymentEntity } from '../../infrastructure/persistence/entities/payment.entity';
import { RefundEntity } from '../../infrastructure/persistence/entities/refund.entity';
import { OrderEntity } from '../../infrastructure/persistence/entities/order.entity';
import { EnrollmentEntity } from '../../infrastructure/persistence/entities/enrollment.entity';
import { AuthModule } from './auth.module';
import { RiskModule } from './risk.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentEntity,
      RefundEntity,
      OrderEntity,
      EnrollmentEntity,
    ]),
    AuthModule,
    RiskModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
