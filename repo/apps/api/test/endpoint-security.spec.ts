import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import * as supertest from 'supertest';
import { JwtAuthGuard } from '../src/api/guards/jwt-auth.guard';
import { RolesGuard } from '../src/api/guards/roles.guard';
import { RateLimitGuard } from '../src/api/guards/rate-limit.guard';
import { TemplateController } from '../src/api/controllers/template.controller';
import { AuthController } from '../src/api/controllers/auth.controller';
import { EnrollmentController } from '../src/api/controllers/enrollment.controller';
import { OrderController } from '../src/api/controllers/order.controller';
import { HealthCheckController } from '../src/api/controllers/health-check.controller';
import { AuthService } from '../src/core/application/use-cases/auth.service';
import { EnrollmentService } from '../src/core/application/use-cases/enrollment.service';
import { OrderService } from '../src/core/application/use-cases/order.service';
import { HealthCheckService } from '../src/core/application/use-cases/health-check.service';
import { SignatureService } from '../src/core/application/use-cases/signature.service';
import { PdfExportService } from '../src/infrastructure/pdf/pdf-export.service';
import { UserRole } from '@checc/shared/constants/roles';
import { ErrorCodes } from '@checc/shared/constants/error-codes';

const JWT_SECRET = 'test-secret-for-endpoint-security';

@Injectable()
class TestJwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }
  async validate(payload: Record<string, unknown>) {
    return { id: payload.sub, username: payload.username, role: payload.role };
  }
}

function signToken(payload: Record<string, unknown>): string {
  const jwt = new JwtService({ secret: JWT_SECRET });
  return jwt.sign(payload);
}

/**
 * Endpoint-level security integration tests.
 *
 * These boot real controllers with the actual guard pipeline (JwtAuthGuard, RolesGuard,
 * RateLimitGuard) to verify route-level authorization constraints are wired correctly.
 * Service dependencies are mocked to avoid DB requirements.
 */
