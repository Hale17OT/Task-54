# CHECC - Community Health Enrollment & Clinic Commerce System

A 100% offline, locally deployed platform for community health clinic management. Supports patient enrollment, service ordering with transparent pricing, clinical health-check reports with e-signature, cultural content publishing, in-app notifications, and comprehensive risk control.

## Prerequisites

- Docker & Docker Compose
- Node.js >= 20 (for local development)

## Quick Start (Docker)

```bash
docker compose up --build
```

This starts:
- **PostgreSQL** on port 5432
- **API** (NestJS) on port 3000
- **Web** (React) on port 5173

Database migrations and seed data run automatically on first start.

## Local Development

### Option A: Docker for PostgreSQL only
```bash
npm install
docker compose up postgres -d
npm run dev:api
npm run dev:web  # separate terminal
```

### Option B: Fully local (no Docker)
```bash
npm install

# 1. Install and start PostgreSQL locally (port 5432)
#    macOS: brew install postgresql@16 && brew services start postgresql@16
#    Ubuntu: sudo apt install postgresql && sudo systemctl start postgresql
#    Windows: Download from https://www.postgresql.org/download/

# 2. Create database and user
psql -U postgres -c "CREATE USER checc WITH PASSWORD 'checc_dev_password';"
psql -U postgres -c "CREATE DATABASE checc OWNER checc;"

# 3. Set environment variables (bash/zsh)
export DATABASE_HOST=localhost
export DATABASE_PORT=5432
export DATABASE_NAME=checc
export DATABASE_USER=checc
export DATABASE_PASSWORD=checc_dev_password
export JWT_SECRET=local_dev_jwt_secret
export FIELD_ENCRYPTION_KEY=local_dev_encryption_key_32chars!!
export RUN_MIGRATIONS=true
export RUN_SEED=true

# 3. Set environment variables (PowerShell — Windows)
# $env:DATABASE_HOST='localhost'
# $env:DATABASE_PORT='5432'
# $env:DATABASE_NAME='checc'
# $env:DATABASE_USER='checc'
# $env:DATABASE_PASSWORD='checc_dev_password'
# $env:JWT_SECRET='local_dev_jwt_secret'
# $env:FIELD_ENCRYPTION_KEY='local_dev_encryption_key_32chars!!'
# $env:RUN_MIGRATIONS='true'
# $env:RUN_SEED='true'

# 4. Start API (runs migrations + seed on first boot)
npm run dev:api

# 5. Start Web (separate terminal)
npm run dev:web

# 6. Smoke test
curl http://localhost:3000/api/health    # API health check
open http://localhost:5173               # Web login page
```

### Automated Acceptance Test
```bash
# After starting the stack (Docker or local), run:
./scripts/acceptance-test.sh
# Validates: API health, admin login, seed data (catalog, pricing, templates)
```

### Quick Smoke Test Checklist
1. Open http://localhost:5173 — login page renders
2. Login as `admin` / `Admin12345678!` — dashboard loads
3. Navigate to Enrollments — list renders
4. Navigate to Pricing Rules — rules from seed data visible
5. Navigate to Risk Dashboard — stat cards render

## Testing

### Frontend Acceptance (no backend needed)
```bash
npm run build:web           # Production build
npm run test:web            # Unit + component tests (83 tests)
npx playwright install chromium
npm run test:e2e            # Standalone E2E (login page, route guards, redirects)
```

### Full-Stack Acceptance (mandatory for release — one Docker command)
```bash
# Single command — builds everything, runs ALL tests (API + Web + E2E), tears down
npm run test:docker

# Or equivalently:
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from test-runner
docker compose -f docker-compose.test.yml down -v
```

### Individual Test Commands
```bash
npm run test:api            # API unit + integration (201 tests)
npm run test:web            # Web unit + component (83 tests)
npm run test:e2e            # E2E standalone (2 always-on + 59 full-stack)
./run_tests.sh              # All of the above + auto-detects backend for full-stack
```

## Architecture

**Backend**: Hexagonal/Clean Architecture — domain logic decoupled from framework.
**Frontend**: React SPA with shadcn/ui (Tailwind CSS + Radix UI), Zustand state management.
**Shared**: TypeScript types and Zod schemas shared between frontend and backend.

```
repo/
├── apps/
│   ├── api/                    # NestJS REST API
│   │   └── src/
│   │       ├── api/            # Controllers, guards, pipes, decorators
│   │       ├── core/           # Domain use cases and port interfaces
│   │       └── infrastructure/ # TypeORM, logging, scheduling, security, PDF
│   └── web/                    # React SPA (Vite + shadcn/ui)
│       ├── src/
│       │   ├── components/     # shadcn/ui components + domain components
│       │   ├── pages/          # Route pages by module
│       │   ├── stores/         # Zustand stores
│       │   ├── api/            # API client layer
│       │   └── utils/          # Offline storage, fingerprinting
│       └── e2e/                # Playwright E2E tests
├── libs/shared/                # Shared types, Zod schemas, constants
├── docker-compose.yml          # PostgreSQL + API + Web
├── run_tests.sh                # Canonical unified test runner
└── .temp/devplan.md            # Full development plan
```

