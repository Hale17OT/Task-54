import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { HealthCheckEntity } from '../persistence/entities/health-check.entity';
import { HealthCheckVersionEntity } from '../persistence/entities/health-check-version.entity';
import { HealthCheckStatus } from '@checc/shared/types/health-check.types';
import { WinstonLogger } from '../logging/winston.logger';

@Injectable()
export class ComplianceCheckService {
  private readonly logger = new WinstonLogger();

  constructor(
    @InjectRepository(HealthCheckEntity)
    private readonly healthCheckRepo: Repository<HealthCheckEntity>,
    @InjectRepository(HealthCheckVersionEntity)
    private readonly versionRepo: Repository<HealthCheckVersionEntity>,
  ) {}

  @Cron('0 0 * * * *') // Every hour
  async handleComplianceCheck() {
    const slaDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find health_check_versions where status='AWAITING_REVIEW' AND created_at + 24h < NOW()
    const overdueVersions = await this.versionRepo.find({
      where: {
        status: HealthCheckStatus.AWAITING_REVIEW,
        createdAt: LessThan(slaDeadline),
      },
    });

    for (const version of overdueVersions) {
      // Flag parent health_check with compliance_breach=true
      await this.healthCheckRepo.update(
        { id: version.healthCheckId },
        { complianceBreach: true },
      );

      this.logger.warn(
        `Compliance breach: Health check ${version.healthCheckId} version ${version.versionNumber} exceeded 24-hour SLA`,
        'ComplianceCheckService',
      );
    }

    if (overdueVersions.length > 0) {
      this.logger.warn(
        `Compliance check flagged ${overdueVersions.length} overdue report(s)`,
        'ComplianceCheckService',
      );
    }
  }
}
