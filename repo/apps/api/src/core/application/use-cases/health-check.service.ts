import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HealthCheckEntity } from '../../../infrastructure/persistence/entities/health-check.entity';
import { HealthCheckVersionEntity } from '../../../infrastructure/persistence/entities/health-check-version.entity';
import { ResultItemEntity } from '../../../infrastructure/persistence/entities/result-item.entity';
import { ReportTemplateEntity } from '../../../infrastructure/persistence/entities/report-template.entity';
import { HealthCheckStatus, AbnormalFlag } from '@checc/shared/types/health-check.types';
import { ErrorCodes } from '@checc/shared/constants/error-codes';
import { WinstonLogger } from '../../../infrastructure/logging/winston.logger';
import type { CreateHealthCheckInput, UpdateHealthCheckInput } from '@checc/shared/schemas/health-check.schema';

@Injectable()
export class HealthCheckService {
  private readonly logger = new WinstonLogger();

  constructor(
    @InjectRepository(HealthCheckEntity)
    private readonly healthCheckRepo: Repository<HealthCheckEntity>,
    @InjectRepository(HealthCheckVersionEntity)
    private readonly versionRepo: Repository<HealthCheckVersionEntity>,
    @InjectRepository(ResultItemEntity)
    private readonly resultItemRepo: Repository<ResultItemEntity>,
    @InjectRepository(ReportTemplateEntity)
    private readonly templateRepo: Repository<ReportTemplateEntity>,
  ) {}

  async create(input: CreateHealthCheckInput, staffUserId: string) {
    const healthCheck = this.healthCheckRepo.create({
      patientId: input.patientId,
      templateId: input.templateId,
      orderId: input.orderId || null,
      status: HealthCheckStatus.DRAFT,
      currentVersion: 1,
      complianceBreach: false,
      createdBy: staffUserId,
    });
    const savedHc = await this.healthCheckRepo.save(healthCheck);

    const version = this.versionRepo.create({
      healthCheckId: savedHc.id,
      versionNumber: 1,
      contentSnapshot: { resultItems: input.resultItems },
      changeSummary: null,
      status: HealthCheckStatus.DRAFT,
      createdBy: staffUserId,
    });
    const savedVersion = await this.versionRepo.save(version);

    // Populate prior values from patient's most recent prior report
    const priorValues = await this.getPriorValues(input.patientId, savedHc.id);

    const resultItems = input.resultItems.map((item, index) => {
      const numValue = parseFloat(item.value);
      const { isAbnormal, flag } = this.detectAbnormalFlag(
        numValue,
        item.referenceLow ?? null,
        item.referenceHigh ?? null,
      );

      const prior = priorValues.get(item.testCode);

      return this.resultItemRepo.create({
        versionId: savedVersion.id,
        testName: item.testName,
        testCode: item.testCode,
        value: item.value,
        unit: item.unit || '',
        referenceLow: item.referenceLow ?? null,
        referenceHigh: item.referenceHigh ?? null,
        isAbnormal,
        flag,
        priorValue: prior?.value ?? null,
        priorDate: prior?.date ?? null,
        sortOrder: index,
      });
    });

    savedVersion.resultItems = await this.resultItemRepo.save(resultItems);

    this.logger.log(
      `Health check created: ${savedHc.id} for patient ${input.patientId}`,
      'HealthCheckService',
    );

    return this.toDto(savedHc, savedVersion);
  }

  async findById(id: string) {
    const healthCheck = await this.healthCheckRepo.findOne({
      where: { id },
    });

    if (!healthCheck) {
      throw new NotFoundException({
        message: 'Health check report not found',
        errorCode: ErrorCodes.REPORT_NOT_FOUND,
      });
    }

    const version = await this.versionRepo.findOne({
      where: { healthCheckId: id, versionNumber: healthCheck.currentVersion },
      relations: ['resultItems'],
    });

    return this.toDto(healthCheck, version || undefined);
  }

