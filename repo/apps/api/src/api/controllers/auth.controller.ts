import { Controller, Post, Get, Delete, Body, Param, Req, UsePipes } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../../core/application/use-cases/auth.service';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ZodValidate } from '../pipes/zod-validation.pipe';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { extractClientIp } from '../../infrastructure/security/ip-extractor';
import { loginSchema, registerSchema } from '@checc/shared/schemas/auth.schema';
import type { LoginInput, RegisterInput } from '@checc/shared/schemas/auth.schema';
import type { UserDto } from '@checc/shared/types/auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @RateLimit(5, 60)
  @UsePipes(ZodValidate(registerSchema))
  async register(@Body() body: RegisterInput, @Req() req: Request) {
    const ipAddress = extractClientIp(req);
    const user = await this.authService.register(body, ipAddress);
    return { data: user, message: 'Registration successful' };
  }

  @Public()
  @Post('login')
  @RateLimit(10, 60)
  @UsePipes(ZodValidate(loginSchema))
  async login(@Body() body: LoginInput, @Req() req: Request) {
    const ipAddress = extractClientIp(req);
    const result = await this.authService.login(body, ipAddress);
    return { data: result };
  }

  @Get('me')
  async me(@CurrentUser() user: UserDto) {
    const result = await this.authService.getMe(user.id);
    return { data: result };
  }

  @Get('devices')
  async listDevices(@CurrentUser() user: UserDto) {
    const devices = await this.authService.getUserDevices(user.id);
    return {
      data: devices.map((d) => ({
        id: d.id,
        fingerprint: d.fingerprint,
        isTrusted: d.isTrusted,
        firstSeenAt: d.firstSeenAt.toISOString(),
        lastSeenAt: d.lastSeenAt.toISOString(),
      })),
    };
  }

  @Post('devices/:fingerprint/trust')
  async trustDevice(
    @CurrentUser() user: UserDto,
    @Param('fingerprint') fingerprint: string,
  ) {
    await this.authService.trustDevice(user.id, fingerprint);
    return { message: 'Device marked as trusted' };
  }

  @Delete('devices/:fingerprint/trust')
  async revokeDevice(
    @CurrentUser() user: UserDto,
    @Param('fingerprint') fingerprint: string,
  ) {
    await this.authService.revokeDevice(user.id, fingerprint);
    return { message: 'Device trust revoked' };
  }
}
