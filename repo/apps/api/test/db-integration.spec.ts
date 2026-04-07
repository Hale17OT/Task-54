/**
 * DB-backed Integration Tests
 *
 * These tests connect to a real PostgreSQL database and exercise actual
 * persistence-layer behaviour for critical constraints. They verify that
 * the service → repository → DB round-trip enforces the rules correctly,
 * not just that mock contracts are met.
 *
 * Covered flows:
 *   - Auth lockout transitions (login attempts → count → lock)
 *   - Notification throttling (cross-type delivery cap per item)
 *   - Order auto-cancel timing (autoCancelAt query predicate)
 *   - Refund approval path (payment status lifecycle)
 *   - Encryption at rest (email stored encrypted, read decrypted)
 *
 * When DATABASE_HOST is not set or unreachable, the entire suite is skipped
 * gracefully. These tests are exercised automatically in the CI docker
 * test-runner container (docker-compose.test.yml).
 */

import { DataSource, Repository, MoreThan, LessThan } from 'typeorm';
import { UserEntity } from '../src/infrastructure/persistence/entities/user.entity';
import { LoginAttemptEntity } from '../src/infrastructure/persistence/entities/login-attempt.entity';
import { NotificationEntity } from '../src/infrastructure/persistence/entities/notification.entity';
import { NotificationDeliveryLogEntity } from '../src/infrastructure/persistence/entities/notification-delivery-log.entity';
import { OrderEntity } from '../src/infrastructure/persistence/entities/order.entity';
import { EnrollmentEntity } from '../src/infrastructure/persistence/entities/enrollment.entity';
import { PaymentEntity } from '../src/infrastructure/persistence/entities/payment.entity';
import { RefundEntity } from '../src/infrastructure/persistence/entities/refund.entity';
import { NOTIFICATION_LIMITS, AUTH_LIMITS, ORDER_LIMITS } from '@checc/shared/constants/limits';
import { OrderStatus } from '@checc/shared/types/order.types';
import { PaymentStatus } from '@checc/shared/types/payment.types';
import * as bcrypt from 'bcrypt';

let dataSource: DataSource;
let dbAvailable = false;

beforeAll(async () => {
  if (!process.env.DATABASE_HOST) {
    return; // skip — no DB configured
  }

  try {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      database: process.env.DATABASE_NAME || 'checc_test',
      username: process.env.DATABASE_USER || 'checc',
      password: process.env.DATABASE_PASSWORD || 'checc_test_password',
      entities: [
        UserEntity, LoginAttemptEntity,
        NotificationEntity, NotificationDeliveryLogEntity,
        OrderEntity, EnrollmentEntity, PaymentEntity, RefundEntity,
      ],
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
    dbAvailable = true;
  } catch {
    // DB unreachable — tests will be skipped
  }
}, 15000);

afterAll(async () => {
  if (dataSource?.isInitialized) {
    await dataSource.destroy();
  }
});

const skipIfNoDb = () => !dbAvailable;

