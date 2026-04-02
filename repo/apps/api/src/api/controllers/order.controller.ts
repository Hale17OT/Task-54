import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { OrderService } from '../../core/application/use-cases/order.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { UserDto } from '@checc/shared/types/auth.types';
import { UserRole } from '@checc/shared/constants/roles';
import { ErrorCodes } from '@checc/shared/constants/error-codes';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  async list(
    @CurrentUser() user: UserDto,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    if (user.role === UserRole.STAFF || user.role === UserRole.ADMIN) {
      const result = await this.orderService.findAll(p, l);
      return { data: result.data, meta: { total: result.total, page: p, limit: l } };
    }

    const result = await this.orderService.findByPatient(user.id, p, l);
    return { data: result.data, meta: { total: result.total, page: p, limit: l } };
  }

  @Get('by-enrollment/:enrollmentId')
  async findByEnrollment(@Param('enrollmentId') enrollmentId: string, @CurrentUser() user: UserDto) {
    const order = await this.orderService.findByEnrollmentId(enrollmentId);
    if (!order) return { data: null };
    if (
      user.role !== UserRole.STAFF &&
      user.role !== UserRole.ADMIN &&
      order.patientId !== user.id
    ) {
      throw new ForbiddenException({
        message: 'You can only access your own orders',
        errorCode: ErrorCodes.RESOURCE_NOT_OWNED,
      });
    }
    return { data: order };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: UserDto) {
    const order = await this.orderService.findById(id);
    if (
      user.role !== UserRole.STAFF &&
      user.role !== UserRole.ADMIN &&
      order.patientId !== user.id
    ) {
      throw new ForbiddenException({
        message: 'You can only access your own orders',
        errorCode: ErrorCodes.RESOURCE_NOT_OWNED,
      });
    }
    return { data: order };
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @CurrentUser() user: UserDto) {
    const order = await this.orderService.findById(id);
    if (
      user.role !== UserRole.STAFF &&
      user.role !== UserRole.ADMIN &&
      order.patientId !== user.id
    ) {
      throw new ForbiddenException({
        message: 'You can only cancel your own orders',
        errorCode: ErrorCodes.RESOURCE_NOT_OWNED,
      });
    }
    const result = await this.orderService.cancel(id);
    return { data: result, message: 'Order canceled' };
  }
}
