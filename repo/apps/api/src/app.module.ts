import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './api/controllers/health.controller';
import { AuthModule } from './api/modules/auth.module';
import { EnrollmentModule } from './api/modules/enrollment.module';
import { PricingModule } from './api/modules/pricing.module';
import { PaymentModule } from './api/modules/payment.module';
import { HealthCheckModule } from './api/modules/health-check.module';
import { NotificationModule } from './api/modules/notification.module';
import { ContentModule } from './api/modules/content.module';
import { RiskModule } from './api/modules/risk.module';
import { JwtAuthGuard } from './api/guards/jwt-auth.guard';
import { RolesGuard } from './api/guards/roles.guard';
import { RateLimitGuard } from './api/guards/rate-limit.guard';
import { IpAllowDenyGuard } from './api/guards/ip-allow-deny.guard';
import { IpRuleEntity } from './infrastructure/persistence/entities/ip-rule.entity';
import { getDatabaseConfig } from './infrastructure/persistence/database.config';

@Module({
  imports: [
    TypeOrmModule.forRoot(getDatabaseConfig()),
    TypeOrmModule.forFeature([IpRuleEntity]),
    ScheduleModule.forRoot(),
    AuthModule,
    EnrollmentModule,
    PricingModule,
    PaymentModule,
    HealthCheckModule,
    NotificationModule,
    ContentModule,
    RiskModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: IpAllowDenyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