  async findByPatient(patientId: string, page: number, limit: number) {
    const [items, total] = await this.healthCheckRepo.findAndCount({
      where: { patientId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: items.map((hc) => this.toDto(hc)),
      total,
      page,
      limit,
    };
  }

  async findAll(page: number, limit: number) {
    const [items, total] = await this.healthCheckRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: items.map((hc) => this.toDto(hc)),
      total,
      page,
      limit,
    };
  }

  async update(id: string, input: UpdateHealthCheckInput, staffUserId: string) {
    const healthCheck = await this.healthCheckRepo.findOne({
      where: { id },
    });

    if (!healthCheck) {
      throw new NotFoundException({
        message: 'Health check report not found',
        errorCode: ErrorCodes.REPORT_NOT_FOUND,
      });
    }

    const currentVersion = await this.versionRepo.findOne({
      where: { healthCheckId: id, versionNumber: healthCheck.currentVersion },
    });

    if (!currentVersion) {
      throw new NotFoundException({
        message: 'Health check report not found',
        errorCode: ErrorCodes.REPORT_NOT_FOUND,
      });
    }

    // If current version is SIGNED, create an AMENDED version
    const newVersionNumber = healthCheck.currentVersion + 1;
    const newStatus = HealthCheckStatus.DRAFT;

    if (currentVersion.status === HealthCheckStatus.SIGNED) {
      healthCheck.status = HealthCheckStatus.AMENDED;
    }

    const newVersion = this.versionRepo.create({
      healthCheckId: id,
      versionNumber: newVersionNumber,
      contentSnapshot: { resultItems: input.resultItems },
      changeSummary: input.changeSummary || null,
      status: newStatus,
      createdBy: staffUserId,
    });
    const savedVersion = await this.versionRepo.save(newVersion);

    // Populate prior values
    const priorValues = await this.getPriorValues(healthCheck.patientId, id);

    const resultItems = input.resultItems.map((item, index) => {
      const numValue = parseFloat(item.value);
      const { isAbnormal, flag } = this.detectAbnormalFlag(
        numValue,
        item.referenceLow ?? null,
        item.referenceHigh ?? null,
      );

      const prior = priorValues.get(item.testCode);

      return this.resultItemRepo.create({
        versionId: savedVersion.id,
        testName: item.testName,
        testCode: item.testCode,
        value: item.value,
        unit: item.unit || '',
        referenceLow: item.referenceLow ?? null,
        referenceHigh: item.referenceHigh ?? null,
        isAbnormal,
        flag,
        priorValue: prior?.value ?? null,
        priorDate: prior?.date ?? null,
        sortOrder: index,
      });
    });

    savedVersion.resultItems = await this.resultItemRepo.save(resultItems);

    healthCheck.currentVersion = newVersionNumber;
    await this.healthCheckRepo.save(healthCheck);

    this.logger.log(
      `Health check updated: ${id}, new version ${newVersionNumber}`,
      'HealthCheckService',
    );

    return this.toDto(healthCheck, savedVersion);
  }

  async submitForReview(id: string) {
    const healthCheck = await this.healthCheckRepo.findOne({
      where: { id },
    });

    if (!healthCheck) {
      throw new NotFoundException({
        message: 'Health check report not found',
        errorCode: ErrorCodes.REPORT_NOT_FOUND,
      });
    }

    const version = await this.versionRepo.findOne({
      where: { healthCheckId: id, versionNumber: healthCheck.currentVersion },
      relations: ['resultItems'],
    });

    if (!version) {
      throw new NotFoundException({
        message: 'Health check report not found',
        errorCode: ErrorCodes.REPORT_NOT_FOUND,
      });
    }

    if (version.status !== HealthCheckStatus.DRAFT) {
      throw new BadRequestException({
        message: 'Only DRAFT versions can be submitted for review',
        errorCode: ErrorCodes.REPORT_VERSION_LOCKED,
      });
    }

    version.status = HealthCheckStatus.AWAITING_REVIEW;
    healthCheck.status = HealthCheckStatus.AWAITING_REVIEW;

    await this.versionRepo.save(version);
    await this.healthCheckRepo.save(healthCheck);

    this.logger.log(
      `Health check ${id} submitted for review`,
      'HealthCheckService',
    );

    return this.toDto(healthCheck, version);
  }

  async getVersionHistory(healthCheckId: string) {
    const healthCheck = await this.healthCheckRepo.findOne({
      where: { id: healthCheckId },
    });

    if (!healthCheck) {
      throw new NotFoundException({
        message: 'Health check report not found',
        errorCode: ErrorCodes.REPORT_NOT_FOUND,
      });
    }

    const versions = await this.versionRepo.find({
      where: { healthCheckId },
      relations: ['resultItems'],
      order: { versionNumber: 'ASC' },
    });

    return versions.map((v) => this.toVersionDto(v));
  }

  async getTemplates() {
    const templates = await this.templateRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });

    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      sections: t.sections,
      isActive: t.isActive,
    }));
  }

  detectAbnormalFlag(
    value: number,
    referenceLow: number | null,
    referenceHigh: number | null,
  ): { isAbnormal: boolean; flag: string | null } {
    if (isNaN(value)) {
      return { isAbnormal: false, flag: null };
    }

    if (referenceLow !== null && referenceHigh !== null) {
      const criticalLow = referenceLow - (referenceHigh - referenceLow) * 0.5;
      const criticalHigh = referenceHigh + (referenceHigh - referenceLow) * 0.5;

      if (value < criticalLow) {
        return { isAbnormal: true, flag: AbnormalFlag.LL };
      }
      if (value > criticalHigh) {
        return { isAbnormal: true, flag: AbnormalFlag.HH };
      }
    }

    if (referenceLow !== null && value < referenceLow) {
      return { isAbnormal: true, flag: AbnormalFlag.L };
    }

    if (referenceHigh !== null && value > referenceHigh) {
      return { isAbnormal: true, flag: AbnormalFlag.H };
    }

    return { isAbnormal: false, flag: null };
  }

  private async getPriorValues(
    patientId: string,
    excludeHealthCheckId: string,
  ): Promise<Map<string, { value: string; date: Date }>> {
    const priorMap = new Map<string, { value: string; date: Date }>();

    // Find the most recent signed/finalized health check for this patient
    const priorHealthCheck = await this.healthCheckRepo.findOne({
      where: [
        { patientId, status: HealthCheckStatus.SIGNED },
        { patientId, status: HealthCheckStatus.AMENDED },
      ],
      order: { createdAt: 'DESC' },
    });

    if (!priorHealthCheck || priorHealthCheck.id === excludeHealthCheckId) {
      return priorMap;
    }

    const priorVersion = await this.versionRepo.findOne({
      where: {
        healthCheckId: priorHealthCheck.id,
        versionNumber: priorHealthCheck.currentVersion,
      },
      relations: ['resultItems'],
    });

    if (priorVersion?.resultItems) {
      for (const item of priorVersion.resultItems) {
        priorMap.set(item.testCode, {
          value: item.value,
          date: priorVersion.createdAt,
        });
      }
    }

    return priorMap;
  }

  private toDto(healthCheck: HealthCheckEntity, version?: HealthCheckVersionEntity) {
    const dto: Record<string, unknown> = {
      id: healthCheck.id,
      patientId: healthCheck.patientId,
      templateId: healthCheck.templateId,
      orderId: healthCheck.orderId,
      status: healthCheck.status,
      currentVersion: healthCheck.currentVersion,
      complianceBreach: healthCheck.complianceBreach,
      createdBy: healthCheck.createdBy,
      createdAt: healthCheck.createdAt.toISOString(),
      updatedAt: healthCheck.updatedAt.toISOString(),
    };

    if (version) {
      dto.currentVersionData = this.toVersionDto(version);
    }

    return dto;
  }

  private toVersionDto(version: HealthCheckVersionEntity) {
    return {
      id: version.id,
      healthCheckId: version.healthCheckId,
      versionNumber: version.versionNumber,
      status: version.status,
      changeSummary: version.changeSummary,
      createdBy: version.createdBy,
      createdAt: version.createdAt.toISOString(),
      resultItems: (version.resultItems || [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          id: item.id,
          testName: item.testName,
          testCode: item.testCode,
          value: item.value,
          unit: item.unit,
          referenceLow: item.referenceLow !== null ? Number(item.referenceLow) : null,
          referenceHigh: item.referenceHigh !== null ? Number(item.referenceHigh) : null,
          isAbnormal: item.isAbnormal,
          flag: item.flag,
          priorValue: item.priorValue,
          priorDate: item.priorDate ? item.priorDate.toISOString() : null,
        })),
    };
  }
}
