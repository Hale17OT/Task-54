Project type: fullstack

# CHECC — Community Health Enrollment & Clinic Commerce System

Fullstack platform for community-health clinic operations: patient enrollment, service ordering with transparent pricing, clinical health-check reports with e-signature, cultural content publishing, in-app notifications, and risk control. Backend is NestJS (TypeScript) with PostgreSQL; frontend is React (Vite + shadcn/ui).

## Prerequisites

- Docker Engine 24+ and Docker Compose v2

That is the only prerequisite. Everything else (Node.js, PostgreSQL, dependencies, migrations, seed data) is provisioned inside containers.

## Start the stack

```bash
docker-compose up
```

This builds and starts:

| Service     | Container       | URL / Port                        |
|-------------|-----------------|-----------------------------------|
| PostgreSQL  | `checc-postgres` | localhost:5432                   |
| API (Nest)  | `checc-api`     | http://localhost:3000             |
| Web (React) | `checc-web`     | http://localhost:5173             |

On first start the API container automatically:

1. Runs database migrations (`RUN_MIGRATIONS=true`)
2. Seeds catalog services, report templates, pricing rules, and demo users (`RUN_SEED=true`)

To run in the background:

```bash
docker-compose up -d
```

To stop and remove all containers + volumes:

```bash
docker-compose down -v
```

## Verify it works

```bash
# API health check
curl http://localhost:3000/api/health

# Web app
open http://localhost:5173
```