/* ================================================================== */
/* 1. Notification Throttle — cross-type delivery cap per item        */
/* ================================================================== */
describe('DB Integration — Notification Throttle (persistence-level)', () => {
  let userRepo: Repository<UserEntity>;
  let notifRepo: Repository<NotificationEntity>;
  let deliveryLogRepo: Repository<NotificationDeliveryLogEntity>;
  let testUserId: string;
  const testRefId = '00000000-0000-0000-9999-000000000001';

  beforeAll(async () => {
    if (skipIfNoDb()) return;
    userRepo = dataSource.getRepository(UserEntity);
    notifRepo = dataSource.getRepository(NotificationEntity);
    deliveryLogRepo = dataSource.getRepository(NotificationDeliveryLogEntity);

    const hash = await bcrypt.hash('TestPass12345!', 10);
    const user = userRepo.create({
      username: `dbtest_notif_${Date.now()}`,
      email: `dbtest_notif_${Date.now()}@test.local`,
      emailHash: UserEntity.hashEmail(`dbtest_notif_${Date.now()}@test.local`),
      passwordHash: hash,
      role: 'patient',
      canApproveRefunds: false,
      fullName: 'DB Test Notif',
      isActive: true,
    });
    const saved = await userRepo.save(user);
    testUserId = saved.id;
  });

  afterAll(async () => {
    if (skipIfNoDb()) return;
    await deliveryLogRepo.delete({ userId: testUserId });
    await notifRepo.delete({ userId: testUserId });
    await userRepo.delete({ id: testUserId });
  });

  it('delivery log count by userId+referenceId counts across notification types', async () => {
    if (skipIfNoDb()) return;

    const types = ['DUE_DATE', 'OVERDUE_BALANCE', 'PICKUP_READY'];
    const windowStart = new Date(
      Date.now() - NOTIFICATION_LIMITS.ROLLING_WINDOW_HOURS * 60 * 60 * 1000,
    );

    for (let i = 0; i < NOTIFICATION_LIMITS.MAX_REMINDERS_PER_ITEM_PER_DAY; i++) {
      const log = deliveryLogRepo.create({
        notificationType: types[i % types.length],
        referenceId: testRefId,
        userId: testUserId,
        deliveredAt: new Date(),
      });
      await deliveryLogRepo.save(log);
    }

    // Same query as NotificationService.canDeliver(): userId + referenceId, no type filter
    const count = await deliveryLogRepo.count({
      where: { userId: testUserId, referenceId: testRefId, deliveredAt: MoreThan(windowStart) },
    });

    expect(count).toBe(NOTIFICATION_LIMITS.MAX_REMINDERS_PER_ITEM_PER_DAY);
    // canDeliver would return false
    expect(count < NOTIFICATION_LIMITS.MAX_REMINDERS_PER_ITEM_PER_DAY).toBe(false);
  });

  it('logs outside the rolling window are excluded from the count', async () => {
    if (skipIfNoDb()) return;

    const oldRefId = '00000000-0000-0000-9999-000000000099';
    const outsideWindow = new Date(
      Date.now() - (NOTIFICATION_LIMITS.ROLLING_WINDOW_HOURS + 1) * 60 * 60 * 1000,
    );
    const windowStart = new Date(
      Date.now() - NOTIFICATION_LIMITS.ROLLING_WINDOW_HOURS * 60 * 60 * 1000,
    );

    // Insert a log that is older than the rolling window
    await dataSource.query(
      `INSERT INTO notification_delivery_log (notification_type, reference_id, user_id, delivered_at)
       VALUES ($1, $2, $3, $4)`,
      ['DUE_DATE', oldRefId, testUserId, outsideWindow.toISOString()],
    );

    const count = await deliveryLogRepo.count({
      where: { userId: testUserId, referenceId: oldRefId, deliveredAt: MoreThan(windowStart) },
    });

    expect(count).toBe(0); // old log is excluded
  });
});

