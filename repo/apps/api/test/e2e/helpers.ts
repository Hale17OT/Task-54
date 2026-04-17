/**
 * Shared E2E helpers
 *
 * - request(app): supertest agent against the live HTTP server
 * - login(app, username, password): logs in via /api/auth/login and returns access token
 * - seededTokens(app): logs in all five seeded users and returns their tokens
 * - createPatient(app, suffix): registers a fresh patient and returns { username, password, token }
 * - uuid(): random UUID convenience
 */

import { INestApplication } from '@nestjs/common';
import * as supertest from 'supertest';
import { randomUUID } from 'crypto';

export function request(app: INestApplication) {
  const r = (supertest as any).default || supertest;
  return r(app.getHttpServer());
}

export const SEEDED = {
  admin:      { username: 'admin',      password: 'Admin12345678!'   },
  staff:      { username: 'staff1',     password: 'Staff12345678!'   },
  supervisor: { username: 'supervisor', password: 'Staff12345678!'   },
  patient:    { username: 'patient1',   password: 'Patient12345!'    },
  reviewer:   { username: 'reviewer1',  password: 'Reviewer12345!'   },
} as const;

export const SEEDED_IDS = {
  admin:      '00000000-0000-0000-0000-000000000001',
  staff:      '00000000-0000-0000-0000-000000000002',
  supervisor: '00000000-0000-0000-0000-000000000003',
  patient:    '00000000-0000-0000-0000-000000000004',
  reviewer:   '00000000-0000-0000-0000-000000000005',
} as const;

export const SEEDED_TEMPLATE_ID = '00000000-0000-0000-0002-000000000001';
export const SEEDED_CATALOG_IDS = {
  annualLab:   '00000000-0000-0000-0001-000000000001',
  nutrition:   '00000000-0000-0000-0001-000000000002',
  bloodDraw:   '00000000-0000-0000-0001-000000000003',
  vision:      '00000000-0000-0000-0001-000000000004',
  hearing:     '00000000-0000-0000-0001-000000000005',
  bp:          '00000000-0000-0000-0001-000000000006',
  bmi:         '00000000-0000-0000-0001-000000000007',
  cholesterol: '00000000-0000-0000-0001-000000000008',
} as const;

export interface LoginResult {
  token: string;
  refreshToken: string;
  userId: string;
  role: string;
}

export async function login(
  app: INestApplication,
  username: string,
  password: string,
  deviceFingerprint = 'e2e-test-device-fingerprint',
): Promise<LoginResult> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password, deviceFingerprint });

  if (res.status !== 201 && res.status !== 200) {
    throw new Error(
      `Login failed for ${username}: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }

  const data = res.body.data;
  return {
    token: data.accessToken,
    refreshToken: data.refreshToken,
    userId: data.user.id,
    role: data.user.role,
  };
}

export interface SeededTokens {
  admin: LoginResult;
  staff: LoginResult;
  supervisor: LoginResult;
  patient: LoginResult;
  reviewer: LoginResult;
}

export async function seededTokens(app: INestApplication): Promise<SeededTokens> {
  const [admin, staff, supervisor, patient, reviewer] = await Promise.all([
    login(app, SEEDED.admin.username, SEEDED.admin.password),
    login(app, SEEDED.staff.username, SEEDED.staff.password),
    login(app, SEEDED.supervisor.username, SEEDED.supervisor.password),
    login(app, SEEDED.patient.username, SEEDED.patient.password),
    login(app, SEEDED.reviewer.username, SEEDED.reviewer.password),
  ]);
  return { admin, staff, supervisor, patient, reviewer };
}

/** Register a fresh patient and return their credentials + token. */
export async function createPatient(
  app: INestApplication,
  suffix?: string,
): Promise<{ username: string; password: string; email: string; token: string; userId: string }> {
  const tag = suffix || randomUUID().slice(0, 8);
  const username = `e2e_patient_${tag}`;
  const email = `e2e_patient_${tag}@test.local`;
  const password = 'E2eTestPass1!';

  const reg = await request(app)
    .post('/api/auth/register')
    .send({ username, email, password, fullName: `E2E Patient ${tag}` });
  if (reg.status !== 201 && reg.status !== 200) {
    throw new Error(`Register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  }

  const result = await login(app, username, password);
  return {
    username,
    password,
    email,
    token: result.token,
    userId: result.userId,
  };
}

export function uuid(): string {
  return randomUUID();
}

/** A non-existent UUID handy for 404-path assertions. */
export const NONEXISTENT_UUID = '00000000-0000-0000-0000-aaaaaaaaaaaa';

/** Bearer header convenience. */
export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}
