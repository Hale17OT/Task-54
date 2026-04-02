import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingController } from '../controllers/pricing.controller';
import { PricingService } from '../../core/application/use-cases/pricing.service';
import { PricingRuleEntity } from '../../infrastructure/persistence/entities/pricing-rule.entity';
import { DiscountAuditEntity } from '../../infrastructure/persistence/entities/discount-audit.entity';
import { OrderEntity } from '../../infrastructure/persistence/entities/order.entity';
import { OrderLineEntity } from '../../infrastructure/persistence/entities/order-line.entity';
import { CatalogServiceEntity } from '../../infrastructure/persistence/entities/catalog-service.entity';
import { RiskModule } from './risk.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PricingRuleEntity,
      DiscountAuditEntity,
      OrderEntity,
      OrderLineEntity,
      CatalogServiceEntity,
    ]),
    RiskModule,
  ],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
