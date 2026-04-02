import { Request } from 'express';

/**
 * Centralized IP extraction that only trusts x-forwarded-for when
 * TRUST_PROXY is explicitly set. Otherwise uses the socket address.
 */
export function extractClientIp(req: Request): string {
  const trustProxy = process.env.TRUST_PROXY === 'true';

  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const firstIp = (typeof forwarded === 'string' ? forwarded : forwarded[0])
        .split(',')[0]
        .trim();
      if (firstIp) return firstIp;
    }
  }

  return req.ip || req.socket?.remoteAddress || '0.0.0.0';
}