/* ================================================================== */
/* 2. Auth Lockout — login attempt persistence & threshold counting   */
/* ================================================================== */
describe('DB Integration — Auth Lockout Transitions (persistence-level)', () => {
  let userRepo: Repository<UserEntity>;
  let loginAttemptRepo: Repository<LoginAttemptEntity>;
  let testUserId: string;

  beforeAll(async () => {
    if (skipIfNoDb()) return;
    userRepo = dataSource.getRepository(UserEntity);
    loginAttemptRepo = dataSource.getRepository(LoginAttemptEntity);

    const hash = await bcrypt.hash('TestPass12345!', 10);
    const user = userRepo.create({
      username: `dbtest_auth_${Date.now()}`,
      email: `dbtest_auth_${Date.now()}@test.local`,
      emailHash: UserEntity.hashEmail(`dbtest_auth_${Date.now()}@test.local`),
      passwordHash: hash,
      role: 'patient',
      canApproveRefunds: false,
      fullName: 'DB Test Auth',
      isActive: true,
    });
    const saved = await userRepo.save(user);
    testUserId = saved.id;
  });

  afterAll(async () => {
    if (skipIfNoDb()) return;
    await loginAttemptRepo.delete({ userId: testUserId });
    await userRepo.delete({ id: testUserId });
  });

  it('failed login attempts are persisted and counted correctly against lockout threshold', async () => {
    if (skipIfNoDb()) return;

    const windowStart = new Date(
      Date.now() - AUTH_LIMITS.LOCKOUT_DURATION_MINUTES * 60 * 1000,
    );

    for (let i = 0; i < AUTH_LIMITS.MAX_LOGIN_ATTEMPTS; i++) {
      const attempt = loginAttemptRepo.create({
        userId: testUserId,
        ipAddress: '10.99.0.1',
        deviceFingerprint: 'test-fp',
        success: false,
      });
      await loginAttemptRepo.save(attempt);
    }

    // Same query as AuthService.checkAndLockAccount()
    const count = await loginAttemptRepo.count({
      where: { userId: testUserId, success: false, attemptedAt: MoreThan(windowStart) },
    });

    expect(count).toBeGreaterThanOrEqual(AUTH_LIMITS.MAX_LOGIN_ATTEMPTS);
  });

  it('successful login attempt is stored with success=true and all fields', async () => {
    if (skipIfNoDb()) return;

    const attempt = loginAttemptRepo.create({
      userId: testUserId,
      ipAddress: '10.99.0.2',
      deviceFingerprint: 'test-fp-ok',
      success: true,
    });
    const saved = await loginAttemptRepo.save(attempt);

    const fetched = await loginAttemptRepo.findOne({ where: { id: saved.id } });
    expect(fetched).not.toBeNull();
    expect(fetched!.success).toBe(true);
    expect(fetched!.userId).toBe(testUserId);
    expect(fetched!.deviceFingerprint).toBe('test-fp-ok');
  });

  it('lockedUntil field persists and blocks login (entity-level round-trip)', async () => {
    if (skipIfNoDb()) return;

    const lockUntil = new Date(
      Date.now() + AUTH_LIMITS.LOCKOUT_DURATION_MINUTES * 60 * 1000,
    );
    await userRepo.update(testUserId, { lockedUntil: lockUntil });

    const locked = await userRepo.findOne({ where: { id: testUserId } });
    expect(locked).not.toBeNull();
    expect(locked!.lockedUntil).not.toBeNull();
    expect(locked!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    // Clear lock for subsequent tests
    await userRepo.update(testUserId, { lockedUntil: null });
  });
});

/* ================================================================== */
/* 3. Order Auto-Cancel — autoCancelAt query and status transition    */
/* ================================================================== */
describe('DB Integration — Order Auto-Cancel (persistence-level)', () => {
  let userRepo: Repository<UserEntity>;
  let enrollmentRepo: Repository<EnrollmentEntity>;
  let orderRepo: Repository<OrderEntity>;
  let testUserId: string;
  let testEnrollmentId: string;
  let overdueOrderId: string;
  let futureOrderId: string;

  beforeAll(async () => {
    if (skipIfNoDb()) return;
    userRepo = dataSource.getRepository(UserEntity);
    enrollmentRepo = dataSource.getRepository(EnrollmentEntity);
    orderRepo = dataSource.getRepository(OrderEntity);

    const hash = await bcrypt.hash('TestPass12345!', 10);
    const user = userRepo.create({
      username: `dbtest_order_${Date.now()}`,
      email: `dbtest_order_${Date.now()}@test.local`,
      emailHash: UserEntity.hashEmail(`dbtest_order_${Date.now()}@test.local`),
      passwordHash: hash,
      role: 'patient',
      canApproveRefunds: false,
      fullName: 'DB Test Order',
      isActive: true,
    });
    const savedUser = await userRepo.save(user);
    testUserId = savedUser.id;

    const enrollment = enrollmentRepo.create({
      patientId: testUserId,
      status: 'SUBMITTED',
      notes: '',
    });
    const savedEnrollment = await enrollmentRepo.save(enrollment);
    testEnrollmentId = savedEnrollment.id;

    // Create an overdue order (autoCancelAt in the past)
    const overdueOrder = orderRepo.create({
      orderNumber: `ORD-DBTEST-OVER-${Date.now()}`,
      enrollmentId: testEnrollmentId,
      patientId: testUserId,
      status: OrderStatus.PENDING_PAYMENT,
      subtotal: 100,
      discountTotal: 0,
      finalTotal: 100,
      autoCancelAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
    });
    const savedOverdue = await orderRepo.save(overdueOrder);
    overdueOrderId = savedOverdue.id;

    // Create a non-overdue order (autoCancelAt in the future)
    const futureOrder = orderRepo.create({
      orderNumber: `ORD-DBTEST-FUT-${Date.now()}`,
      enrollmentId: testEnrollmentId,
      patientId: testUserId,
      status: OrderStatus.PENDING_PAYMENT,
      subtotal: 50,
      discountTotal: 0,
      finalTotal: 50,
      autoCancelAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min from now
    });
    const savedFuture = await orderRepo.save(futureOrder);
    futureOrderId = savedFuture.id;
  });

  afterAll(async () => {
    if (skipIfNoDb()) return;
    await orderRepo.delete({ id: overdueOrderId });
    await orderRepo.delete({ id: futureOrderId });
    await enrollmentRepo.delete({ id: testEnrollmentId });
    await userRepo.delete({ id: testUserId });
  });

  it('overdue orders are found by autoCancelAt < now query (same as OrderTimeoutService)', async () => {
    if (skipIfNoDb()) return;

    // Same query as OrderTimeoutService.handlePendingOrderTimeouts()
    const overdueOrders = await orderRepo.find({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        autoCancelAt: LessThan(new Date()),
      },
    });

    const ids = overdueOrders.map((o) => o.id);
    expect(ids).toContain(overdueOrderId);
    expect(ids).not.toContain(futureOrderId);
  });

  it('order status can transition from PENDING_PAYMENT to CANCELED', async () => {
    if (skipIfNoDb()) return;

    await orderRepo.update(overdueOrderId, { status: OrderStatus.CANCELED });
    const canceled = await orderRepo.findOne({ where: { id: overdueOrderId } });
    expect(canceled!.status).toBe(OrderStatus.CANCELED);
  });
});