describe('Endpoint Security - Real Controller Wiring', () => {
  const request = (supertest as any).default || supertest;

  const adminToken = signToken({ sub: 'admin-1', username: 'admin', role: UserRole.ADMIN });
  const staffToken = signToken({ sub: 'staff-1', username: 'staff', role: UserRole.STAFF });
  const patientToken = signToken({ sub: 'patient-1', username: 'patient', role: UserRole.PATIENT });
  const reviewerToken = signToken({ sub: 'reviewer-1', username: 'reviewer', role: UserRole.REVIEWER });

  describe('GET /templates — role restriction', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          PassportModule.register({ defaultStrategy: 'jwt' }),
          JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
        ],
        controllers: [TemplateController],
        providers: [
          TestJwtStrategy,
          { provide: APP_GUARD, useClass: JwtAuthGuard },
          { provide: APP_GUARD, useClass: RolesGuard },
          { provide: APP_GUARD, useClass: RateLimitGuard },
          { provide: HealthCheckService, useValue: { getTemplates: jest.fn().mockResolvedValue([]) } },
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    }, 15000);

    afterAll(async () => {
      if (app) await app.close();
    });

    it('returns 401 without token', async () => {
      const res = await request(app.getHttpServer()).get('/templates');
      expect(res.status).toBe(401);
    });

    it('returns 403 for patient role', async () => {
      const res = await request(app.getHttpServer())
        .get('/templates')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 200 for staff role', async () => {
      const res = await request(app.getHttpServer())
        .get('/templates')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
    });

    it('returns 200 for admin role', async () => {
      const res = await request(app.getHttpServer())
        .get('/templates')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('returns 200 for reviewer role', async () => {
      const res = await request(app.getHttpServer())
        .get('/templates')
        .set('Authorization', `Bearer ${reviewerToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /auth/login — device fingerprint enforcement', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          PassportModule.register({ defaultStrategy: 'jwt' }),
          JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
        ],
        controllers: [AuthController],
        providers: [
          TestJwtStrategy,
          { provide: APP_GUARD, useClass: JwtAuthGuard },
          { provide: APP_GUARD, useClass: RolesGuard },
          { provide: APP_GUARD, useClass: RateLimitGuard },
          {
            provide: AuthService,
            useValue: {
              login: jest.fn().mockResolvedValue({
                accessToken: 'tok',
                refreshToken: 'rtok',
                user: { id: '1', username: 'test', role: 'patient' },
              }),
              getMe: jest.fn(),
              getUserDevices: jest.fn().mockResolvedValue([]),
              trustDevice: jest.fn(),
              revokeDevice: jest.fn(),
              register: jest.fn(),
            },
          },
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    }, 15000);

    afterAll(async () => {
      if (app) await app.close();
    });

    it('rejects login without deviceFingerprint (Zod validation)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'testuser', password: 'ValidPass123!' });
      // Should be rejected by Zod validation (400) or by service (401)
      expect([400, 401, 422]).toContain(res.status);
    });

    it('accepts login with deviceFingerprint', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'testuser', password: 'ValidPass123!', deviceFingerprint: 'fp-abc123' });
      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /enrollments/:id — object-level ownership', () => {
    let app: INestApplication;
    const patientAToken = signToken({ sub: 'patient-a', username: 'patientA', role: UserRole.PATIENT });
    const patientBToken = signToken({ sub: 'patient-b', username: 'patientB', role: UserRole.PATIENT });

    beforeAll(async () => {
      const mockEnrollmentService = {
        findById: jest.fn().mockImplementation((id: string) => {
          if (id === 'enr-not-found') throw new NotFoundException('Not found');
          return Promise.resolve({ id, patientId: 'patient-a', status: 'DRAFT', serviceLines: [] });
        }),
        findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
        findByPatient: jest.fn().mockResolvedValue({ data: [], total: 0 }),
        create: jest.fn(),
        update: jest.fn(),
        submit: jest.fn(),
        cancel: jest.fn(),
      };

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          PassportModule.register({ defaultStrategy: 'jwt' }),
          JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
        ],
        controllers: [EnrollmentController],
        providers: [
          TestJwtStrategy,
          { provide: APP_GUARD, useClass: JwtAuthGuard },
          { provide: APP_GUARD, useClass: RolesGuard },
          { provide: APP_GUARD, useClass: RateLimitGuard },
          { provide: EnrollmentService, useValue: mockEnrollmentService },
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    }, 15000);

    afterAll(async () => {
      if (app) await app.close();
    });

    it('owner (patient-a) can access their enrollment', async () => {
      const res = await request(app.getHttpServer())
        .get('/enrollments/enr-1')
        .set('Authorization', `Bearer ${patientAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.patientId).toBe('patient-a');
    });

    it('non-owner (patient-b) gets 403 on another patient enrollment', async () => {
      const res = await request(app.getHttpServer())
        .get('/enrollments/enr-1')
        .set('Authorization', `Bearer ${patientBToken}`);
      expect(res.status).toBe(403);
    });

    it('staff can access any enrollment', async () => {
      const res = await request(app.getHttpServer())
        .get('/enrollments/enr-1')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
    });

    it('unauthenticated request returns 401', async () => {
      const res = await request(app.getHttpServer()).get('/enrollments/enr-1');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /orders/:id — object-level ownership', () => {
    let app: INestApplication;
    const patientAToken = signToken({ sub: 'patient-a', username: 'patientA', role: UserRole.PATIENT });
    const patientBToken = signToken({ sub: 'patient-b', username: 'patientB', role: UserRole.PATIENT });

    beforeAll(async () => {
      const mockOrderService = {
        findById: jest.fn().mockImplementation((id: string) => {
          if (id === 'ord-not-found') throw new NotFoundException('Not found');
          return Promise.resolve({ id, patientId: 'patient-a', status: 'PENDING_PAYMENT', orderNumber: 'ORD-001' });
        }),
        findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
        findByPatient: jest.fn().mockResolvedValue({ data: [], total: 0 }),
        findByEnrollmentId: jest.fn(),
        cancel: jest.fn(),
      };

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          PassportModule.register({ defaultStrategy: 'jwt' }),
          JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
        ],
        controllers: [OrderController],
        providers: [
          TestJwtStrategy,
          { provide: APP_GUARD, useClass: JwtAuthGuard },
          { provide: APP_GUARD, useClass: RolesGuard },
          { provide: APP_GUARD, useClass: RateLimitGuard },
          { provide: OrderService, useValue: mockOrderService },
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    }, 15000);

    afterAll(async () => {
      if (app) await app.close();
    });

    it('owner (patient-a) can access their order', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/ord-1')
        .set('Authorization', `Bearer ${patientAToken}`);
      expect(res.status).toBe(200);
    });

    it('non-owner (patient-b) gets 403 on another patient order', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/ord-1')
        .set('Authorization', `Bearer ${patientBToken}`);
      expect(res.status).toBe(403);
    });

    it('staff can access any order', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/ord-1')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
    });

    it('non-owner cannot cancel another patient order', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders/ord-1/cancel')
        .set('Authorization', `Bearer ${patientBToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /health-checks/:id — object-level ownership', () => {
    let app: INestApplication;
    const patientAToken = signToken({ sub: 'patient-a', username: 'patientA', role: UserRole.PATIENT });
    const patientBToken = signToken({ sub: 'patient-b', username: 'patientB', role: UserRole.PATIENT });

    beforeAll(async () => {
      const mockHealthCheckService = {
        findById: jest.fn().mockImplementation((id: string) => {
          if (id === 'hc-not-found') throw new NotFoundException('Not found');
          return Promise.resolve({ id, patientId: 'patient-a', status: 'DRAFT', createdBy: 'staff-1' });
        }),
        findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
        findByPatient: jest.fn().mockResolvedValue({ data: [], total: 0 }),
        create: jest.fn(),
        update: jest.fn(),
        submitForReview: jest.fn(),
        getVersionHistory: jest.fn().mockResolvedValue([]),
        getTemplates: jest.fn().mockResolvedValue([]),
      };

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          PassportModule.register({ defaultStrategy: 'jwt' }),
          JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
        ],
        controllers: [HealthCheckController],
        providers: [
          TestJwtStrategy,
          { provide: APP_GUARD, useClass: JwtAuthGuard },
          { provide: APP_GUARD, useClass: RolesGuard },
          { provide: APP_GUARD, useClass: RateLimitGuard },
          { provide: HealthCheckService, useValue: mockHealthCheckService },
          { provide: SignatureService, useValue: { sign: jest.fn() } },
          { provide: PdfExportService, useValue: { downloadReport: jest.fn() } },
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    }, 15000);

    afterAll(async () => {
      if (app) await app.close();
    });

    it('owner (patient-a) can access their health check', async () => {
      const res = await request(app.getHttpServer())
        .get('/health-checks/hc-1')
        .set('Authorization', `Bearer ${patientAToken}`);
      expect(res.status).toBe(200);
    });

    it('non-owner (patient-b) gets 403 on another patient health check', async () => {
      const res = await request(app.getHttpServer())
        .get('/health-checks/hc-1')
        .set('Authorization', `Bearer ${patientBToken}`);
      expect(res.status).toBe(403);
    });

    it('staff can access any health check', async () => {
      const res = await request(app.getHttpServer())
        .get('/health-checks/hc-1')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
    });

    it('reviewer can access any health check', async () => {
      const res = await request(app.getHttpServer())
        .get('/health-checks/hc-1')
        .set('Authorization', `Bearer ${reviewerToken}`);
      expect(res.status).toBe(200);
    });

    it('non-owner patient gets 403 on version history', async () => {
      const res = await request(app.getHttpServer())
        .get('/health-checks/hc-1/versions')
        .set('Authorization', `Bearer ${patientBToken}`);
      expect(res.status).toBe(403);
    });

    it('patient cannot create health checks (staff/admin only)', async () => {
      const res = await request(app.getHttpServer())
        .post('/health-checks')
        .set('Authorization', `Bearer ${patientAToken}`)
        .send({ patientId: 'patient-a', templateId: 'tmpl-1', results: [] });
      expect(res.status).toBe(403);
    });

    it('patient cannot sign health checks (reviewer only)', async () => {
      const res = await request(app.getHttpServer())
        .post('/health-checks/hc-1/sign')
        .set('Authorization', `Bearer ${patientAToken}`)
        .send({ username: 'pat', password: 'pass', versionNumber: 1 });
      expect(res.status).toBe(403);
    });
  });
});
