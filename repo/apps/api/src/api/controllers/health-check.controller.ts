import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Req,
  Res,
  UsePipes,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { HealthCheckService } from '../../core/application/use-cases/health-check.service';
import { SignatureService } from '../../core/application/use-cases/signature.service';
import { PdfExportService } from '../../infrastructure/pdf/pdf-export.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { ZodValidate } from '../pipes/zod-validation.pipe';
import {
  createHealthCheckSchema,
  updateHealthCheckSchema,
  signHealthCheckSchema,
} from '@checc/shared/schemas/health-check.schema';
import type {
  CreateHealthCheckInput,
  UpdateHealthCheckInput,
  SignHealthCheckInput,
} from '@checc/shared/schemas/health-check.schema';
import type { UserDto } from '@checc/shared/types/auth.types';
import { UserRole } from '@checc/shared/constants/roles';
import { ErrorCodes } from '@checc/shared/constants/error-codes';
import { extractClientIp } from '../../infrastructure/security/ip-extractor';
import * as fs from 'fs';

@Controller('health-checks')
export class HealthCheckController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly signatureService: SignatureService,
    private readonly pdfExportService: PdfExportService,
  ) {}

  @Post()
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @UsePipes(ZodValidate(createHealthCheckSchema))
  async create(@Body() body: CreateHealthCheckInput, @CurrentUser() user: UserDto) {
    const result = await this.healthCheckService.create(body, user.id);
    return { data: result, message: 'Health check created' };
  }

  @Get()
  async list(
    @CurrentUser() user: UserDto,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    if (user.role === UserRole.STAFF || user.role === UserRole.ADMIN || user.role === UserRole.REVIEWER) {
      const result = await this.healthCheckService.findAll(p, l);
      return { data: result.data, meta: { total: result.total, page: p, limit: l } };
    }

    const result = await this.healthCheckService.findByPatient(user.id, p, l);
    return { data: result.data, meta: { total: result.total, page: p, limit: l } };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: UserDto) {
    const healthCheck = await this.healthCheckService.findById(id);
    if (
      user.role !== UserRole.STAFF &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.REVIEWER &&
      (healthCheck as any).patientId !== user.id
    ) {
      throw new ForbiddenException({
        message: 'You can only access your own health checks',
        errorCode: ErrorCodes.RESOURCE_NOT_OWNED,
      });
    }
    return { data: healthCheck };
  }

  @Put(':id')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @UsePipes(ZodValidate(updateHealthCheckSchema))
  async update(
    @Param('id') id: string,
    @Body() body: UpdateHealthCheckInput,
    @CurrentUser() user: UserDto,
  ) {
    const result = await this.healthCheckService.update(id, body, user.id);
    return { data: result, message: 'Health check updated' };
  }

  @Post(':id/submit-review')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async submitForReview(@Param('id') id: string, @CurrentUser() _user: UserDto) {
    const result = await this.healthCheckService.submitForReview(id);
    return { data: result, message: 'Health check submitted for review' };
  }

  @Post(':id/sign')
  @Roles(UserRole.REVIEWER)
  @RateLimit(5, 60)
  @UsePipes(ZodValidate(signHealthCheckSchema))
  async sign(
    @Param('id') id: string,
    @Body() body: SignHealthCheckInput,
    @CurrentUser() user: UserDto,
    @Req() req: Request,
  ) {
    const ipAddress = extractClientIp(req);
    const result = await this.signatureService.sign(id, body, ipAddress, user.id);
    return { data: result, message: 'Health check signed' };
  }

  @Get(':id/versions')
  async getVersionHistory(@Param('id') id: string, @CurrentUser() user: UserDto) {
    const healthCheck = await this.healthCheckService.findById(id);
    if (
      user.role !== UserRole.STAFF &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.REVIEWER &&
      (healthCheck as any).patientId !== user.id
    ) {
      throw new ForbiddenException({
        message: 'You can only access your own health checks',
        errorCode: ErrorCodes.RESOURCE_NOT_OWNED,
      });
    }
    const versions = await this.healthCheckService.getVersionHistory(id);
    return { data: versions };
  }

  @Get(':id/pdf/:versionNumber')
  async downloadPdf(
    @Param('id') id: string,
    @Param('versionNumber') versionNumber: string,
    @Res() res: Response,
    @CurrentUser() user: UserDto,
  ) {
    const healthCheck = await this.healthCheckService.findById(id);
    if (
      user.role !== UserRole.STAFF &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.REVIEWER &&
      (healthCheck as any).patientId !== user.id
    ) {
      throw new ForbiddenException({
        message: 'You can only access your own health checks',
        errorCode: ErrorCodes.RESOURCE_NOT_OWNED,
      });
    }

    const vNum = parseInt(versionNumber, 10);
    const { filePath, fileName } = await this.pdfExportService.downloadReport(id, vNum);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
}