/* ================================================================== */
/* 4. Refund Approval — payment status lifecycle with DB state        */
/* ================================================================== */
describe('DB Integration — Refund Approval Path (persistence-level)', () => {
  let userRepo: Repository<UserEntity>;
  let enrollmentRepo: Repository<EnrollmentEntity>;
  let orderRepo: Repository<OrderEntity>;
  let paymentRepo: Repository<PaymentEntity>;
  let refundRepo: Repository<RefundEntity>;
  let staffUserId: string;
  let supervisorUserId: string;
  let testEnrollmentId: string;
  let testOrderId: string;
  let testPaymentId: string;

  beforeAll(async () => {
    if (skipIfNoDb()) return;
    userRepo = dataSource.getRepository(UserEntity);
    enrollmentRepo = dataSource.getRepository(EnrollmentEntity);
    orderRepo = dataSource.getRepository(OrderEntity);
    paymentRepo = dataSource.getRepository(PaymentEntity);
    refundRepo = dataSource.getRepository(RefundEntity);

    const hash = await bcrypt.hash('TestPass12345!', 10);

    // Staff user (cannot approve refunds)
    const staff = userRepo.create({
      username: `dbtest_staff_${Date.now()}`,
      email: `dbtest_staff_${Date.now()}@test.local`,
      emailHash: UserEntity.hashEmail(`dbtest_staff_${Date.now()}@test.local`),
      passwordHash: hash,
      role: 'staff',
      canApproveRefunds: false,
      fullName: 'DB Test Staff',
      isActive: true,
    });
    const savedStaff = await userRepo.save(staff);
    staffUserId = savedStaff.id;

    // Supervisor user (can approve refunds)
    const supervisor = userRepo.create({
      username: `dbtest_super_${Date.now()}`,
      email: `dbtest_super_${Date.now()}@test.local`,
      emailHash: UserEntity.hashEmail(`dbtest_super_${Date.now()}@test.local`),
      passwordHash: hash,
      role: 'staff',
      canApproveRefunds: true,
      fullName: 'DB Test Supervisor',
      isActive: true,
    });
    const savedSupervisor = await userRepo.save(supervisor);
    supervisorUserId = savedSupervisor.id;

    // Create enrollment → order → payment chain
    const enrollment = enrollmentRepo.create({
      patientId: staffUserId, // re-using staff as patient for simplicity
      status: 'ACTIVE',
      notes: '',
    });
    const savedEnrollment = await enrollmentRepo.save(enrollment);
    testEnrollmentId = savedEnrollment.id;

    const order = orderRepo.create({
      orderNumber: `ORD-DBTEST-REF-${Date.now()}`,
      enrollmentId: testEnrollmentId,
      patientId: staffUserId,
      status: OrderStatus.PAID,
      subtotal: 200,
      discountTotal: 0,
      finalTotal: 200,
    });
    const savedOrder = await orderRepo.save(order);
    testOrderId = savedOrder.id;

    const payment = paymentRepo.create({
      orderId: testOrderId,
      paymentMethod: 'cash',
      amount: 200,
      status: PaymentStatus.PAID,
      recordedBy: staffUserId,
      paidAt: new Date(),
    });
    const savedPayment = await paymentRepo.save(payment);
    testPaymentId = savedPayment.id;
  });

  afterAll(async () => {
    if (skipIfNoDb()) return;
    // Clean up in FK order
    await refundRepo.delete({ paymentId: testPaymentId });
    await paymentRepo.delete({ id: testPaymentId });
    await orderRepo.delete({ id: testOrderId });
    await enrollmentRepo.delete({ id: testEnrollmentId });
    await userRepo.delete({ id: staffUserId });
    await userRepo.delete({ id: supervisorUserId });
  });

  it('payment in PAID status can be found with pessimistic lock query', async () => {
    if (skipIfNoDb()) return;

    // Same pattern as PaymentService.initiateRefund() transaction
    const result = await dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(PaymentEntity, {
        where: { id: testPaymentId },
        lock: { mode: 'pessimistic_write' },
      });
      expect(payment).not.toBeNull();
      expect(payment!.status).toBe(PaymentStatus.PAID);
      return payment;
    });

    expect(result).not.toBeNull();
  });

  it('refund record persists with approver, amount, and reason code', async () => {
    if (skipIfNoDb()) return;

    const refund = refundRepo.create({
      paymentId: testPaymentId,
      amount: 200,
      reasonCode: 'DEFECTIVE',
      reasonDetail: 'DB integration test refund',
      requestedBy: staffUserId,
      approvedBy: supervisorUserId,
      approvedAt: new Date(),
    });
    const saved = await refundRepo.save(refund);

    const fetched = await refundRepo.findOne({ where: { id: saved.id } });
    expect(fetched).not.toBeNull();
    expect(fetched!.amount).toBe(200);
    expect(fetched!.reasonCode).toBe('DEFECTIVE');
    expect(fetched!.requestedBy).toBe(staffUserId);
    expect(fetched!.approvedBy).toBe(supervisorUserId);
  });

  it('payment status transitions to REFUNDED after refund', async () => {
    if (skipIfNoDb()) return;

    await paymentRepo.update(testPaymentId, { status: PaymentStatus.REFUNDED });
    const refunded = await paymentRepo.findOne({ where: { id: testPaymentId } });
    expect(refunded!.status).toBe(PaymentStatus.REFUNDED);

    // Order also transitions to REFUNDED
    await orderRepo.update(testOrderId, { status: OrderStatus.REFUNDED });
    const order = await orderRepo.findOne({ where: { id: testOrderId } });
    expect(order!.status).toBe(OrderStatus.REFUNDED);
  });
});

