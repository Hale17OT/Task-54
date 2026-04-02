import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IpRuleEntity } from '../../../infrastructure/persistence/entities/ip-rule.entity';
import { RiskEventEntity } from '../../../infrastructure/persistence/entities/risk-event.entity';
import { IncidentTicketEntity } from '../../../infrastructure/persistence/entities/incident-ticket.entity';
import { ErrorCodes } from '@checc/shared/constants/error-codes';
import { WinstonLogger } from '../../../infrastructure/logging/winston.logger';

@Injectable()
export class RiskService {
  private readonly logger = new WinstonLogger();

  constructor(
    @InjectRepository(IpRuleEntity)
    private readonly ipRuleRepo: Repository<IpRuleEntity>,
    @InjectRepository(RiskEventEntity)
    private readonly riskEventRepo: Repository<RiskEventEntity>,
    @InjectRepository(IncidentTicketEntity)
    private readonly incidentRepo: Repository<IncidentTicketEntity>,
  ) {}

  async createIpRule(
    input: { ipAddress: string; cidrMask?: number; ruleType: string; reason?: string; expiresAt?: string },
    userId: string,
  ) {
    const cidrMask = input.cidrMask ?? 32;
    if (cidrMask < 0 || cidrMask > 32) {
      throw new BadRequestException({
        message: `Invalid CIDR mask: ${cidrMask}. Must be between 0 and 32.`,
        errorCode: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const rule = this.ipRuleRepo.create({
      ipAddress: input.ipAddress,
      cidrMask,
      ruleType: input.ruleType,
      reason: input.reason || null,
      createdBy: userId,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    });

    const saved = await this.ipRuleRepo.save(rule);
    this.logger.log(`IP rule created: ${saved.id} (${input.ruleType} ${input.ipAddress})`, 'RiskService');
    return saved;
  }

  async deleteIpRule(id: string) {
    const rule = await this.ipRuleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException({
        message: 'IP rule not found',
        errorCode: ErrorCodes.NOT_FOUND,
      });
    }
    await this.ipRuleRepo.remove(rule);
    this.logger.log(`IP rule deleted: ${id}`, 'RiskService');
  }

  async listIpRules(page: number, limit: number) {
    const [data, total] = await this.ipRuleRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async checkIp(ip: string): Promise<{ allowed: boolean }> {
    const rules = await this.ipRuleRepo.find();
    const now = new Date();

    const activeRules = rules.filter((r) => !r.expiresAt || r.expiresAt > now);

    const denyMatch = activeRules.some(
      (r) => r.ruleType === 'deny' && this.ipMatches(ip, r.ipAddress, r.cidrMask),
    );

    if (!denyMatch) return { allowed: true };

    const allowOverride = activeRules.some(
      (r) => r.ruleType === 'allow' && this.ipMatches(ip, r.ipAddress, r.cidrMask),
    );

    return { allowed: allowOverride };
  }

  async listRiskEvents(page: number, limit: number) {
    const [data, total] = await this.riskEventRepo.findAndCount({
      order: { detectedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async listIncidents(page: number, limit: number, status?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [data, total] = await this.incidentRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async updateIncident(
    id: string,
    data: { status?: string; assignedTo?: string; resolutionNotes?: string },
  ) {
    const incident = await this.incidentRepo.findOne({ where: { id } });
    if (!incident) {
      throw new NotFoundException({
        message: 'Incident not found',
        errorCode: ErrorCodes.NOT_FOUND,
      });
    }

    if (data.status) incident.status = data.status;
    if (data.assignedTo !== undefined) incident.assignedTo = data.assignedTo;
    if (data.resolutionNotes !== undefined) incident.resolutionNotes = data.resolutionNotes;

    if (data.status === 'RESOLVED' || data.status === 'DISMISSED') {
      incident.resolvedAt = new Date();
    }

    const saved = await this.incidentRepo.save(incident);
    this.logger.log(`Incident updated: ${id} → ${data.status || 'updated'}`, 'RiskService');
    return saved;
  }

  private ipMatches(requestIp: string, ruleIp: string, cidrMask: number): boolean {
    const normalizedReq = requestIp.replace(/^::ffff:/, '');
    const normalizedRule = ruleIp.replace(/^::ffff:/, '');

    if (cidrMask === 32) {
      return normalizedReq === normalizedRule;
    }

    const reqNum = this.ipToNumber(normalizedReq);
    const ruleNum = this.ipToNumber(normalizedRule);
    if (reqNum === null || ruleNum === null) return false;

    const mask = (~0 << (32 - cidrMask)) >>> 0;
    return (reqNum & mask) === (ruleNum & mask);
  }

  private ipToNumber(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    let result = 0;
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > 255) return null;
      result = (result << 8) + num;
    }
    return result >>> 0;
  }
}
