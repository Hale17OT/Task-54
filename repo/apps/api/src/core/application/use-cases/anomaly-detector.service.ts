import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { RiskEventEntity } from '../../../infrastructure/persistence/entities/risk-event.entity';
import { IncidentTicketEntity } from '../../../infrastructure/persistence/entities/incident-ticket.entity';
import { RefundEntity } from '../../../infrastructure/persistence/entities/refund.entity';
import { LoginAttemptEntity } from '../../../infrastructure/persistence/entities/login-attempt.entity';
import { DiscountAuditEntity } from '../../../infrastructure/persistence/entities/discount-audit.entity';
import { RiskEventType, RiskSeverity, IncidentStatus } from '@checc/shared/types/risk.types';
import { WinstonLogger } from '../../../infrastructure/logging/winston.logger';

@Injectable()
export class AnomalyDetectorService {
  private readonly logger = new WinstonLogger();

  constructor(
    @InjectRepository(RiskEventEntity)
    private readonly riskEventRepo: Repository<RiskEventEntity>,
    @InjectRepository(IncidentTicketEntity)
    private readonly incidentRepo: Repository<IncidentTicketEntity>,
    @InjectRepository(RefundEntity)
    private readonly refundRepo: Repository<RefundEntity>,
    @InjectRepository(LoginAttemptEntity)
    private readonly loginAttemptRepo: Repository<LoginAttemptEntity>,
    @InjectRepository(DiscountAuditEntity)
    private readonly discountAuditRepo: Repository<DiscountAuditEntity>,
  ) {}

  async checkPromoAbuse(userId: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Count actual discount applications for this user's orders in the last hour
    // by joining discount_audit_trail with orders to scope by patient
    const discountCount = await this.discountAuditRepo
      .createQueryBuilder('audit')
      .innerJoin('audit.order', 'order')
      .where('order.patientId = :userId', { userId })
      .andWhere('audit.computedAt > :since', { since: oneHourAgo })
      .andWhere('audit.discountAmount > 0')
      .getCount();

    if (discountCount >= 5) {
      await this.createRiskEventAndIncident({
        userId,
        eventType: RiskEventType.PROMO_ABUSE,
        severity: RiskSeverity.HIGH,
        details: { discountApplications: discountCount, window: '1h' },
        title: `Promo abuse detected: user ${userId}`,
        description: `User ${userId} has ${discountCount} discount applications in the last hour.`,
      });

      this.logger.warn(`Promo abuse detected for user ${userId}: ${discountCount} discount applications`, 'AnomalyDetector');
      return true;
    }

    return false;
  }

  async checkBulkRegistration(ip: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Count only registration events from this IP (tagged with '__registration__' fingerprint)
    const count = await this.loginAttemptRepo.count({
      where: {
        ipAddress: ip,
        deviceFingerprint: '__registration__',
        success: true,
        attemptedAt: MoreThan(oneHourAgo),
      },
    });

    if (count >= 3) {
      await this.createRiskEventAndIncident({
        userId: null,
        eventType: RiskEventType.BULK_REGISTRATION,
        severity: RiskSeverity.MEDIUM,
        details: { registrationCount: count, ip, window: '1h' },
        ipAddress: ip,
        title: `Bulk registration detected from IP ${ip}`,
        description: `IP ${ip} has ${count} successful registrations in the last hour.`,
      });

      this.logger.warn(`Bulk registration detected from IP ${ip}: ${count} registrations`, 'AnomalyDetector');
      return true;
    }

    return false;
  }

  async checkRepeatedRefunds(userId: string): Promise<boolean> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const count = await this.refundRepo.count({
      where: {
        requestedBy: userId,
        createdAt: MoreThan(oneDayAgo),
      },
    });

    if (count >= 3) {
      await this.createRiskEventAndIncident({
        userId,
        eventType: RiskEventType.REPEATED_REFUND,
        severity: RiskSeverity.MEDIUM,
        details: { refundCount: count, window: '24h' },
        title: `Repeated refunds detected: user ${userId}`,
        description: `User ${userId} has requested ${count} refunds in the last 24 hours.`,
      });

      this.logger.warn(`Repeated refunds detected for user ${userId}: ${count} refunds`, 'AnomalyDetector');
      return true;
    }

    return false;
  }

  private async createRiskEventAndIncident(input: {
    userId: string | null;
    eventType: RiskEventType;
    severity: RiskSeverity;
    details: Record<string, unknown>;
    ipAddress?: string;
    deviceFingerprint?: string;
    title: string;
    description: string;
  }) {
    const riskEvent = this.riskEventRepo.create({
      userId: input.userId,
      eventType: input.eventType,
      severity: input.severity,
      details: input.details,
      ipAddress: input.ipAddress || null,
      deviceFingerprint: input.deviceFingerprint || null,
    });

    const savedEvent = await this.riskEventRepo.save(riskEvent);

    const incident = this.incidentRepo.create({
      riskEventId: savedEvent.id,
      title: input.title,
      description: input.description,
      status: IncidentStatus.OPEN,
      hitLogs: input.details,
    });

    await this.incidentRepo.save(incident);
    return savedEvent;
  }
}
