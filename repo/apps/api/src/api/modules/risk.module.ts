import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiskController } from '../controllers/risk.controller';
import { RiskService } from '../../core/application/use-cases/risk.service';
import { AnomalyDetectorService } from '../../core/application/use-cases/anomaly-detector.service';
import { CaptchaService } from '../../infrastructure/security/captcha.service';
import { IpRuleEntity } from '../../infrastructure/persistence/entities/ip-rule.entity';
import { RiskEventEntity } from '../../infrastructure/persistence/entities/risk-event.entity';
import { IncidentTicketEntity } from '../../infrastructure/persistence/entities/incident-ticket.entity';
import { CaptchaChallengeEntity } from '../../infrastructure/persistence/entities/captcha-challenge.entity';
import { RefundEntity } from '../../infrastructure/persistence/entities/refund.entity';
import { LoginAttemptEntity } from '../../infrastructure/persistence/entities/login-attempt.entity';
import { DiscountAuditEntity } from '../../infrastructure/persistence/entities/discount-audit.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      IpRuleEntity,
      RiskEventEntity,
      IncidentTicketEntity,
      CaptchaChallengeEntity,
      RefundEntity,
      LoginAttemptEntity,
      DiscountAuditEntity,
    ]),
  ],
  controllers: [RiskController],
  providers: [RiskService, AnomalyDetectorService, CaptchaService],
  exports: [RiskService, AnomalyDetectorService, CaptchaService],
})
export class RiskModule {}
