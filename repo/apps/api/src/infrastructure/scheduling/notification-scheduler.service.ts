import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { OrderEntity } from '../persistence/entities/order.entity';
import { PaymentEntity } from '../persistence/entities/payment.entity';
import { SeatReservationEntity } from '../persistence/entities/seat-reservation.entity';
import { HealthCheckEntity } from '../persistence/entities/health-check.entity';
import { NotificationService } from '../../core/application/use-cases/notification.service';
import { OrderStatus } from '@checc/shared/types/order.types';
import { NotificationType } from '@checc/shared/types/notification.types';
import { WinstonLogger } from '../logging/winston.logger';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new WinstonLogger();

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepo: Repository<PaymentEntity>,
    @InjectRepository(SeatReservationEntity)
    private readonly seatRepo: Repository<SeatReservationEntity>,
    @InjectRepository(HealthCheckEntity)
    private readonly healthCheckRepo: Repository<HealthCheckEntity>,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron('0 */30 * * * *') // Every 30 minutes
  async handleScheduledNotifications() {
    await this.checkDueSoonOrders();
    await this.checkOverdueBalances();
    await this.checkPickupReady();
    await this.checkComplianceBreaches();
  }

  /** Notify patients whose orders are approaching auto-cancel (due soon). */
  private async checkDueSoonOrders() {
    const warningThreshold = new Date(Date.now() + 15 * 60 * 1000); // 15 min from now

    const approachingOrders = await this.orderRepo.find({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        autoCancelAt: LessThan(warningThreshold),
      },
    });

    for (const order of approachingOrders) {
      const canSend = await this.notificationService.canDeliver(
        order.patientId,
        order.id,
      );

      if (canSend) {
        await this.notificationService.create({
          userId: order.patientId,
          type: NotificationType.DUE_DATE,
          title: 'Payment Due Soon',
          body: `Your order ${order.orderNumber} will be auto-canceled if not paid soon.`,
          referenceType: 'order',
          referenceId: order.id,
        });

        this.logger.log(
          `Due-date notification sent for order ${order.orderNumber}`,
          'NotificationScheduler',
        );
      }
    }
  }

  /** Notify patients with overdue balances (orders past auto-cancel that were canceled). */
  private async checkOverdueBalances() {
    const overdueOrders = await this.orderRepo.find({
      where: {
        status: OrderStatus.CANCELED,
      },
    });

    for (const order of overdueOrders) {
      // Check if there's a partial payment recorded for this order
      const payments = await this.paymentRepo.find({
        where: { orderId: order.id },
      });

      // Only notify if there were payment attempts (indicating the patient was engaged)
      if (payments.length > 0) {
        const canSend = await this.notificationService.canDeliver(
          order.patientId,
          order.id,
        );

        if (canSend) {
          await this.notificationService.create({
            userId: order.patientId,
            type: NotificationType.OVERDUE_BALANCE,
            title: 'Overdue Balance',
            body: `Order ${order.orderNumber} was canceled due to non-payment. Please contact staff if you wish to re-enroll.`,
            referenceType: 'order',
            referenceId: order.id,
          });

          this.logger.log(
            `Overdue balance notification sent for order ${order.orderNumber}`,
            'NotificationScheduler',
          );
        }
      }
    }
  }

  /** Notify patients whose seat reservations are confirmed (hold available for pickup). */
  private async checkPickupReady() {
    const confirmedReservations = await this.seatRepo.find({
      where: { status: 'CONFIRMED' },
      relations: ['enrollment'],
    });

    for (const reservation of confirmedReservations) {
      if (!reservation.enrollment) continue;

      const canSend = await this.notificationService.canDeliver(
        reservation.enrollment.patientId,
        reservation.id,
      );

      if (canSend) {
        await this.notificationService.create({
          userId: reservation.enrollment.patientId,
          type: NotificationType.PICKUP_READY,
          title: 'Service Ready',
          body: 'Your reserved service is confirmed and ready. Please visit the clinic at your scheduled time.',
          referenceType: 'seat_reservation',
          referenceId: reservation.id,
        });

        this.logger.log(
          `Pickup-ready notification sent for reservation ${reservation.id}`,
          'NotificationScheduler',
        );
      }
    }
  }

  /** Notify staff about health check compliance breaches (24h SLA exceeded). */
  private async checkComplianceBreaches() {
    const breachedChecks = await this.healthCheckRepo.find({
      where: { complianceBreach: true },
    });

    for (const hc of breachedChecks) {
      const canSend = await this.notificationService.canDeliver(
        hc.createdBy,
        hc.id,
      );

      if (canSend) {
        await this.notificationService.create({
          userId: hc.createdBy,
          type: NotificationType.COMPLIANCE_BREACH,
          title: 'Compliance Breach Detected',
          body: `Health check ${hc.id} has exceeded the 24-hour review SLA.`,
          referenceType: 'health_check',
          referenceId: hc.id,
        });

        this.logger.log(
          `Compliance breach notification sent for health check ${hc.id}`,
          'NotificationScheduler',
        );
      }
    }
  }
}
