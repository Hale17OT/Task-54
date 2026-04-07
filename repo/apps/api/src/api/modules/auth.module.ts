import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../../core/application/use-cases/auth.service';
import { JwtStrategy } from '../../infrastructure/security/jwt.strategy';
import { UserEntity } from '../../infrastructure/persistence/entities/user.entity';
import { LoginAttemptEntity } from '../../infrastructure/persistence/entities/login-attempt.entity';
import { DeviceFingerprintEntity } from '../../infrastructure/persistence/entities/device-fingerprint.entity';
import { UserRepository } from '../../infrastructure/persistence/repositories/user.repository';
import { USER_REPOSITORY } from '../../core/application/ports/user.repository.port';
import { RiskModule } from './risk.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, LoginAttemptEntity, DeviceFingerprintEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    RiskModule,
    JwtModule.register({
      secret: (() => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
            return 'checc_jwt_secret_dev_only_change_in_prod';
          }
          throw new Error('JWT_SECRET environment variable must be set in non-development environments');
        }
        return secret;
      })(),
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
  ],
  exports: [AuthService, USER_REPOSITORY],
})
export class AuthModule {}
