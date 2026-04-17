/**
 * E2E Test App Bootstrap
 *
 * Boots the real production AppModule against a real PostgreSQL database
 * (via DATABASE_HOST env var). Mirrors apps/api/src/main.ts:
 *   - app.setGlobalPrefix('api')
 *   - GlobalExceptionFilter
 *   - ZodValidationPipe (controllers attach per-endpoint pipes)
 *
 * No services are mocked. Tests hit the real /api/... routes through
 * the real guard chain (JwtAuthGuard, RolesGuard, RateLimitGuard,
 * IpAllowDenyGuard) and persistence layer.
 *
 * If DATABASE_HOST is not set, getTestApp() returns null and tests
 * conditionally skip — same pattern as db-integration.spec.ts.
 */

import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as express from 'express';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/api/filters/global-exception.filter';
import { ZodValidationPipe } from '../../src/api/pipes/zod-validation.pipe';
import { WinstonLogger } from '../../src/infrastructure/logging/winston.logger';
import { runSeed } from '../../src/infrastructure/persistence/seed';

let cachedApp: INestApplication | null = null;
let cachedAvailable = false;

/**
 * Boot a real Nest app once and reuse across the test process.
 * Returns null if DATABASE_HOST is unset or the DB cannot be reached.
 */
export async function getTestApp(): Promise<INestApplication | null> {
  if (cachedApp) return cachedApp;
  if (!process.env.DATABASE_HOST) return null;

  // Test-friendly env: rate limiting off, seeding on, dev-style secrets allowed
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.RATE_LIMIT_DISABLED = 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e_test_jwt_secret_change_me';
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
  process.env.FIELD_ENCRYPTION_KEY =
    process.env.FIELD_ENCRYPTION_KEY || 'test_encryption_key_32characters!';
  process.env.RUN_MIGRATIONS = process.env.RUN_MIGRATIONS || 'true';

  try {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter(new WinstonLogger()));
    app.useGlobalPipes(new ZodValidationPipe());
    // Explicit body parsers mirror what NestFactory.create installs in main.ts.
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    await app.init();

    // Seed the test database (idempotent) and reset volatile state.
    try {
      const ds = app.get(DataSource);
      await runSeed(ds);

      // Test isolation: wipe transient tables that accumulate across runs and
      // would otherwise interact with auth flows (trusted-device step-up,
      // login-attempt lockouts, captcha consumption).
      await ds.query('TRUNCATE TABLE device_fingerprints CASCADE');
      await ds.query('TRUNCATE TABLE login_attempts CASCADE');
      // Clear any user lockouts left over from prior failures
      await ds.query("UPDATE users SET locked_until = NULL WHERE locked_until IS NOT NULL");
    } catch {
      // Seed errors are non-fatal — individual tests will fail clearly if data is missing.
    }

    cachedApp = app;
    cachedAvailable = true;
    return cachedApp;
  } catch {
    cachedAvailable = false;
    return null;
  }
}

export async function closeTestApp(): Promise<void> {
  if (cachedApp) {
    await cachedApp.close();
    cachedApp = null;
    cachedAvailable = false;
  }
}

export function isE2eAvailable(): boolean {
  return cachedAvailable;
}
