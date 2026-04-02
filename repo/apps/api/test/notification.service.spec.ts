import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationService } from '../src/core/application/use-cases/notification.service';
import { NotificationEntity } from '../src/infrastructure/persistence/entities/notification.entity';
import { NotificationDeliveryLogEntity } from '../src/infrastructure/persistence/entities/notification-delivery-log.entity';
import { NotificationType } from '@checc/shared/types/notification.types';

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepo: Record<string, jest.Mock>;
  let deliveryLogRepo: Record<string, jest.Mock>;

  const userId = 'user-uuid-1';
  const otherUserId = 'user-uuid-2';
  const referenceId = 'ref-uuid-1';
  const notificationId = 'notif-uuid-1';

  beforeEach(async () => {
    notificationRepo = {
      create: jest.fn().mockImplementation((data) => ({
        ...data,
        id: notificationId,
        createdAt: new Date(),
      })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    };

    deliveryLogRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'log-uuid-1', deliveredAt: new Date() })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      count: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(NotificationEntity), useValue: notificationRepo },
        { provide: getRepositoryToken(NotificationDeliveryLogEntity), useValue: deliveryLogRepo },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  describe('create', () => {
    it('should create a notification', async () => {
      const input = {
        userId,
        type: NotificationType.GENERAL,
        title: 'Test Notification',
        body: 'This is a test notification',
      };

      const result = await service.create(input);

      expect(result).toBeDefined();
      expect(notificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: NotificationType.GENERAL,
          title: 'Test Notification',
          body: 'This is a test notification',
          isRead: false,
        }),
      );
      expect(notificationRepo.save).toHaveBeenCalled();
    });

    it('should create notification with referenceId and log delivery', async () => {
      deliveryLogRepo.count.mockResolvedValue(0);

      const input = {
        userId,
        type: NotificationType.DUE_DATE,
        title: 'Payment Due',
        body: 'Your payment is due soon',
        referenceType: 'order',
        referenceId,
      };

      const result = await service.create(input);

      expect(result).toBeDefined();
      expect(deliveryLogRepo.create).toHaveBeenCalled();
      expect(deliveryLogRepo.save).toHaveBeenCalled();
    });
  });

  describe('frequency limit', () => {
    it('should block 4th reminder within 24h', async () => {
      deliveryLogRepo.count.mockResolvedValue(3); // Already at limit

      const input = {
        userId,
        type: NotificationType.DUE_DATE,
        title: 'Payment Due',
        body: 'Your payment is due soon',
        referenceType: 'order',
        referenceId,
      };

      const result = await service.create(input);

      expect(result).toBeNull();
      expect(notificationRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      notificationRepo.findOne.mockResolvedValue({
        id: notificationId,
        userId,
        isRead: false,
      });

      await service.markAsRead(notificationId, userId);

      expect(notificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isRead: true }),
      );
    });

    it('should throw if notification not found', async () => {
      notificationRepo.findOne.mockResolvedValue(null);

      await expect(service.markAsRead('nonexistent', userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unread count', () => {
    it('should return unread count for user', async () => {
      notificationRepo.count.mockResolvedValue(5);

      const count = await service.getUnreadCount(userId);

      expect(count).toBe(5);
      expect(notificationRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, isRead: false },
        }),
      );
    });
  });

  describe('object-level auth', () => {
    it('should reject marking another users notification as read', async () => {
      notificationRepo.findOne.mockResolvedValue({
        id: notificationId,
        userId: otherUserId,
        isRead: false,
      });

      await expect(
        service.markAsRead(notificationId, userId),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