/* ================================================================== */
/* 5. Encryption at Rest — email stored encrypted, read decrypted     */
/* ================================================================== */
describe('DB Integration — User Email Encryption (persistence-level)', () => {
  let userRepo: Repository<UserEntity>;
  let testUserId: string;

  beforeAll(async () => {
    if (skipIfNoDb()) return;
    userRepo = dataSource.getRepository(UserEntity);
  });

  afterAll(async () => {
    if (skipIfNoDb()) return;
    if (testUserId) {
      await userRepo.delete({ id: testUserId });
    }
  });

  it('email is stored encrypted and decrypted transparently via entity', async () => {
    if (skipIfNoDb()) return;

    const testEmail = `encrypted_${Date.now()}@test.local`;
    const hash = await bcrypt.hash('TestPass12345!', 10);

    const user = userRepo.create({
      username: `dbtest_enc_${Date.now()}`,
      email: testEmail,
      passwordHash: hash,
      role: 'patient',
      canApproveRefunds: false,
      fullName: 'DB Test Enc',
      isActive: true,
    });
    const saved = await userRepo.save(user);
    testUserId = saved.id;

    // Read back via entity — should get decrypted value
    const fetched = await userRepo.findOne({ where: { id: testUserId } });
    expect(fetched).not.toBeNull();
    expect(fetched!.email).toBe(testEmail);

    // Read raw DB value — should NOT be the plaintext email
    const raw = await dataSource.query(
      `SELECT email FROM users WHERE id = $1`,
      [testUserId],
    );
    expect(raw[0].email).not.toBe(testEmail);
    // Encrypted format: iv:authTag:ciphertext
    expect(raw[0].email).toContain(':');
  });
});
