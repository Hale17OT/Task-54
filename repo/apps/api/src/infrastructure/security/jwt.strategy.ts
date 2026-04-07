import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../../core/application/use-cases/auth.service';
import type { TokenPayload } from '@checc/shared/types/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
            return 'checc_jwt_secret_dev_only_change_in_prod';
          }
          throw new Error('JWT_SECRET environment variable must be set in non-development environments');
        }
        return secret;
      })(),
    });
  }

  async validate(payload: TokenPayload) {
    const user = await this.authService.validateToken(payload);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
