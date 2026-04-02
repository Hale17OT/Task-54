import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../src/api/guards/roles.guard';
import { UserRole } from '@checc/shared/constants/roles';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const mockContext = (user: Record<string, unknown> | null, roles?: UserRole[]) => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(roles);
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow when no roles required', () => {
    const ctx = mockContext({ role: UserRole.PATIENT });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow when user has required role', () => {
    const ctx = mockContext({ role: UserRole.ADMIN }, [UserRole.ADMIN]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny when user lacks required role', () => {
    const ctx = mockContext({ role: UserRole.PATIENT }, [UserRole.ADMIN]);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should deny when no user on request', () => {
    const ctx = mockContext(null, [UserRole.ADMIN]);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should allow when user has one of multiple required roles', () => {
    const ctx = mockContext({ role: UserRole.STAFF }, [UserRole.STAFF, UserRole.ADMIN]);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
