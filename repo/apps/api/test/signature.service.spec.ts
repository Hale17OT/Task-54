import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SignatureService } from '../src/core/application/use-cases/signature.service';
import { AuthService } from '../src/core/application/use-cases/auth.service';
import { PdfExportService } from '../src/infrastructure/pdf/pdf-export.service';
import { HealthCheckEntity } from '../src/infrastructure/persistence/entities/health-check.entity';
import { HealthCheckVersionEntity } from '../src/infrastructure/persistence/entities/health-check-version.entity';
import { ReportSignatureEntity } from '../src/infrastructure/persistence/entities/report-signature.entity';
import { HealthCheckStatus } from '@checc/shared/types/health-check.types';
import { UserRole } from '@checc/shared/constants/roles';

describe('SignatureService', () => {
  let service: SignatureService;
  let authService: { verifyCredentials: jest.Mock };
  let pdfExportService: { generateReport: jest.Mock };
  let healthCheckRepo: Record<string, jest.Mock>;
  let versionRepo: Record<string, jest.Mock>;
  let signatureRepo: Record<string, jest.Mock>;

  const healthCheckId = 'hc-001';
  const ipAddress = '192.168.1.1';

  const mockReviewer = {
    id: 'reviewer-123',
    username: 'dr_reviewer',
    email: 'reviewer@test.com',
    passwordHash: 'hashed',
    role: UserRole.REVIEWER,
    fullName: 'Dr. Reviewer',
    isActive: true,
    lockedUntil: null,
    canApproveRefunds: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStaffUser = {
    ...mockReviewer,
    id: 'staff-456',
    username: 'staff_user',
    role: UserRole.STAFF,
    fullName: 'Staff User',
  };

  const mockHealthCheck = {
    id: healthCheckId,
    patientId: 'patient-789',
    templateId: 'template-001',
    orderId: null,
    status: HealthCheckStatus.AWAITING_REVIEW,
    currentVersion: 1,
    complianceBreach: false,
    createdBy: 'staff-456',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVersion = {
    id: 'version-001',
    healthCheckId,
    versionNumber: 1,
    contentSnapshot: { resultItems: [{ testCode: 'HGB', value: '14.5' }] },
    changeSummary: null,
    status: HealthCheckStatus.AWAITING_REVIEW,
    createdBy: 'staff-456',
    createdAt: new Date(), // recent, within SLA
    resultItems: [],
  };

  const validSignInput = {
    username: 'dr_reviewer',
    password: 'ValidPass123!',
    versionNumber: 1,
  };

  beforeEach(async () => {
    authService = {
      verifyCredentials: jest.fn(),
    };

    pdfExportService = {
      generateReport: jest.fn().mockResolvedValue({}),
    };

    healthCheckRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    versionRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    signatureRepo = {
      findOne: jest.fn().mockResolvedValue(null), // no existing signature by default
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'sig-001' })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignatureService,
        { provide: AuthService, useValue: authService },
        { provide: PdfExportService, useValue: pdfExportService },
        { provide: getRepositoryToken(HealthCheckEntity), useValue: healthCheckRepo },
        { provide: getRepositoryToken(HealthCheckVersionEntity), useValue: versionRepo },
        { provide: getRepositoryToken(ReportSignatureEntity), useValue: signatureRepo },
      ],
    }).compile();

    service = module.get<SignatureService>(SignatureService);
  });

  describe('successful sign', () => {
    it('should sign when valid reviewer, valid credentials, within SLA', async () => {
      authService.verifyCredentials.mockResolvedValue(mockReviewer);
      healthCheckRepo.findOne.mockResolvedValue({ ...mockHealthCheck });
      versionRepo.findOne.mockResolvedValue({ ...mockVersion });

      const result = await service.sign(healthCheckId, validSignInput, ipAddress, mockReviewer.id);

      expect(result.signerId).toBe(mockReviewer.id);
      expect(result.signerName).toBe(mockReviewer.fullName);
      expect(result.signatureHash).toBeDefined();
      expect(result.signatureHash.length).toBe(128); // SHA-512 hex length
      expect(signatureRepo.save).toHaveBeenCalled();
      expect(versionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: HealthCheckStatus.SIGNED }),
      );
      expect(healthCheckRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: HealthCheckStatus.SIGNED }),
      );
      expect(pdfExportService.generateReport).toHaveBeenCalledWith(
        healthCheckId,
        1,
      );
    });
  });

  describe('reject: signer identity mismatch', () => {
    it('should reject signing when body credentials do not match JWT user', async () => {
      authService.verifyCredentials.mockResolvedValue(mockReviewer);

      await expect(
        service.sign(healthCheckId, validSignInput, ipAddress, 'different-jwt-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reject: user is not a reviewer', () => {
    it('should reject signing by non-reviewer', async () => {
      authService.verifyCredentials.mockResolvedValue(mockStaffUser);

      await expect(
        service.sign(healthCheckId, validSignInput, ipAddress, mockReviewer.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reject: invalid credentials', () => {
    it('should reject when re-auth fails', async () => {
      authService.verifyCredentials.mockResolvedValue(null);

      await expect(
        service.sign(healthCheckId, validSignInput, ipAddress, mockReviewer.id),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('reject: version not in AWAITING_REVIEW', () => {
    it('should reject when version is DRAFT', async () => {
      authService.verifyCredentials.mockResolvedValue(mockReviewer);
      healthCheckRepo.findOne.mockResolvedValue({ ...mockHealthCheck });
      versionRepo.findOne.mockResolvedValue({
        ...mockVersion,
        status: HealthCheckStatus.DRAFT,
      });

      await expect(
        service.sign(healthCheckId, validSignInput, ipAddress, mockReviewer.id),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject: past 24-hour SLA window', () => {
    it('should reject when SLA expired', async () => {
      authService.verifyCredentials.mockResolvedValue(mockReviewer);
      healthCheckRepo.findOne.mockResolvedValue({ ...mockHealthCheck });

      const expiredVersion = {
        ...mockVersion,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      };
      versionRepo.findOne.mockResolvedValue(expiredVersion);

      await expect(
        service.sign(healthCheckId, validSignInput, ipAddress, mockReviewer.id),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject: version already signed', () => {
    it('should reject when signature already exists', async () => {
      authService.verifyCredentials.mockResolvedValue(mockReviewer);
      healthCheckRepo.findOne.mockResolvedValue({ ...mockHealthCheck });
      versionRepo.findOne.mockResolvedValue({ ...mockVersion });
      signatureRepo.findOne.mockResolvedValue({
        id: 'existing-sig',
        healthCheckId,
        versionNumber: 1,
      });

      await expect(
        service.sign(healthCheckId, validSignInput, ipAddress, mockReviewer.id),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('sign generates SHA-512 hash', () => {
    it('should produce a valid SHA-512 hex hash (128 chars)', async () => {
      authService.verifyCredentials.mockResolvedValue(mockReviewer);
      healthCheckRepo.findOne.mockResolvedValue({ ...mockHealthCheck });
      versionRepo.findOne.mockResolvedValue({ ...mockVersion });

      const result = await service.sign(healthCheckId, validSignInput, ipAddress, mockReviewer.id);

      expect(result.signatureHash).toMatch(/^[a-f0-9]{128}$/);
    });
  });

  describe('sign locks version', () => {
    it('should update version status to SIGNED after signing', async () => {
      authService.verifyCredentials.mockResolvedValue(mockReviewer);
      healthCheckRepo.findOne.mockResolvedValue({ ...mockHealthCheck });
      versionRepo.findOne.mockResolvedValue({ ...mockVersion });

      await service.sign(healthCheckId, validSignInput, ipAddress, mockReviewer.id);

      expect(versionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: HealthCheckStatus.SIGNED }),
      );
      // Subsequent updates would need to create a new version (tested in health-check.service.spec.ts)
    });
  });
});
