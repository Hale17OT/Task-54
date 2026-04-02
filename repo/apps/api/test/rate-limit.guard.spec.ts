import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from '../src/api/guards/rate-limit.guard';

function createMockContext(overrides: {
  userId?: string;
  ip?: string;
  method?: string;
  path?: string;
  routePath?: string;
  rateLimitMeta?: { limit: number; windowSeconds: number };
}): ExecutionContext {
  const request = {
    user: overrides.userId ? { id: overrides.userId } : undefined,
    ip: overrides.ip || '127.0.0.1',
    socket: { remoteAddress: overrides.ip || '127.0.0.1' },
    method: overrides.method || 'GET',
    path: overrides.path || '/test',
    route: { path: overrides.routePath || overrides.path || '/test' },
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RateLimitGuard, Reflector],
    }).compile();

    guard = module.get<RateLimitGuard>(RateLimitGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should allow requests under the limit', () => {
    const ctx = createMockContext({ userId: 'user-1', method: 'GET', path: '/enrollments' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should use per-action keys (different routes get separate buckets)', () => {
    // Fill up one route
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ limit: 2, windowSeconds: 60 });

    const ctxA = createMockContext({ userId: 'user-1', method: 'GET', path: '/enrollments', routePath: '/enrollments' });
    const ctxB = createMockContext({ userId: 'user-1', method: 'POST', path: '/enrollments', routePath: '/enrollments' });

    expect(guard.canActivate(ctxA)).toBe(true);
    expect(guard.canActivate(ctxA)).toBe(true);

    // Route A is now at limit=2, should throw
    expect(() => guard.canActivate(ctxA)).toThrow(HttpException);

    // Route B (different method) should still be allowed
    expect(guard.canActivate(ctxB)).toBe(true);
  });

  it('should use per-endpoint limits from @RateLimit decorator', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ limit: 1, windowSeconds: 60 });

    const ctx = createMockContext({ userId: 'user-1', method: 'POST', path: '/auth/login', routePath: '/auth/login' });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
  });

  it('should separate buckets by user identity', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ limit: 1, windowSeconds: 60 });

    const ctxUser1 = createMockContext({ userId: 'user-1', method: 'GET', path: '/test' });
    const ctxUser2 = createMockContext({ userId: 'user-2', method: 'GET', path: '/test' });

    expect(guard.canActivate(ctxUser1)).toBe(true);
    expect(() => guard.canActivate(ctxUser1)).toThrow(HttpException);

    // Different user should still be allowed
    expect(guard.canActivate(ctxUser2)).toBe(true);
  });

  it('should use IP as identity for unauthenticated requests', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ limit: 1, windowSeconds: 60 });

    const ctxIp1 = createMockContext({ ip: '10.0.0.1', method: 'POST', path: '/auth/login' });
    const ctxIp2 = createMockContext({ ip: '10.0.0.2', method: 'POST', path: '/auth/login' });

    expect(guard.canActivate(ctxIp1)).toBe(true);
    expect(() => guard.canActivate(ctxIp1)).toThrow(HttpException);

    // Different IP should still be allowed
    expect(guard.canActivate(ctxIp2)).toBe(true);
  });
});
