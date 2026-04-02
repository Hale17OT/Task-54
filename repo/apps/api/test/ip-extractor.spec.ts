import { extractClientIp } from '../src/infrastructure/security/ip-extractor';
import type { Request } from 'express';

function mockReq(overrides: {
  headers?: Record<string, string | string[]>;
  ip?: string;
  socketAddress?: string;
}): Request {
  return {
    headers: overrides.headers || {},
    ip: overrides.ip,
    socket: { remoteAddress: overrides.socketAddress || '127.0.0.1' },
  } as unknown as Request;
}

describe('extractClientIp', () => {
  const origEnv = process.env.TRUST_PROXY;

  afterEach(() => {
    if (origEnv === undefined) {
      delete process.env.TRUST_PROXY;
    } else {
      process.env.TRUST_PROXY = origEnv;
    }
  });

  it('returns socket address when TRUST_PROXY is not set', () => {
    delete process.env.TRUST_PROXY;
    const req = mockReq({
      headers: { 'x-forwarded-for': '10.0.0.1' },
      ip: '172.16.0.1',
      socketAddress: '192.168.1.1',
    });
    const ip = extractClientIp(req);
    // Should NOT use x-forwarded-for
    expect(ip).toBe('172.16.0.1');
  });

  it('returns x-forwarded-for first IP when TRUST_PROXY is true', () => {
    process.env.TRUST_PROXY = 'true';
    const req = mockReq({
      headers: { 'x-forwarded-for': '10.0.0.1, 172.16.0.1' },
      ip: '192.168.1.1',
    });
    const ip = extractClientIp(req);
    expect(ip).toBe('10.0.0.1');
  });

  it('falls back to req.ip when TRUST_PROXY is true but no forwarded header', () => {
    process.env.TRUST_PROXY = 'true';
    const req = mockReq({ ip: '192.168.1.1' });
    const ip = extractClientIp(req);
    expect(ip).toBe('192.168.1.1');
  });

  it('returns 0.0.0.0 when nothing is available', () => {
    delete process.env.TRUST_PROXY;
    const req = mockReq({ socketAddress: undefined });
    // Override ip to be undefined too
    (req as any).ip = undefined;
    (req.socket as any).remoteAddress = undefined;
    const ip = extractClientIp(req);
    expect(ip).toBe('0.0.0.0');
  });

  it('ignores x-forwarded-for when TRUST_PROXY is false', () => {
    process.env.TRUST_PROXY = 'false';
    const req = mockReq({
      headers: { 'x-forwarded-for': '10.0.0.1' },
      ip: '172.16.0.1',
    });
    const ip = extractClientIp(req);
    expect(ip).toBe('172.16.0.1');
  });
});
