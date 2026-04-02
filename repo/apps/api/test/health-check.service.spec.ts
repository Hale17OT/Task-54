import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { HealthCheckService } from '../src/core/application/use-cases/health-check.service';
import { HealthCheckEntity } from '../src/infrastructure/persistence/entities/health-check.entity';
import { HealthCheckVersionEntity } from '../src/infrastructure/persistence/entities/health-check-version.entity';
import { ResultItemEntity } from '../src/infrastructure/persistence/entities/result-item.entity';
import { ReportTemplateEntity } from '../src/infrastructure/persistence/entities/report-template.entity';
import { HealthCheckStatus, AbnormalFlag } from '@checc/shared/types/health-check.types';

describe('HealthCheckService', () => {
  let service: HealthCheckService;
  let healthCheckRepo: Record<string, jest.Mock>;
  let versionRepo: Record<string, jest.Mock>;
  let resultItemRepo: Record<string, jest.Mock>;
  let templateRepo: Record<string, jest.Mock>;

  const staffUserId = 'staff-user-123';
  const patientId = 'patient-456';
  const templateId = 'template-789';
  const healthCheckId = 'hc-001';

  const mockHealthCheck = {
    id: healthCheckId,
    patientId,
    templateId,
    orderId: null,
    status: HealthCheckStatus.DRAFT,
    currentVersion: 1,
    complianceBreach: false,
    createdBy: staffUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVersion = {
    id: 'version-001',
    healthCheckId,
    versionNumber: 1,
    contentSnapshot: {},
    changeSummary: null,
    status: HealthCheckStatus.DRAFT,
    createdBy: staffUserId,
    createdAt: new Date(),
    resultItems: [],
  };

  const baseInput = {
    patientId,
    templateId,
    resultItems: [
      {
        testName: 'Hemoglobin',
        testCode: 'HGB',
        value: '14.5',
        unit: 'g/dL',
        referenceLow: 12.0,
        referenceHigh: 17.5,
      },
      {
        testName: 'White Blood Cells',
        testCode: 'WBC',
        value: '3.0',
        unit: '10^3/uL',
        referenceLow: 4.5,
        referenceHigh: 11.0,
      },
      {
        testName: 'Glucose',
        testCode: 'GLU',
        value: '250',
        unit: 'mg/dL',
        referenceLow: 70,
        referenceHigh: 100,
      },
    ],
  };

  beforeEach(async () => {
    healthCheckRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: healthCheckId, createdAt: new Date(), updatedAt: new Date() })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      update: jest.fn(),
    };

    versionRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'version-001', createdAt: new Date(), resultItems: [] })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };

    resultItemRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: `item-${Math.random().toString(36).slice(2, 8)}` })),
      save: jest.fn().mockImplementation((entities) => Promise.resolve(
        Array.isArray(entities) ? entities : [entities],
      )),
    };

    templateRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthCheckService,
        { provide: getRepositoryToken(HealthCheckEntity), useValue: healthCheckRepo },
        { provide: getRepositoryToken(HealthCheckVersionEntity), useValue: versionRepo },
        { provide: getRepositoryToken(ResultItemEntity), useValue: resultItemRepo },
        { provide: getRepositoryToken(ReportTemplateEntity), useValue: templateRepo },
      ],
    }).compile();

    service = module.get<HealthCheckService>(HealthCheckService);
  });

  describe('create', () => {
    it('should create a health check with result items', async () => {
      // No prior health check for this patient
      healthCheckRepo.findOne.mockResolvedValue(null);

      const result = await service.create(baseInput, staffUserId);

      expect(healthCheckRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId,
          templateId,
          status: HealthCheckStatus.DRAFT,
          currentVersion: 1,
          createdBy: staffUserId,
        }),
      );
      expect(healthCheckRepo.save).toHaveBeenCalled();
      expect(versionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          versionNumber: 1,
          status: HealthCheckStatus.DRAFT,
        }),
      );
      expect(versionRepo.save).toHaveBeenCalled();
      expect(resultItemRepo.create).toHaveBeenCalledTimes(3);
      expect(resultItemRepo.save).toHaveBeenCalled();
    });
  });

  describe('abnormal flag detection', () => {
    it('should flag value below reference low as L', () => {
      const { isAbnormal, flag } = service.detectAbnormalFlag(3.0, 4.5, 11.0);
      expect(isAbnormal).toBe(true);
      expect(flag).toBe(AbnormalFlag.L);
    });

    it('should flag value above reference high as H', () => {
      // range 70-100, critical high = 100 + (100-70)*0.5 = 115
      // value 110 is above high (100) but below critical high (115), so flag=H
      const { isAbnormal, flag } = service.detectAbnormalFlag(110, 70, 100);
      expect(isAbnormal).toBe(true);
      expect(flag).toBe(AbnormalFlag.H);
    });

    it('should not flag value within reference range', () => {
      const { isAbnormal, flag } = service.detectAbnormalFlag(14.5, 12.0, 17.5);
      expect(isAbnormal).toBe(false);
      expect(flag).toBeNull();
    });

    it('should flag critically low value as LL', () => {
      // range 4.5-11.0, critical low = 4.5 - (11.0-4.5)*0.5 = 4.5 - 3.25 = 1.25
      const { isAbnormal, flag } = service.detectAbnormalFlag(1.0, 4.5, 11.0);
      expect(isAbnormal).toBe(true);
      expect(flag).toBe(AbnormalFlag.LL);
    });

    it('should flag critically high value as HH', () => {
      // range 70-100, critical high = 100 + (100-70)*0.5 = 100 + 15 = 115
      const { isAbnormal, flag } = service.detectAbnormalFlag(120, 70, 100);
      expect(isAbnormal).toBe(true);
      expect(flag).toBe(AbnormalFlag.HH);
    });
  });

  describe('update', () => {
    it('should create a new version when updating', async () => {
      healthCheckRepo.findOne.mockResolvedValueOnce({ ...mockHealthCheck });
      versionRepo.findOne.mockResolvedValueOnce({ ...mockVersion });
      // For prior values lookup
      healthCheckRepo.findOne.mockResolvedValueOnce(null);

      const updateInput = {
        resultItems: [
          {
            testName: 'Hemoglobin',
            testCode: 'HGB',
            value: '15.0',
            unit: 'g/dL',
            referenceLow: 12.0,
            referenceHigh: 17.5,
          },
        ],
        changeSummary: 'Corrected hemoglobin value',
      };

      const result = await service.update(healthCheckId, updateInput, staffUserId);

      expect(versionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          versionNumber: 2,
          changeSummary: 'Corrected hemoglobin value',
        }),
      );
      expect(healthCheckRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentVersion: 2 }),
      );
    });

    it('should create amended version when updating a signed health check', async () => {
      const signedHc = {
        ...mockHealthCheck,
        status: HealthCheckStatus.SIGNED,
      };
      const signedVersion = {
        ...mockVersion,
        status: HealthCheckStatus.SIGNED,
      };

      healthCheckRepo.findOne.mockResolvedValueOnce(signedHc);
      versionRepo.findOne.mockResolvedValueOnce(signedVersion);
      // For prior values lookup
      healthCheckRepo.findOne.mockResolvedValueOnce(null);

      const updateInput = {
        resultItems: [
          {
            testName: 'Hemoglobin',
            testCode: 'HGB',
            value: '15.0',
            unit: 'g/dL',
            referenceLow: 12.0,
            referenceHigh: 17.5,
          },
        ],
      };

      await service.update(healthCheckId, updateInput, staffUserId);

      // Header status should be AMENDED
      expect(healthCheckRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: HealthCheckStatus.AMENDED }),
      );
      // New version should be DRAFT
      expect(versionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          versionNumber: 2,
          status: HealthCheckStatus.DRAFT,
        }),
      );
    });
  });

  describe('submitForReview', () => {
    it('should transition status to AWAITING_REVIEW', async () => {
      healthCheckRepo.findOne.mockResolvedValueOnce({ ...mockHealthCheck });
      versionRepo.findOne.mockResolvedValueOnce({
        ...mockVersion,
        resultItems: [],
      });

      await service.submitForReview(healthCheckId);

      expect(versionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: HealthCheckStatus.AWAITING_REVIEW }),
      );
      expect(healthCheckRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: HealthCheckStatus.AWAITING_REVIEW }),
      );
    });

    it('should reject if version is not DRAFT', async () => {
      healthCheckRepo.findOne.mockResolvedValueOnce({ ...mockHealthCheck });
      versionRepo.findOne.mockResolvedValueOnce({
        ...mockVersion,
        status: HealthCheckStatus.SIGNED,
        resultItems: [],
      });

      await expect(service.submitForReview(healthCheckId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if health check not found', async () => {
      healthCheckRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.submitForReview('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('prior values', () => {
    it('should populate prior values from patient history', async () => {
      const priorHcId = 'prior-hc-001';
      const priorDate = new Date('2025-01-15');
      const priorHealthCheck = {
        id: priorHcId,
        patientId,
        currentVersion: 1,
        createdAt: new Date('2025-01-15'),
      };

      const priorVersion = {
        id: 'prior-version-001',
        healthCheckId: priorHcId,
        versionNumber: 1,
        createdAt: priorDate,
        resultItems: [
          {
            testCode: 'HGB',
            value: '13.5',
            sortOrder: 0,
          },
          {
            testCode: 'WBC',
            value: '6.0',
            sortOrder: 1,
          },
        ],
      };

      // First findOne for save (returns the created HC)
      healthCheckRepo.findOne
        .mockResolvedValueOnce(priorHealthCheck); // prior lookup

      versionRepo.findOne
        .mockResolvedValueOnce(priorVersion); // prior version lookup

      const result = await service.create(baseInput, staffUserId);

      // Check that resultItemRepo.create was called with prior values
      const createCalls = resultItemRepo.create.mock.calls;
      const hgbCall = createCalls.find(
        (call: any[]) => call[0].testCode === 'HGB',
      );
      expect(hgbCall).toBeDefined();
      expect(hgbCall![0].priorValue).toBe('13.5');

      const wbcCall = createCalls.find(
        (call: any[]) => call[0].testCode === 'WBC',
      );
      expect(wbcCall).toBeDefined();
      expect(wbcCall![0].priorValue).toBe('6.0');
    });
  });
});