## Modules

| Module | Description |
|--------|-------------|
| **Auth** | Registration (12+ char passwords), JWT login, account lockout (5 failures/15 min), role-based guards |
| **Enrollment** | Draft→Submitted→Active workflow, service add-ons, seat quotas (60-min reservations) |
| **Orders** | Order creation from enrollment, price snapshots, auto-cancel (30 min, cron every 5 min) |
| **Pricing** | Deterministic best-offer engine, exclusion groups, immutable discount audit trail, line-level reasoning |
| **Payments** | Offline recorded payments (cash/check/card), supervisor-gated refunds with reason codes |
| **Health Checks** | Versioned reports, reference ranges, abnormal flags, reviewer e-signature (re-auth), 24h SLA compliance, PDF export with SHA-256 checksum |
| **Notifications** | Due dates, overdue balances, hold pickups; 3-per-item-per-24h throttle |
| **Content** | Articles/galleries/audio/video, draft→review→publish workflow, regex sensitive-word detection |
| **Risk Control** | IP allow/deny, rate limiting (30 req/min), device fingerprinting, local CAPTCHA, anomaly detection, incident tickets |

## Roles

| Role | Capabilities |
|------|-------------|
| **Patient** | Browse content, create/submit enrollments, view own reports, receive notifications |
| **Staff** | Record health checks, manage payments, process enrollments. `can_approve_refunds` flag for supervisor override |
| **Reviewer** | Clinical sign-off on health-check report versions via e-signature |
| **Admin** | Manage pricing rules, publish/withdraw content, monitor risk alerts, manage IP rules, view incidents |

## API Endpoints

Base URL: `http://localhost:3000/api`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | Public | Health check |
| `/auth/login` | POST | Public | Login |
| `/auth/register` | POST | Public | Register |
| `/auth/me` | GET | JWT | Current user |
| `/catalog` | GET | JWT | List catalog services |
| `/enrollments` | GET/POST | JWT | List/create enrollments |
| `/enrollments/:id` | GET/PUT | JWT | Get/update enrollment |
| `/enrollments/:id/submit` | POST | JWT | Submit enrollment |
| `/orders` | GET | JWT | List orders |
| `/orders/:id` | GET | JWT | Get order |
| `/pricing/rules` | GET/POST/PUT/DELETE | Admin | Manage pricing rules |
| `/pricing/compute` | POST | JWT | Preview pricing |
| `/pricing/audit/:orderId` | GET | Staff/Admin | Discount audit trail |
| `/payments` | GET/POST | Staff/Admin | List/record payments |
| `/payments/refund` | POST | Staff/Admin | Initiate refund |
| `/health-checks` | GET/POST/PUT | JWT | Health check CRUD |
| `/health-checks/:id/sign` | POST | Reviewer | E-signature |
| `/health-checks/:id/pdf/:v` | GET | JWT | Download PDF |
| `/notifications` | GET | JWT | List notifications |
| `/content` | GET/POST/PUT | JWT | Content CRUD |
| `/content/:id/review` | POST | Admin | Review article |
| `/risk/ip-rules` | GET/POST/DELETE | Admin | IP rules |
| `/risk/events` | GET | Admin | Risk events |
| `/risk/incidents` | GET/PATCH | Admin | Incident tickets |
| `/risk/captcha` | GET/POST | Public | CAPTCHA challenge/verify |

## Security

- Passwords: 12+ characters with uppercase, lowercase, number, special character
- Account lockout: 5 failed attempts → 15-minute lock
- JWT authentication with configurable expiry
- Role-based access control (global guards)
- Object-level authorization (users access only their own data)
- AES-256-GCM field encryption for sensitive data (phone, SSN, medical notes)
- IP allow/deny lists with CIDR support
- Per-action rate limiting (30 req/min default)
- Device fingerprinting (Canvas + AudioContext + hardware)
- Locally generated CAPTCHA challenges
- Anomaly detection: promo abuse, bulk registration, repeated refunds
- PII scrubbed from all logs (Winston structured logging)
- PDFs stored locally with SHA-256 checksum validation

## Environment Variables

See `.env.example` for all configurable variables.

## Seed Data (Development)

| Username | Password | Role | Notes |
|----------|----------|------|-------|
| admin | Admin12345678! | Admin | Full system access |
| staff1 | Staff12345678! | Staff | Standard staff |
| supervisor | Staff12345678! | Staff | Has `can_approve_refunds` flag |
| patient1 | Patient12345! | Patient | Standard patient |
| reviewer1 | Reviewer12345! | Reviewer | Clinical sign-off |

Seed also includes: 8 catalog services, 2 report templates, 3 pricing rules (10% off over $200, BOGO screenings, 50% off second item).
