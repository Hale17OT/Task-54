import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UsePipes,
} from '@nestjs/common';
import { PaymentService } from '../../core/application/use-cases/payment.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { ZodValidate } from '../pipes/zod-validation.pipe';
import { recordPaymentSchema, refundSchema } from '@checc/shared/schemas/payment.schema';
import type { RecordPaymentInput, RefundInput } from '@checc/shared/schemas/payment.schema';
import type { UserDto } from '@checc/shared/types/auth.types';
import { UserRole } from '@checc/shared/constants/roles';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @UsePipes(ZodValidate(recordPaymentSchema))
  async recordPayment(@Body() body: RecordPaymentInput, @CurrentUser() user: UserDto) {
    const result = await this.paymentService.recordPayment(body, user.id);
    return { data: result, message: 'Payment recorded' };
  }

  @Get('order/:orderId')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async getPaymentsByOrder(@Param('orderId') orderId: string, @CurrentUser() user: UserDto) {
    const result = await this.paymentService.getPaymentsByOrder(orderId, user);
    return { data: result };
  }

  @Get(':id')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async getPaymentById(@Param('id') id: string, @CurrentUser() user: UserDto) {
    const result = await this.paymentService.getPaymentById(id, user);
    return { data: result };
  }

  @Post('refund')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @RateLimit(5, 60)
  @UsePipes(ZodValidate(refundSchema))
  async initiateRefund(@Body() body: RefundInput, @CurrentUser() user: UserDto) {
    const result = await this.paymentService.initiateRefund(body, user.id, user.canApproveRefunds);
    return { data: result, message: 'Refund processed' };
  }

  @Get()
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async listPayments(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const result = await this.paymentService.listPayments(p, l);
    return { data: result.data, meta: { total: result.total, page: p, limit: l } };
  }
}
