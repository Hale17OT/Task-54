import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../src/core/application/use-cases/auth.service';
import { LoginAttemptEntity } from '../src/infrastructure/persistence/entities/login-attempt.entity';
import { DeviceFingerprintEntity } from '../src/infrastructure/persistence/entities/device-fingerprint.entity';
import { USER_REPOSITORY } from '../src/core/application/ports/user.repository.port';
import { CaptchaService } from '../src/infrastructure/security/captcha.service';
import { AnomalyDetectorService } from '../src/core/application/use-cases/anomaly-detector.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: Record<string, jest.Mock>;
  let loginAttemptRepo: Record<string, jest.Mock>;
  let deviceFingerprintRepo: Record<string, jest.Mock>;
  let jwtService: { sign: jest.Mock };

  const mockUser = {
    id: '123',
    username: 'testuser',
    email: 'test@test.com',
    passwordHash: '',
    role: 'patient',
    canApproveRefunds: false,
    fullName: 'Test User',
    isActive: true,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockUser.passwordHash = await bcrypt.hash('ValidPass123!', 10);

    userRepo = {
      findById: jest.fn(),
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    loginAttemptRepo = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };

    deviceFingerprintRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock.jwt.token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: USER_REPOSITORY, useValue: userRepo },
        { provide: getRepositoryToken(LoginAttemptEntity), useValue: loginAttemptRepo },
        { provide: getRepositoryToken(DeviceFingerprintEntity), useValue: deviceFingerprintRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: CaptchaService, useValue: { verify: jest.fn().mockResolvedValue(true), generate: jest.fn() } },
        { provide: AnomalyDetectorService, useValue: { checkBulkRegistration: jest.fn().mockResolvedValue(false), checkPromoAbuse: jest.fn().mockResolvedValue(false), checkRepeatedRefunds: jest.fn().mockResolvedValue(false) } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      userRepo.findByUsername.mockResolvedValue(null);
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockResolvedValue({ ...mockUser, id: 'new-id' });

      const result = await service.register({
        username: 'newuser',
        email: 'new@test.com',
        password: 'ValidPass123!',
        fullName: 'New User',

      });

      expect(result.username).toBe('testuser');
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'newuser' }),
      );
    });

    it('should always assign PATIENT role regardless of input', async () => {
      userRepo.findByUsername.mockResolvedValue(null);
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockResolvedValue({ ...mockUser, id: 'new-id', role: 'patient' });

      await service.register({
        username: 'attacker',
        email: 'attacker@test.com',
        password: 'ValidPass123!',
        fullName: 'Attacker',
      } as any);

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'patient' }),
      );
      // Ensure admin/staff roles cannot be self-assigned
      expect(userRepo.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ role: 'admin' }),
      );
    });

    it('should reject duplicate username', async () => {
      userRepo.findByUsername.mockResolvedValue(mockUser);

      await expect(
        service.register({
          username: 'testuser',
          email: 'other@test.com',
          password: 'ValidPass123!',
          fullName: 'Test',
  
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject duplicate email', async () => {
      userRepo.findByUsername.mockResolvedValue(null);
      userRepo.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({
          username: 'newuser',
          email: 'test@test.com',
          password: 'ValidPass123!',
          fullName: 'Test',
  
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return tokens on valid login', async () => {
      userRepo.findByUsername.mockResolvedValue(mockUser);

      const result = await service.login(
        { username: 'testuser', password: 'ValidPass123!', deviceFingerprint: 'fp-abc123' },
        '127.0.0.1',
      );

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.user.username).toBe('testuser');
    });

    it('should throw on missing device fingerprint', async () => {
      await expect(
        service.login({ username: 'testuser', password: 'ValidPass123!' } as any, '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw on invalid username', async () => {
      userRepo.findByUsername.mockResolvedValue(null);

      await expect(
        service.login({ username: 'nobody', password: 'any', deviceFingerprint: 'fp-abc123' }, '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw on invalid password', async () => {
      userRepo.findByUsername.mockResolvedValue(mockUser);

      await expect(
        service.login({ username: 'testuser', password: 'wrong', deviceFingerprint: 'fp-abc123' }, '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if account is locked', async () => {
      const lockedUser = { ...mockUser, lockedUntil: new Date(Date.now() + 900000) };
      userRepo.findByUsername.mockResolvedValue(lockedUser);

      await expect(
        service.login({ username: 'testuser', password: 'ValidPass123!', deviceFingerprint: 'fp-abc123' }, '127.0.0.1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if user is deactivated', async () => {
      const inactive = { ...mockUser, isActive: false };
      userRepo.findByUsername.mockResolvedValue(inactive);

      await expect(
        service.login({ username: 'testuser', password: 'ValidPass123!', deviceFingerprint: 'fp-abc123' }, '127.0.0.1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should lock account after 5 failed attempts', async () => {
      userRepo.findByUsername.mockResolvedValue(mockUser);
      // First count call: CAPTCHA check (by IP) — return below threshold
      // Second count call: lockout check (by userId) — return at threshold
      loginAttemptRepo.count
        .mockResolvedValueOnce(0)  // CAPTCHA IP check passes
        .mockResolvedValue(5);     // lockout check triggers
      userRepo.update.mockResolvedValue(mockUser);

      await expect(
        service.login({ username: 'testuser', password: 'wrong', deviceFingerprint: 'fp-abc123' }, '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);

      expect(userRepo.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ lockedUntil: expect.any(Date) }),
      );
    });

    it('should record login attempts', async () => {
      userRepo.findByUsername.mockResolvedValue(mockUser);

      await service.login(
        { username: 'testuser', password: 'ValidPass123!', deviceFingerprint: 'fp-abc123' },
        '192.168.1.1',
      );

      expect(loginAttemptRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          ipAddress: '192.168.1.1',
          success: true,
        }),
      );
    });
  });

  describe('validateToken', () => {
    it('should return user dto for valid token payload', async () => {
      userRepo.findById.mockResolvedValue(mockUser);

      const result = await service.validateToken({
        sub: '123',
        username: 'testuser',
        role: 'patient' as any,
        canApproveRefunds: false,
      });

      expect(result).not.toBeNull();
      expect(result!.id).toBe('123');
    });

    it('should return null for inactive user', async () => {
      userRepo.findById.mockResolvedValue({ ...mockUser, isActive: false });

      const result = await service.validateToken({
        sub: '123',
        username: 'testuser',
        role: 'patient' as any,
        canApproveRefunds: false,
      });

      expect(result).toBeNull();
    });
  });

  describe('verifyCredentials', () => {
    it('should return user on valid credentials', async () => {
      userRepo.findByUsername.mockResolvedValue(mockUser);
      const result = await service.verifyCredentials('testuser', 'ValidPass123!');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('123');
    });

    it('should return null for wrong password', async () => {
      userRepo.findByUsername.mockResolvedValue(mockUser);
      const result = await service.verifyCredentials('testuser', 'WrongPassword1!');
      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      userRepo.findByUsername.mockResolvedValue(null);
      const result = await service.verifyCredentials('nonexistent', 'any');
      expect(result).toBeNull();
    });

    it('should reject deactivated user even with valid credentials', async () => {
      userRepo.findByUsername.mockResolvedValue({ ...mockUser, isActive: false });
      const result = await service.verifyCredentials('testuser', 'ValidPass123!');
      expect(result).toBeNull();
    });

    it('should reject locked user even with valid credentials', async () => {
      const futureDate = new Date(Date.now() + 15 * 60 * 1000);
      userRepo.findByUsername.mockResolvedValue({ ...mockUser, lockedUntil: futureDate });
      const result = await service.verifyCredentials('testuser', 'ValidPass123!');
      expect(result).toBeNull();
    });

    it('should allow user whose lock has expired', async () => {
      const pastDate = new Date(Date.now() - 1000);
      userRepo.findByUsername.mockResolvedValue({ ...mockUser, lockedUntil: pastDate });
      const result = await service.verifyCredentials('testuser', 'ValidPass123!');
      expect(result).not.toBeNull();
    });
  });
});
