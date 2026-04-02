import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { NotificationEntity } from '../../../infrastructure/persistence/entities/notification.entity';
import { NotificationDeliveryLogEntity } from '../../../infrastructure/persistence/entities/notification-delivery-log.entity';
import { NOTIFICATION_LIMITS } from '@checc/shared/constants/limits';
import { ErrorCodes } from '@checc/shared/constants/error-codes';
import { WinstonLogger } from '../../../infrastructure/logging/winston.logger';
import type { CreateNotificationRequest } from '@checc/shared/types/notification.types';

@Injectable()
export class NotificationService {
  private readonly logger = new WinstonLogger();

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    @InjectRepository(NotificationDeliveryLogEntity)
    private readonly deliveryLogRepo: Repository<NotificationDeliveryLogEntity>,
  ) {}

  async create(input: CreateNotificationRequest) {
    // Check frequency limit if referenceId is present
    if (input.referenceId) {
      const canSend = await this.canDeliver(input.userId, input.referenceId);
      if (!canSend) {
        this.logger.warn(
          `Notification throttled for user ${input.userId}, reference ${input.referenceId}`,
          'NotificationService',
        );
        return null;
      }
    }

    const notification = this.notificationRepo.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      referenceType: input.referenceType || null,
      referenceId: input.referenceId || null,
      isRead: false,
    });

    const saved = await this.notificationRepo.save(notification);

    // Log delivery
    if (input.referenceId) {
      const log = this.deliveryLogRepo.create({
        notificationType: input.type,
        referenceId: input.referenceId,
        userId: input.userId,
        deliveredAt: new Date(),
      });
      await this.deliveryLogRepo.save(log);
    }

    this.logger.log(
      `Notification created: ${saved.id} for user ${input.userId}`,
      'NotificationService',
    );

    return saved;
  }

  async findByUser(userId: string, page: number, limit: number, unreadOnly?: boolean) {
    const where: Record<string, unknown> = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [data, total] = await this.notificationRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.notificationRepo.findOne({ where: { id } });

    if (!notification) {
      throw new NotFoundException({
        message: 'Notification not found',
        errorCode: ErrorCodes.NOTIFICATION_NOT_FOUND,
      });
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException({
        message: 'You can only mark your own notifications as read',
        errorCode: ErrorCodes.RESOURCE_NOT_OWNED,
      });
    }

    notification.isRead = true;
    return this.notificationRepo.save(notification);
  }

  async markAllAsRead(userId: string) {
    await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { userId, isRead: false },
    });
  }

  async getThrottleStatus(_userId: string): Promise<{ maxPerItem: number; windowHours: number }> {
    return {
      maxPerItem: NOTIFICATION_LIMITS.MAX_REMINDERS_PER_ITEM_PER_DAY,
      windowHours: NOTIFICATION_LIMITS.ROLLING_WINDOW_HOURS,
    };
  }

  async canDeliver(userId: string, referenceId: string): Promise<boolean> {
    const windowStart = new Date(
      Date.now() - NOTIFICATION_LIMITS.ROLLING_WINDOW_HOURS * 60 * 60 * 1000,
    );

    const count = await this.deliveryLogRepo.count({
      where: {
        userId,
        referenceId,
        deliveredAt: MoreThan(windowStart),
      },
    });

    return count < NOTIFICATION_LIMITS.MAX_REMINDERS_PER_ITEM_PER_DAY;
  }
}
