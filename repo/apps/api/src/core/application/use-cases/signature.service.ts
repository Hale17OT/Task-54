import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { HealthCheckEntity } from '../../../infrastructure/persistence/entities/health-check.entity';
import { HealthCheckVersionEntity } from '../../../infrastructure/persistence/entities/health-check-version.entity';
import { ReportSignatureEntity } from '../../../infrastructure/persistence/entities/report-signature.entity';
import { AuthService } from './auth.service';
import { PdfExportService } from '../../../infrastructure/pdf/pdf-export.service';
import { HealthCheckStatus } from '@checc/shared/types/health-check.types';
import { UserRole } from '@checc/shared/constants/roles';
import { ErrorCodes } from '@checc/shared/constants/error-codes';
import { WinstonLogger } from '../../../infrastructure/logging/winston.logger';
import type { SignHealthCheckInput } from '@checc/shared/schemas/health-check.schema';

@Injectable()
export class SignatureService {
  private readonly logger = new WinstonLogger();

  constructor(
    @InjectRepository(HealthCheckEntity)
    private readonly healthCheckRepo: Repository<HealthCheckEntity>,
    @InjectRepository(HealthCheckVersionEntity)
    private readonly versionRepo: Repository<HealthCheckVersionEntity>,
    @InjectRepository(ReportSignatureEntity)
    private readonly signatureRepo: Repository<ReportSignatureEntity>,
    private readonly authService: AuthService,
    private readonly pdfExportService: PdfExportService,
  ) {}

  async sign(
    healthCheckId: string,
    input: SignHealthCheckInput,
    ipAddress: string,
    jwtUserId: string,
  ) {
    // 1. Re-authenticate the signer
    const signer = await this.authService.verifyCredentials(
      input.username,
      input.password,
    );

    if (!signer) {
      throw new UnauthorizedException({
        message: 'Invalid credentials for signature',
        errorCode: ErrorCodes.REPORT_SIGNATURE_AUTH_FAILED,
      });
    }

    // 2. Verify re-authenticated signer matches the JWT session user
    if (signer.id !== jwtUserId) {
      throw new ForbiddenException({
        message: 'Signature credentials must match the logged-in user',
        errorCode: ErrorCodes.REPORT_SIGNATURE_AUTH_FAILED,
      });
    }

    // 3. Validate signer has role='reviewer'
    if (signer.role !== UserRole.REVIEWER) {
      throw new ForbiddenException({
        message: 'Only reviewers can sign health check reports',
        errorCode: ErrorCodes.INSUFFICIENT_ROLE,
      });
    }

    // 3. Find the health check
    const healthCheck = await this.healthCheckRepo.findOne({
      where: { id: healthCheckId },
    });

    if (!healthCheck) {
      throw new NotFoundException({
        message: 'Health check report not found',
        errorCode: ErrorCodes.REPORT_NOT_FOUND,
      });
    }

    // 4. Find the version
    const version = await this.versionRepo.findOne({
      where: { healthCheckId, versionNumber: input.versionNumber },
      relations: ['resultItems'],
    });

    if (!version) {
      throw new NotFoundException({
        message: 'Health check version not found',
        errorCode: ErrorCodes.REPORT_NOT_FOUND,
      });
    }

    // 5. Check version is AWAITING_REVIEW
    if (version.status !== HealthCheckStatus.AWAITING_REVIEW) {
      throw new BadRequestException({
        message: 'Version must be in AWAITING_REVIEW status to be signed',
        errorCode: ErrorCodes.REPORT_VERSION_LOCKED,
      });
    }

    // 6. Check for existing signature on this version
    const existingSignature = await this.signatureRepo.findOne({
      where: { healthCheckId, versionNumber: input.versionNumber },
    });

    if (existingSignature) {
      throw new BadRequestException({
        message: 'This version has already been signed',
        errorCode: ErrorCodes.REPORT_ALREADY_SIGNED,
      });
    }

    // 7. Check within 24-hour SLA
    const slaDeadline = new Date(version.createdAt.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();

    if (now >= slaDeadline) {
      throw new BadRequestException({
        message: 'Signature SLA has expired (24-hour window exceeded)',
        errorCode: ErrorCodes.REPORT_SIGNATURE_EXPIRED,
      });
    }

    // 8. Compute signatureHash = SHA-512(contentSnapshot JSON + signerId + ISO timestamp)
    const signedAt = new Date();
    const signatureData =
      JSON.stringify(version.contentSnapshot) +
      signer.id +
      signedAt.toISOString();
    const signatureHash = crypto
      .createHash('sha512')
      .update(signatureData)
      .digest('hex');

    // 9. Insert report_signatures row
    const signature = this.signatureRepo.create({
      healthCheckId,
      versionNumber: input.versionNumber,
      signerId: signer.id,
      signatureHash,
      signedAt,
      ipAddress,
    });
    await this.signatureRepo.save(signature);

    // 10. Update version status to SIGNED, header status to SIGNED
    version.status = HealthCheckStatus.SIGNED;
    await this.versionRepo.save(version);

    healthCheck.status = HealthCheckStatus.SIGNED;
    await this.healthCheckRepo.save(healthCheck);

    // 11. Trigger PDF generation
    try {
      await this.pdfExportService.generateReport(healthCheckId, input.versionNumber);
    } catch (err) {
      this.logger.error(
        `PDF generation failed for health check ${healthCheckId} v${input.versionNumber}: ${err}`,
        undefined,
        'SignatureService',
      );
    }

    this.logger.log(
      `Health check ${healthCheckId} v${input.versionNumber} signed by ${signer.username}`,
      'SignatureService',
    );

    return {
      id: signature.id,
      healthCheckId,
      versionNumber: input.versionNumber,
      signerId: signer.id,
      signerName: signer.fullName,
      signatureHash,
      signedAt: signedAt.toISOString(),
    };
  }
}
