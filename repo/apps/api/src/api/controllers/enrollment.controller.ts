import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UsePipes,
  ForbiddenException,
} from '@nestjs/common';
import { EnrollmentService } from '../../core/application/use-cases/enrollment.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { ZodValidate } from '../pipes/zod-validation.pipe';
import {
  createEnrollmentSchema,
  updateEnrollmentSchema,
} from '@checc/shared/schemas/enrollment.schema';
import type {
  CreateEnrollmentInput,
  UpdateEnrollmentInput,
} from '@checc/shared/schemas/enrollment.schema';
import type { UserDto } from '@checc/shared/types/auth.types';
import { UserRole } from '@checc/shared/constants/roles';
import { ErrorCodes } from '@checc/shared/constants/error-codes';

@Controller('enrollments')
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @Post()
  @Roles(UserRole.PATIENT)
  @UsePipes(ZodValidate(createEnrollmentSchema))
  async create(@Body() body: CreateEnrollmentInput, @CurrentUser() user: UserDto) {
    const result = await this.enrollmentService.create(user.id, body);
    return { data: result, message: 'Enrollment created' };
  }

  @Get()
  async list(
    @CurrentUser() user: UserDto,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    if (user.role === UserRole.STAFF || user.role === UserRole.ADMIN) {
      const result = await this.enrollmentService.findAll(p, l);
      return { data: result.data, meta: { total: result.total, page: p, limit: l } };
    }

    const result = await this.enrollmentService.findByPatient(user.id, p, l);
    return { data: result.data, meta: { total: result.total, page: p, limit: l } };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: UserDto) {
    const enrollment = await this.enrollmentService.findById(id);
    if (
      user.role !== UserRole.STAFF &&
      user.role !== UserRole.ADMIN &&
      enrollment.patientId !== user.id
    ) {
      throw new ForbiddenException({
        message: 'You can only access your own enrollments',
        errorCode: ErrorCodes.RESOURCE_NOT_OWNED,
      });
    }
    return { data: enrollment };
  }

  @Put(':id')
  @UsePipes(ZodValidate(updateEnrollmentSchema))
  async update(
    @Param('id') id: string,
    @Body() body: UpdateEnrollmentInput,
    @CurrentUser() user: UserDto,
  ) {
    const result = await this.enrollmentService.update(id, user.id, body);
    return { data: result, message: 'Enrollment updated' };
  }

  @Post(':id/submit')
  @RateLimit(10, 60)
  async submit(@Param('id') id: string, @CurrentUser() user: UserDto) {
    const result = await this.enrollmentService.submit(id, user.id);
    return { data: result, message: 'Enrollment submitted' };
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @CurrentUser() user: UserDto) {
    const result = await this.enrollmentService.cancel(id, { id: user.id, role: user.role });
    return { data: result, message: 'Enrollment canceled' };
  }
}
