# Community Health Enrollment & Clinic Commerce System — Comprehensive Development Plan

**Version**: 1.0.0
**Date**: 2026-04-01
**Status**: Pre-Implementation Planning
**Repository**: `E:/Hale/Coding/Eaglepoint/Task-54/repo`

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Choice & Reasoning](#2-architecture-choice--reasoning)
3. [Major Modules (Vertical Slices)](#3-major-modules-vertical-slices)
4. [Domain Model](#4-domain-model)
5. [Data Model](#5-data-model)
6. [Interface Contracts](#6-interface-contracts)
7. [State Transitions](#7-state-transitions)
8. [Permission & Access Boundaries](#8-permission--access-boundaries)
9. [Failure Paths](#9-failure-paths)
10. [Logging Strategy](#10-logging-strategy)
11. [Testing Strategy](#11-testing-strategy)
12. [README & Operational Documentation](#12-readme--operational-documentation)
13. [Docker Execution Model](#13-docker-execution-model)
14. [Prompt Coverage Verification Checklist](#14-prompt-coverage-verification-checklist)

---

## 1. System Overview

### 1.1 What the System Is

The Community Health Enrollment & Clinic Commerce System (hereafter "CHECC") is an offline-first, locally deployed application that supports community health clinics in managing patient enrollment, ordering add-on health services, processing payments, generating clinical health-check reports, publishing cultural wellness content, and enforcing security and risk controls. It is a self-contained system with zero external API dependencies — no cloud identity providers, no third-party payment gateways, no external messaging services, no CDNs, and no map or storage APIs.

### 1.2 Who It Serves

CHECC serves four primary roles:

| Role | Description |
|------|-------------|
| **Patient/Member** | Browses cultural content, creates enrollment applications, selects add-on services, views health-check reports, receives in-app notifications |
| **Clinic Staff** | Processes enrollments, captures health-check results, manages orders and payments, views notifications |
| **Administrator** | Manages promotion rules, publishes/withdraws cultural content, monitors notifications, reviews risk alerts and incident tickets, manages users |
| **Reviewer** | Clinical sign-off role; reviews and e-signs health-check report versions within 24-hour SLA |

A Staff user may additionally hold a `can_approve_refunds` flag, granting supervisor override capability for refund approvals. This is a boolean attribute on the Staff role, not a separate role.

### 1.3 What It Does

Core capabilities:

- **Offline Enrollment**: Patients save draft enrollment applications, attach add-on services, and submit. Enrollment transitions through DRAFT → SUBMITTED → ACTIVE (upon payment).
- **Order & Checkout**: Transparent pricing with "best offer applied" breakdown, line-level discount reasoning, and mutual exclusion enforcement.
- **Recorded Payment Workflow**: Staff registers offline payment methods (cash, check, manual card terminal), captures reference numbers, and marks orders as Paid, Refunded, or Canceled. Unpaid orders auto-cancel after 30 minutes.
- **Promotion Engine**: Priority-based, time-windowed, mutually exclusive discount rules with deterministic best-offer computation and immutable discount audit trail.
- **Health-Check Reports**: Structured results with reference ranges and abnormal flags, historical comparison, versioned edits with Reviewer e-signature, 24-hour SLA tracking, and one-click PDF export.
- **Cultural Content Publishing**: Draft–review–publish workflow for articles, image galleries, audio, and video. Sensitive-word regex filtering with soft-warning modal.
- **In-App Notifications**: Upcoming due dates, overdue balances, "hold available" pickups. Frequency limit of 3 reminders per item per 24 hours.
- **Risk Control**: Username/password login with 12+ character requirement, 5-attempt lockout for 15 minutes, device fingerprinting (Canvas + AudioContext + hardware), IP allow/deny lists, per-action rate limiting (30 req/min/user), locally generated CAPTCHA challenges, anomaly detection for promo abuse, bulk registrations, and repeated refunds.

### 1.4 Offline-First Constraint

CHECC operates fully offline. The deployment model is an Electron-wrapped "Local Cloud" where:

- A central node runs the NestJS backend and PostgreSQL database.
- Client machines connect via LAN or Wi-Fi to the central node.
- No internet connectivity is required at any point.
- All assets (icons, fonts, images, media) are bundled locally.
- PDFs are generated and stored locally with checksum validation.
- CAPTCHA challenges are generated locally (no reCAPTCHA or hCaptcha).
- Authentication is local username/password — no OAuth, SAML, or external IdP.

### 1.5 Docker Deployment Model

All services are orchestrated via `docker-compose.yml`. A single `docker compose up --build` command produces a fully functional system with:

- PostgreSQL database with auto-migration on startup
- NestJS API server
- React frontend served via Vite (or Nginx in production)
- Seed data for development/testing
- Health checks on all services

Testing is executed via `run_tests.sh`, which is the canonical test entrypoint and returns non-zero exit codes on any failure.

---

## 2. Architecture Choice & Reasoning

### 2.1 Backend: Hexagonal / Clean Architecture

The backend follows Hexagonal (Ports & Adapters) architecture to ensure:

- **Domain isolation**: Business rules live in pure TypeScript classes with zero framework coupling. The domain layer knows nothing about NestJS, TypeORM, or HTTP.
- **Testability**: Domain logic is unit-testable without databases, HTTP servers, or framework bootstrapping.
- **Adaptability**: Infrastructure (database, file storage, scheduling) is injected through ports, allowing replacement without domain changes.
- **Auditability**: Clear separation makes it straightforward to audit security-sensitive business logic (promotions, payments, risk rules).

**Layer Structure**:

```
src/
├── core/
│   ├── domain/          # Entities, value objects, domain events, business rules
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── enums/
│   │   └── errors/
│   └── application/     # Use cases (application services), port interfaces
│       ├── use-cases/
│       ├── ports/       # Repository interfaces, service interfaces
│       └── dtos/        # Internal DTOs (not HTTP DTOs)
├── infrastructure/      # TypeORM repositories, file storage, scheduling adapters
│   ├── persistence/
│   │   ├── entities/    # TypeORM entity decorators (map to domain entities)
│   │   ├── repositories/
│   │   └── migrations/
│   ├── security/        # Encryption, hashing, CAPTCHA generation
│   ├── scheduling/      # Cron jobs (auto-cancel, SLA checks)
│   └── pdf/             # PDFKit generation, checksum validation
└── api/                 # NestJS controllers, HTTP DTOs, guards, interceptors
    ├── controllers/
    ├── dtos/            # Zod-validated request/response DTOs
    ├── guards/
    ├── interceptors/
    └── filters/
```

### 2.2 Frontend: Component-Based Architecture

The React frontend uses a component-based architecture with clear separation:

- **Pages**: Route-level components that compose features.
- **Features**: Domain-specific component groups (enrollment, orders, health-checks, etc.).
- **Components**: Reusable UI components built on shadcn/ui primitives.
- **Hooks**: Custom hooks for data fetching, state management, and business logic.
- **Stores**: Zustand stores for client-side state (auth, cart, notifications).
- **Services**: API client functions (typed fetch wrappers).

### 2.3 Technology Justification

| Technology | Justification |
|-----------|---------------|
| **NestJS** | Modular architecture with built-in dependency injection, guards, interceptors, and scheduling. Strong TypeScript support. Well-suited for enterprise backend patterns. |
| **TypeORM** | Mature ORM with migration support, decorator-based entity mapping, and PostgreSQL compatibility. Supports query-level data isolation. |
| **PostgreSQL** | ACID-compliant, supports JSON columns for flexible metadata, robust indexing, and encryption extensions (pgcrypto). Ideal system of record. |
| **React + Vite** | Fast development builds with HMR, modern ESM-based bundling, and broad ecosystem. Vite produces optimized static assets for production. |
| **shadcn/ui** | Copy-paste component library built on Radix UI primitives and Tailwind CSS. Full control over styling, accessible by default, no external CDN dependency. Design token system via CSS variables. |
| **Tailwind CSS** | Utility-first CSS framework. Works offline (compiled at build time). Consistent spacing via 8px grid. |
| **Radix UI** | Unstyled, accessible UI primitives (dialogs, dropdowns, tabs). Foundation for shadcn/ui. WAI-ARIA compliant. |
| **Lucide Icons** | Consistent icon set with uniform stroke weights. SVG-based, fully offline. |
| **Zustand** | Lightweight state management with minimal boilerplate. No context provider hell. Supports middleware (persist, devtools). |
| **Zod** | Runtime schema validation shared between frontend and backend. Type inference for TypeScript. Used for API input validation and form validation. |
| **Winston** | Structured logging with configurable levels and transports. JSON output for structured log analysis. Supports log rotation. |
| **PDFKit** | Pure JavaScript PDF generation. No external service dependency. Supports templates, tables, and images for health-check report export. |
| **Nx** | Monorepo management with dependency graph, task caching, and affected-based test execution. Shared libraries between frontend and backend. |
| **bcrypt** | Industry-standard password hashing with configurable salt rounds. |
| **jsonwebtoken** | JWT generation and verification for local session management. |
| **node-cron / @nestjs/schedule** | Scheduled task execution for auto-cancel, SLA checks, and notification frequency enforcement. |
| **Docker + docker-compose** | Reproducible deployment, environment parity, and single-command startup. |
| **Jest** | Unit and integration testing with mocking, coverage reporting, and snapshot testing. |
| **Playwright** | Cross-browser E2E testing with network interception, visual regression, and accessibility testing. |

### 2.4 Monorepo Structure (Nx Workspace)

```
repo/
├── .claude/
├── .docker/
│   ├── api.Dockerfile
│   ├── web.Dockerfile
│   └── postgres/
│       └── init.sql
├── docker-compose.yml
├── docker-compose.test.yml
├── run_tests.sh
├── nx.json
├── tsconfig.base.json
├── package.json
├── .env.example
├── .gitignore
├── README.md
│
├── libs/
│   └── shared/
│       ├── src/
│       │   ├── schemas/          # Zod schemas shared FE/BE
│       │   │   ├── auth.schema.ts
│       │   │   ├── enrollment.schema.ts
│       │   │   ├── order.schema.ts
│       │   │   ├── promotion.schema.ts
│       │   │   ├── payment.schema.ts
│       │   │   ├── health-check.schema.ts
│       │   │   ├── notification.schema.ts
│       │   │   ├── content.schema.ts
│       │   │   └── risk.schema.ts
│       │   ├── types/            # Shared TypeScript types/interfaces
│       │   │   ├── auth.types.ts
│       │   │   ├── enrollment.types.ts
│       │   │   ├── order.types.ts
│       │   │   ├── promotion.types.ts
│       │   │   ├── payment.types.ts
│       │   │   ├── health-check.types.ts
│       │   │   ├── notification.types.ts
│       │   │   ├── content.types.ts
│       │   │   └── risk.types.ts
│       │   ├── enums/            # Shared enums
│       │   │   ├── roles.enum.ts
│       │   │   ├── enrollment-status.enum.ts
│       │   │   ├── order-status.enum.ts
│       │   │   ├── payment-status.enum.ts
│       │   │   ├── report-status.enum.ts
│       │   │   ├── content-status.enum.ts
│       │   │   └── incident-status.enum.ts
│       │   └── constants/        # Shared constants
│       │       ├── rate-limits.ts
│       │       ├── sla.ts
│       │       └── notification-limits.ts
│       ├── tsconfig.json
│       └── project.json
│
├── apps/
│   ├── api/                      # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── core/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── entities/
│   │   │   │   │   │   ├── user.entity.ts
│   │   │   │   │   │   ├── enrollment.entity.ts
│   │   │   │   │   │   ├── order.entity.ts
│   │   │   │   │   │   ├── order-line.entity.ts
│   │   │   │   │   │   ├── service-item.entity.ts
│   │   │   │   │   │   ├── promotion-rule.entity.ts
│   │   │   │   │   │   ├── discount-audit.entity.ts
│   │   │   │   │   │   ├── payment.entity.ts
│   │   │   │   │   │   ├── health-check.entity.ts
│   │   │   │   │   │   ├── health-check-version.entity.ts
│   │   │   │   │   │   ├── health-check-result.entity.ts
│   │   │   │   │   │   ├── report-template.entity.ts
│   │   │   │   │   │   ├── content.entity.ts
│   │   │   │   │   │   ├── content-version.entity.ts
│   │   │   │   │   │   ├── notification.entity.ts
│   │   │   │   │   │   ├── notification-delivery.entity.ts
│   │   │   │   │   │   ├── seat-reservation.entity.ts
│   │   │   │   │   │   ├── risk-event.entity.ts
│   │   │   │   │   │   ├── incident-ticket.entity.ts
│   │   │   │   │   │   ├── device-fingerprint.entity.ts
│   │   │   │   │   │   ├── ip-rule.entity.ts
│   │   │   │   │   │   └── login-attempt.entity.ts
│   │   │   │   │   ├── value-objects/
│   │   │   │   │   │   ├── money.vo.ts
│   │   │   │   │   │   ├── email.vo.ts
│   │   │   │   │   │   ├── password.vo.ts
│   │   │   │   │   │   ├── date-range.vo.ts
│   │   │   │   │   │   ├── reference-range.vo.ts
│   │   │   │   │   │   └── checksum.vo.ts
│   │   │   │   │   ├── enums/
│   │   │   │   │   │   └── (mirrors shared enums for domain use)
│   │   │   │   │   └── errors/
│   │   │   │   │       ├── domain-error.ts
│   │   │   │   │       ├── enrollment-errors.ts
│   │   │   │   │       ├── order-errors.ts
│   │   │   │   │       ├── payment-errors.ts
│   │   │   │   │       ├── promotion-errors.ts
│   │   │   │   │       ├── health-check-errors.ts
│   │   │   │   │       └── risk-errors.ts
│   │   │   │   └── application/
│   │   │   │       ├── use-cases/
│   │   │   │       │   ├── auth/
│   │   │   │       │   │   ├── login.use-case.ts
│   │   │   │       │   │   ├── register.use-case.ts
│   │   │   │       │   │   └── refresh-token.use-case.ts
│   │   │   │       │   ├── enrollment/
│   │   │   │       │   │   ├── create-enrollment.use-case.ts
│   │   │   │       │   │   ├── update-enrollment.use-case.ts
│   │   │   │       │   │   ├── submit-enrollment.use-case.ts
│   │   │   │       │   │   └── get-enrollment.use-case.ts
│   │   │   │       │   ├── order/
│   │   │   │       │   │   ├── create-order.use-case.ts
│   │   │   │       │   │   ├── apply-promotions.use-case.ts
│   │   │   │       │   │   ├── cancel-order.use-case.ts
│   │   │   │       │   │   └── auto-cancel-orders.use-case.ts
│   │   │   │       │   ├── payment/
│   │   │   │       │   │   ├── record-payment.use-case.ts
│   │   │   │       │   │   ├── request-refund.use-case.ts
│   │   │   │       │   │   └── approve-refund.use-case.ts
│   │   │   │       │   ├── health-check/
│   │   │   │       │   │   ├── create-health-check.use-case.ts
│   │   │   │       │   │   ├── add-results.use-case.ts
│   │   │   │       │   │   ├── create-version.use-case.ts
│   │   │   │       │   │   ├── sign-version.use-case.ts
│   │   │   │       │   │   ├── export-pdf.use-case.ts
│   │   │   │       │   │   └── check-sla-compliance.use-case.ts
│   │   │   │       │   ├── notification/
│   │   │   │       │   │   ├── create-notification.use-case.ts
│   │   │   │       │   │   ├── send-notification.use-case.ts
│   │   │   │       │   │   └── mark-read.use-case.ts
│   │   │   │       │   ├── content/
│   │   │   │       │   │   ├── create-content.use-case.ts
│   │   │   │       │   │   ├── submit-for-review.use-case.ts
│   │   │   │       │   │   ├── publish-content.use-case.ts
│   │   │   │       │   │   ├── withdraw-content.use-case.ts
│   │   │   │       │   │   └── scan-sensitive-words.use-case.ts
│   │   │   │       │   └── risk/
│   │   │   │       │       ├── evaluate-risk.use-case.ts
│   │   │   │       │       ├── generate-captcha.use-case.ts
│   │   │   │       │       ├── create-incident.use-case.ts
│   │   │   │       │       └── check-rate-limit.use-case.ts
│   │   │   │       └── ports/
│   │   │   │           ├── user.repository.port.ts
│   │   │   │           ├── enrollment.repository.port.ts
│   │   │   │           ├── order.repository.port.ts
│   │   │   │           ├── promotion.repository.port.ts
│   │   │   │           ├── payment.repository.port.ts
│   │   │   │           ├── health-check.repository.port.ts
│   │   │   │           ├── notification.repository.port.ts
│   │   │   │           ├── content.repository.port.ts
│   │   │   │           ├── risk.repository.port.ts
│   │   │   │           ├── pdf-generator.port.ts
│   │   │   │           ├── encryption.port.ts
│   │   │   │           └── captcha-generator.port.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── persistence/
│   │   │   │   │   ├── typeorm-config.ts
│   │   │   │   │   ├── entities/         # TypeORM-decorated entities
│   │   │   │   │   ├── repositories/     # Implements port interfaces
│   │   │   │   │   └── migrations/       # Timestamped migration files
│   │   │   │   ├── security/
│   │   │   │   │   ├── bcrypt-hasher.ts
│   │   │   │   │   ├── aes-encryption.service.ts
│   │   │   │   │   ├── jwt-token.service.ts
│   │   │   │   │   └── captcha-generator.service.ts
│   │   │   │   ├── scheduling/
│   │   │   │   │   ├── auto-cancel.cron.ts
│   │   │   │   │   ├── seat-expiry.cron.ts
│   │   │   │   │   ├── sla-check.cron.ts
│   │   │   │   │   └── notification-frequency.cron.ts
│   │   │   │   └── pdf/
│   │   │   │       ├── pdfkit-generator.service.ts
│   │   │   │       └── checksum.service.ts
│   │   │   └── api/
│   │   │       ├── controllers/
│   │   │       │   ├── auth.controller.ts
│   │   │       │   ├── users.controller.ts
│   │   │       │   ├── enrollments.controller.ts
│   │   │       │   ├── orders.controller.ts
│   │   │       │   ├── promotions.controller.ts
│   │   │       │   ├── payments.controller.ts
│   │   │       │   ├── health-checks.controller.ts
│   │   │       │   ├── notifications.controller.ts
│   │   │       │   ├── content.controller.ts
│   │   │       │   └── risk.controller.ts
│   │   │       ├── dtos/
│   │   │       │   ├── auth.dto.ts
│   │   │       │   ├── enrollment.dto.ts
│   │   │       │   ├── order.dto.ts
│   │   │       │   ├── promotion.dto.ts
│   │   │       │   ├── payment.dto.ts
│   │   │       │   ├── health-check.dto.ts
│   │   │       │   ├── notification.dto.ts
│   │   │       │   ├── content.dto.ts
│   │   │       │   └── risk.dto.ts
│   │   │       ├── guards/
│   │   │       │   ├── jwt-auth.guard.ts
│   │   │       │   ├── roles.guard.ts
│   │   │       │   ├── rate-limit.guard.ts
│   │   │       │   └── ip-filter.guard.ts
│   │   │       ├── interceptors/
│   │   │       │   ├── logging.interceptor.ts
│   │   │       │   └── transform.interceptor.ts
│   │   │       ├── filters/
│   │   │       │   └── global-exception.filter.ts
│   │   │       └── decorators/
│   │   │           ├── roles.decorator.ts
│   │   │           └── current-user.decorator.ts
│   │   ├── test/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── e2e/
│   │   ├── tsconfig.json
│   │   └── project.json
│   │
│   └── web/                      # React frontend
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── index.css           # Tailwind + CSS variables
│       │   ├── components/
│       │   │   ├── ui/             # shadcn/ui components
│       │   │   │   ├── button.tsx
│       │   │   │   ├── input.tsx
│       │   │   │   ├── dialog.tsx
│       │   │   │   ├── card.tsx
│       │   │   │   ├── table.tsx
│       │   │   │   ├── badge.tsx
│       │   │   │   ├── tabs.tsx
│       │   │   │   ├── skeleton.tsx
│       │   │   │   ├── toast.tsx
│       │   │   │   ├── dropdown-menu.tsx
│       │   │   │   ├── select.tsx
│       │   │   │   ├── form.tsx
│       │   │   │   └── ...
│       │   │   ├── layout/
│       │   │   │   ├── app-shell.tsx
│       │   │   │   ├── sidebar.tsx
│       │   │   │   ├── header.tsx
│       │   │   │   └── footer.tsx
│       │   │   └── shared/
│       │   │       ├── loading-spinner.tsx
│       │   │       ├── error-boundary.tsx
│       │   │       ├── empty-state.tsx
│       │   │       ├── confirm-dialog.tsx
│       │   │       └── pdf-viewer.tsx
│       │   ├── features/
│       │   │   ├── auth/
│       │   │   │   ├── login-page.tsx
│       │   │   │   ├── login-form.tsx
│       │   │   │   ├── captcha-challenge.tsx
│       │   │   │   └── use-auth.ts
│       │   │   ├── enrollment/
│       │   │   │   ├── enrollment-list-page.tsx
│       │   │   │   ├── enrollment-form-page.tsx
│       │   │   │   ├── enrollment-detail-page.tsx
│       │   │   │   ├── service-selector.tsx
│       │   │   │   └── use-enrollment.ts
│       │   │   ├── orders/
│       │   │   │   ├── order-list-page.tsx
│       │   │   │   ├── checkout-page.tsx
│       │   │   │   ├── order-detail-page.tsx
│       │   │   │   ├── discount-breakdown.tsx
│       │   │   │   └── use-orders.ts
│       │   │   ├── payments/
│       │   │   │   ├── payment-form.tsx
│       │   │   │   ├── refund-dialog.tsx
│       │   │   │   ├── supervisor-override-dialog.tsx
│       │   │   │   └── use-payments.ts
│       │   │   ├── health-checks/
│       │   │   │   ├── health-check-list-page.tsx
│       │   │   │   ├── health-check-capture-page.tsx
│       │   │   │   ├── health-check-report-page.tsx
│       │   │   │   ├── result-entry-form.tsx
│       │   │   │   ├── reference-range-display.tsx
│       │   │   │   ├── version-history.tsx
│       │   │   │   ├── e-signature-dialog.tsx
│       │   │   │   └── use-health-checks.ts
│       │   │   ├── notifications/
│       │   │   │   ├── notification-inbox-page.tsx
│       │   │   │   ├── notification-bell.tsx
│       │   │   │   └── use-notifications.ts
│       │   │   ├── content/
│       │   │   │   ├── content-browse-page.tsx
│       │   │   │   ├── content-detail-page.tsx
│       │   │   │   ├── content-editor-page.tsx
│       │   │   │   ├── content-review-page.tsx
│       │   │   │   ├── sensitive-word-warning.tsx
│       │   │   │   └── use-content.ts
│       │   │   ├── risk/
│       │   │   │   ├── risk-dashboard-page.tsx
│       │   │   │   ├── incident-list-page.tsx
│       │   │   │   ├── incident-detail-page.tsx
│       │   │   │   └── use-risk.ts
│       │   │   └── admin/
│       │   │       ├── user-management-page.tsx
│       │   │       ├── promotion-management-page.tsx
│       │   │       └── ip-rules-page.tsx
│       │   ├── hooks/
│       │   │   ├── use-api.ts
│       │   │   ├── use-pagination.ts
│       │   │   ├── use-debounce.ts
│       │   │   └── use-polling.ts
│       │   ├── stores/
│       │   │   ├── auth.store.ts
│       │   │   ├── cart.store.ts
│       │   │   ├── notification.store.ts
│       │   │   └── ui.store.ts
│       │   ├── services/
│       │   │   ├── api-client.ts
│       │   │   ├── auth.service.ts
│       │   │   ├── enrollment.service.ts
│       │   │   ├── order.service.ts
│       │   │   ├── payment.service.ts
│       │   │   ├── health-check.service.ts
│       │   │   ├── notification.service.ts
│       │   │   ├── content.service.ts
│       │   │   └── risk.service.ts
│       │   ├── router/
│       │   │   └── index.tsx
│       │   └── lib/
│       │       ├── utils.ts
│       │       └── cn.ts
│       ├── components.json          # shadcn/ui config
│       ├── tailwind.config.ts
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── index.html
│       └── project.json
│
└── tools/
    ├── scripts/
    │   ├── seed.ts                  # Database seeder
    │   └── generate-migration.ts
    └── playwright/
        ├── playwright.config.ts
        └── tests/
            ├── auth.spec.ts
            ├── enrollment.spec.ts
            ├── orders.spec.ts
            ├── payments.spec.ts
            ├── health-checks.spec.ts
            ├── notifications.spec.ts
            ├── content.spec.ts
            └── risk.spec.ts
```

---

## 3. Major Modules (Vertical Slices)

### Module 0: Infrastructure & Docker Foundation

#### Responsibilities
- Initialize Nx monorepo workspace with `apps/api`, `apps/web`, and `libs/shared`
- Configure Docker services (PostgreSQL, API, Web)
- Set up TypeORM with auto-migration
- Configure Winston structured logging
- Implement global exception filter
- Create `run_tests.sh` canonical test entrypoint
- Set up Zod shared schema library
- Configure Tailwind CSS + shadcn/ui with design tokens
- Seed development data

#### Required Flows

**Happy Path: System Startup**
1. `docker compose up --build` starts all services
2. PostgreSQL initializes and accepts connections
3. API server runs TypeORM migrations automatically
4. Seed script populates initial data (admin user, sample services, report templates)
5. Web frontend is accessible at configured port
6. Health check endpoints return 200

**Happy Path: Test Execution**
1. `./run_tests.sh` spins up test containers
2. Unit tests run first (fast feedback)
3. Integration tests run with test database
4. E2E tests run with Playwright
5. Coverage report generated
6. Non-zero exit code on any failure

**Failure Path: Database Unavailable**
- API server retries connection with exponential backoff (max 5 attempts)
- Logs ERROR with connection details (no password)
- Health check endpoint returns 503

**Failure Path: Migration Failure**
- API server logs migration error and exits with non-zero code
- Docker restart policy does not auto-restart (fail-fast for migration issues)

#### Inputs and Outputs
- **Input**: `docker-compose.yml`, `.env` configuration
- **Output**: Running system with database, API, and frontend

#### Permissions and Boundaries
- No user-facing permissions at this stage
- Database credentials via environment variables only
- `.env` file never committed to repository

#### Tests Required

| Type | Test |
|------|------|
| Integration | PostgreSQL connection and migration execution |
| Integration | Seed script creates expected data |
| Integration | Health check endpoint returns 200 |
| Integration | Winston logs are structured JSON |
| Unit | Global exception filter maps domain errors to HTTP status codes |
| Unit | Zod schemas validate and reject correctly |

#### Module Completion Checklist
- [ ] `docker compose up --build` produces fully running system
- [ ] PostgreSQL is accessible and migrations run automatically
- [ ] Seed data creates admin user, sample services, and templates
- [ ] Winston structured logging outputs JSON to stdout
- [ ] Global exception filter catches all unhandled errors
- [ ] Health check endpoints respond with 200
- [ ] `run_tests.sh` executes and returns correct exit codes
- [ ] `.env.example` documents all required environment variables
- [ ] README documents setup and startup instructions
- [ ] No `console.log` statements anywhere in codebase
- [ ] Shared Zod schemas compile and export correctly

---

### Module 1: Authentication & Authorization

#### Responsibilities
- Username/password registration and login
- JWT token generation and validation
- Role-based access control (Patient, Staff, Admin, Reviewer)
- Password requirements enforcement (12+ characters)
- Account lockout after 5 failed attempts for 15 minutes
- Login attempt tracking
- `can_approve_refunds` supervisor flag on Staff role
- Guards: JwtAuthGuard, RolesGuard
- Frontend: login page, auth state management, route protection

#### Required Flows

**Happy Path: Login**
1. User enters username and password
2. Backend validates credentials against bcrypt hash
3. Backend checks account is not locked
4. Backend generates JWT (access token + refresh token)
5. Frontend stores tokens in memory (Zustand store)
6. Frontend redirects to role-appropriate dashboard
7. Login attempt recorded with success status

**Happy Path: Registration (Staff/Admin creates user)**
1. Admin/Staff enters new user details
2. Backend validates password meets 12+ character requirement
3. Backend validates username uniqueness
4. Backend hashes password with bcrypt (12 rounds)
5. User created with specified role
6. Confirmation response returned

**Happy Path: Token Refresh**
1. Access token nears expiration
2. Frontend sends refresh token to refresh endpoint
3. Backend validates refresh token
4. Backend issues new access token
5. Frontend stores new token

**Failure Path: Invalid Credentials**
1. User enters wrong password
2. Backend increments failed attempt counter
3. Backend records login attempt with failure status
4. Backend returns 401 with generic "Invalid credentials" message
5. Frontend displays error

**Failure Path: Account Locked**
1. User has 5 failed attempts within tracking window
2. Backend locks account for 15 minutes
3. Backend returns 423 with "Account locked. Try again in X minutes."
4. Frontend displays lockout message with countdown
5. After 15 minutes, counter resets

**Failure Path: Insufficient Role**
1. User accesses endpoint requiring higher role
2. RolesGuard intercepts request
3. Backend returns 403 Forbidden
4. Frontend displays unauthorized message

**Failure Path: Expired Token**
1. JWT access token has expired
2. JwtAuthGuard intercepts request
3. Backend returns 401
4. Frontend attempts token refresh
5. If refresh fails, redirect to login

#### Inputs and Outputs
- **Login Input**: `{ username: string, password: string }`
- **Login Output**: `{ accessToken: string, refreshToken: string, user: { id, username, role, canApproveRefunds } }`
- **Register Input**: `{ username: string, password: string, role: Role, canApproveRefunds?: boolean }`
- **Register Output**: `{ id: string, username: string, role: Role }`

#### Important Failure Behavior
- Never reveal whether username exists (generic "Invalid credentials" for both wrong username and wrong password)
- Never log passwords or tokens at any log level
- Lock duration is exactly 15 minutes from the 5th failed attempt
- Failed attempt counter resets on successful login
- JWT tokens have configurable expiry (default: access 15min, refresh 7d)

#### Permissions and Boundaries
- Registration: Admin only (Staff can register Patients)
- Login: Public (no auth required)
- Token refresh: Requires valid refresh token
- User listing: Admin only
- Users can only view their own profile (object-level auth)
- Admin can view all users

#### State Transitions

```
Account States:
  ACTIVE → LOCKED (after 5 failed attempts)
  LOCKED → ACTIVE (after 15 minutes or admin unlock)
  ACTIVE → DISABLED (admin action)
  DISABLED → ACTIVE (admin action)
```

#### Tests Required

| Type | Test |
|------|------|
| Unit | Password validation (12+ chars, various edge cases) |
| Unit | JWT token generation and verification |
| Unit | Failed attempt counter logic |
| Unit | Lockout duration calculation |
| Unit | RolesGuard allows/denies correctly per role |
| Integration | Login flow end-to-end with database |
| Integration | Account lockout after 5 failures |
| Integration | Lockout expires after 15 minutes |
| Integration | Token refresh with valid/invalid tokens |
| Integration | Registration with duplicate username rejected |
| E2E | Login page renders and accepts input |
| E2E | Successful login redirects to dashboard |
| E2E | Failed login shows error message |
| E2E | Locked account shows lockout message |
| E2E | Unauthorized route access redirects to login |
| E2E | Role-based navigation (Patient sees patient menu, Staff sees staff menu) |

#### Module Completion Checklist
- [ ] Login with valid credentials returns JWT tokens
- [ ] Login with invalid credentials returns 401
- [ ] Account locks after 5 failed attempts
- [ ] Account unlocks after 15 minutes
- [ ] Password must be 12+ characters
- [ ] JWT tokens expire correctly
- [ ] Token refresh works
- [ ] RolesGuard enforces role requirements
- [ ] Object-level auth prevents cross-user data access
- [ ] No passwords or tokens in logs
- [ ] Frontend login page with form validation
- [ ] Frontend auth store persists session in memory
- [ ] Frontend route guards redirect unauthenticated users
- [ ] Docker verification passes
- [ ] All tests pass via run_tests.sh

---

### Module 2: Enrollment & Ordering

#### Responsibilities
- Enrollment application CRUD with draft saving
- Add-on service selection (e.g., "Annual Lab Panel", "Nutrition Session")
- Enrollment submission workflow
- 1:N Enrollment-to-Orders relationship
- Order creation from enrollment with line items
- Seat quota management with 60-minute soft reservations
- Auto-cancel of unpaid orders after 30 minutes (cron every 5 minutes)
- Order line items with pricing
- Frontend: enrollment form, service selector, order list, checkout

#### Required Flows

**Happy Path: Create and Save Enrollment Draft**
1. Patient navigates to enrollment form
2. Patient fills in personal details
3. Patient selects add-on services
4. Frontend validates input via Zod schemas
5. Patient clicks "Save Draft"
6. Backend persists enrollment with status DRAFT
7. Seat reservations created for selected services (60-minute expiry)
8. Frontend shows success toast

**Happy Path: Submit Enrollment**
1. Patient opens a DRAFT enrollment
2. Patient reviews details and clicks "Submit"
3. Backend validates enrollment is complete
4. Backend creates Order with line items from selected services
5. Backend transitions enrollment to SUBMITTED
6. Backend refreshes seat reservations (new 60-minute window)
7. Order status is PENDING_PAYMENT
8. Frontend redirects to checkout page

**Happy Path: Seat Reservation**
1. Patient selects a service with limited seats
2. Backend checks quota availability
3. Backend creates soft reservation (60-minute TTL)
4. Reservation holds seat for this enrollment
5. On order payment, reservation converts to confirmed
6. On expiry, reservation releases and seat becomes available

**Happy Path: Auto-Cancel Unpaid Orders**
1. Cron job runs every 5 minutes
2. Finds orders in PENDING_PAYMENT status older than 30 minutes
3. Transitions orders to CANCELED
4. Releases associated seat reservations
5. Enrollment remains in SUBMITTED (can create new order)
6. Logs each cancellation at INFO level

**Failure Path: Seat Quota Exhausted**
1. Patient selects service with no available seats
2. Backend returns 409 Conflict with "No seats available for [service]"
3. Frontend displays error and disables service selection

**Failure Path: Stale Seat Reservation**
1. Patient's reservation expires while filling form
2. On submit, backend checks reservation validity
3. If expired, backend attempts to re-reserve
4. If seats now taken, returns 409 Conflict
5. Frontend shows "Seats no longer available, please review your selections"

**Failure Path: Enrollment Not Complete**
1. Patient submits enrollment with missing required fields
2. Backend validates and returns 422 with field-level errors
3. Frontend highlights invalid fields

**Failure Path: Duplicate Submission**
1. Patient submits enrollment already in SUBMITTED state
2. Backend returns 409 Conflict with "Enrollment already submitted"
3. Frontend shows existing order link

#### Inputs and Outputs
- **Create Enrollment Input**: `{ patientId, personalDetails: {...}, serviceIds: string[] }`
- **Create Enrollment Output**: `{ enrollmentId, status: 'DRAFT', createdAt }`
- **Submit Enrollment Output**: `{ enrollmentId, status: 'SUBMITTED', orderId, orderTotal }`
- **Order Output**: `{ orderId, enrollmentId, lines: [{ serviceId, name, unitPrice, quantity }], subtotal, status }`

#### Important Failure Behavior
- Enrollment can only be submitted once (idempotency guard)
- Seat reservations are advisory (soft lock), not guaranteed until payment
- Auto-cancel cron must be idempotent (re-running on already-canceled orders is no-op)
- Orders reference the enrollment; deleting enrollment does not delete order history
- Patients can only see their own enrollments (object-level auth)

#### Permissions and Boundaries
- Create/Edit/Submit enrollment: Patient (own) or Staff (on behalf of patient)
- View enrollment: Patient (own), Staff (all), Admin (all)
- View orders: Patient (own), Staff (all), Admin (all)
- Cancel order: Staff, Admin
- Auto-cancel: System (cron job, no user context)

#### State Transitions

```
Enrollment:
  DRAFT → SUBMITTED (on submit, creates order)
  SUBMITTED → ACTIVE (when associated order is PAID)
  DRAFT → DRAFT (save updates)
  SUBMITTED → SUBMITTED (if order canceled, can resubmit)

Order:
  PENDING_PAYMENT → PAID (payment recorded)
  PENDING_PAYMENT → CANCELED (auto-cancel after 30min or manual cancel)
  PAID → REFUND_REQUESTED (refund initiated)
  REFUND_REQUESTED → REFUNDED (supervisor approved)
  REFUND_REQUESTED → PAID (refund denied)

Seat Reservation:
  HELD → CONFIRMED (order paid)
  HELD → EXPIRED (60-minute TTL elapsed)
  HELD → RELEASED (order canceled)
```

#### Tests Required

| Type | Test |
|------|------|
| Unit | Enrollment entity state transitions (valid and invalid) |
| Unit | Order total calculation from line items |
| Unit | Seat reservation TTL logic |
| Unit | Auto-cancel eligibility detection (30-minute threshold) |
| Integration | Create enrollment persists to database |
| Integration | Submit enrollment creates order with correct line items |
| Integration | Seat reservation creation and expiry |
| Integration | Auto-cancel cron cancels old orders and releases seats |
| Integration | Concurrent seat reservation handles race condition |
| E2E | Patient creates draft enrollment with services |
| E2E | Patient submits enrollment and sees checkout |
| E2E | Order list shows correct status |
| E2E | Staff views all enrollments |
| E2E | Patient cannot see other patients' enrollments |

#### Module Completion Checklist
- [ ] Enrollment CRUD with draft saving works
- [ ] Service selection with seat quota checking
- [ ] Enrollment submission creates order with line items
- [ ] Seat reservations created and tracked
- [ ] Auto-cancel cron runs every 5 minutes
- [ ] Unpaid orders auto-canceled after 30 minutes
- [ ] Seat reservations released on cancel/expiry
- [ ] State transitions enforced (no invalid transitions)
- [ ] Object-level authorization (patients see only own data)
- [ ] Frontend enrollment form with Zod validation
- [ ] Frontend checkout page shows order summary
- [ ] All error paths return appropriate HTTP codes
- [ ] Docker verification passes
- [ ] All tests pass via run_tests.sh

---

### Module 3: Pricing & Promotion Engine

#### Responsibilities
- Promotion rule CRUD (Admin only)
- Rule attributes: priority, time window (effective_start, effective_end), mutual exclusion groups, discount type (percentage, fixed, BOGO, tiered)
- Deterministic "best offer" computation per order
- Line-level discount reasoning (e.g., "10% off orders over $200", "BOGO on select screenings", "50% off second item")
- Mutual exclusion enforcement (rules in same exclusion group cannot stack)
- Immutable discount audit trail per order
- Frontend: transparent "best offer applied" breakdown at checkout, promotion management for admins

#### Required Flows

**Happy Path: Apply Best Promotion**
1. Order is created with line items
2. Promotion engine loads all active rules (within time window)
3. Engine sorts rules by priority
4. Engine evaluates each rule against order lines
5. Engine applies mutual exclusion (if two rules are in same exclusion group, pick the one with greater discount)
6. Engine computes final best discount per line and per order
7. Engine persists immutable discount audit trail entries
8. Checkout UI shows line-level discount reasoning

**Happy Path: Percentage Discount**
1. Rule: "10% off orders over $200.00"
2. Order subtotal is $250.00
3. Engine applies 10% = $25.00 discount
4. Audit trail: `{ ruleId, type: 'PERCENTAGE', reason: '10% off orders over $200.00', originalAmount: 250.00, discountAmount: 25.00, finalAmount: 225.00 }`

**Happy Path: BOGO (Buy One Get One)**
1. Rule: "BOGO on select screenings"
2. Order has 2x "Blood Panel Screening" at $50.00 each
3. Engine applies free second item = $50.00 discount
4. Audit trail per line: `{ lineId, ruleId, type: 'BOGO', reason: 'Buy one get one free on Blood Panel Screening', discountAmount: 50.00 }`

**Happy Path: 50% Off Second Item**
1. Rule: "50% off second item"
2. Order has 2 different services
3. Engine applies 50% to the cheaper item
4. Audit trail per line with reasoning

**Happy Path: Mutual Exclusion**
1. Rule A (priority 1): "10% off over $200" — exclusion group "ORDER_LEVEL"
2. Rule B (priority 2): "15% off over $300" — exclusion group "ORDER_LEVEL"
3. Order total is $350
4. Rule B gives $52.50 discount; Rule A gives $35.00 discount
5. Engine picks Rule B (greater discount within same exclusion group)
6. Rule A is excluded; audit trail notes "excluded by mutual exclusion with Rule B"

**Happy Path: Admin Creates Promotion Rule**
1. Admin navigates to promotion management
2. Admin fills in rule details (name, type, conditions, priority, time window, exclusion group)
3. Backend validates rule
4. Rule saved to database
5. Rule takes effect at effective_start timestamp

**Failure Path: No Active Promotions**
1. Order is created but no rules match (all expired or conditions unmet)
2. Order total remains at subtotal
3. Discount audit trail records "No applicable promotions"
4. Checkout UI shows "No promotions applied"

**Failure Path: Overlapping Priorities**
1. Two rules have same priority and same exclusion group
2. Engine uses deterministic tiebreaker: rule with lower ID wins
3. Audit trail documents tiebreaker reasoning

**Failure Path: Promotion Rule Validation Error**
1. Admin creates rule with effective_end before effective_start
2. Backend returns 422 with "End date must be after start date"
3. Frontend highlights invalid field

#### Inputs and Outputs
- **Evaluate Promotions Input**: `{ orderId: string }` (engine loads order and all active rules)
- **Evaluate Promotions Output**: `{ orderId, originalTotal, finalTotal, discounts: [{ lineId?, ruleId, ruleName, type, reason, amount }], exclusions: [{ ruleId, reason }] }`
- **Create Rule Input**: `{ name, type, conditions: {...}, priority, effectiveStart, effectiveEnd, exclusionGroup?, active }`
- **Create Rule Output**: `{ ruleId, name, type, priority, effectiveStart, effectiveEnd }`

#### Important Failure Behavior
- Promotion evaluation is deterministic: same order + same active rules = same result every time
- Discount audit trail is immutable (INSERT only, no UPDATE or DELETE)
- Rules can be deactivated but not deleted (soft delete)
- Expired rules are never evaluated (filtered by current timestamp)
- BOGO applies to cheapest qualifying item when quantities differ

#### Permissions and Boundaries
- Create/Edit/Deactivate promotion rules: Admin only
- View active promotions: All authenticated users
- Evaluate promotions: System (triggered on order creation/update)
- View discount audit trail: Staff, Admin

#### Tests Required

| Type | Test |
|------|------|
| Unit | Percentage discount calculation (various thresholds) |
| Unit | BOGO discount logic (2 items, 3 items, mixed items) |
| Unit | 50% off second item (same price, different prices) |
| Unit | Mutual exclusion enforcement (same group, different groups) |
| Unit | Priority ordering and tiebreaker |
| Unit | Time window filtering (active, expired, future) |
| Unit | Deterministic evaluation (same input = same output) |
| Unit | Edge cases: zero amount, single item BOGO, negative after discount |
| Integration | Promotion evaluation persists audit trail |
| Integration | Audit trail is immutable (UPDATE/DELETE fail) |
| Integration | Rule CRUD with validation |
| E2E | Checkout page shows discount breakdown |
| E2E | Admin creates promotion rule |
| E2E | Admin deactivates promotion rule |
| E2E | Multiple promotions evaluated correctly at checkout |

#### Module Completion Checklist
- [ ] Promotion rule CRUD for admins
- [ ] Percentage, BOGO, fixed, and tiered discount types implemented
- [ ] Best-offer evaluation is deterministic
- [ ] Mutual exclusion enforced within exclusion groups
- [ ] Line-level discount reasoning displayed at checkout
- [ ] Immutable discount audit trail persisted per order
- [ ] Time window filtering works correctly
- [ ] Priority ordering with tiebreaker
- [ ] Frontend checkout shows transparent breakdown
- [ ] Frontend admin promotion management page
- [ ] Docker verification passes
- [ ] All tests pass via run_tests.sh

---

### Module 4: Payments & Refunds

#### Responsibilities
- Recorded payment workflow (offline — no payment gateway)
- Payment method registration (cash, check, manual card terminal)
- Reference number capture
- Order status transitions: PENDING_PAYMENT → PAID, PAID → REFUND_REQUESTED → REFUNDED
- Refund requires reason code and supervisor confirmation (`can_approve_refunds` flag)
- Enrollment activation on payment (SUBMITTED → ACTIVE)
- Seat reservation confirmation on payment
- Frontend: payment form, refund dialog, supervisor override modal

#### Required Flows

**Happy Path: Record Payment**
1. Staff opens order in PENDING_PAYMENT status
2. Staff selects payment method (cash/check/card terminal)
3. Staff enters reference number
4. Backend validates order is in PENDING_PAYMENT status
5. Backend creates Payment record
6. Backend transitions order to PAID
7. Backend transitions enrollment to ACTIVE
8. Backend confirms seat reservations
9. Frontend shows payment confirmation with receipt details

**Happy Path: Request Refund**
1. Staff opens order in PAID status
2. Staff clicks "Request Refund"
3. Staff selects reason code from predefined list
4. Staff enters optional notes
5. Backend creates refund request
6. Backend transitions order to REFUND_REQUESTED
7. Notification sent to supervisors

**Happy Path: Approve Refund (Supervisor Override)**
1. Supervisor (Staff with `can_approve_refunds = true`) views refund request
2. Supervisor clicks "Approve Refund"
3. Supervisor Override Modal appears: requires re-entry of supervisor username/password
4. Backend validates supervisor credentials
5. Backend validates supervisor has `can_approve_refunds` flag
6. Backend transitions order to REFUNDED
7. Backend creates refund audit record
8. Seat reservations released
9. Enrollment remains ACTIVE (historical record)

**Happy Path: Deny Refund**
1. Supervisor views refund request
2. Supervisor clicks "Deny Refund" with reason
3. Backend transitions order back to PAID
4. Refund request record updated with denial reason
5. Notification sent to requesting staff

**Failure Path: Payment on Non-Pending Order**
1. Staff attempts payment on already-PAID or CANCELED order
2. Backend returns 409 Conflict with "Order is not in PENDING_PAYMENT status"
3. Frontend shows error

**Failure Path: Non-Supervisor Attempts Refund Approval**
1. Staff without `can_approve_refunds` attempts to approve refund
2. Backend returns 403 Forbidden with "Supervisor approval required"
3. Frontend shows unauthorized message

**Failure Path: Invalid Supervisor Credentials in Override**
1. Supervisor enters wrong password in override modal
2. Backend returns 401 with "Invalid supervisor credentials"
3. Modal shows error, does not close
4. After 5 failed attempts, modal locks for 15 minutes (same lockout rules)

**Failure Path: Duplicate Payment**
1. Staff submits payment twice (double-click, network retry)
2. Backend checks order is still PENDING_PAYMENT
3. Second request finds order already PAID
4. Returns 409 Conflict
5. Frontend shows "Payment already recorded"

#### Inputs and Outputs
- **Record Payment Input**: `{ orderId, method: 'CASH'|'CHECK'|'CARD_TERMINAL', referenceNumber: string }`
- **Record Payment Output**: `{ paymentId, orderId, method, referenceNumber, amount, paidAt }`
- **Request Refund Input**: `{ orderId, reasonCode: string, notes?: string }`
- **Approve Refund Input**: `{ refundRequestId, supervisorUsername: string, supervisorPassword: string }`

#### Important Failure Behavior
- Payment recording is idempotent at the order level (second attempt on same PAID order returns 409, not a duplicate payment)
- Refund reason codes are from a predefined list (not free text)
- Supervisor override requires full credential re-entry (not just a confirmation click)
- All payment actions are logged with actor, timestamp, and method
- PII (reference numbers for card terminals) is encrypted at rest

#### Permissions and Boundaries
- Record payment: Staff, Admin
- Request refund: Staff, Admin
- Approve/Deny refund: Staff with `can_approve_refunds = true`, Admin
- View payment history: Staff (for their orders), Admin (all)
- Patient can view payment status of their own orders (read-only)

#### Tests Required

| Type | Test |
|------|------|
| Unit | Payment state transitions (valid and invalid) |
| Unit | Refund requires reason code |
| Unit | Supervisor override validation |
| Unit | Idempotency check for duplicate payments |
| Integration | Record payment updates order, enrollment, and reservations |
| Integration | Refund request creates notification for supervisors |
| Integration | Supervisor override with credential validation |
| Integration | Refund denial transitions order back to PAID |
| Integration | Payment reference number encrypted at rest |
| E2E | Staff records cash payment |
| E2E | Staff requests refund with reason code |
| E2E | Supervisor approves refund via override modal |
| E2E | Non-supervisor cannot approve refund (403) |
| E2E | Duplicate payment attempt shows error |

#### Module Completion Checklist
- [ ] Record payment with method and reference number
- [ ] Order transitions to PAID on payment
- [ ] Enrollment transitions to ACTIVE on payment
- [ ] Seat reservations confirmed on payment
- [ ] Refund request with reason code
- [ ] Supervisor override modal with credential re-entry
- [ ] Refund approval transitions order to REFUNDED
- [ ] Refund denial transitions order back to PAID
- [ ] Idempotent payment recording
- [ ] Payment reference numbers encrypted at rest
- [ ] All payment actions logged
- [ ] Frontend payment form with method selector
- [ ] Frontend refund dialog with reason codes
- [ ] Frontend supervisor override modal
- [ ] Docker verification passes
- [ ] All tests pass via run_tests.sh

---

### Module 5: Health-Check Reports

#### Responsibilities
- Structured health-check result capture during visits
- Reference ranges and abnormal flags per measurement
- Historical comparison by date
- Report assembly from templates
- Version management (edits create new version)
- Reviewer e-signature (username/password re-entry) within 24-hour SLA
- Signed versions locked from modification
- "Reviewed" status indicator on patient-facing view
- One-click PDF export with checksum validation
- SLA tracking: flag unsigned reports after 24 hours as Compliance Breaches
- Frontend: capture form, report view, version history, e-signature dialog, PDF export

#### Required Flows

**Happy Path: Capture Health-Check Results**
1. Staff opens health-check capture form for a patient
2. Staff selects report template (e.g., "Annual Wellness Check")
3. Template populates expected measurements (weight, blood pressure, glucose, etc.)
4. Staff enters values for each measurement
5. System displays reference ranges alongside entered values
6. System flags abnormal values (outside reference range) with visual indicator
7. Backend saves HealthCheck with initial HealthCheckVersion (version 1)
8. Status: DRAFT

**Happy Path: Compare with Prior Results**
1. Staff views current health-check results
2. UI shows "Compare" option with date picker
3. Staff selects prior health-check date
4. UI displays side-by-side comparison with trend indicators (up/down/stable)

**Happy Path: Edit Results (Creates New Version)**
1. Staff edits a measurement value on a DRAFT or REVIEWED version
2. Backend creates new HealthCheckVersion (version N+1)
3. Previous version is preserved (immutable once signed)
4. New version status: DRAFT
5. 24-hour SLA clock resets for new version

**Happy Path: Reviewer E-Signature**
1. Reviewer opens health-check report
2. Reviewer reviews all measurements, flags, and notes
3. Reviewer clicks "Sign and Approve"
4. E-Signature Dialog appears: requires re-entry of Reviewer username/password
5. Backend validates Reviewer credentials
6. Backend validates Reviewer has Reviewer role
7. Backend records e-signature on current version
8. Version status transitions to REVIEWED
9. Version is locked from modification
10. Patient-facing view shows "Reviewed" badge

**Happy Path: PDF Export**
1. User clicks "Export PDF" on a health-check report
2. Backend generates PDF using PDFKit from report template
3. Backend computes SHA-256 checksum of generated PDF
4. Backend stores PDF locally with checksum
5. Backend returns PDF file for download
6. Frontend triggers browser download

**Happy Path: SLA Compliance Check**
1. Cron job runs periodically (every hour)
2. Finds HealthCheckVersions in DRAFT status older than 24 hours
3. Flags them as Compliance Breaches
4. Creates notification for Admin and relevant Reviewer
5. Logs at WARN level

**Failure Path: Invalid Reviewer Credentials**
1. Reviewer enters wrong password in e-signature dialog
2. Backend returns 401
3. Dialog shows error, does not close
4. Failed attempts tracked (same lockout rules as login)

**Failure Path: Attempt to Edit Signed Version**
1. Staff attempts to edit a REVIEWED (signed) version
2. Backend returns 403 with "Signed versions cannot be modified"
3. Frontend disables edit controls on signed versions

**Failure Path: SLA Breach**
1. Version remains unsigned for 24+ hours
2. SLA check flags as breach
3. Admin receives compliance notification
4. Report shows "SLA BREACHED" indicator

**Failure Path: PDF Checksum Mismatch**
1. PDF file is read for download
2. System recomputes checksum
3. Checksum does not match stored value
4. Returns 500 with "PDF integrity check failed"
5. Logs ERROR with details

#### Inputs and Outputs
- **Create Health-Check Input**: `{ patientId, templateId, results: [{ measurementCode, value, unit }] }`
- **Create Health-Check Output**: `{ healthCheckId, versionId, version: 1, status: 'DRAFT', results: [...with referenceRanges and flags] }`
- **Sign Version Input**: `{ versionId, reviewerUsername, reviewerPassword }`
- **Sign Version Output**: `{ versionId, status: 'REVIEWED', signedBy, signedAt }`
- **Export PDF Output**: Binary PDF file with `Content-Disposition: attachment`

#### Important Failure Behavior
- Signed versions are permanently immutable (no UPDATE on signed HealthCheckVersion rows)
- E-signature requires full credential re-entry (not session-based)
- PDF checksums are SHA-256, stored alongside the file
- Reference ranges are per-measurement and may vary by patient demographics
- Sensitive medical data (results, notes) encrypted at rest

#### Permissions and Boundaries
- Capture health-check results: Staff
- Edit health-check (create new version): Staff
- Sign health-check version: Reviewer only
- View health-check reports: Patient (own, reviewed only), Staff (all), Reviewer (all), Admin (all)
- Export PDF: Patient (own, reviewed only), Staff, Reviewer, Admin
- SLA breach notifications: Admin, Reviewer

#### Tests Required

| Type | Test |
|------|------|
| Unit | Reference range comparison and abnormal flag logic |
| Unit | Version creation preserves previous version |
| Unit | Signed version immutability enforcement |
| Unit | SLA breach detection (24-hour threshold) |
| Unit | PDF checksum generation and validation |
| Integration | Health-check creation with template |
| Integration | Version history retrieval |
| Integration | E-signature with credential validation |
| Integration | Signed version cannot be edited (DB constraint) |
| Integration | PDF generation with correct content |
| Integration | SLA cron detects overdue versions |
| E2E | Staff captures health-check results |
| E2E | Abnormal flags display correctly |
| E2E | Historical comparison side-by-side |
| E2E | Reviewer signs report via e-signature dialog |
| E2E | Patient sees "Reviewed" badge |
| E2E | PDF export downloads file |
| E2E | Staff cannot edit signed version |

#### Module Completion Checklist
- [ ] Structured health-check capture with templates
- [ ] Reference ranges and abnormal flags
- [ ] Historical comparison by date
- [ ] Version management (edits create new version)
- [ ] Reviewer e-signature with credential re-entry
- [ ] Signed versions locked from modification
- [ ] "Reviewed" status on patient-facing view
- [ ] PDF export with checksum validation
- [ ] SLA tracking with 24-hour breach detection
- [ ] Sensitive medical data encrypted at rest
- [ ] Frontend capture form with real-time validation
- [ ] Frontend version history timeline
- [ ] Frontend e-signature dialog
- [ ] Frontend PDF download
- [ ] Docker verification passes
- [ ] All tests pass via run_tests.sh

---

### Module 6: In-App Notifications

#### Responsibilities
- Notification creation for various events (due dates, overdue balances, hold pickups, SLA breaches, refund requests)
- Notification inbox per user role
- Highlighting: upcoming due dates, overdue balances, "hold available" pickups
- Frequency limits: max 3 reminders per item per 24 hours
- Read/unread status tracking
- Notification bell with unread count in header
- Frontend: notification inbox page, notification bell component

#### Required Flows

**Happy Path: Create and Deliver Notification**
1. System event triggers notification (e.g., order nearing due date)
2. Backend checks frequency limit for this item+recipient
3. If under limit (< 3 in last 24 hours), creates notification
4. Notification stored with type, recipient, item reference, message, priority
5. Delivery record created with timestamp
6. Frontend polls for new notifications (or uses SSE/polling)
7. Notification bell updates unread count

**Happy Path: View Notification Inbox**
1. User clicks notification bell
2. Frontend loads notification inbox page
3. Notifications displayed grouped by type/priority
4. Unread notifications highlighted
5. Upcoming due dates, overdue balances, and hold pickups have distinct visual indicators
6. User clicks notification to navigate to relevant item

**Happy Path: Mark as Read**
1. User clicks on notification
2. Backend marks notification as read
3. Unread count decrements
4. Notification visual changes to read state

**Happy Path: Frequency Limit Enforcement**
1. System attempts to send 4th reminder for same item to same user within 24 hours
2. Backend checks delivery history
3. Finds 3 deliveries in last 24 hours for this item+user
4. Suppresses notification
5. Logs at INFO level: "Notification suppressed (frequency limit reached)"

**Failure Path: Notification for Nonexistent User**
1. System attempts to create notification for deleted/disabled user
2. Backend skips notification creation
3. Logs WARN: "Notification target user not found or disabled"

**Failure Path: Invalid Notification Type**
1. Malformed notification request with unknown type
2. Backend returns 422 with "Invalid notification type"

#### Inputs and Outputs
- **Create Notification Input**: `{ recipientId, type: NotificationType, itemType, itemId, message, priority }`
- **Notification Inbox Output**: `{ notifications: [{ id, type, message, priority, read, createdAt, itemType, itemId }], unreadCount }`
- **Mark Read Input**: `{ notificationId }`

#### Important Failure Behavior
- Frequency limit is per (item, recipient) pair, not global
- Suppressed notifications are logged but not stored
- Notifications are never deleted, only marked as read
- Polling interval: 30 seconds for inbox, 60 seconds for bell count

#### Permissions and Boundaries
- Patients see only their own notifications
- Staff see notifications relevant to their role (refund requests, SLA breaches for their patients)
- Admins see all system notifications
- Reviewers see SLA-related notifications
- No user can mark another user's notifications as read

#### Notification Types

| Type | Description | Recipients |
|------|-------------|------------|
| `DUE_DATE_UPCOMING` | Appointment or payment due within 48 hours | Patient, Staff |
| `OVERDUE_BALANCE` | Unpaid order past due date | Patient, Staff, Admin |
| `HOLD_AVAILABLE` | Service/item ready for pickup | Patient, Staff |
| `REFUND_REQUESTED` | Refund needs supervisor review | Staff (supervisors) |
| `REFUND_PROCESSED` | Refund approved or denied | Staff (requester) |
| `SLA_BREACH` | Health-check unsigned past 24 hours | Reviewer, Admin |
| `COMPLIANCE_ALERT` | Risk event or anomaly detected | Admin |
| `CONTENT_REVIEW` | Content submitted for review | Admin |
| `ORDER_AUTO_CANCELED` | Unpaid order auto-canceled | Patient, Staff |

#### Tests Required

| Type | Test |
|------|------|
| Unit | Frequency limit logic (0, 1, 2, 3, 4 deliveries) |
| Unit | Notification priority sorting |
| Unit | 24-hour window calculation |
| Integration | Notification creation and retrieval |
| Integration | Mark as read updates status |
| Integration | Frequency limit prevents 4th notification |
| Integration | Notification delivery record creation |
| E2E | Notification bell shows unread count |
| E2E | Inbox page lists notifications by type |
| E2E | Click notification navigates to item |
| E2E | Mark as read updates UI |

#### Module Completion Checklist
- [ ] Notification creation for all event types
- [ ] Per-user notification inbox
- [ ] Read/unread status tracking
- [ ] Frequency limit: max 3 per item per 24 hours
- [ ] Notification bell with unread count
- [ ] Priority-based highlighting
- [ ] Distinct indicators for due dates, overdue, and hold pickups
- [ ] Navigation from notification to relevant item
- [ ] Object-level auth (users see only their notifications)
- [ ] Frontend notification inbox page
- [ ] Frontend notification bell component
- [ ] Docker verification passes
- [ ] All tests pass via run_tests.sh

---

### Module 7: Cultural Content Publishing

#### Responsibilities
- Content types: articles, image galleries, audio, video
- Draft–review–publish workflow
- Content versioning
- Sensitive-word filter (regex-based) with soft-warning modal
- Admin publish/withdraw capabilities
- Patient-facing content browsing in clean, accessible interface
- Media file storage (local filesystem)
- Frontend: content browser, content detail, content editor, review page, sensitive word warning

#### Required Flows

**Happy Path: Create and Publish Content**
1. Admin creates new content (article, gallery, audio, or video)
2. Admin enters title, body, media attachments
3. Admin clicks "Submit for Review"
4. Backend runs sensitive-word filter against content text
5. If sensitive words found: returns warnings (list of matches with positions)
6. Frontend shows Sensitive Word Warning modal with matched words highlighted
7. Admin can acknowledge warnings and proceed, or go back to edit
8. Content status transitions to PENDING_REVIEW
9. Another Admin (or same admin, depending on policy) reviews content
10. Reviewer clicks "Publish"
11. Backend transitions content to PUBLISHED with effective timestamp
12. Content appears in patient-facing browse page

**Happy Path: Content Versioning**
1. Admin edits published content
2. Backend creates new ContentVersion
3. Previous version preserved
4. New version enters DRAFT status
5. Must go through review-publish cycle again

**Happy Path: Withdraw Content**
1. Admin clicks "Withdraw" on published content
2. Backend transitions content to WITHDRAWN
3. Content removed from patient-facing browse page
4. Content remains in admin view for historical reference

**Happy Path: Patient Browses Content**
1. Patient navigates to content section
2. Frontend loads published content (paginated)
3. Content displayed in clean, accessible cards
4. Patient can filter by type (article, gallery, audio, video)
5. Patient clicks to view full content
6. Articles render rich text
7. Galleries display image slideshow
8. Audio/video use native HTML5 players

**Failure Path: Sensitive Word Rejection**
1. Admin submits content with severe sensitive words
2. Backend returns warning list
3. Frontend shows modal with highlighted words
4. Admin chooses to go back and edit
5. Content remains in DRAFT

**Failure Path: Publish Without Review**
1. Content in DRAFT status, admin attempts to publish directly
2. Backend returns 422 "Content must be reviewed before publishing"
3. Frontend shows error

**Failure Path: Media File Too Large**
1. Admin uploads media file exceeding size limit
2. Backend returns 413 "File too large"
3. Frontend shows upload error

**Failure Path: Unsupported Media Type**
1. Admin uploads file with unsupported MIME type
2. Backend returns 415 "Unsupported media type"
3. Frontend shows error

#### Inputs and Outputs
- **Create Content Input**: `{ title, type: 'ARTICLE'|'GALLERY'|'AUDIO'|'VIDEO', body?: string, mediaFiles?: File[] }`
- **Create Content Output**: `{ contentId, versionId, status: 'DRAFT', createdAt }`
- **Sensitive Word Check Output**: `{ hasWarnings: boolean, warnings: [{ word, position, severity }] }`
- **Browse Content Output**: `{ items: [{ id, title, type, excerpt, thumbnailUrl, publishedAt }], total, page, pageSize }`

#### Important Failure Behavior
- Sensitive-word filter is regex-based and configurable by admin
- Filter is a soft warning (modal), not a hard block — admin can override
- Media files stored locally with unique filenames (UUID-based)
- Content withdrawal does not delete content; it marks as WITHDRAWN
- Published content version is immutable; edits create new versions
- Patient-facing view only shows PUBLISHED content

#### Permissions and Boundaries
- Create/Edit content: Admin
- Submit for review: Admin
- Publish/Withdraw: Admin
- Browse published content: Patient, Staff, Admin, Reviewer (all authenticated)
- View content history/versions: Admin

#### State Transitions

```
Content:
  DRAFT → PENDING_REVIEW (submit for review)
  PENDING_REVIEW → PUBLISHED (publish)
  PENDING_REVIEW → DRAFT (reject/return for edits)
  PUBLISHED → WITHDRAWN (withdraw)
  WITHDRAWN → DRAFT (re-edit for republishing)
```

#### Tests Required

| Type | Test |
|------|------|
| Unit | Sensitive-word regex matching (positive and negative cases) |
| Unit | Content state transitions (valid and invalid) |
| Unit | Content versioning logic |
| Integration | Content CRUD with database |
| Integration | Sensitive-word filter on content submission |
| Integration | Media file upload and retrieval |
| Integration | Content version history |
| E2E | Admin creates article content |
| E2E | Sensitive word warning modal appears |
| E2E | Admin publishes content |
| E2E | Patient browses published content |
| E2E | Admin withdraws content (disappears from browse) |
| E2E | Image gallery renders correctly |

#### Module Completion Checklist
- [ ] Content CRUD for articles, galleries, audio, video
- [ ] Draft-review-publish workflow enforced
- [ ] Sensitive-word regex filter with soft-warning modal
- [ ] Content versioning (edits create new version)
- [ ] Admin publish and withdraw capabilities
- [ ] Media file upload and local storage
- [ ] Patient-facing content browser (clean, accessible)
- [ ] Content filtering by type
- [ ] Rich text article rendering
- [ ] Image gallery, audio, video display
- [ ] Object-level auth (patients see only published)
- [ ] Frontend content editor with media upload
- [ ] Frontend sensitive word warning modal
- [ ] Docker verification passes
- [ ] All tests pass via run_tests.sh

---

### Module 8: Risk Control & Security Hardening

#### Responsibilities
- Device fingerprinting (Canvas + AudioContext + hardware attributes)
- IP-based allow/deny lists
- Per-action rate limiting (30 requests/minute/user)
- CAPTCHA generation (locally generated challenges) for suspicious spikes
- Anomaly detection: promo abuse, bulk registrations, repeated refund attempts
- Risk event logging with hit logs
- Incident ticket creation for administrator review
- Sensitive field encryption at rest (medical IDs, notes)
- PII scrubbing from logs
- Frontend: CAPTCHA challenge component, risk dashboard, incident management

#### Required Flows

**Happy Path: Device Fingerprinting**
1. On login, frontend collects device fingerprint (Canvas rendering hash, AudioContext hash, screen resolution, installed fonts, hardware concurrency, timezone, language)
2. Frontend sends fingerprint with login request
3. Backend stores/matches fingerprint to user
4. If new device detected, backend records risk event
5. Admin can view device history per user

**Happy Path: Rate Limiting**
1. User makes API request
2. RateLimitGuard checks request count for user in current minute window
3. If under 30, request proceeds; counter incremented
4. If at 30, request rejected with 429 Too Many Requests
5. Response includes `Retry-After` header

**Happy Path: CAPTCHA Challenge**
1. Rate limit or suspicious spike detected for a user
2. Backend flags session for CAPTCHA requirement
3. Next request from frontend receives 428 Precondition Required with CAPTCHA challenge ID
4. Frontend displays locally-generated CAPTCHA challenge
5. User solves CAPTCHA (simple math, distorted text from server-generated image)
6. Frontend submits solution
7. Backend validates; if correct, clears CAPTCHA requirement
8. Subsequent requests proceed normally

**Happy Path: Anomaly Detection — Promo Abuse**
1. System detects same user applying promotions to many orders in short window
2. Anomaly rule triggers (e.g., >5 promo applications in 10 minutes)
3. Risk event created with type PROMO_ABUSE
4. Incident ticket created for admin review
5. Hit log records: user, timestamps, promo IDs, order IDs
6. Admin notification sent

**Happy Path: Anomaly Detection — Bulk Registration**
1. System detects many registrations from same IP in short window
2. Anomaly rule triggers (e.g., >10 registrations from same IP in 1 hour)
3. Risk event created with type BULK_REGISTRATION
4. Incident ticket created
5. CAPTCHA requirement enabled for that IP

**Happy Path: Anomaly Detection — Repeated Refunds**
1. System detects same user requesting many refunds in short window
2. Anomaly rule triggers (e.g., >3 refund requests in 24 hours)
3. Risk event created with type REPEATED_REFUNDS
4. Incident ticket created
5. Admin can temporarily block refund capability for user

**Happy Path: IP Allow/Deny List**
1. Admin configures IP rules (allow or deny specific IPs/ranges)
2. IpFilterGuard checks incoming request IP against rules
3. Deny list takes precedence over allow list
4. Blocked IPs receive 403 Forbidden

**Happy Path: Incident Management**
1. Admin opens risk dashboard
2. Sees list of incident tickets with severity, type, and status
3. Admin opens incident detail
4. Views hit logs (timeline of triggering events)
5. Admin can: acknowledge, investigate, resolve, or dismiss incident
6. Resolution notes recorded

**Failure Path: CAPTCHA Wrong Answer**
1. User submits incorrect CAPTCHA solution
2. Backend returns 400 with "Incorrect CAPTCHA"
3. New CAPTCHA challenge generated
4. After 5 failed CAPTCHA attempts, session locked for 15 minutes

**Failure Path: Rate Limit Exceeded**
1. User exceeds 30 requests/minute
2. All subsequent requests return 429 until next minute window
3. Risk event logged
4. If rate limit hit repeatedly, CAPTCHA requirement triggered

#### Inputs and Outputs
- **Device Fingerprint Input**: `{ canvasHash, audioContextHash, screenResolution, hardwareConcurrency, timezone, language, installedFonts }`
- **CAPTCHA Challenge Output**: `{ challengeId, imageBase64, type: 'MATH'|'TEXT' }`
- **CAPTCHA Solution Input**: `{ challengeId, solution: string }`
- **IP Rule Input**: `{ ip: string, type: 'ALLOW'|'DENY', description? }`
- **Incident Ticket Output**: `{ ticketId, type, severity, status, hitLogs: [...], createdAt }`

#### Important Failure Behavior
- Rate limiting uses sliding window (not fixed window)
- CAPTCHA images are generated server-side using Canvas (no external APIs)
- Device fingerprinting is best-effort (not all browsers support all signals)
- IP rules support CIDR notation for ranges
- Encryption at rest uses AES-256-GCM
- All sensitive fields (medical IDs, health-check notes) encrypted before storage
- PII never appears in log messages (scrubbed via Winston format function)

#### Permissions and Boundaries
- IP rule management: Admin only
- View risk dashboard: Admin only
- Manage incident tickets: Admin only
- CAPTCHA challenges: System-generated, user-solved
- Rate limits apply to all roles equally
- Device fingerprints visible to Admin only

#### State Transitions

```
Incident Ticket:
  OPEN → ACKNOWLEDGED (admin acknowledges)
  ACKNOWLEDGED → INVESTIGATING (admin starts investigation)
  INVESTIGATING → RESOLVED (admin resolves with notes)
  INVESTIGATING → DISMISSED (admin dismisses as false positive)
  OPEN → DISMISSED (admin dismisses immediately)
```

#### Tests Required

| Type | Test |
|------|------|
| Unit | Rate limit sliding window logic |
| Unit | CAPTCHA generation and validation |
| Unit | Anomaly detection rules (promo abuse thresholds) |
| Unit | Anomaly detection rules (bulk registration thresholds) |
| Unit | Anomaly detection rules (repeated refund thresholds) |
| Unit | IP allow/deny evaluation with CIDR |
| Unit | Device fingerprint hashing and comparison |
| Unit | AES-256-GCM encryption/decryption |
| Unit | PII scrubbing from log messages |
| Integration | Rate limit guard blocks excess requests |
| Integration | CAPTCHA flow (challenge → solve → continue) |
| Integration | Anomaly detection creates incident tickets |
| Integration | IP filter blocks denied IPs |
| Integration | Encrypted fields stored and retrieved correctly |
| E2E | Rate limit returns 429 after 30 requests |
| E2E | CAPTCHA challenge appears and can be solved |
| E2E | Admin views risk dashboard |
| E2E | Admin manages incident tickets |
| E2E | Admin configures IP rules |

#### Module Completion Checklist
- [ ] Device fingerprinting (Canvas + AudioContext + hardware)
- [ ] IP allow/deny lists with CIDR support
- [ ] Per-action rate limiting (30 req/min/user)
- [ ] CAPTCHA generation (locally generated image challenges)
- [ ] Anomaly detection for promo abuse
- [ ] Anomaly detection for bulk registrations
- [ ] Anomaly detection for repeated refunds
- [ ] Risk event logging with hit logs
- [ ] Incident ticket management
- [ ] Sensitive field encryption at rest (AES-256-GCM)
- [ ] PII scrubbing from logs
- [ ] Frontend CAPTCHA component
- [ ] Frontend risk dashboard
- [ ] Frontend incident management
- [ ] Docker verification passes
- [ ] All tests pass via run_tests.sh

---

### Module 9: Integration, E2E Testing & Polish

#### Responsibilities
- Cross-module integration testing
- End-to-end workflow verification
- UI polish and consistency audit
- Performance baseline testing
- Accessibility audit
- Final security review
- Documentation completion
- Docker deployment verification

#### Required Flows

**Happy Path: Full Patient Journey**
1. Patient registers (via Staff)
2. Patient logs in
3. Patient browses cultural content
4. Patient creates enrollment draft with services
5. Patient submits enrollment (order created)
6. Staff records payment
7. Enrollment becomes ACTIVE
8. Staff captures health-check results
9. Reviewer signs health-check report
10. Patient views reviewed report
11. Patient exports PDF
12. Patient receives notifications throughout

**Happy Path: Full Admin Journey**
1. Admin logs in
2. Admin creates promotion rules
3. Admin publishes cultural content
4. Admin monitors notifications
5. Admin reviews risk dashboard
6. Admin manages incident tickets
7. Admin manages users

**Happy Path: Refund Journey**
1. Staff records payment for order
2. Staff requests refund with reason code
3. Supervisor approves via override modal
4. Order transitions to REFUNDED

#### UI Polish Requirements
- All interactive elements have hover, active, focus, and disabled states
- All async operations show Skeleton or Spinner loading states
- No layout shifts (reserved dimensions for images, dynamic content)
- Consistent use of design tokens (CSS variables)
- 8px grid system enforced
- Distinct backgrounds for functional areas (sidebar, content, header)
- Error boundaries catch and display errors gracefully
- Toast notifications for success/failure of user actions
- Consistent icon weights (Lucide)
- Responsive layout for various screen sizes (clinic monitors)

#### Tests Required

| Type | Test |
|------|------|
| E2E | Full patient enrollment-to-PDF journey |
| E2E | Full admin content-publish journey |
| E2E | Full refund journey with supervisor override |
| E2E | Cross-role notification delivery |
| E2E | Rate limiting during normal multi-user operation |
| E2E | Auto-cancel with payment race condition |
| Integration | Cross-module state consistency (enrollment + order + payment) |
| Integration | Notification frequency limits across modules |

#### Module Completion Checklist
- [ ] All cross-module workflows verified
- [ ] Full patient journey E2E test passes
- [ ] Full admin journey E2E test passes
- [ ] Full refund journey E2E test passes
- [ ] UI audit: all interactive states present
- [ ] UI audit: all async states (skeleton/spinner) present
- [ ] UI audit: no layout shifts
- [ ] UI audit: design token consistency
- [ ] UI audit: 8px grid compliance
- [ ] Accessibility: keyboard navigation works
- [ ] Accessibility: screen reader friendly (aria labels)
- [ ] Performance: page load under 3 seconds
- [ ] Performance: API response under 500ms for standard queries
- [ ] Security: no PII in logs
- [ ] Security: all routes authenticated
- [ ] Security: object-level auth verified
- [ ] README complete and accurate
- [ ] Docker deployment fully functional
- [ ] `run_tests.sh` passes with 90%+ coverage
- [ ] No TODO/Mock code in codebase

---

## 4. Domain Model

### 4.1 Entities

#### User
- `id: UUID` (PK)
- `username: string` (unique)
- `passwordHash: string`
- `role: Role` (PATIENT | STAFF | ADMIN | REVIEWER)
- `canApproveRefunds: boolean` (default false, relevant for STAFF)
- `status: AccountStatus` (ACTIVE | LOCKED | DISABLED)
- `failedLoginAttempts: number`
- `lockedUntil: DateTime | null`
- `createdAt: DateTime`
- `updatedAt: DateTime`

#### Enrollment
- `id: UUID` (PK)
- `patientId: UUID` (FK → User)
- `status: EnrollmentStatus` (DRAFT | SUBMITTED | ACTIVE)
- `personalDetails: JSON` (encrypted at rest)
- `createdAt: DateTime`
- `updatedAt: DateTime`
- Relations: belongs to User (patient), has many Orders, has many EnrollmentServices

#### EnrollmentService
- `id: UUID` (PK)
- `enrollmentId: UUID` (FK → Enrollment)
- `serviceItemId: UUID` (FK → ServiceItem)
- Relations: belongs to Enrollment, belongs to ServiceItem

#### ServiceItem
- `id: UUID` (PK)
- `name: string`
- `description: string`
- `unitPrice: decimal(10,2)`
- `seatQuota: number | null` (null = unlimited)
- `active: boolean`
- `createdAt: DateTime`
- Relations: has many EnrollmentServices, has many OrderLines, has many SeatReservations

#### Order
- `id: UUID` (PK)
- `enrollmentId: UUID` (FK → Enrollment)
- `status: OrderStatus` (PENDING_PAYMENT | PAID | REFUND_REQUESTED | REFUNDED | CANCELED)
- `subtotal: decimal(10,2)`
- `discountTotal: decimal(10,2)`
- `finalTotal: decimal(10,2)`
- `createdAt: DateTime`
- `updatedAt: DateTime`
- `canceledAt: DateTime | null`
- `cancelReason: string | null`
- Relations: belongs to Enrollment, has many OrderLines, has many DiscountAudits, has one Payment

#### OrderLine
- `id: UUID` (PK)
- `orderId: UUID` (FK → Order)
- `serviceItemId: UUID` (FK → ServiceItem)
- `name: string` (denormalized)
- `unitPrice: decimal(10,2)`
- `quantity: number`
- `lineTotal: decimal(10,2)`
- `discountAmount: decimal(10,2)`
- `finalAmount: decimal(10,2)`
- Relations: belongs to Order, belongs to ServiceItem

#### PromotionRule
- `id: UUID` (PK)
- `name: string`
- `type: DiscountType` (PERCENTAGE | FIXED | BOGO | TIERED | SECOND_ITEM_DISCOUNT)
- `conditions: JSON` (threshold, eligible services, etc.)
- `discountValue: decimal(10,2)` (percentage or fixed amount)
- `priority: number`
- `exclusionGroup: string | null`
- `effectiveStart: DateTime`
- `effectiveEnd: DateTime`
- `active: boolean`
- `createdAt: DateTime`
- `updatedAt: DateTime`

#### DiscountAudit
- `id: UUID` (PK)
- `orderId: UUID` (FK → Order)
- `orderLineId: UUID | null` (FK → OrderLine, null for order-level discounts)
- `promotionRuleId: UUID | null` (FK → PromotionRule, null if no promo applied)
- `ruleSnapshot: JSON` (immutable copy of rule at evaluation time)
- `type: DiscountType`
- `reason: string`
- `originalAmount: decimal(10,2)`
- `discountAmount: decimal(10,2)`
- `finalAmount: decimal(10,2)`
- `excluded: boolean` (true if rule was evaluated but excluded by mutual exclusion)
- `exclusionReason: string | null`
- `evaluatedAt: DateTime`
- **IMMUTABLE** — INSERT only, no UPDATE or DELETE

#### Payment
- `id: UUID` (PK)
- `orderId: UUID` (FK → Order, unique)
- `method: PaymentMethod` (CASH | CHECK | CARD_TERMINAL)
- `referenceNumber: string` (encrypted at rest)
- `amount: decimal(10,2)`
- `status: PaymentStatus` (RECORDED | REFUND_REQUESTED | REFUNDED)
- `refundReasonCode: string | null`
- `refundNotes: string | null`
- `refundApprovedBy: UUID | null` (FK → User)
- `refundApprovedAt: DateTime | null`
- `paidAt: DateTime`
- `refundedAt: DateTime | null`
- `createdAt: DateTime`

#### SeatReservation
- `id: UUID` (PK)
- `serviceItemId: UUID` (FK → ServiceItem)
- `enrollmentId: UUID` (FK → Enrollment)
- `status: ReservationStatus` (HELD | CONFIRMED | EXPIRED | RELEASED)
- `expiresAt: DateTime` (created_at + 60 minutes)
- `createdAt: DateTime`
- `confirmedAt: DateTime | null`

#### HealthCheck
- `id: UUID` (PK)
- `patientId: UUID` (FK → User)
- `templateId: UUID` (FK → ReportTemplate)
- `visitDate: DateTime`
- `createdBy: UUID` (FK → User, staff who captured)
- `createdAt: DateTime`
- Relations: has many HealthCheckVersions

#### HealthCheckVersion
- `id: UUID` (PK)
- `healthCheckId: UUID` (FK → HealthCheck)
- `versionNumber: number`
- `status: ReportStatus` (DRAFT | REVIEWED | SLA_BREACHED)
- `signedBy: UUID | null` (FK → User, reviewer)
- `signedAt: DateTime | null`
- `slaDeadline: DateTime` (createdAt + 24 hours)
- `createdAt: DateTime`
- Relations: has many HealthCheckResults
- **IMMUTABLE once status = REVIEWED** — no UPDATE on signed versions

#### HealthCheckResult
- `id: UUID` (PK)
- `versionId: UUID` (FK → HealthCheckVersion)
- `measurementCode: string`
- `measurementName: string`
- `value: string` (encrypted at rest)
- `unit: string`
- `referenceRangeLow: decimal | null`
- `referenceRangeHigh: decimal | null`
- `isAbnormal: boolean`
- `notes: string | null` (encrypted at rest)

#### ReportTemplate
- `id: UUID` (PK)
- `name: string`
- `description: string`
- `measurements: JSON` (array of { code, name, unit, refLow, refHigh })
- `active: boolean`
- `createdAt: DateTime`

#### Content
- `id: UUID` (PK)
- `currentVersionId: UUID | null` (FK → ContentVersion)
- `type: ContentType` (ARTICLE | GALLERY | AUDIO | VIDEO)
- `status: ContentStatus` (DRAFT | PENDING_REVIEW | PUBLISHED | WITHDRAWN)
- `publishedAt: DateTime | null`
- `withdrawnAt: DateTime | null`
- `createdBy: UUID` (FK → User)
- `createdAt: DateTime`
- `updatedAt: DateTime`

#### ContentVersion
- `id: UUID` (PK)
- `contentId: UUID` (FK → Content)
- `versionNumber: number`
- `title: string`
- `body: string | null`
- `mediaFiles: JSON` (array of { filename, mimeType, path, size })
- `sensitiveWordWarnings: JSON | null`
- `createdAt: DateTime`

#### Notification
- `id: UUID` (PK)
- `recipientId: UUID` (FK → User)
- `type: NotificationType`
- `itemType: string` (e.g., 'ORDER', 'HEALTH_CHECK', 'CONTENT')
- `itemId: UUID`
- `message: string`
- `priority: NotificationPriority` (LOW | MEDIUM | HIGH)
- `read: boolean` (default false)
- `createdAt: DateTime`
- `readAt: DateTime | null`

#### NotificationDelivery
- `id: UUID` (PK)
- `notificationId: UUID` (FK → Notification)
- `deliveredAt: DateTime`
- Purpose: tracks delivery timestamps for frequency limiting

#### DeviceFingerprint
- `id: UUID` (PK)
- `userId: UUID` (FK → User)
- `fingerprintHash: string`
- `attributes: JSON` (canvas, audio, screen, hardware, etc.)
- `firstSeenAt: DateTime`
- `lastSeenAt: DateTime`

#### LoginAttempt
- `id: UUID` (PK)
- `userId: UUID | null` (FK → User, null if username not found)
- `username: string`
- `success: boolean`
- `ipAddress: string`
- `fingerprintHash: string | null`
- `attemptedAt: DateTime`

#### IpRule
- `id: UUID` (PK)
- `ip: string` (IP address or CIDR range)
- `type: IpRuleType` (ALLOW | DENY)
- `description: string | null`
- `createdBy: UUID` (FK → User)
- `createdAt: DateTime`

#### RiskEvent
- `id: UUID` (PK)
- `type: RiskEventType` (PROMO_ABUSE | BULK_REGISTRATION | REPEATED_REFUNDS | RATE_LIMIT_EXCEEDED | NEW_DEVICE | SUSPICIOUS_LOGIN)
- `userId: UUID | null` (FK → User)
- `ipAddress: string | null`
- `details: JSON`
- `severity: RiskSeverity` (LOW | MEDIUM | HIGH | CRITICAL)
- `createdAt: DateTime`

#### IncidentTicket
- `id: UUID` (PK)
- `riskEventId: UUID` (FK → RiskEvent)
- `type: RiskEventType`
- `severity: RiskSeverity`
- `status: IncidentStatus` (OPEN | ACKNOWLEDGED | INVESTIGATING | RESOLVED | DISMISSED)
- `assignedTo: UUID | null` (FK → User)
- `hitLogs: JSON` (array of timestamped event entries)
- `resolutionNotes: string | null`
- `createdAt: DateTime`
- `updatedAt: DateTime`
- `resolvedAt: DateTime | null`

### 4.2 Key Enums

```typescript
enum Role { PATIENT = 'PATIENT', STAFF = 'STAFF', ADMIN = 'ADMIN', REVIEWER = 'REVIEWER' }
enum AccountStatus { ACTIVE = 'ACTIVE', LOCKED = 'LOCKED', DISABLED = 'DISABLED' }
enum EnrollmentStatus { DRAFT = 'DRAFT', SUBMITTED = 'SUBMITTED', ACTIVE = 'ACTIVE' }
enum OrderStatus { PENDING_PAYMENT = 'PENDING_PAYMENT', PAID = 'PAID', REFUND_REQUESTED = 'REFUND_REQUESTED', REFUNDED = 'REFUNDED', CANCELED = 'CANCELED' }
enum PaymentMethod { CASH = 'CASH', CHECK = 'CHECK', CARD_TERMINAL = 'CARD_TERMINAL' }
enum PaymentStatus { RECORDED = 'RECORDED', REFUND_REQUESTED = 'REFUND_REQUESTED', REFUNDED = 'REFUNDED' }
enum DiscountType { PERCENTAGE = 'PERCENTAGE', FIXED = 'FIXED', BOGO = 'BOGO', TIERED = 'TIERED', SECOND_ITEM_DISCOUNT = 'SECOND_ITEM_DISCOUNT' }
enum ReservationStatus { HELD = 'HELD', CONFIRMED = 'CONFIRMED', EXPIRED = 'EXPIRED', RELEASED = 'RELEASED' }
enum ReportStatus { DRAFT = 'DRAFT', REVIEWED = 'REVIEWED', SLA_BREACHED = 'SLA_BREACHED' }
enum ContentType { ARTICLE = 'ARTICLE', GALLERY = 'GALLERY', AUDIO = 'AUDIO', VIDEO = 'VIDEO' }
enum ContentStatus { DRAFT = 'DRAFT', PENDING_REVIEW = 'PENDING_REVIEW', PUBLISHED = 'PUBLISHED', WITHDRAWN = 'WITHDRAWN' }
enum NotificationType { DUE_DATE_UPCOMING = 'DUE_DATE_UPCOMING', OVERDUE_BALANCE = 'OVERDUE_BALANCE', HOLD_AVAILABLE = 'HOLD_AVAILABLE', REFUND_REQUESTED = 'REFUND_REQUESTED', REFUND_PROCESSED = 'REFUND_PROCESSED', SLA_BREACH = 'SLA_BREACH', COMPLIANCE_ALERT = 'COMPLIANCE_ALERT', CONTENT_REVIEW = 'CONTENT_REVIEW', ORDER_AUTO_CANCELED = 'ORDER_AUTO_CANCELED' }
enum NotificationPriority { LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH' }
enum IpRuleType { ALLOW = 'ALLOW', DENY = 'DENY' }
enum RiskEventType { PROMO_ABUSE = 'PROMO_ABUSE', BULK_REGISTRATION = 'BULK_REGISTRATION', REPEATED_REFUNDS = 'REPEATED_REFUNDS', RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED', NEW_DEVICE = 'NEW_DEVICE', SUSPICIOUS_LOGIN = 'SUSPICIOUS_LOGIN' }
enum RiskSeverity { LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH', CRITICAL = 'CRITICAL' }
enum IncidentStatus { OPEN = 'OPEN', ACKNOWLEDGED = 'ACKNOWLEDGED', INVESTIGATING = 'INVESTIGATING', RESOLVED = 'RESOLVED', DISMISSED = 'DISMISSED' }
```

### 4.3 Value Objects

| Value Object | Properties | Validation |
|-------------|-----------|------------|
| `Money` | `amount: number, currency: string` | amount >= 0, currency = 'USD' (default) |
| `Email` | `value: string` | Valid email format |
| `Password` | `value: string` | 12+ characters |
| `DateRange` | `start: DateTime, end: DateTime` | start < end |
| `ReferenceRange` | `low: number, high: number, unit: string` | low < high |
| `Checksum` | `algorithm: string, value: string` | SHA-256 hex string |

---

## 5. Data Model

### 5.1 Database Tables

#### `users`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `username` | `VARCHAR(100)` | NOT NULL, UNIQUE |
| `password_hash` | `VARCHAR(255)` | NOT NULL |
| `role` | `VARCHAR(20)` | NOT NULL, CHECK (role IN ('PATIENT','STAFF','ADMIN','REVIEWER')) |
| `can_approve_refunds` | `BOOLEAN` | NOT NULL, DEFAULT false |
| `status` | `VARCHAR(20)` | NOT NULL, DEFAULT 'ACTIVE', CHECK (status IN ('ACTIVE','LOCKED','DISABLED')) |
| `failed_login_attempts` | `INTEGER` | NOT NULL, DEFAULT 0 |
| `locked_until` | `TIMESTAMPTZ` | NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |

**Indexes**: `UNIQUE(username)`, `INDEX(role)`, `INDEX(status)`

#### `enrollments`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `patient_id` | `UUID` | NOT NULL, FK → users(id) |
| `status` | `VARCHAR(20)` | NOT NULL, DEFAULT 'DRAFT', CHECK (status IN ('DRAFT','SUBMITTED','ACTIVE')) |
| `personal_details` | `BYTEA` | NOT NULL (encrypted JSON) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |

**Indexes**: `INDEX(patient_id)`, `INDEX(status)`, `INDEX(created_at)`

#### `enrollment_services`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `enrollment_id` | `UUID` | NOT NULL, FK → enrollments(id) |
| `service_item_id` | `UUID` | NOT NULL, FK → service_items(id) |

**Indexes**: `INDEX(enrollment_id)`, `UNIQUE(enrollment_id, service_item_id)`

#### `service_items`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `name` | `VARCHAR(255)` | NOT NULL |
| `description` | `TEXT` | NOT NULL |
| `unit_price` | `DECIMAL(10,2)` | NOT NULL, CHECK (unit_price >= 0) |
| `seat_quota` | `INTEGER` | NULL (null = unlimited) |
| `active` | `BOOLEAN` | NOT NULL, DEFAULT true |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |

**Indexes**: `INDEX(active)`

#### `orders`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `enrollment_id` | `UUID` | NOT NULL, FK → enrollments(id) |
| `status` | `VARCHAR(30)` | NOT NULL, DEFAULT 'PENDING_PAYMENT' |
| `subtotal` | `DECIMAL(10,2)` | NOT NULL |
| `discount_total` | `DECIMAL(10,2)` | NOT NULL, DEFAULT 0 |
| `final_total` | `DECIMAL(10,2)` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |
| `canceled_at` | `TIMESTAMPTZ` | NULL |
| `cancel_reason` | `VARCHAR(255)` | NULL |

**Indexes**: `INDEX(enrollment_id)`, `INDEX(status)`, `INDEX(created_at)`, `INDEX(status, created_at)` (for auto-cancel query)

#### `order_lines`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `order_id` | `UUID` | NOT NULL, FK → orders(id) |
| `service_item_id` | `UUID` | NOT NULL, FK → service_items(id) |
| `name` | `VARCHAR(255)` | NOT NULL |
| `unit_price` | `DECIMAL(10,2)` | NOT NULL |
| `quantity` | `INTEGER` | NOT NULL, DEFAULT 1, CHECK (quantity > 0) |
| `line_total` | `DECIMAL(10,2)` | NOT NULL |
| `discount_amount` | `DECIMAL(10,2)` | NOT NULL, DEFAULT 0 |
| `final_amount` | `DECIMAL(10,2)` | NOT NULL |

**Indexes**: `INDEX(order_id)`

#### `promotion_rules`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `name` | `VARCHAR(255)` | NOT NULL |
| `type` | `VARCHAR(30)` | NOT NULL |
| `conditions` | `JSONB` | NOT NULL |
| `discount_value` | `DECIMAL(10,2)` | NOT NULL |
| `priority` | `INTEGER` | NOT NULL |
| `exclusion_group` | `VARCHAR(100)` | NULL |
| `effective_start` | `TIMESTAMPTZ` | NOT NULL |
| `effective_end` | `TIMESTAMPTZ` | NOT NULL |
| `active` | `BOOLEAN` | NOT NULL, DEFAULT true |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |

**Indexes**: `INDEX(active, effective_start, effective_end)`, `INDEX(priority)`, `INDEX(exclusion_group)`

#### `discount_audits`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `order_id` | `UUID` | NOT NULL, FK → orders(id) |
| `order_line_id` | `UUID` | NULL, FK → order_lines(id) |
| `promotion_rule_id` | `UUID` | NULL, FK → promotion_rules(id) |
| `rule_snapshot` | `JSONB` | NOT NULL |
| `type` | `VARCHAR(30)` | NOT NULL |
| `reason` | `TEXT` | NOT NULL |
| `original_amount` | `DECIMAL(10,2)` | NOT NULL |
| `discount_amount` | `DECIMAL(10,2)` | NOT NULL |
| `final_amount` | `DECIMAL(10,2)` | NOT NULL |
| `excluded` | `BOOLEAN` | NOT NULL, DEFAULT false |
| `exclusion_reason` | `TEXT` | NULL |
| `evaluated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |

**Indexes**: `INDEX(order_id)`, `INDEX(promotion_rule_id)`
**Immutability**: Table has a trigger that prevents UPDATE and DELETE operations. Only INSERT is allowed.

#### `payments`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `order_id` | `UUID` | NOT NULL, FK → orders(id), UNIQUE |
| `method` | `VARCHAR(20)` | NOT NULL, CHECK (method IN ('CASH','CHECK','CARD_TERMINAL')) |
| `reference_number` | `BYTEA` | NOT NULL (encrypted) |
| `amount` | `DECIMAL(10,2)` | NOT NULL |
| `status` | `VARCHAR(30)` | NOT NULL, DEFAULT 'RECORDED' |
| `refund_reason_code` | `VARCHAR(50)` | NULL |
| `refund_notes` | `TEXT` | NULL |
| `refund_approved_by` | `UUID` | NULL, FK → users(id) |
| `refund_approved_at` | `TIMESTAMPTZ` | NULL |
| `paid_at` | `TIMESTAMPTZ` | NOT NULL |
| `refunded_at` | `TIMESTAMPTZ` | NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |

**Indexes**: `UNIQUE(order_id)`, `INDEX(status)`

#### `seat_reservations`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `service_item_id` | `UUID` | NOT NULL, FK → service_items(id) |
| `enrollment_id` | `UUID` | NOT NULL, FK → enrollments(id) |
| `status` | `VARCHAR(20)` | NOT NULL, DEFAULT 'HELD' |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |
| `confirmed_at` | `TIMESTAMPTZ` | NULL |

**Indexes**: `INDEX(service_item_id, status)`, `INDEX(expires_at)`, `INDEX(enrollment_id)`

#### `health_checks`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `patient_id` | `UUID` | NOT NULL, FK → users(id) |
| `template_id` | `UUID` | NOT NULL, FK → report_templates(id) |
| `visit_date` | `TIMESTAMPTZ` | NOT NULL |
| `created_by` | `UUID` | NOT NULL, FK → users(id) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |

**Indexes**: `INDEX(patient_id)`, `INDEX(visit_date)`, `INDEX(patient_id, visit_date)`

#### `health_check_versions`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `health_check_id` | `UUID` | NOT NULL, FK → health_checks(id) |
| `version_number` | `INTEGER` | NOT NULL |
| `status` | `VARCHAR(20)` | NOT NULL, DEFAULT 'DRAFT' |
| `signed_by` | `UUID` | NULL, FK → users(id) |
| `signed_at` | `TIMESTAMPTZ` | NULL |
| `sla_deadline` | `TIMESTAMPTZ` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |

**Indexes**: `INDEX(health_check_id)`, `INDEX(status)`, `INDEX(sla_deadline)`, `UNIQUE(health_check_id, version_number)`
**Immutability**: Trigger prevents UPDATE on rows where `status = 'REVIEWED'`.

#### `health_check_results`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `version_id` | `UUID` | NOT NULL, FK → health_check_versions(id) |
| `measurement_code` | `VARCHAR(50)` | NOT NULL |
| `measurement_name` | `VARCHAR(255)` | NOT NULL |
| `value` | `BYTEA` | NOT NULL (encrypted) |
| `unit` | `VARCHAR(50)` | NOT NULL |
| `reference_range_low` | `DECIMAL(10,2)` | NULL |
| `reference_range_high` | `DECIMAL(10,2)` | NULL |
| `is_abnormal` | `BOOLEAN` | NOT NULL |
| `notes` | `BYTEA` | NULL (encrypted) |

**Indexes**: `INDEX(version_id)`

#### `report_templates`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `name` | `VARCHAR(255)` | NOT NULL |
| `description` | `TEXT` | NOT NULL |
| `measurements` | `JSONB` | NOT NULL |
| `active` | `BOOLEAN` | NOT NULL, DEFAULT true |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |

**Indexes**: `INDEX(active)`

#### `content`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `current_version_id` | `UUID` | NULL, FK → content_versions(id) |
| `type` | `VARCHAR(20)` | NOT NULL |
| `status` | `VARCHAR(20)` | NOT NULL, DEFAULT 'DRAFT' |
| `published_at` | `TIMESTAMPTZ` | NULL |
| `withdrawn_at` | `TIMESTAMPTZ` | NULL |
| `created_by` | `UUID` | NOT NULL, FK → users(id) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |

**Indexes**: `INDEX(status)`, `INDEX(type, status)`, `INDEX(published_at)`

#### `content_versions`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `content_id` | `UUID` | NOT NULL, FK → content(id) |
| `version_number` | `INTEGER` | NOT NULL |
| `title` | `VARCHAR(500)` | NOT NULL |
| `body` | `TEXT` | NULL |
| `media_files` | `JSONB` | NULL |
| `sensitive_word_warnings` | `JSONB` | NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |

**Indexes**: `INDEX(content_id)`, `UNIQUE(content_id, version_number)`

#### `notifications`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `recipient_id` | `UUID` | NOT NULL, FK → users(id) |
| `type` | `VARCHAR(50)` | NOT NULL |
| `item_type` | `VARCHAR(50)` | NOT NULL |
| `item_id` | `UUID` | NOT NULL |
| `message` | `TEXT` | NOT NULL |
| `priority` | `VARCHAR(10)` | NOT NULL, DEFAULT 'MEDIUM' |
| `read` | `BOOLEAN` | NOT NULL, DEFAULT false |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |
| `read_at` | `TIMESTAMPTZ` | NULL |

**Indexes**: `INDEX(recipient_id, read)`, `INDEX(recipient_id, created_at)`, `INDEX(type)`

#### `notification_deliveries`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `recipient_id` | `UUID` | NOT NULL, FK → users(id) |
| `item_type` | `VARCHAR(50)` | NOT NULL |
| `item_id` | `UUID` | NOT NULL |
| `delivered_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |

**Indexes**: `INDEX(recipient_id, item_type, item_id, delivered_at)` (for frequency limit queries)

#### `device_fingerprints`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `user_id` | `UUID` | NOT NULL, FK → users(id) |
| `fingerprint_hash` | `VARCHAR(255)` | NOT NULL |
| `attributes` | `JSONB` | NOT NULL |
| `first_seen_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |
| `last_seen_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |

**Indexes**: `INDEX(user_id)`, `INDEX(fingerprint_hash)`, `UNIQUE(user_id, fingerprint_hash)`

#### `login_attempts`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `user_id` | `UUID` | NULL, FK → users(id) |
| `username` | `VARCHAR(100)` | NOT NULL |
| `success` | `BOOLEAN` | NOT NULL |
| `ip_address` | `VARCHAR(45)` | NOT NULL |
| `fingerprint_hash` | `VARCHAR(255)` | NULL |
| `attempted_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |

**Indexes**: `INDEX(user_id, attempted_at)`, `INDEX(ip_address, attempted_at)`, `INDEX(username, attempted_at)`

#### `ip_rules`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `ip` | `VARCHAR(50)` | NOT NULL |
| `type` | `VARCHAR(10)` | NOT NULL, CHECK (type IN ('ALLOW','DENY')) |
| `description` | `TEXT` | NULL |
| `created_by` | `UUID` | NOT NULL, FK → users(id) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |

**Indexes**: `INDEX(type)`, `UNIQUE(ip)`

#### `risk_events`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `type` | `VARCHAR(30)` | NOT NULL |
| `user_id` | `UUID` | NULL, FK → users(id) |
| `ip_address` | `VARCHAR(45)` | NULL |
| `details` | `JSONB` | NOT NULL |
| `severity` | `VARCHAR(10)` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |

**Indexes**: `INDEX(type)`, `INDEX(user_id)`, `INDEX(severity)`, `INDEX(created_at)`

#### `incident_tickets`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() |
| `risk_event_id` | `UUID` | NOT NULL, FK → risk_events(id) |
| `type` | `VARCHAR(30)` | NOT NULL |
| `severity` | `VARCHAR(10)` | NOT NULL |
| `status` | `VARCHAR(20)` | NOT NULL, DEFAULT 'OPEN' |
| `assigned_to` | `UUID` | NULL, FK → users(id) |
| `hit_logs` | `JSONB` | NOT NULL, DEFAULT '[]' |
| `resolution_notes` | `TEXT` | NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() |
| `resolved_at` | `TIMESTAMPTZ` | NULL |

**Indexes**: `INDEX(status)`, `INDEX(severity)`, `INDEX(type)`, `INDEX(assigned_to)`

### 5.2 Immutability Rules

1. **`discount_audits`**: A PostgreSQL trigger prevents UPDATE and DELETE. Only INSERT is permitted. This ensures the promotion audit trail is tamper-proof.

2. **`health_check_versions`** (signed): A PostgreSQL trigger prevents UPDATE on rows where `status = 'REVIEWED'`. Edits create new version rows rather than modifying signed ones.

3. **`login_attempts`**: Append-only by convention (no UPDATE/DELETE in application code). Used for audit and rate-limit forensics.

4. **`notification_deliveries`**: Append-only by convention. Used for frequency limit checks.

---

## 6. Interface Contracts

### 6.1 Authentication Module

#### `POST /api/auth/login`
- **Auth**: Public
- **Request**: `{ username: string, password: string, fingerprint?: DeviceFingerprint }`
- **Success (200)**: `{ accessToken: string, refreshToken: string, user: { id, username, role, canApproveRefunds } }`
- **Errors**: 401 (Invalid credentials), 423 (Account locked), 422 (Validation error), 428 (CAPTCHA required), 429 (Rate limited)

#### `POST /api/auth/refresh`
- **Auth**: Refresh token in body
- **Request**: `{ refreshToken: string }`
- **Success (200)**: `{ accessToken: string }`
- **Errors**: 401 (Invalid/expired refresh token)

#### `POST /api/auth/captcha/verify`
- **Auth**: Public
- **Request**: `{ challengeId: string, solution: string }`
- **Success (200)**: `{ verified: true }`
- **Errors**: 400 (Incorrect solution), 404 (Challenge not found/expired)

#### `POST /api/users`
- **Auth**: Admin (Staff can create Patients)
- **Request**: `{ username, password, role, canApproveRefunds? }`
- **Success (201)**: `{ id, username, role, canApproveRefunds, createdAt }`
- **Errors**: 400 (Password too short), 409 (Username taken), 403 (Insufficient role), 422 (Validation)

#### `GET /api/users`
- **Auth**: Admin
- **Query**: `?page=1&pageSize=20&role=STAFF&status=ACTIVE`
- **Success (200)**: `{ items: User[], total, page, pageSize }`
- **Errors**: 403 (Not admin)

#### `GET /api/users/:id`
- **Auth**: Self or Admin
- **Success (200)**: `{ id, username, role, canApproveRefunds, status, createdAt }`
- **Errors**: 403 (Not self or admin), 404 (Not found)

#### `PATCH /api/users/:id`
- **Auth**: Admin
- **Request**: `{ status?, canApproveRefunds?, role? }`
- **Success (200)**: Updated user object
- **Errors**: 403 (Not admin), 404 (Not found), 422 (Validation)

### 6.2 Enrollment Module

#### `POST /api/enrollments`
- **Auth**: Patient (self), Staff
- **Request**: `{ patientId, personalDetails: {...}, serviceIds: string[] }`
- **Success (201)**: `{ id, patientId, status: 'DRAFT', services: [...], createdAt }`
- **Errors**: 403 (Unauthorized), 409 (Seats unavailable), 422 (Validation)

#### `GET /api/enrollments`
- **Auth**: Patient (own), Staff (all), Admin (all)
- **Query**: `?page=1&pageSize=20&status=DRAFT&patientId=...`
- **Success (200)**: `{ items: Enrollment[], total, page, pageSize }`
- **Errors**: 403 (Unauthorized)

#### `GET /api/enrollments/:id`
- **Auth**: Patient (own), Staff, Admin
- **Success (200)**: Full enrollment with services
- **Errors**: 403 (Not own/not staff), 404 (Not found)

#### `PATCH /api/enrollments/:id`
- **Auth**: Patient (own, DRAFT only), Staff (DRAFT only)
- **Request**: `{ personalDetails?, serviceIds? }`
- **Success (200)**: Updated enrollment
- **Errors**: 403 (Unauthorized), 404 (Not found), 409 (Not in DRAFT status, seats unavailable), 422 (Validation)

#### `POST /api/enrollments/:id/submit`
- **Auth**: Patient (own), Staff
- **Success (200)**: `{ enrollmentId, status: 'SUBMITTED', orderId, orderTotal }`
- **Errors**: 403 (Unauthorized), 404 (Not found), 409 (Not in DRAFT status, already submitted, seats unavailable), 422 (Incomplete enrollment)

### 6.3 Order Module

#### `GET /api/orders`
- **Auth**: Patient (own), Staff (all), Admin (all)
- **Query**: `?page=1&pageSize=20&status=PENDING_PAYMENT&enrollmentId=...`
- **Success (200)**: `{ items: Order[], total, page, pageSize }`
- **Errors**: 403 (Unauthorized)

#### `GET /api/orders/:id`
- **Auth**: Patient (own), Staff, Admin
- **Success (200)**: Full order with lines, discounts, payment info
- **Errors**: 403 (Not own/not staff), 404 (Not found)

#### `POST /api/orders/:id/cancel`
- **Auth**: Staff, Admin
- **Request**: `{ reason: string }`
- **Success (200)**: `{ orderId, status: 'CANCELED', canceledAt }`
- **Errors**: 403 (Unauthorized), 404 (Not found), 409 (Order not cancelable — already paid/canceled)

#### `GET /api/orders/:id/discounts`
- **Auth**: Patient (own), Staff, Admin
- **Success (200)**: `{ discounts: DiscountAudit[], exclusions: DiscountAudit[] }`
- **Errors**: 403 (Unauthorized), 404 (Not found)

### 6.4 Promotion Module

#### `POST /api/promotions`
- **Auth**: Admin
- **Request**: `{ name, type, conditions, discountValue, priority, exclusionGroup?, effectiveStart, effectiveEnd }`
- **Success (201)**: Created promotion rule
- **Errors**: 403 (Not admin), 422 (Validation — end before start, invalid type)

#### `GET /api/promotions`
- **Auth**: Authenticated
- **Query**: `?active=true&page=1&pageSize=20`
- **Success (200)**: `{ items: PromotionRule[], total, page, pageSize }`

#### `GET /api/promotions/:id`
- **Auth**: Authenticated
- **Success (200)**: Full promotion rule
- **Errors**: 404 (Not found)

#### `PATCH /api/promotions/:id`
- **Auth**: Admin
- **Request**: `{ name?, conditions?, priority?, active?, effectiveEnd? }`
- **Success (200)**: Updated promotion rule
- **Errors**: 403 (Not admin), 404 (Not found), 422 (Validation)

#### `DELETE /api/promotions/:id`
- **Auth**: Admin
- **Behavior**: Soft delete (sets `active = false`)
- **Success (200)**: `{ id, active: false }`
- **Errors**: 403 (Not admin), 404 (Not found)

### 6.5 Payment Module

#### `POST /api/payments`
- **Auth**: Staff, Admin
- **Request**: `{ orderId, method: 'CASH'|'CHECK'|'CARD_TERMINAL', referenceNumber: string }`
- **Success (201)**: `{ paymentId, orderId, method, amount, paidAt }`
- **Errors**: 403 (Unauthorized), 404 (Order not found), 409 (Order not in PENDING_PAYMENT), 422 (Validation)

#### `POST /api/payments/:id/refund-request`
- **Auth**: Staff, Admin
- **Request**: `{ reasonCode: string, notes?: string }`
- **Success (200)**: `{ paymentId, status: 'REFUND_REQUESTED', reasonCode }`
- **Errors**: 403 (Unauthorized), 404 (Not found), 409 (Payment not in RECORDED status)

#### `POST /api/payments/:id/refund-approve`
- **Auth**: Staff (can_approve_refunds), Admin
- **Request**: `{ supervisorUsername: string, supervisorPassword: string }`
- **Success (200)**: `{ paymentId, status: 'REFUNDED', refundedAt, approvedBy }`
- **Errors**: 401 (Invalid supervisor credentials), 403 (Not supervisor), 404 (Not found), 409 (Not in REFUND_REQUESTED status), 423 (Supervisor account locked)

#### `POST /api/payments/:id/refund-deny`
- **Auth**: Staff (can_approve_refunds), Admin
- **Request**: `{ reason: string }`
- **Success (200)**: `{ paymentId, status: 'RECORDED', denialReason }`
- **Errors**: 403 (Not supervisor), 404 (Not found), 409 (Not in REFUND_REQUESTED status)

#### `GET /api/payments`
- **Auth**: Staff, Admin
- **Query**: `?orderId=...&status=...&page=1&pageSize=20`
- **Success (200)**: `{ items: Payment[], total, page, pageSize }`

### 6.6 Health-Check Module

#### `POST /api/health-checks`
- **Auth**: Staff
- **Request**: `{ patientId, templateId, visitDate, results: [{ measurementCode, value, unit }] }`
- **Success (201)**: `{ healthCheckId, versionId, versionNumber: 1, status: 'DRAFT', results: [...with flags] }`
- **Errors**: 403 (Not staff), 404 (Patient/template not found), 422 (Validation)

#### `GET /api/health-checks`
- **Auth**: Patient (own), Staff, Reviewer, Admin
- **Query**: `?patientId=...&page=1&pageSize=20`
- **Success (200)**: `{ items: HealthCheck[], total, page, pageSize }`
- **Errors**: 403 (Patient accessing others' data)

#### `GET /api/health-checks/:id`
- **Auth**: Patient (own, REVIEWED only), Staff, Reviewer, Admin
- **Success (200)**: Health check with current version and results
- **Errors**: 403 (Unauthorized), 404 (Not found)

#### `GET /api/health-checks/:id/versions`
- **Auth**: Staff, Reviewer, Admin
- **Success (200)**: `{ versions: HealthCheckVersion[] }`
- **Errors**: 403 (Unauthorized), 404 (Not found)

#### `POST /api/health-checks/:id/versions`
- **Auth**: Staff
- **Request**: `{ results: [{ measurementCode, value, unit }] }`
- **Purpose**: Creates new version (edit)
- **Success (201)**: `{ versionId, versionNumber, status: 'DRAFT' }`
- **Errors**: 403 (Not staff), 404 (Not found), 422 (Validation)

#### `POST /api/health-checks/versions/:versionId/sign`
- **Auth**: Reviewer
- **Request**: `{ reviewerUsername: string, reviewerPassword: string }`
- **Success (200)**: `{ versionId, status: 'REVIEWED', signedBy, signedAt }`
- **Errors**: 401 (Invalid credentials), 403 (Not reviewer), 404 (Not found), 409 (Already signed, not DRAFT status), 423 (Account locked)

#### `GET /api/health-checks/:id/compare`
- **Auth**: Staff, Reviewer, Admin
- **Query**: `?versionA=...&versionB=...` or `?dateA=...&dateB=...`
- **Success (200)**: `{ comparison: [{ measurement, versionA: {...}, versionB: {...}, trend }] }`
- **Errors**: 403 (Unauthorized), 404 (Not found)

#### `GET /api/health-checks/versions/:versionId/pdf`
- **Auth**: Patient (own, REVIEWED only), Staff, Reviewer, Admin
- **Success (200)**: Binary PDF with `Content-Type: application/pdf`
- **Errors**: 403 (Unauthorized), 404 (Not found), 500 (PDF integrity check failed)

### 6.7 Notification Module

#### `GET /api/notifications`
- **Auth**: Authenticated (own notifications)
- **Query**: `?read=false&type=...&page=1&pageSize=20`
- **Success (200)**: `{ items: Notification[], total, page, pageSize, unreadCount }`

#### `GET /api/notifications/count`
- **Auth**: Authenticated
- **Success (200)**: `{ unreadCount: number }`

#### `PATCH /api/notifications/:id/read`
- **Auth**: Authenticated (own notification)
- **Success (200)**: `{ id, read: true, readAt }`
- **Errors**: 403 (Not own notification), 404 (Not found)

#### `POST /api/notifications/mark-all-read`
- **Auth**: Authenticated
- **Success (200)**: `{ updatedCount: number }`

### 6.8 Content Module

#### `POST /api/content`
- **Auth**: Admin
- **Request**: `{ title, type, body?, mediaFiles? }` (multipart/form-data for media)
- **Success (201)**: `{ contentId, versionId, status: 'DRAFT' }`
- **Errors**: 403 (Not admin), 413 (File too large), 415 (Unsupported type), 422 (Validation)

#### `GET /api/content`
- **Auth**: Authenticated
- **Query**: `?status=PUBLISHED&type=ARTICLE&page=1&pageSize=20`
- **Success (200)**: `{ items: Content[], total, page, pageSize }`
- **Note**: Patients automatically filtered to PUBLISHED only

#### `GET /api/content/:id`
- **Auth**: Authenticated (PUBLISHED for patients, all statuses for Admin)
- **Success (200)**: Full content with current version
- **Errors**: 403 (Patient accessing non-published), 404 (Not found)

#### `PATCH /api/content/:id`
- **Auth**: Admin
- **Request**: `{ title?, body?, mediaFiles? }` (creates new version)
- **Success (200)**: `{ contentId, versionId, versionNumber }`
- **Errors**: 403 (Not admin), 404 (Not found)

#### `POST /api/content/:id/submit-for-review`
- **Auth**: Admin
- **Success (200)**: `{ contentId, status: 'PENDING_REVIEW', sensitiveWordWarnings? }`
- **Errors**: 403 (Not admin), 404 (Not found), 409 (Not in DRAFT status)

#### `POST /api/content/:id/publish`
- **Auth**: Admin
- **Success (200)**: `{ contentId, status: 'PUBLISHED', publishedAt }`
- **Errors**: 403 (Not admin), 404 (Not found), 409 (Not in PENDING_REVIEW status)

#### `POST /api/content/:id/withdraw`
- **Auth**: Admin
- **Success (200)**: `{ contentId, status: 'WITHDRAWN', withdrawnAt }`
- **Errors**: 403 (Not admin), 404 (Not found), 409 (Not in PUBLISHED status)

#### `GET /api/content/:id/versions`
- **Auth**: Admin
- **Success (200)**: `{ versions: ContentVersion[] }`
- **Errors**: 403 (Not admin), 404 (Not found)

#### `GET /api/content/media/:filename`
- **Auth**: Authenticated
- **Success (200)**: Binary file with appropriate Content-Type
- **Errors**: 404 (File not found)

### 6.9 Risk & Security Module

#### `GET /api/risk/events`
- **Auth**: Admin
- **Query**: `?type=...&severity=...&page=1&pageSize=20`
- **Success (200)**: `{ items: RiskEvent[], total, page, pageSize }`
- **Errors**: 403 (Not admin)

#### `GET /api/risk/incidents`
- **Auth**: Admin
- **Query**: `?status=OPEN&severity=...&page=1&pageSize=20`
- **Success (200)**: `{ items: IncidentTicket[], total, page, pageSize }`
- **Errors**: 403 (Not admin)

#### `GET /api/risk/incidents/:id`
- **Auth**: Admin
- **Success (200)**: Full incident with hit logs
- **Errors**: 403 (Not admin), 404 (Not found)

#### `PATCH /api/risk/incidents/:id`
- **Auth**: Admin
- **Request**: `{ status: IncidentStatus, resolutionNotes?, assignedTo? }`
- **Success (200)**: Updated incident
- **Errors**: 403 (Not admin), 404 (Not found), 409 (Invalid status transition)

#### `GET /api/risk/ip-rules`
- **Auth**: Admin
- **Success (200)**: `{ items: IpRule[] }`
- **Errors**: 403 (Not admin)

#### `POST /api/risk/ip-rules`
- **Auth**: Admin
- **Request**: `{ ip: string, type: 'ALLOW'|'DENY', description? }`
- **Success (201)**: Created IP rule
- **Errors**: 403 (Not admin), 409 (IP already exists), 422 (Invalid IP/CIDR)

#### `DELETE /api/risk/ip-rules/:id`
- **Auth**: Admin
- **Success (200)**: `{ deleted: true }`
- **Errors**: 403 (Not admin), 404 (Not found)

#### `GET /api/risk/device-fingerprints`
- **Auth**: Admin
- **Query**: `?userId=...`
- **Success (200)**: `{ items: DeviceFingerprint[] }`
- **Errors**: 403 (Not admin)

#### `GET /api/auth/captcha`
- **Auth**: Public (triggered when CAPTCHA required)
- **Success (200)**: `{ challengeId, imageBase64, type }`

### 6.10 Service Items

#### `GET /api/service-items`
- **Auth**: Authenticated
- **Query**: `?active=true&page=1&pageSize=20`
- **Success (200)**: `{ items: ServiceItem[], total, page, pageSize }`

#### `POST /api/service-items`
- **Auth**: Admin
- **Request**: `{ name, description, unitPrice, seatQuota? }`
- **Success (201)**: Created service item
- **Errors**: 403 (Not admin), 422 (Validation)

#### `PATCH /api/service-items/:id`
- **Auth**: Admin
- **Request**: `{ name?, description?, unitPrice?, seatQuota?, active? }`
- **Success (200)**: Updated service item
- **Errors**: 403 (Not admin), 404 (Not found), 422 (Validation)

### 6.11 Report Templates

#### `GET /api/report-templates`
- **Auth**: Staff, Reviewer, Admin
- **Query**: `?active=true`
- **Success (200)**: `{ items: ReportTemplate[] }`

#### `POST /api/report-templates`
- **Auth**: Admin
- **Request**: `{ name, description, measurements: [...] }`
- **Success (201)**: Created template
- **Errors**: 403 (Not admin), 422 (Validation)

#### `PATCH /api/report-templates/:id`
- **Auth**: Admin
- **Request**: `{ name?, description?, measurements?, active? }`
- **Success (200)**: Updated template
- **Errors**: 403 (Not admin), 404 (Not found)

### 6.12 Health Check Endpoint

#### `GET /api/health`
- **Auth**: Public
- **Success (200)**: `{ status: 'ok', version: string, timestamp: string, database: 'connected' }`
- **Error (503)**: `{ status: 'error', database: 'disconnected' }`

---

## 7. State Transitions

### 7.1 Enrollment State Machine

```
        ┌─────────┐
        │  DRAFT  │ ◄── Create enrollment
        └────┬────┘
             │ Submit (creates order)
             ▼
      ┌──────────────┐
      │  SUBMITTED   │ ◄── Order canceled (can resubmit)
      └──────┬───────┘
             │ Order PAID
             ▼
        ┌─────────┐
        │  ACTIVE  │ (terminal state)
        └─────────┘

Valid transitions:
  DRAFT → DRAFT (update)
  DRAFT → SUBMITTED (submit)
  SUBMITTED → ACTIVE (order paid)
  SUBMITTED → SUBMITTED (order canceled, enrollment stays submitted)

Invalid transitions (must be rejected):
  SUBMITTED → DRAFT
  ACTIVE → any
  DRAFT → ACTIVE (must go through SUBMITTED)
```

### 7.2 Order State Machine

```
        ┌───────────────────┐
        │  PENDING_PAYMENT  │ ◄── Created from enrollment submission
        └────────┬──────────┘
                 │
        ┌────────┴─────────┐
        │                  │
        ▼                  ▼
   ┌─────────┐      ┌───────────┐
   │  PAID   │      │ CANCELED  │ (auto-cancel 30min or manual)
   └────┬────┘      └───────────┘
        │
        ▼
┌─────────────────┐
│ REFUND_REQUESTED│
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌──────┐
│REFUNDED │ │ PAID │ (refund denied)
└─────────┘ └──────┘

Valid transitions:
  PENDING_PAYMENT → PAID
  PENDING_PAYMENT → CANCELED
  PAID → REFUND_REQUESTED
  REFUND_REQUESTED → REFUNDED
  REFUND_REQUESTED → PAID (denial)

Invalid transitions (must be rejected):
  CANCELED → any
  REFUNDED → any
  PAID → PENDING_PAYMENT
  PAID → CANCELED (must go through refund process)
```

### 7.3 Payment State Machine

```
  ┌───────────┐
  │ RECORDED  │ ◄── Payment registered
  └─────┬─────┘
        │ Refund requested
        ▼
┌─────────────────┐
│ REFUND_REQUESTED│
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌───────────┐
│REFUNDED │ │ RECORDED  │ (denial)
└─────────┘ └───────────┘
```

### 7.4 Health-Check Report State Machine

```
HealthCheckVersion:

  ┌─────────┐
  │  DRAFT  │ ◄── Version created (new or edit)
  └────┬────┘
       │ Reviewer e-signs
       ▼
  ┌──────────┐
  │ REVIEWED │ (locked, immutable)
  └──────────┘

  ┌─────────┐
  │  DRAFT  │ ──── 24h SLA passes ────►  ┌──────────────┐
  └─────────┘                              │ SLA_BREACHED │
                                           └──────────────┘
                                                  │ Reviewer signs
                                                  ▼
                                           ┌──────────┐
                                           │ REVIEWED │
                                           └──────────┘

Valid transitions:
  DRAFT → REVIEWED (e-signature)
  DRAFT → SLA_BREACHED (24h without signature)
  SLA_BREACHED → REVIEWED (late signature)

Invalid transitions:
  REVIEWED → any (immutable)
```

### 7.5 Content Publishing State Machine

```
  ┌─────────┐
  │  DRAFT  │ ◄── Create / Return for edits / Re-edit after withdrawal
  └────┬────┘
       │ Submit for review
       ▼
┌────────────────┐
│ PENDING_REVIEW │
└────────┬───────┘
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────────┐ ┌─────────┐
│ PUBLISHED │ │  DRAFT  │ (rejected)
└─────┬─────┘ └─────────┘
      │ Withdraw
      ▼
┌───────────┐
│ WITHDRAWN │
└─────┬─────┘
      │ Re-edit
      ▼
┌─────────┐
│  DRAFT  │
└─────────┘

Valid transitions:
  DRAFT → PENDING_REVIEW
  PENDING_REVIEW → PUBLISHED
  PENDING_REVIEW → DRAFT (reject)
  PUBLISHED → WITHDRAWN
  WITHDRAWN → DRAFT (re-edit)

Invalid transitions:
  DRAFT → PUBLISHED (must go through review)
  WITHDRAWN → PUBLISHED (must go through draft → review)
```

### 7.6 Incident Ticket State Machine

```
  ┌──────┐
  │ OPEN │ ◄── Created from risk event
  └──┬───┘
     │
┌────┴───────────────┐
│                    │
▼                    ▼
┌──────────────┐  ┌───────────┐
│ ACKNOWLEDGED │  │ DISMISSED │
└──────┬───────┘  └───────────┘
       │
       ▼
┌───────────────┐
│ INVESTIGATING │
└──────┬────────┘
  ┌────┴────┐
  │         │
  ▼         ▼
┌──────────┐ ┌───────────┐
│ RESOLVED │ │ DISMISSED │
└──────────┘ └───────────┘

Valid transitions:
  OPEN → ACKNOWLEDGED
  OPEN → DISMISSED
  ACKNOWLEDGED → INVESTIGATING
  INVESTIGATING → RESOLVED
  INVESTIGATING → DISMISSED

Invalid transitions:
  RESOLVED → any (terminal)
  DISMISSED → any (terminal)
```

### 7.7 Seat Reservation State Machine

```
  ┌──────┐
  │ HELD │ ◄── Created when patient selects service
  └──┬───┘
     │
┌────┴──────────────────────┐
│              │             │
▼              ▼             ▼
┌───────────┐ ┌─────────┐ ┌──────────┐
│ CONFIRMED │ │ EXPIRED │ │ RELEASED │
└───────────┘ └─────────┘ └──────────┘
(order paid)  (60min TTL) (order canceled)
```

---

## 8. Permission & Access Boundaries

### 8.1 Role-Permission Matrix

| Resource / Action | Patient | Staff | Admin | Reviewer |
|-------------------|---------|-------|-------|----------|
| **Auth** |
| Login | Yes | Yes | Yes | Yes |
| Register new user | No | Patients only | All roles | No |
| View own profile | Yes | Yes | Yes | Yes |
| View all users | No | No | Yes | No |
| Manage users (enable/disable) | No | No | Yes | No |
| **Enrollment** |
| Create enrollment | Own | For any patient | For any patient | No |
| Edit draft enrollment | Own | Yes | Yes | No |
| Submit enrollment | Own | Yes | Yes | No |
| View enrollment | Own | All | All | No |
| **Orders** |
| View orders | Own | All | All | No |
| Cancel order | No | Yes | Yes | No |
| View discount audit | No | Yes | Yes | No |
| **Promotions** |
| View active promotions | Yes | Yes | Yes | Yes |
| Create/Edit/Deactivate rules | No | No | Yes | No |
| **Payments** |
| Record payment | No | Yes | Yes | No |
| Request refund | No | Yes | Yes | No |
| Approve refund | No | Supervisor only | Yes | No |
| Deny refund | No | Supervisor only | Yes | No |
| View payment history | Own (status only) | Yes | Yes | No |
| **Health Checks** |
| Capture results | No | Yes | No | No |
| Edit (create version) | No | Yes | No | No |
| Sign version (e-signature) | No | No | No | Yes |
| View reports | Own (reviewed only) | All | All | All |
| Compare versions | No | Yes | Yes | Yes |
| Export PDF | Own (reviewed only) | Yes | Yes | Yes |
| **Notifications** |
| View own notifications | Yes | Yes | Yes | Yes |
| Mark as read | Own | Own | Own | Own |
| **Content** |
| Browse published | Yes | Yes | Yes | Yes |
| Create/Edit content | No | No | Yes | No |
| Submit for review | No | No | Yes | No |
| Publish/Withdraw | No | No | Yes | No |
| View content versions | No | No | Yes | No |
| **Risk & Security** |
| View risk dashboard | No | No | Yes | No |
| Manage incidents | No | No | Yes | No |
| Manage IP rules | No | No | Yes | No |
| View device fingerprints | No | No | Yes | No |
| **Service Items** |
| View | Yes | Yes | Yes | Yes |
| Create/Edit | No | No | Yes | No |
| **Report Templates** |
| View | No | Yes | Yes | Yes |
| Create/Edit | No | No | Yes | No |

### 8.2 Object-Level Authorization Rules

1. **Patient data isolation**: Patients can only access their own enrollments, orders, health-check reports, and notifications. Every query for a Patient user is scoped to `WHERE patient_id = :currentUserId` (or equivalent).

2. **Health-check visibility**: Patients see only REVIEWED versions of their health checks. DRAFT and SLA_BREACHED versions are not visible to patients.

3. **Notification isolation**: Users can only see and interact with their own notifications. No cross-user notification access.

4. **Content visibility**: Patients (and all non-Admin roles) see only PUBLISHED content. Draft, pending review, and withdrawn content visible only to Admin.

5. **Staff scope**: Staff can view all patient data (enrollments, orders, health checks) but cannot modify data owned by other staff members' user accounts.

6. **Admin scope**: Full access to all resources.

### 8.3 Supervisor Override Rules

1. **Refund approval** requires `can_approve_refunds = true` on the Staff user, or Admin role.
2. **Supervisor override modal** requires re-authentication (username + password entry, not session reuse).
3. **Failed supervisor override attempts** are tracked and subject to the same 5-attempt lockout rule.
4. **Supervisor override is logged** in the payment audit trail with supervisor user ID and timestamp.

---

## 9. Failure Paths

### 9.1 Authentication Module

| Scenario | HTTP Code | Response | Behavior |
|----------|-----------|----------|----------|
| Wrong username | 401 | `{ error: 'Invalid credentials' }` | Generic message (don't reveal if username exists) |
| Wrong password | 401 | `{ error: 'Invalid credentials' }` | Increment failed attempts |
| Account locked | 423 | `{ error: 'Account locked', retryAfter: minutes }` | Include retry countdown |
| Account disabled | 403 | `{ error: 'Account disabled' }` | Contact administrator |
| Expired access token | 401 | `{ error: 'Token expired' }` | Frontend triggers refresh |
| Invalid refresh token | 401 | `{ error: 'Invalid refresh token' }` | Redirect to login |
| Weak password (< 12 chars) | 422 | `{ error: 'Password must be at least 12 characters' }` | Prevent registration |
| Duplicate username | 409 | `{ error: 'Username already taken' }` | Prompt for different username |
| CAPTCHA required | 428 | `{ error: 'CAPTCHA required', challengeId, imageBase64 }` | Show CAPTCHA |
| Rate limited | 429 | `{ error: 'Too many requests', retryAfter }` | Include Retry-After header |

### 9.2 Enrollment Module

| Scenario | HTTP Code | Response | Behavior |
|----------|-----------|----------|----------|
| Missing required fields | 422 | `{ error: 'Validation failed', fields: {...} }` | Field-level errors |
| Seats unavailable | 409 | `{ error: 'No seats available for [service]' }` | Disable service selection |
| Enrollment not in DRAFT | 409 | `{ error: 'Enrollment is not in DRAFT status' }` | Prevent submission |
| Already submitted | 409 | `{ error: 'Enrollment already submitted' }` | Show existing order |
| Reservation expired on submit | 409 | `{ error: 'Seat reservations expired' }` | Prompt re-selection |
| Access to other patient's data | 403 | `{ error: 'Forbidden' }` | Do not reveal data existence |
| Enrollment not found | 404 | `{ error: 'Enrollment not found' }` | Standard not found |

### 9.3 Order Module

| Scenario | HTTP Code | Response | Behavior |
|----------|-----------|----------|----------|
| Order not found | 404 | `{ error: 'Order not found' }` | Standard not found |
| Order not cancelable | 409 | `{ error: 'Order cannot be canceled in current status' }` | Show current status |
| Access denied | 403 | `{ error: 'Forbidden' }` | Do not reveal data |
| Order already paid | 409 | `{ error: 'Order already paid' }` | On duplicate cancel attempt |

### 9.4 Promotion Module

| Scenario | HTTP Code | Response | Behavior |
|----------|-----------|----------|----------|
| End date before start date | 422 | `{ error: 'End date must be after start date' }` | Validation |
| Invalid discount type | 422 | `{ error: 'Invalid discount type' }` | Validation |
| Rule not found | 404 | `{ error: 'Promotion rule not found' }` | Standard |
| Not admin | 403 | `{ error: 'Forbidden' }` | Role check |

### 9.5 Payment Module

| Scenario | HTTP Code | Response | Behavior |
|----------|-----------|----------|----------|
| Order not PENDING_PAYMENT | 409 | `{ error: 'Order is not awaiting payment' }` | State check |
| Duplicate payment | 409 | `{ error: 'Payment already recorded' }` | Idempotency |
| Invalid supervisor credentials | 401 | `{ error: 'Invalid supervisor credentials' }` | Override failure |
| Not supervisor | 403 | `{ error: 'Supervisor approval required' }` | Role + flag check |
| Refund on non-paid order | 409 | `{ error: 'Order must be PAID for refund' }` | State check |
| Supervisor locked | 423 | `{ error: 'Supervisor account locked' }` | Lockout |

### 9.6 Health-Check Module

| Scenario | HTTP Code | Response | Behavior |
|----------|-----------|----------|----------|
| Edit signed version | 403 | `{ error: 'Signed versions cannot be modified' }` | Immutability |
| Invalid reviewer credentials | 401 | `{ error: 'Invalid credentials' }` | E-signature failure |
| Not reviewer role | 403 | `{ error: 'Only reviewers can sign reports' }` | Role check |
| PDF integrity failure | 500 | `{ error: 'PDF integrity check failed' }` | Checksum mismatch, log ERROR |
| Template not found | 404 | `{ error: 'Report template not found' }` | Standard |
| Patient not found | 404 | `{ error: 'Patient not found' }` | Standard |
| Patient accessing DRAFT report | 403 | `{ error: 'Report not yet reviewed' }` | Visibility rule |

### 9.7 Notification Module

| Scenario | HTTP Code | Response | Behavior |
|----------|-----------|----------|----------|
| Access other user's notification | 403 | `{ error: 'Forbidden' }` | Object-level auth |
| Notification not found | 404 | `{ error: 'Notification not found' }` | Standard |
| Frequency limit reached | N/A (system) | Notification suppressed | Logged at INFO |

### 9.8 Content Module

| Scenario | HTTP Code | Response | Behavior |
|----------|-----------|----------|----------|
| Publish without review | 422 | `{ error: 'Content must be reviewed before publishing' }` | Workflow enforcement |
| File too large | 413 | `{ error: 'File exceeds maximum size' }` | Upload rejection |
| Unsupported media type | 415 | `{ error: 'Unsupported media type' }` | Upload rejection |
| Patient accessing non-published | 403 | `{ error: 'Content not available' }` | Visibility rule |
| Invalid status transition | 409 | `{ error: 'Invalid status transition' }` | State machine |

### 9.9 Risk Module

| Scenario | HTTP Code | Response | Behavior |
|----------|-----------|----------|----------|
| Invalid IP/CIDR | 422 | `{ error: 'Invalid IP address or CIDR range' }` | Validation |
| Duplicate IP rule | 409 | `{ error: 'IP rule already exists' }` | Uniqueness |
| Invalid incident transition | 409 | `{ error: 'Invalid status transition' }` | State machine |
| Not admin | 403 | `{ error: 'Forbidden' }` | Role check |

---

## 10. Logging Strategy

### 10.1 Log Levels and Usage

| Level | When to Use | Examples |
|-------|------------|---------|
| **ERROR** | System-level failures requiring attention | Database connection failure, PDF integrity mismatch, unhandled exception, migration failure |
| **WARN** | Abnormal but recoverable situations | SLA breach detected, rate limit exceeded, CAPTCHA triggered, notification target not found, failed login attempt |
| **INFO** | Normal business operations | User login (username only), order created, payment recorded, enrollment submitted, auto-cancel executed, promotion evaluated, content published |

### 10.2 What NEVER to Log

- Passwords (plain or hashed)
- JWT tokens (access or refresh)
- Payment reference numbers
- Medical record values (health-check results)
- Personal details (addresses, phone numbers, SSN, medical IDs)
- Encryption keys
- Full request/response bodies containing PII
- Device fingerprint raw attributes (only hash)

### 10.3 Log Format

All logs use Winston structured JSON format:

```json
{
  "timestamp": "2026-04-01T12:00:00.000Z",
  "level": "info",
  "category": "auth",
  "message": "User login successful",
  "context": {
    "userId": "uuid",
    "username": "jdoe",
    "ipAddress": "192.168.1.100",
    "action": "LOGIN"
  },
  "requestId": "uuid",
  "duration": 45
}
```

### 10.4 Log Categories

| Category | Covers |
|----------|--------|
| `auth` | Login, logout, token refresh, lockout, CAPTCHA |
| `enrollment` | Enrollment CRUD, submission |
| `order` | Order creation, cancellation, auto-cancel |
| `promotion` | Rule evaluation, discount application |
| `payment` | Payment recording, refund request/approval/denial |
| `health-check` | Result capture, version creation, signing, PDF export |
| `notification` | Creation, delivery, frequency suppression |
| `content` | CRUD, publish, withdraw, sensitive word check |
| `risk` | Rate limiting, anomaly detection, incidents, IP rules |
| `system` | Startup, shutdown, migration, health check, cron jobs |

### 10.5 PII Scrubbing

Winston format function scrubs PII before writing:

- Replace any field named `password`, `passwordHash`, `token`, `accessToken`, `refreshToken` with `[REDACTED]`
- Replace `referenceNumber` with `[ENCRYPTED]`
- Replace `personalDetails` with `[PII]`
- Replace health-check `value` and `notes` with `[MEDICAL]`
- IP addresses are logged (not PII in clinic context, used for security)
- Usernames are logged (needed for audit trail)

---

## 11. Testing Strategy

### 11.1 Coverage Target

**90% code coverage** across all modules. Coverage is measured via Istanbul/NYC through Jest.

### 11.2 Unit Test Strategy

Unit tests target the domain layer and pure business logic. They run without database, network, or framework dependencies.

| Module | Unit Test Focus |
|--------|----------------|
| Auth | Password validation (length, edge cases), JWT generation/parsing, lockout timing, attempt counter |
| Enrollment | State transition validation, enrollment completeness check |
| Order | Total calculation, line item math, auto-cancel eligibility |
| Promotion | All discount types (percentage, BOGO, fixed, tiered, second-item), mutual exclusion, priority sort, determinism, edge cases (zero amounts, single items) |
| Payment | State transitions, idempotency, supervisor flag check |
| Health Check | Reference range comparison, abnormal flag logic, version numbering, SLA deadline calculation |
| Notification | Frequency limit calculation (within/outside 24h window) |
| Content | State transitions, sensitive-word regex matching |
| Risk | Rate limit window logic, anomaly threshold detection, CIDR matching, CAPTCHA generation/validation |
| Shared | Zod schema validation (valid/invalid inputs for every schema) |

**Edge cases to cover in unit tests:**
- Boundary values (exactly 12 character password, exactly 30 minute old order, exactly 24 hour SLA)
- Empty collections (no line items, no promotions, no results)
- Maximum values (largest discount, most items)
- Concurrent-like scenarios (state already changed)
- Decimal precision (rounding in money calculations)

### 11.3 Integration Test Strategy

Integration tests verify that components work together with real database and services, running inside Docker.

| Module | Integration Test Focus |
|--------|----------------------|
| Auth | Full login flow with DB, lockout persistence, token refresh with DB |
| Enrollment | Enrollment CRUD persistence, submission with order creation, seat reservation |
| Order | Order creation with line items, auto-cancel cron execution |
| Promotion | Rule persistence, evaluation with DB lookups, immutable audit trail (verify UPDATE/DELETE fail) |
| Payment | Payment recording with order/enrollment updates, refund with supervisor credential validation |
| Health Check | Health check with version history, e-signature persistence, PDF generation, SLA cron |
| Notification | Notification delivery tracking, frequency limit with DB |
| Content | Content CRUD, media file storage, versioning |
| Risk | Rate limit with Redis/in-memory store, IP rule enforcement, anomaly detection with DB |

### 11.4 E2E Test Strategy (Playwright)

E2E tests verify user-facing workflows through the browser.

| Module | E2E Tests |
|--------|-----------|
| Auth | Login page → success → dashboard; Login → failure → error; Login → lockout → countdown; Protected route → redirect to login |
| Enrollment | Create draft → save → reload → data persists; Submit enrollment → see checkout |
| Order | Checkout page shows line items and discounts; Order list with filtering |
| Payment | Staff records payment → order status updates; Refund request → supervisor override modal |
| Health Check | Staff captures results → abnormal flags show; Reviewer signs → status changes; PDF export downloads file |
| Notification | Bell shows count → click → inbox; Mark as read → count decrements |
| Content | Admin creates article → publish → patient sees in browse; Sensitive word warning modal |
| Risk | Admin views dashboard → incident list; IP rule management |
| Cross-module | Full patient journey (register → enroll → pay → health check → PDF → notifications) |

**E2E Failure path tests:**
- 401: Access protected page without login → redirect
- 403: Patient attempts admin page → forbidden message
- 404: Navigate to nonexistent resource → not found page
- 422: Submit form with invalid data → field errors displayed
- 429: Rapid requests → rate limit message
- 500: API error → generic error page (verify no stack trace in UI)

### 11.5 Docker Verification

Every module must pass Docker verification:

1. `docker compose up --build` succeeds
2. API health check returns 200
3. Frontend loads without errors
4. Database has expected schema
5. Seed data present

### 11.6 `run_tests.sh` Specification

```bash
#!/bin/bash
set -e  # Exit on first failure

echo "=== Building test containers ==="
docker compose -f docker-compose.test.yml up --build -d

echo "=== Waiting for services ==="
# Wait for API health check
until curl -sf http://localhost:3000/api/health; do sleep 1; done

echo "=== Running unit tests ==="
docker compose -f docker-compose.test.yml exec api npm run test:unit -- --coverage

echo "=== Running integration tests ==="
docker compose -f docker-compose.test.yml exec api npm run test:integration -- --coverage

echo "=== Running E2E tests ==="
docker compose -f docker-compose.test.yml exec playwright npx playwright test

echo "=== Generating coverage report ==="
docker compose -f docker-compose.test.yml exec api npm run test:coverage-report

echo "=== Checking coverage threshold ==="
docker compose -f docker-compose.test.yml exec api npm run test:coverage-check -- --threshold 90

echo "=== Tearing down ==="
docker compose -f docker-compose.test.yml down -v

echo "=== All tests passed ==="
exit 0
```

Returns non-zero exit code if any step fails (due to `set -e`).

---

## 12. README & Operational Documentation

### 12.1 README Must Contain

1. **Project title and description**: What CHECC is and who it serves
2. **Prerequisites**: Docker, Docker Compose, Node.js (for local dev), Git
3. **Quick Start**:
   - Clone repository
   - Copy `.env.example` to `.env`
   - `docker compose up --build`
   - Access frontend at `http://localhost:5173`
   - Access API at `http://localhost:3000`
   - Default admin credentials (for development only)
4. **Architecture Overview**: Brief description with link to full architecture doc
5. **Monorepo Structure**: Directory tree with descriptions
6. **Development**:
   - `nx serve api` — start API in dev mode
   - `nx serve web` — start frontend in dev mode
   - `nx run-many --target=lint` — lint all projects
   - `nx run-many --target=test` — run unit tests
7. **Testing**: `./run_tests.sh` as canonical test command
8. **Database**:
   - Migrations: `nx run api:migration:generate`
   - Seed: `nx run api:seed`
9. **Environment Variables**: Table of all required env vars with descriptions
10. **API Documentation**: Link to API interface contracts (or auto-generated docs)
11. **Module Status**: Checklist of modules with completion status

### 12.2 API Documentation Approach

- API contracts defined in this development plan (Section 6)
- Zod schemas serve as living documentation
- Each endpoint documented in code via JSDoc comments on controllers
- Consider Swagger/OpenAPI generation from NestJS decorators for browsable API docs (offline, no external hosting)

### 12.3 Architecture Overview Documentation

A separate `docs/architecture.md` file containing:
- System context diagram (text-based)
- Container diagram (Docker services)
- Component diagram (backend modules)
- Data flow diagrams for key workflows (enrollment-to-payment, health-check-to-PDF)
- Security architecture (auth flow, encryption at rest, rate limiting)

---

## 13. Docker Execution Model

### 13.1 `docker-compose.yml` Service Definitions

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: checc-postgres
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./.docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "${DB_PORT:-5432}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: .docker/api.Dockerfile
    container_name: checc-api
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: ${DB_NAME}
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRY: ${JWT_EXPIRY:-15m}
      JWT_REFRESH_EXPIRY: ${JWT_REFRESH_EXPIRY:-7d}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      LOG_LEVEL: ${LOG_LEVEL:-info}
      AUTO_MIGRATE: "true"
      AUTO_SEED: ${AUTO_SEED:-false}
    ports:
      - "${API_PORT:-3000}:3000"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - pdf_storage:/app/storage/pdfs
      - media_storage:/app/storage/media
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: .docker/web.Dockerfile
    container_name: checc-web
    environment:
      VITE_API_URL: ${VITE_API_URL:-http://localhost:3000}
    ports:
      - "${WEB_PORT:-5173}:80"
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped

volumes:
  postgres_data:
  pdf_storage:
  media_storage:
```

### 13.2 `docker-compose.test.yml` (Test Environment)

```yaml
version: '3.8'

services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
      POSTGRES_DB: checc_test
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test_user"]
      interval: 3s
      timeout: 3s
      retries: 5
    tmpfs:
      - /var/lib/postgresql/data  # RAM-backed for speed

  api:
    build:
      context: .
      dockerfile: .docker/api.Dockerfile
      target: test
    environment:
      NODE_ENV: test
      DB_HOST: postgres-test
      DB_PORT: 5432
      DB_USER: test_user
      DB_PASSWORD: test_password
      DB_NAME: checc_test
      JWT_SECRET: test-jwt-secret-for-ci-only
      ENCRYPTION_KEY: test-encryption-key-32chars!!
      AUTO_MIGRATE: "true"
      AUTO_SEED: "true"
    depends_on:
      postgres-test:
        condition: service_healthy
    ports:
      - "3000:3000"

  web:
    build:
      context: .
      dockerfile: .docker/web.Dockerfile
    environment:
      VITE_API_URL: http://api:3000
    depends_on:
      - api
    ports:
      - "5173:80"

  playwright:
    build:
      context: .
      dockerfile: .docker/playwright.Dockerfile
    environment:
      BASE_URL: http://web:80
      API_URL: http://api:3000
    depends_on:
      - web
    volumes:
      - ./playwright-results:/app/playwright-results
```

### 13.3 Volume Mounts

| Volume | Purpose | Mount Point |
|--------|---------|-------------|
| `postgres_data` | PostgreSQL data persistence | `/var/lib/postgresql/data` |
| `pdf_storage` | Generated PDF reports | `/app/storage/pdfs` |
| `media_storage` | Uploaded content media files | `/app/storage/media` |

### 13.4 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_USER` | Yes | - | PostgreSQL username |
| `DB_PASSWORD` | Yes | - | PostgreSQL password |
| `DB_NAME` | Yes | - | PostgreSQL database name |
| `DB_PORT` | No | `5432` | PostgreSQL port |
| `JWT_SECRET` | Yes | - | Secret for JWT signing (256-bit minimum) |
| `JWT_EXPIRY` | No | `15m` | Access token expiry duration |
| `JWT_REFRESH_EXPIRY` | No | `7d` | Refresh token expiry duration |
| `ENCRYPTION_KEY` | Yes | - | AES-256 encryption key (32 bytes, hex or base64) |
| `LOG_LEVEL` | No | `info` | Winston log level (error, warn, info) |
| `API_PORT` | No | `3000` | API server port |
| `WEB_PORT` | No | `5173` | Web server port |
| `NODE_ENV` | No | `production` | Node environment |
| `AUTO_MIGRATE` | No | `true` | Run TypeORM migrations on startup |
| `AUTO_SEED` | No | `false` | Run seed script on startup |
| `VITE_API_URL` | No | `http://localhost:3000` | API URL for frontend |

### 13.5 Health Checks

| Service | Endpoint / Command | Interval | Retries |
|---------|-------------------|----------|---------|
| PostgreSQL | `pg_isready -U ${DB_USER}` | 5s | 5 |
| API | `curl -f http://localhost:3000/api/health` | 10s | 5 |
| Web | `curl -f http://localhost:80` | 10s | 3 |

### 13.6 Auto-Migration on Startup

The API service runs TypeORM migrations automatically when `AUTO_MIGRATE=true`:

```typescript
// In main.ts or app initialization
if (process.env.AUTO_MIGRATE === 'true') {
  const dataSource = app.get(DataSource);
  await dataSource.runMigrations();
  logger.info('Database migrations completed');
}

if (process.env.AUTO_SEED === 'true') {
  const seeder = app.get(SeederService);
  await seeder.seed();
  logger.info('Database seeding completed');
}
```

### 13.7 `run_tests.sh` Behavior

1. Builds test Docker containers from `docker-compose.test.yml`
2. Starts PostgreSQL in RAM-backed tmpfs for speed
3. Waits for API health check
4. Runs unit tests with coverage
5. Runs integration tests with coverage
6. Runs Playwright E2E tests
7. Generates combined coverage report
8. Checks 90% coverage threshold
9. Tears down all containers and volumes
10. Exits with 0 on full success, non-zero on any failure
11. Supports CI/CD usage (no interactive prompts)

---

## 14. Prompt Coverage Verification Checklist

| # | Requirement | Module | Status |
|---|------------|--------|--------|
| 1 | React-based user experience | All frontend (Module 0 setup, all feature modules) | Planned |
| 2 | Three primary roles: Patient, Staff, Admin | Module 1 (Auth) | Planned |
| 3 | Reviewer role for clinical sign-off | Module 1 (Auth), Module 5 (Health Checks) | Planned |
| 4 | Browse cultural/wellness content (articles, galleries, audio, video) | Module 7 (Content) | Planned |
| 5 | Clean, accessible interface for content | Module 7 (Content), Module 9 (Polish) | Planned |
| 6 | Save drafts of enrollment applications | Module 2 (Enrollment) | Planned |
| 7 | Submit enrollment package with add-on services | Module 2 (Enrollment) | Planned |
| 8 | Add-on services (Annual Lab Panel, Nutrition Session) | Module 2 (Enrollment) | Planned |
| 9 | "Best offer applied" breakdown at checkout | Module 3 (Promotions) | Planned |
| 10 | Line-level discount reasoning | Module 3 (Promotions) | Planned |
| 11 | 10% off over $200, BOGO, 50% off second item | Module 3 (Promotions) | Planned |
| 12 | Prevent stacking when rules mutually exclusive | Module 3 (Promotions) | Planned |
| 13 | Structured health-check results capture | Module 5 (Health Checks) | Planned |
| 14 | Reference ranges and abnormal flags | Module 5 (Health Checks) | Planned |
| 15 | Compare against prior results by date | Module 5 (Health Checks) | Planned |
| 16 | Assemble reports from templates | Module 5 (Health Checks) | Planned |
| 17 | "Reviewed" status indicator on patient view | Module 5 (Health Checks) | Planned |
| 18 | One-click PDF export | Module 5 (Health Checks) | Planned |
| 19 | Admin manages promotion rules with effective windows | Module 3 (Promotions) | Planned |
| 20 | Draft–review–publish workflow for content | Module 7 (Content) | Planned |
| 21 | Sensitive-word warnings | Module 7 (Content) | Planned |
| 22 | In-app notification inbox | Module 6 (Notifications) | Planned |
| 23 | Due dates, overdue balances, hold pickups | Module 6 (Notifications) | Planned |
| 24 | Frequency limit: 3 reminders per item per 24 hours | Module 6 (Notifications) | Planned |
| 25 | NestJS backend with decoupled REST API | Module 0 (Infrastructure) | Planned |
| 26 | PostgreSQL as system of record | Module 0 (Infrastructure) | Planned |
| 27 | Offline "recorded payment" workflow | Module 4 (Payments) | Planned |
| 28 | Cash, check, manual card terminal methods | Module 4 (Payments) | Planned |
| 29 | Reference number capture | Module 4 (Payments) | Planned |
| 30 | Paid, Refunded, Canceled order statuses | Module 2 (Orders), Module 4 (Payments) | Planned |
| 31 | Auto-cancel after 30 minutes | Module 2 (Orders) | Planned |
| 32 | Refund requires reason code and supervisor confirmation | Module 4 (Payments) | Planned |
| 33 | Promotion priority, time window, mutual exclusion | Module 3 (Promotions) | Planned |
| 34 | Deterministic best discount computation | Module 3 (Promotions) | Planned |
| 35 | Immutable discount audit trail | Module 3 (Promotions) | Planned |
| 36 | Health-check version management | Module 5 (Health Checks) | Planned |
| 37 | Edits create new version | Module 5 (Health Checks) | Planned |
| 38 | Reviewer e-signature (username/password re-entry) | Module 5 (Health Checks) | Planned |
| 39 | 24-hour e-signature SLA | Module 5 (Health Checks) | Planned |
| 40 | Lock previous signed versions | Module 5 (Health Checks) | Planned |
| 41 | Username/password login with 12+ characters | Module 1 (Auth) | Planned |
| 42 | Lockout after 5 failed attempts for 15 minutes | Module 1 (Auth) | Planned |
| 43 | Device fingerprinting (Canvas, AudioContext, hardware) | Module 8 (Risk) | Planned |
| 44 | IP-based allow/deny lists | Module 8 (Risk) | Planned |
| 45 | Per-action rate limits (30 req/min/user) | Module 8 (Risk) | Planned |
| 46 | CAPTCHA for suspicious spikes (locally generated) | Module 8 (Risk) | Planned |
| 47 | Anomaly: promo abuse detection | Module 8 (Risk) | Planned |
| 48 | Anomaly: bulk registration detection | Module 8 (Risk) | Planned |
| 49 | Anomaly: repeated refund detection | Module 8 (Risk) | Planned |
| 50 | Risk alerts and incident tickets with hit logs | Module 8 (Risk) | Planned |
| 51 | Sensitive fields encrypted at rest | Module 0 (Infrastructure), Module 8 (Risk) | Planned |
| 52 | PDFs stored locally with checksum validation | Module 5 (Health Checks) | Planned |
| 53 | Fully offline — no external dependencies | All modules | Planned |
| 54 | Electron "Local Cloud" deployment | Module 0 (Infrastructure) | Planned |
| 55 | Supervisor = can_approve_refunds flag | Module 1 (Auth), Module 4 (Payments) | Planned |
| 56 | 1:N Enrollment→Orders relationship | Module 2 (Enrollment) | Planned |
| 57 | Enrollment DRAFT→SUBMITTED→ACTIVE | Module 2 (Enrollment) | Planned |
| 58 | Seat quotas with 60-minute soft reservations | Module 2 (Enrollment) | Planned |
| 59 | Auto-cancel cron every 5 minutes | Module 2 (Orders) | Planned |
| 60 | Header/Detail pattern for health checks | Module 5 (Health Checks) | Planned |
| 61 | SLA tracking: flag after 24h as Compliance Breach | Module 5 (Health Checks) | Planned |
| 62 | Sensitive word filter: Regex + soft-warning modal | Module 7 (Content) | Planned |
| 63 | Supervisor Override modal for refunds | Module 4 (Payments) | Planned |
| 64 | shadcn/ui + Tailwind CSS + Radix UI | Module 0 (Infrastructure) | Planned |
| 65 | Design tokens via CSS variables | Module 0 (Infrastructure), Module 9 (Polish) | Planned |
| 66 | 8px grid system | Module 0 (Infrastructure), Module 9 (Polish) | Planned |
| 67 | Nx monorepo | Module 0 (Infrastructure) | Planned |
| 68 | Zod schemas shared FE/BE | Module 0 (Infrastructure) | Planned |
| 69 | Winston structured logging | Module 0 (Infrastructure) | Planned |
| 70 | Docker + docker-compose | Module 0 (Infrastructure) | Planned |
| 71 | Jest unit/integration testing | Module 0 (Infrastructure) | Planned |
| 72 | Playwright E2E testing | Module 0 (Infrastructure), Module 9 | Planned |
| 73 | Clean/Hexagonal architecture | Module 0 (Infrastructure) | Planned |
| 74 | AuthN/AuthZ on every route | Module 1 (Auth) | Planned |
| 75 | Object-Level Authorization | Module 1 (Auth), all modules | Planned |
| 76 | Zero secret leakage, env vars only | Module 0 (Infrastructure) | Planned |
| 77 | PII scrubbed from logs | Module 0 (Infrastructure), Module 8 (Risk) | Planned |
| 78 | 90% coverage target | Module 9 (Testing) | Planned |
| 79 | TDD where practical | All modules | Planned |
| 80 | Global error handler | Module 0 (Infrastructure) | Planned |
| 81 | No TODO/Mock code in final delivery | Module 9 (Polish) | Planned |
| 82 | Skeleton/Spinner for all data fetching | All frontend modules | Planned |
| 83 | No layout shifts (CLS) | All frontend modules, Module 9 (Polish) | Planned |
| 84 | Lucide icons consistent weights | All frontend modules | Planned |
| 85 | Vertical slicing: module by module | Build sequence | Planned |
| 86 | run_tests.sh canonical entrypoint | Module 0 (Infrastructure) | Planned |

**Verification**: All 86 identified requirements from the original prompt and clarified decisions are mapped to specific modules. No requirements are missing from the plan.

---

## Appendix A: Module Build Sequence

Modules must be built in order due to dependencies:

1. **Module 0**: Infrastructure — foundation for everything
2. **Module 1**: Auth — required by all subsequent modules
3. **Module 2**: Enrollment & Ordering — core domain
4. **Module 3**: Promotions — depends on orders
5. **Module 4**: Payments & Refunds — depends on orders
6. **Module 5**: Health Checks — depends on auth and users
7. **Module 6**: Notifications — depends on multiple modules for event sources
8. **Module 7**: Content Publishing — relatively independent, but needs auth
9. **Module 8**: Risk Control — cross-cutting, integrates with auth and all modules
10. **Module 9**: Integration & Polish — final verification of everything

---

## Appendix B: Refund Reason Codes

| Code | Description |
|------|-------------|
| `PATIENT_REQUEST` | Patient requested cancellation |
| `SERVICE_UNAVAILABLE` | Service no longer available |
| `DUPLICATE_PAYMENT` | Duplicate payment recorded |
| `BILLING_ERROR` | Incorrect amount charged |
| `QUALITY_ISSUE` | Service quality complaint |
| `MEDICAL_REASON` | Medical reason preventing service |
| `OTHER` | Other reason (notes required) |

---

## Appendix C: Sensitive Word Filter Configuration

The sensitive word filter uses a configurable regex pattern list stored in the database or configuration file:

```json
{
  "patterns": [
    { "regex": "\\b(offensive_word_1)\\b", "severity": "HIGH" },
    { "regex": "\\b(caution_word_1|caution_word_2)\\b", "severity": "MEDIUM" },
    { "regex": "\\b(flagged_phrase_1)\\b", "severity": "LOW" }
  ]
}
```

- **HIGH** severity: Strongly recommended to edit before publishing
- **MEDIUM** severity: Review recommended
- **LOW** severity: Informational flag

All severities produce soft warnings (modal) — none are hard blocks. Admin can override any warning.

---

## Appendix D: CAPTCHA Challenge Types

### Math Challenge
- Generates simple arithmetic: `{a} + {b} = ?` or `{a} - {b} = ?`
- Rendered as distorted image via server-side Canvas
- Numbers between 1-99
- Solution is the numeric answer as string

### Text Challenge
- Generates 6-character alphanumeric string
- Rendered as distorted image with noise lines and color variation
- Case-insensitive comparison
- Characters chosen from easily distinguishable set (no 0/O, 1/l/I confusion)

### Challenge Lifecycle
- Challenges expire after 5 minutes
- Each challenge can be attempted once
- Failed attempt generates new challenge
- 5 consecutive failures lock the session for 15 minutes

---

## Appendix E: Cron Job Schedule

| Job | Schedule | Module | Description |
|-----|----------|--------|-------------|
| Auto-cancel unpaid orders | Every 5 minutes | Module 2 | Cancel PENDING_PAYMENT orders older than 30 minutes |
| Expire seat reservations | Every 5 minutes | Module 2 | Release HELD reservations past 60-minute TTL |
| SLA compliance check | Every 1 hour | Module 5 | Flag unsigned health-check versions past 24 hours |
| Notification frequency cleanup | Every 1 hour | Module 6 | Clean delivery records older than 48 hours |
| Rate limit window cleanup | Every 5 minutes | Module 8 | Clear expired rate limit counters |

---

*End of Development Plan Document*

---

### Critical Files for Implementation

These are the most critical files that must be created first and serve as the foundation for the entire system:

- `E:/Hale/Coding/Eaglepoint/Task-54/repo/docker-compose.yml` — Docker service orchestration; all services depend on this being correct
- `E:/Hale/Coding/Eaglepoint/Task-54/repo/libs/shared/src/schemas/` (directory) — Shared Zod schemas that define the contract between frontend and backend
- `E:/Hale/Coding/Eaglepoint/Task-54/repo/apps/api/src/core/domain/entities/` (directory) — Domain entities that encode all business rules without framework coupling
- `E:/Hale/Coding/Eaglepoint/Task-54/repo/apps/api/src/core/application/ports/` (directory) — Repository port interfaces that define the hexagonal architecture boundary
- `E:/Hale/Coding/Eaglepoint/Task-54/repo/run_tests.sh` — Canonical test entrypoint; defines how correctness is verified