import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../../infrastructure/persistence/entities/user.entity';
import { LoginAttemptEntity } from '../../../infrastructure/persistence/entities/login-attempt.entity';
import { IUserRepository, USER_REPOSITORY } from '../ports/user.repository.port';
import { CaptchaService } from '../../../infrastructure/security/captcha.service';
import { AnomalyDetectorService } from './anomaly-detector.service';
import { AUTH_LIMITS, CAPTCHA_LIMITS } from '@checc/shared/constants/limits';
import { ErrorCodes } from '@checc/shared/constants/error-codes';
import { WinstonLogger } from '../../../infrastructure/logging/winston.logger';
import type { TokenPayload } from '@checc/shared/types/auth.types';
import type { RegisterInput, LoginInput } from '@checc/shared/schemas/auth.schema';
import { UserRole } from '@checc/shared/constants/roles';

@Injectable()
export class AuthService {
  private readonly logger = new WinstonLogger();

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @InjectRepository(LoginAttemptEntity)
    private readonly loginAttemptRepo: Repository<LoginAttemptEntity>,
    private readonly jwtService: JwtService,
    private readonly captchaService: CaptchaService,
    private readonly anomalyDetector: AnomalyDetectorService,
  ) {}

  async register(input: RegisterInput, ipAddress?: string) {
    const existingUsername = await this.userRepo.findByUsername(input.username);
    if (existingUsername) {
      throw new ConflictException({
        message: 'Username already taken',
        errorCode: ErrorCodes.USERNAME_TAKEN,
      });
    }

    const existingEmail = await this.userRepo.findByEmail(input.email);
    if (existingEmail) {
      throw new ConflictException({
        message: 'Email already taken',
        errorCode: ErrorCodes.EMAIL_TAKEN,
      });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.userRepo.create({
      username: input.username,
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: UserRole.PATIENT,
      canApproveRefunds: false,
      isActive: true,
    });

    this.logger.log(`User registered: ${user.username} (${user.role})`, 'AuthService');

    // Record registration event for IP-based anomaly tracking
    // Uses '__registration__' fingerprint to distinguish from login events
    if (ipAddress) {
      await this.recordLoginAttempt(user.id, ipAddress, '__registration__', true);
      this.anomalyDetector.checkBulkRegistration(ipAddress).catch(() => {});
    }

    return this.buildUserDto(user);
  }

  async login(input: LoginInput, ipAddress: string) {
    // Server-driven CAPTCHA escalation: require CAPTCHA after suspicious activity threshold
    const recentFailedWindow = new Date(Date.now() - AUTH_LIMITS.LOCKOUT_DURATION_MINUTES * 60 * 1000);
    const recentFailedFromIp = await this.loginAttemptRepo.count({
      where: {
        ipAddress,
        success: false,
        attemptedAt: MoreThan(recentFailedWindow),
      },
    });

    const captchaRequired = recentFailedFromIp >= CAPTCHA_LIMITS.MAX_CONSECUTIVE_FAILURES;

    if (captchaRequired && (!input.captchaId || !input.captchaAnswer)) {
      throw new ForbiddenException({
        message: 'CAPTCHA is required due to suspicious login activity',
        errorCode: ErrorCodes.CAPTCHA_REQUIRED,
      });
    }

    // Validate CAPTCHA if provided (always validate when present, even if not required)
    if (input.captchaId && input.captchaAnswer) {
      const captchaValid = await this.captchaService.verify(input.captchaId, input.captchaAnswer);
      if (!captchaValid) {
        throw new UnauthorizedException({
          message: 'Invalid or expired CAPTCHA',
          errorCode: ErrorCodes.CAPTCHA_INVALID,
        });
      }
    }

    const user = await this.userRepo.findByUsername(input.username);

    if (!user) {
      await this.recordLoginAttempt(null, ipAddress, input.deviceFingerprint, false);
      throw new UnauthorizedException({
        message: 'Invalid username or password',
        errorCode: ErrorCodes.INVALID_CREDENTIALS,
      });
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException({
        message: `Account locked until ${user.lockedUntil.toISOString()}`,
        errorCode: ErrorCodes.ACCOUNT_LOCKED,
      });
    }

    // Verify password
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    await this.recordLoginAttempt(user.id, ipAddress, input.deviceFingerprint, valid);

    if (!valid) {
      await this.checkAndLockAccount(user);
      throw new UnauthorizedException({
        message: 'Invalid username or password',
        errorCode: ErrorCodes.INVALID_CREDENTIALS,
      });
    }

    if (!user.isActive) {
      throw new ForbiddenException({
        message: 'Account is deactivated',
        errorCode: ErrorCodes.FORBIDDEN,
      });
    }

    // Clear any lock on successful login
    if (user.lockedUntil) {
      await this.userRepo.update(user.id, { lockedUntil: null });
    }

    const tokens = this.generateTokens(user);
    this.logger.log(`Login successful: ${user.username}`, 'AuthService');

    return {
      ...tokens,
      user: this.buildUserDto(user),
    };
  }

  async validateToken(payload: TokenPayload) {
    const user = await this.userRepo.findById(payload.sub);
    if (!user || !user.isActive) return null;
    return this.buildUserDto(user);
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        message: 'User not found',
        errorCode: ErrorCodes.INVALID_CREDENTIALS,
      });
    }
    return { user: this.buildUserDto(user) };
  }

  async verifyCredentials(username: string, password: string): Promise<UserEntity | null> {
    const user = await this.userRepo.findByUsername(username);
    if (!user) return null;
    if (!user.isActive) return null;
    if (user.lockedUntil && user.lockedUntil > new Date()) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }

  private async recordLoginAttempt(
    userId: string | null,
    ipAddress: string,
    deviceFingerprint: string | undefined,
    success: boolean,
  ) {
    const attempt = this.loginAttemptRepo.create({
      userId,
      ipAddress,
      deviceFingerprint: deviceFingerprint || null,
      success,
    });
    await this.loginAttemptRepo.save(attempt);
  }

  private async checkAndLockAccount(user: UserEntity) {
    const windowStart = new Date(Date.now() - AUTH_LIMITS.LOCKOUT_DURATION_MINUTES * 60 * 1000);
    const recentFailed = await this.loginAttemptRepo.count({
      where: {
        userId: user.id,
        success: false,
        attemptedAt: MoreThan(windowStart),
      },
    });

    if (recentFailed >= AUTH_LIMITS.MAX_LOGIN_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + AUTH_LIMITS.LOCKOUT_DURATION_MINUTES * 60 * 1000);
      await this.userRepo.update(user.id, { lockedUntil: lockUntil });
      this.logger.warn(
        `Account locked: ${user.username} (${recentFailed} failed attempts)`,
        'AuthService',
      );
    }
  }

  private generateTokens(user: UserEntity) {
    const payload: TokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role as UserRole,
      canApproveRefunds: user.canApproveRefunds,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      }),
    };
  }

  private buildUserDto(user: UserEntity) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role as UserRole,
      fullName: user.fullName,
      canApproveRefunds: user.canApproveRefunds,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
