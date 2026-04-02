import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IpRuleEntity } from '../../infrastructure/persistence/entities/ip-rule.entity';
import { ErrorCodes } from '@checc/shared/constants/error-codes';
import { extractClientIp } from '../../infrastructure/security/ip-extractor';

interface CachedRules {
  rules: IpRuleEntity[];
  cachedAt: number;
}

@Injectable()
export class IpAllowDenyGuard implements CanActivate {
  private cache: CachedRules | null = null;
  private readonly CACHE_TTL_MS = 60_000; // 60 seconds

  constructor(
    @InjectRepository(IpRuleEntity)
    private readonly ipRuleRepo: Repository<IpRuleEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = extractClientIp(request);

    const rules = await this.getRules();
    const now = new Date();

    // Filter out expired rules
    const activeRules = rules.filter(
      (r) => !r.expiresAt || r.expiresAt > now,
    );

    const denyMatch = activeRules.some(
      (r) => r.ruleType === 'deny' && this.ipMatches(ip, r.ipAddress, r.cidrMask),
    );

    if (!denyMatch) return true;

    const allowOverride = activeRules.some(
      (r) => r.ruleType === 'allow' && this.ipMatches(ip, r.ipAddress, r.cidrMask),
    );

    if (allowOverride) return true;

    throw new ForbiddenException({
      message: 'IP address denied',
      errorCode: ErrorCodes.IP_DENIED,
    });
  }

  private async getRules(): Promise<IpRuleEntity[]> {
    const now = Date.now();

    if (this.cache && now - this.cache.cachedAt < this.CACHE_TTL_MS) {
      return this.cache.rules;
    }

    const rules = await this.ipRuleRepo.find();
    this.cache = { rules, cachedAt: now };
    return rules;
  }

  private ipMatches(requestIp: string, ruleIp: string, cidrMask: number): boolean {
    // Simple exact match for /32 or non-IPv4
    if (cidrMask === 32) {
      return this.normalizeIp(requestIp) === this.normalizeIp(ruleIp);
    }

    // CIDR matching for IPv4
    const reqNum = this.ipToNumber(this.normalizeIp(requestIp));
    const ruleNum = this.ipToNumber(this.normalizeIp(ruleIp));

    if (reqNum === null || ruleNum === null) return false;

    const mask = (~0 << (32 - cidrMask)) >>> 0;
    return (reqNum & mask) === (ruleNum & mask);
  }

  private normalizeIp(ip: string): string {
    // Strip ::ffff: prefix for IPv4-mapped IPv6 addresses
    return ip.replace(/^::ffff:/, '');
  }

  private ipToNumber(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;

    let result = 0;
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > 255) return null;
      result = (result << 8) + num;
    }
    return result >>> 0;
  }
}
