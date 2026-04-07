import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY } from '../decorators/rate-limit.decorator';
import { extractClientIp } from '../../infrastructure/security/ip-extractor';
import { RATE_LIMITS } from '@checc/shared/constants/limits';
import { ErrorCodes } from '@checc/shared/constants/error-codes';

interface BucketEntry {
  timestamps: number[];
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, BucketEntry>();

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (
      process.env.RATE_LIMIT_DISABLED === 'true' &&
      (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Get per-endpoint override or use defaults
    const rateLimitMeta = this.reflector.getAllAndOverride<
      { limit: number; windowSeconds: number } | undefined
    >(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);

    const limit = rateLimitMeta?.limit ?? RATE_LIMITS.DEFAULT_REQUESTS_PER_MINUTE;
    const windowSeconds = rateLimitMeta?.windowSeconds ?? RATE_LIMITS.DEFAULT_WINDOW_SECONDS;

    // Per-action key: identity + HTTP method + route path
    const user = request.user;
    const identity = user?.id || extractClientIp(request);
    const action = `${request.method}:${request.route?.path || request.path || '/'}`;
    const key = `${identity}:${action}`;

    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.buckets.set(key, bucket);
    }

    // Remove timestamps outside window
    bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);

    if (bucket.timestamps.length >= limit) {
      throw new HttpException(
        {
          message: 'Too many requests',
          errorCode: ErrorCodes.RATE_LIMITED,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.timestamps.push(now);
    return true;
  }
}
