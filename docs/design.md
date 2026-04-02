# CHECC Design

## Overview

CHECC is a locally deployed clinic operations platform that combines:

- patient enrollment and service selection
- order creation with deterministic pricing
- offline-recorded payments and controlled refunds
- versioned health-check reporting with reviewer e-signature and PDF export
- in-app notifications
- cultural content publishing with review workflow
- operational risk controls such as IP rules, rate limiting, CAPTCHA, and anomaly detection

The implementation is a monorepo with a NestJS API, a React SPA, and a shared TypeScript package for schemas, DTOs, roles, limits, and error codes.

## Goals

- run fully offline on a local network or a single machine
- keep business rules on the server
- share contracts between API and web app
- preserve auditability for pricing, signatures, and risk events
- protect sensitive data with layered controls rather than a single mechanism

## High-Level Architecture

### Backend

- Framework: NestJS
- Persistence: PostgreSQL via TypeORM
- Scheduling: `@nestjs/schedule`
- Validation: Zod schemas applied through a custom validation pipe
- Logging: Winston with basic PII scrubbing
- File storage:
  - media assets in `data/media` by default
  - generated PDFs in `data/pdfs` by default

The API uses a modular layout:

- `api/`: controllers, guards, decorators, filters, pipes
- `core/application/use-cases/`: business logic and orchestration
- `core/application/ports/`: interfaces for replaceable dependencies
- `infrastructure/`: TypeORM entities, security helpers, schedulers, PDF generation, logging

### Frontend

- Framework: React with Vite
- Routing: React Router
- State: Zustand for auth state
- UI: Tailwind + shadcn/ui
- Auth storage: `sessionStorage`
- Offline support:
  - IndexedDB draft storage via `idb-keyval`
  - per-user sync queue for enrollment operations

### Shared Library

`libs/shared` defines:

- Zod request schemas
- DTO and enum types
- role constants
- system limits
- canonical error codes

This keeps request and response contracts aligned across backend and frontend.

## Request Lifecycle

All API routes are mounted under `/api`.

The effective pipeline is:

1. IP allow/deny guard
2. rate-limit guard
3. JWT auth guard
4. role guard
5. controller-level Zod validation where configured
6. service-layer business rules
7. global exception filter returning a normalized error payload

Successful responses usually use one of these shapes:

- `{ data: ... }`
- `{ data: ..., message: "..." }`
- `{ data: [...], meta: { total, page, limit } }`

Errors are normalized to:

```json
{
  "statusCode": 400,
  "errorCode": "GEN_001",
  "message": "Validation failed",
  "details": {
    "field": ["message"]
  },
  "timestamp": "2026-04-03T00:00:00.000Z"
}
```

## Core Domain Flows

### Auth

- registration always creates a `patient` user
- passwords must be at least 12 chars with upper, lower, number, and special char
- failed logins are recorded per user and per IP
- accounts lock after 5 failed attempts in 15 minutes
- CAPTCHA is required after 5 recent failed attempts from the same IP
- login returns both access and refresh tokens, although there is currently no refresh endpoint

### Enrollment to Order

Workflow:

1. patient creates a draft enrollment with one or more service lines
2. patient updates draft as needed
3. patient submits the draft
4. submission transaction:
   - locks the enrollment row
   - validates service lines
   - checks seat availability for seat-limited services
   - creates 60-minute held seat reservations
   - marks enrollment `SUBMITTED`
   - creates an order with price snapshots
   - sets order auto-cancel for 30 minutes later
   - applies pricing rules and writes immutable discount audit rows

If the order is canceled or times out, the enrollment is moved back to `DRAFT` and held seats are released.

### Pricing

Pricing is implemented as a pure engine plus a persistence service.

Key rules:

- only active rules inside their validity window are considered
- rules can target service IDs, categories, minimum quantity, and minimum order subtotal
- rules are sorted by `priorityLevel`
- exclusion groups choose the single highest-value rule for the patient
- standalone rules all apply
- total discount is capped at the line subtotal
- every applied line writes immutable reasoning into `discount_audit_trail`

Supported rule types:

- `percentage_off`
- `fixed_off`
- `fixed_price`
- `buy_x_get_y`

### Payments and Refunds

