import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UsePipes,
} from '@nestjs/common';
import { PricingService } from '../../core/application/use-cases/pricing.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { ZodValidate } from '../pipes/zod-validation.pipe';
import {
  createPricingRuleSchema,
  updatePricingRuleSchema,
} from '@checc/shared/schemas/pricing.schema';
import type {
  CreatePricingRuleInput,
  UpdatePricingRuleInput,
} from '@checc/shared/schemas/pricing.schema';
import type { UserDto } from '@checc/shared/types/auth.types';
import { UserRole } from '@checc/shared/constants/roles';
import type { OrderLineInput } from '../../core/application/use-cases/pricing-engine';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('rules')
  @Roles(UserRole.ADMIN)
  @UsePipes(ZodValidate(createPricingRuleSchema))
  async createRule(
    @Body() body: CreatePricingRuleInput,
    @CurrentUser() user: UserDto,
  ) {
    const result = await this.pricingService.createRule(body, user.id);
    return { data: result, message: 'Pricing rule created' };
  }

  @Put('rules/:id')
  @Roles(UserRole.ADMIN)
  @UsePipes(ZodValidate(updatePricingRuleSchema))
  async updateRule(
    @Param('id') id: string,
    @Body() body: UpdatePricingRuleInput,
  ) {
    const result = await this.pricingService.updateRule(id, body);
    return { data: result, message: 'Pricing rule updated' };
  }

  @Delete('rules/:id')
  @Roles(UserRole.ADMIN)
  async deleteRule(@Param('id') id: string) {
    const result = await this.pricingService.deleteRule(id);
    return result;
  }

  @Get('rules')
  @Roles(UserRole.ADMIN)
  async listRules(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('activeOnly') activeOnly?: string,
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const active = activeOnly === 'true' ? true : undefined;

    const result = await this.pricingService.listRules(p, l, active);
    return { data: result.data, meta: { total: result.total, page: p, limit: l } };
  }

  @Post('compute')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  async computePricing(@Body() body: { lines: OrderLineInput[] }) {
    const result = await this.pricingService.computeForOrder(body.lines);
    return { data: result };
  }

  @Get('audit/:orderId')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  async getAuditTrail(@Param('orderId') orderId: string) {
    const result = await this.pricingService.getAuditTrail(orderId);
    return { data: result };
  }
}
