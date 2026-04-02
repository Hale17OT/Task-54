import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { NotificationService } from '../../core/application/use-cases/notification.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { UserDto } from '@checc/shared/types/auth.types';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async list(
    @CurrentUser() user: UserDto,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const onlyUnread = unreadOnly === 'true';

    const result = await this.notificationService.findByUser(user.id, p, l, onlyUnread);
    return { data: result.data, meta: { total: result.total, page: p, limit: l } };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @CurrentUser() user: UserDto) {
    await this.notificationService.markAsRead(id, user.id);
    return { message: 'Notification marked as read' };
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: UserDto) {
    await this.notificationService.markAllAsRead(user.id);
    return { message: 'All notifications marked as read' };
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: UserDto) {
    const count = await this.notificationService.getUnreadCount(user.id);
    return { data: { count } };
  }

  @Get('throttle-status')
  async getThrottleStatus(@CurrentUser() user: UserDto) {
    const status = await this.notificationService.getThrottleStatus(user.id);
    return { data: status };
  }
}