- payments are recorded manually by staff or admin
- payment amount must exactly match the order final total
- successful payment marks the order `PAID`, clears auto-cancel, and activates the enrollment
- refunds require a reason code
- refunds are self-approved only when the requester has `canApproveRefunds`
- otherwise supervisor credentials are required and re-verified against live auth data
- completed refunds mark the payment `REFUNDED` and the order `REFUNDED`

### Health Checks

Health checks are versioned clinical reports.

Workflow:

1. staff/admin creates a draft report with result items
2. server creates version 1 snapshot
3. abnormal flags are computed from reference ranges
4. prior values are attached from the patient's most recent signed or amended report
5. staff/admin can amend by creating a new version
6. staff/admin submits the current version for review
7. reviewer re-authenticates and signs the specific version
8. signing updates report and version status to `SIGNED`
9. PDF generation runs after signing and stores a SHA-256 checksum

Important constraints:

- only `AWAITING_REVIEW` versions can be signed
- signatures require the same user as the active JWT session
- only `reviewer` role can sign
- signing must happen within 24 hours of the version creation time
- PDF download validates checksum before streaming the file

### Notifications

Notifications are stored in the database and exposed only as in-app messages.

The scheduler emits notifications for:

- orders approaching auto-cancel
- canceled orders that had payment attempts
- confirmed seat reservations
- health checks that breached the 24-hour review SLA

Delivery is throttled to 3 notifications per reference item per rolling 24-hour window.

### Content

Content supports `article`, `gallery`, `audio`, and `video` records.

Workflow:

1. admin/staff creates content in `DRAFT`
2. body HTML is sanitized
3. sensitive words are scanned and stored as hits, but creation is not blocked
4. the author can update while still in `DRAFT`
5. the author submits for review
6. admin approves to `PUBLISHED` or rejects to `REJECTED`
7. admin can archive published or rejected content

Each content edit creates a version snapshot. Media uploads are stored as separate assets and served through a public media endpoint.

### Risk Control

Risk controls are layered across guards and background detection:

- IP allow/deny with CIDR matching
- per-route in-memory rate limiting keyed by user-or-IP plus route/action
- device fingerprint propagation from the SPA
- locally generated CAPTCHA challenges
- anomaly detection for:
  - promo abuse
  - bulk registration from the same IP
  - repeated refunds

Detected anomalies create both a `risk_event` and an `incident_ticket`.

## Scheduled Jobs

- `OrderTimeoutService`
  - every 5 minutes
  - auto-cancels overdue unpaid orders
  - reverts enrollment to `DRAFT`
  - releases expired seat reservations

- `NotificationSchedulerService`
  - every 30 minutes
  - sends due-soon, overdue, pickup-ready, and compliance-breach notifications

- `ComplianceCheckService`
  - every hour
  - flags health checks whose `AWAITING_REVIEW` version exceeded 24 hours

## Data Model Summary

Major tables by domain:

- auth: `users`, `login_attempts`
- enrollment: `catalog_services`, `enrollments`, `enrollment_service_lines`, `seat_reservations`
- ordering: `orders`, `order_lines`
- pricing: `pricing_rules`, `discount_audit_trail`
- payments: `payments`, `refunds`
- clinical: `report_templates`, `health_checks`, `health_check_versions`, `health_check_result_items`, `report_signatures`, `report_pdfs`
- notifications: `notifications`, `notification_delivery_log`
- content: `articles`, `article_versions`, `media_assets`, `sensitive_words`
- risk: `ip_rules`, `risk_events`, `incident_tickets`, `captcha_challenges`

## Security and Privacy

- JWT auth with role-based guards
- object-level ownership checks inside controllers and services
- AES-256-GCM helpers for encrypted fields and JSON payloads
- log scrubbing for password, token, authorization, and SSN patterns
- checksum validation on stored PDFs
- path sanitization for media and PDF file handling

## Frontend Behavior Notes

- auth tokens are kept in `sessionStorage`, so they survive refresh but not tab close
- the app computes a device fingerprint and sends it as `X-Device-Fingerprint`
- offline draft storage is scoped per user
- the sync queue currently covers enrollment create, update, and submit operations
- `AppShell` retries queued enrollment actions when the app loads or regains connectivity

## Deployment Model

The default deployment is a local-first stack:

- PostgreSQL
- NestJS API on port `3000`
- React web app on port `5173`

The codebase supports Docker-based startup and optional automatic migration and seed execution through environment variables.
