import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as supertest from 'supertest';
import { JwtAuthGuard } from '../src/api/guards/jwt-auth.guard';
import { RolesGuard } from '../src/api/guards/roles.guard';
import { RateLimitGuard } from '../src/api/guards/rate-limit.guard';
import { Roles } from '../src/api/decorators/roles.decorator';
import { Public } from '../src/api/decorators/public.decorator';
import { CurrentUser } from '../src/api/decorators/current-user.decorator';
import { RateLimit } from '../src/api/decorators/rate-limit.decorator';
import { UserRole } from '@checc/shared/constants/roles';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

const JWT_SECRET = 'test-secret-for-integration';

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

@Controller('test-public')
class TestPublicController {
  @Public()
  @Get()
  publicEndpoint() { return { status: 'ok' }; }
}

@Controller('test-authed')
class TestAuthedController {
  @Get()
  authed(@CurrentUser() user: Record<string, unknown>) { return { user }; }

  @Post('admin-only')
  @Roles(UserRole.ADMIN)
  adminOnly(@CurrentUser() user: Record<string, unknown>) { return { user }; }

  @Post('staff-only')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  staffOnly(@CurrentUser() user: Record<string, unknown>) { return { user }; }

  @Post('reviewer-only')
  @Roles(UserRole.REVIEWER)
  reviewerOnly(@CurrentUser() user: Record<string, unknown>) { return { user }; }

  @Post('rate-limited')
  @RateLimit(2, 60)
  rateLimited() { return { ok: true }; }
}

function signToken(payload: Record<string, unknown>): string {
  const jwt = new JwtService({ secret: JWT_SECRET });
  return jwt.sign(payload);
}

/**
 * HTTP-level integration tests for the guard chain.
 * Boots a real NestJS HTTP server with supertest — NO database required.
 * Tests 401, 403, 200, and 429 responses through the actual guard pipeline.
 */
describe('API Integration - Guard Chain & Role Boundaries', () => {
  let app: INestApplication;
  const request = (supertest as any).default || supertest;

  const adminToken = signToken({ sub: 'admin-1', username: 'admin', role: UserRole.ADMIN });
  const staffToken = signToken({ sub: 'staff-1', username: 'staff', role: UserRole.STAFF });
  const patientToken = signToken({ sub: 'patient-1', username: 'patient', role: UserRole.PATIENT });
  const reviewerToken = signToken({ sub: 'reviewer-1', username: 'reviewer', role: UserRole.REVIEWER });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
      ],
      controllers: [TestPublicController, TestAuthedController],
      providers: [
        TestJwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: RateLimitGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 15000);

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('401 - Unauthenticated requests rejected', () => {
    it('GET /test-authed returns 401 without token', async () => {
      const res = await request(app.getHttpServer()).get('/test-authed');
      expect(res.status).toBe(401);
    });

    it('POST /test-authed/admin-only returns 401 without token', async () => {
      const res = await request(app.getHttpServer()).post('/test-authed/admin-only');
      expect(res.status).toBe(401);
    });

    it('POST /test-authed/staff-only returns 401 without token', async () => {
      const res = await request(app.getHttpServer()).post('/test-authed/staff-only');
      expect(res.status).toBe(401);
    });

    it('POST /test-authed/reviewer-only returns 401 without token', async () => {
      const res = await request(app.getHttpServer()).post('/test-authed/reviewer-only');
      expect(res.status).toBe(401);
    });
  });

  describe('200 - Public endpoints bypass auth', () => {
    it('GET /test-public returns 200 without token', async () => {
      const res = await request(app.getHttpServer()).get('/test-public');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('200 - Authenticated access with correct role', () => {
    it('any authenticated user can access undecorated endpoint', async () => {
      const res = await request(app.getHttpServer())
        .get('/test-authed')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe(UserRole.PATIENT);
    });

    it('admin can access admin-only', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-authed/admin-only')
        .set('Authorization', `Bearer ${adminToken}`);
      expect([200, 201]).toContain(res.status);
    });

    it('staff can access staff-only', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-authed/staff-only')
        .set('Authorization', `Bearer ${staffToken}`);
      expect([200, 201]).toContain(res.status);
    });

    it('admin can also access staff-only', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-authed/staff-only')
        .set('Authorization', `Bearer ${adminToken}`);
      expect([200, 201]).toContain(res.status);
    });

    it('reviewer can access reviewer-only', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-authed/reviewer-only')
        .set('Authorization', `Bearer ${reviewerToken}`);
      expect([200, 201]).toContain(res.status);
    });
  });

  describe('403 - Wrong role rejected', () => {
    it('patient CANNOT access admin-only', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-authed/admin-only')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(res.status).toBe(403);
    });

    it('staff CANNOT access admin-only', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-authed/admin-only')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });

    it('reviewer CANNOT access admin-only', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-authed/admin-only')
        .set('Authorization', `Bearer ${reviewerToken}`);
      expect(res.status).toBe(403);
    });

    it('patient CANNOT access staff-only', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-authed/staff-only')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(res.status).toBe(403);
    });

    it('patient CANNOT access reviewer-only', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-authed/reviewer-only')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(res.status).toBe(403);
    });

    it('staff CANNOT access reviewer-only', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-authed/reviewer-only')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });

    it('admin CANNOT access reviewer-only', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-authed/reviewer-only')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('429 - Per-action rate limiting enforced', () => {
    it('exceeding per-endpoint limit returns 429', async () => {
      const token = signToken({ sub: 'rl-user-1', username: 'rl', role: UserRole.PATIENT });

      const res1 = await request(app.getHttpServer())
        .post('/test-authed/rate-limited')
        .set('Authorization', `Bearer ${token}`);
      expect([200, 201]).toContain(res1.status);

      const res2 = await request(app.getHttpServer())
        .post('/test-authed/rate-limited')
        .set('Authorization', `Bearer ${token}`);
      expect([200, 201]).toContain(res2.status);

      const res3 = await request(app.getHttpServer())
        .post('/test-authed/rate-limited')
        .set('Authorization', `Bearer ${token}`);
      expect(res3.status).toBe(429);
    });

    it('different user is not affected by another user\'s rate limit', async () => {
      const token = signToken({ sub: 'rl-user-2', username: 'rl2', role: UserRole.PATIENT });

      const res = await request(app.getHttpServer())
        .post('/test-authed/rate-limited')
        .set('Authorization', `Bearer ${token}`);
      expect([200, 201]).toContain(res.status);
    });
  });
});