Sign in with the seeded admin credentials (see [Demo credentials](#demo-credentials)).

## Run the tests (Docker only)

The full test suite — API unit, integration, end-to-end (real DB), web unit, and Playwright E2E — runs inside containers via a single command:

```bash
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from test-runner
docker-compose -f docker-compose.test.yml down -v
```

Or via the npm shortcut, which wraps the same compose flow:

```bash
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from test-runner && \
docker-compose -f docker-compose.test.yml down -v
```

What the test-runner exercises:

- **API unit / service / pipe / guard tests** (Jest, ~278 tests)
- **API end-to-end endpoint coverage** (`apps/api/test/e2e/endpoints.e2e.spec.ts`, 89 tests, real PostgreSQL, real controllers + guards + services + persistence — no service mocks)
- **Web unit / component tests** (Vitest)
- **Playwright E2E** against the running web container

Exit code 0 = all suites passed.

## Demo credentials

Seeded automatically on first API container start.

| Username     | Password           | Role     | Notes                            |
|--------------|--------------------|----------|----------------------------------|
| `admin`      | `Admin12345678!`   | admin    | Full system access               |
| `staff1`     | `Staff12345678!`   | staff    | Standard staff                   |
| `supervisor` | `Staff12345678!`   | staff    | Has `can_approve_refunds` flag   |
| `patient1`   | `Patient12345!`    | patient  | Standard patient                 |
| `reviewer1`  | `Reviewer12345!`   | reviewer | Clinical sign-off authority      |

## API endpoints

Base URL: `http://localhost:3000/api`. All routes are namespaced under `/api`. Auth uses Bearer JWT in the `Authorization` header (obtain via `POST /api/auth/login`).

| # | Method | Path                                              | Auth          | Purpose                                         |
|---|--------|---------------------------------------------------|---------------|-------------------------------------------------|
| 1 | GET    | /api/health                                       | Public        | Liveness probe                                  |
| 2 | POST   | /api/auth/register                                | Public        | Register a new patient                          |
| 3 | POST   | /api/auth/login                                   | Public        | Issue access + refresh JWTs                     |
| 4 | GET    | /api/auth/me                                      | JWT           | Current authenticated user                      |
| 5 | GET    | /api/auth/devices                                 | JWT           | List own known devices                          |
| 6 | POST   | /api/auth/devices/:fingerprint/trust              | JWT           | Mark device trusted                             |
| 7 | DELETE | /api/auth/devices/:fingerprint/trust              | JWT           | Revoke device trust                             |
| 8 | GET    | /api/catalog                                      | JWT           | List catalog services                           |
| 9 | GET    | /api/catalog/:id                                  | JWT           | Single catalog service                          |
| 10 | POST   | /api/content                                     | Staff/Admin   | Create article (DRAFT)                          |
| 11 | PUT    | /api/content/:id                                 | Staff/Admin   | Update article                                  |
| 12 | POST   | /api/content/:id/submit-review                   | Staff/Admin   | DRAFT → IN_REVIEW                               |
| 13 | POST   | /api/content/:id/review                          | Admin         | Approve / reject submitted article              |
| 14 | POST   | /api/content/:id/archive                         | Admin         | Archive article                                 |
| 15 | GET    | /api/content/published                           | JWT           | List PUBLISHED articles                         |
| 16 | GET    | /api/content                                     | Admin         | List all articles                               |
| 17 | GET    | /api/content/:id/versions                        | Staff/Admin   | Article version history                         |
| 18 | POST   | /api/content/:id/media                           | Staff/Admin   | Upload media asset (10 MB max, MIME-allowlisted) |
| 19 | GET    | /api/content/:slug                               | Public        | Fetch article by slug                           |
| 20 | POST   | /api/enrollments                                 | Patient       | Create enrollment (DRAFT)                       |
| 21 | GET    | /api/enrollments                                 | JWT           | List own enrollments (staff/admin: all)         |
| 22 | GET    | /api/enrollments/:id                             | JWT           | Enrollment detail                               |
| 23 | PUT    | /api/enrollments/:id                             | JWT           | Update enrollment                               |
| 24 | POST   | /api/enrollments/:id/submit                      | JWT           | DRAFT → SUBMITTED, creates order                |
| 25 | POST   | /api/enrollments/:id/cancel                      | JWT           | Cancel non-active enrollment                    |
| 26 | POST   | /api/health-checks                               | Staff/Admin   | Create health-check report (DRAFT)              |
| 27 | GET    | /api/health-checks                               | JWT           | List reports                                    |
| 28 | GET    | /api/health-checks/:id                           | JWT           | Report + current version                        |
| 29 | PUT    | /api/health-checks/:id                           | Staff/Admin   | Update report → new version                     |
| 30 | POST   | /api/health-checks/:id/submit-review             | Staff/Admin   | DRAFT → AWAITING_REVIEW                         |
| 31 | POST   | /api/health-checks/:id/sign                      | Reviewer      | Re-auth + e-sign report                         |
| 32 | GET    | /api/health-checks/:id/versions                  | JWT           | Report version history                          |
| 33 | GET    | /api/health-checks/:id/pdf/:versionNumber        | JWT           | Download signed PDF                             |
| 34 | GET    | /api/media/:filename                             | Public        | Serve uploaded media                            |
| 35 | GET    | /api/notifications                               | JWT           | List own notifications                          |
| 36 | PATCH  | /api/notifications/:id/read                      | JWT           | Mark one read                                   |
| 37 | PATCH  | /api/notifications/read-all                      | JWT           | Mark all read                                   |
| 38 | GET    | /api/notifications/unread-count                  | JWT           | Unread count                                    |
| 39 | GET    | /api/notifications/throttle-status               | JWT           | Throttle config                                 |
| 40 | GET    | /api/orders                                      | JWT           | List orders                                     |
| 41 | GET    | /api/orders/by-enrollment/:enrollmentId          | JWT           | Order for an enrollment                         |
| 42 | GET    | /api/orders/:id                                  | JWT           | Order detail                                    |
| 43 | POST   | /api/orders/:id/cancel                           | JWT           | Cancel pending order                            |
| 44 | POST   | /api/payments                                    | Staff/Admin   | Record payment                                  |
| 45 | GET    | /api/payments/order/:orderId                     | Staff/Admin   | Payments for an order                           |
| 46 | GET    | /api/payments/:id                                | Staff/Admin   | Payment detail                                  |
| 47 | POST   | /api/payments/refund                             | Staff/Admin   | Issue refund (supervisor-gated)                 |
| 48 | GET    | /api/payments                                    | Staff/Admin   | List all payments                               |
| 49 | POST   | /api/pricing/rules                               | Admin         | Create pricing rule                             |
| 50 | PUT    | /api/pricing/rules/:id                           | Admin         | Update pricing rule                             |
| 51 | DELETE | /api/pricing/rules/:id                           | Admin         | Deactivate pricing rule                         |
| 52 | GET    | /api/pricing/rules                               | Admin         | List pricing rules                              |
| 53 | POST   | /api/pricing/compute                             | Patient/Staff/Admin | Preview pricing for an order              |
| 54 | GET    | /api/pricing/audit/:orderId                      | Staff/Admin   | Discount audit trail                            |
| 55 | GET    | /api/risk/ip-rules                               | Admin         | List IP rules                                   |
| 56 | POST   | /api/risk/ip-rules                               | Admin         | Create IP allow/deny rule                       |
| 57 | DELETE | /api/risk/ip-rules/:id                           | Admin         | Delete IP rule                                  |
| 58 | GET    | /api/risk/events                                 | Admin         | List detected risk events                       |
| 59 | GET    | /api/risk/incidents                              | Admin         | List incident tickets                           |
| 60 | PATCH  | /api/risk/incidents/:id                          | Admin         | Update incident                                 |
| 61 | GET    | /api/risk/captcha                                | Public        | Issue CAPTCHA challenge                         |
| 62 | POST   | /api/risk/captcha/verify                         | Public        | Verify CAPTCHA answer                           |
| 63 | GET    | /api/templates                                   | Staff/Admin/Reviewer | List health-check templates              |

Source of truth: `apps/api/src/api/controllers/*.ts`. Schema definitions for request/response payloads live in `libs/shared/src/schemas/*.ts`.

## Configuration

`docker-compose.yml` reads variables from a `.env` file in the repo root. A working `.env` ships in the repo for local dev. Required variables:

| Variable                | Purpose                                                        |
|-------------------------|----------------------------------------------------------------|
| `JWT_SECRET`            | Required. JWT signing key.                                     |
| `FIELD_ENCRYPTION_KEY`  | Required. 32-byte AES key for at-rest field encryption.        |
| `POSTGRES_PASSWORD`     | DB password (default `checc_dev_password` for local).          |
| `RATE_LIMIT_DISABLED`   | Defaults to `false`. Only override in non-production.          |
| `RUN_MIGRATIONS`        | Defaults to `true` in compose. Runs migrations at API startup. |
| `RUN_SEED`              | Defaults to `true` in compose. Idempotent seed.                |

See `.env.example` for production guidance.

## Architecture

- **Backend**: NestJS, hexagonal layout (`apps/api/src/{api,core,infrastructure}`). TypeORM + PostgreSQL.
- **Frontend**: React + Vite + shadcn/ui (Tailwind + Radix). Zustand state management.
- **Shared**: Zod schemas, types, and constants in `libs/shared/src/`.
- **Auth**: JWT bearer tokens, account lockout (5 failures / 15 min), CAPTCHA escalation, device-fingerprint step-up for unrecognized devices.
- **Pricing**: Deterministic best-offer engine with exclusion groups and immutable discount audit trail.
- **Reports**: Versioned health checks, reviewer e-signature with re-authentication, 24-hour signing SLA, SHA-256-checksummed PDF export.
- **Risk**: IP allow/deny lists, per-action rate limiting, anomaly detection (bulk registration, repeated refunds, promo abuse), incident tickets.

## Project layout

```
repo/
├── apps/
│   ├── api/                    # NestJS REST API (port 3000)
│   │   └── src/
│   │       ├── api/            # Controllers, guards, pipes, decorators
│   │       ├── core/           # Domain use cases and ports
│   │       └── infrastructure/ # TypeORM, logging, scheduling, security, PDF
│   └── web/                    # React SPA (port 5173)
├── libs/shared/                # Shared Zod schemas, types, constants
├── docker-compose.yml          # PostgreSQL + API + Web (production-style runtime)
├── docker-compose.test.yml     # PostgreSQL + API + Web + test-runner (CI test flow)
└── Dockerfile.test             # Image used by the test-runner container
```
