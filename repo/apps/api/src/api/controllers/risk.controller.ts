import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UsePipes,
} from '@nestjs/common';
import { RiskService } from '../../core/application/use-cases/risk.service';
import { CaptchaService } from '../../infrastructure/security/captcha.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { Public } from '../decorators/public.decorator';
import { ZodValidate } from '../pipes/zod-validation.pipe';
import {
  createIpRuleSchema,
  updateIncidentSchema,
  verifyCaptchaSchema,
} from '@checc/shared/schemas/risk.schema';
import type {
  CreateIpRuleInput,
  UpdateIncidentInput,
  VerifyCaptchaInput,
} from '@checc/shared/schemas/risk.schema';
import type { UserDto } from '@checc/shared/types/auth.types';
import { UserRole } from '@checc/shared/constants/roles';

@Controller('risk')
export class RiskController {
  constructor(
    private readonly riskService: RiskService,
    private readonly captchaService: CaptchaService,
  ) {}

  @Get('ip-rules')
  @Roles(UserRole.ADMIN)
  async listIpRules(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const result = await this.riskService.listIpRules(p, l);
    return { data: result.data, meta: { total: result.total, page: p, limit: l } };
  }

  @Post('ip-rules')
  @Roles(UserRole.ADMIN)
  @UsePipes(ZodValidate(createIpRuleSchema))
  async createIpRule(@Body() body: CreateIpRuleInput, @CurrentUser() user: UserDto) {
    const result = await this.riskService.createIpRule(body, user.id);
    return { data: result, message: 'IP rule created' };
  }

  @Delete('ip-rules/:id')
  @Roles(UserRole.ADMIN)
  async deleteIpRule(@Param('id') id: string) {
    await this.riskService.deleteIpRule(id);
    return { message: 'IP rule deleted' };
  }

  @Get('events')
  @Roles(UserRole.ADMIN)
  async listRiskEvents(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const result = await this.riskService.listRiskEvents(p, l);
    return { data: result.data, meta: { total: result.total, page: p, limit: l } };
  }

  @Get('incidents')
  @Roles(UserRole.ADMIN)
  async listIncidents(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const result = await this.riskService.listIncidents(p, l, status);
    return { data: result.data, meta: { total: result.total, page: p, limit: l } };
  }

  @Patch('incidents/:id')
  @Roles(UserRole.ADMIN)
  @UsePipes(ZodValidate(updateIncidentSchema))
  async updateIncident(@Param('id') id: string, @Body() body: UpdateIncidentInput) {
    const result = await this.riskService.updateIncident(id, body);
    return { data: result, message: 'Incident updated' };
  }

  @Public()
  @Get('captcha')
  async getCaptcha() {
    const result = await this.captchaService.generate();
    return { data: result };
  }

  @Public()
  @Post('captcha/verify')
  @UsePipes(ZodValidate(verifyCaptchaSchema))
  async verifyCaptcha(@Body() body: VerifyCaptchaInput) {
    const valid = await this.captchaService.verify(body.id, body.answer);
    return { data: { valid } };
  }
}
