# Delivery Acceptance and Architecture Audit

## 1. Verdict
- Pass

## 2. Scope and Verification Boundary
- Reviewed project documentation, backend/frontend architecture, key security guards/services, representative business-flow implementations, and test suites.
- Executed documented non-Docker verification commands: `npm run test:api`, `npm run test:web`, and `npm run build` (all succeeded).
- Did not execute Docker-based startup/acceptance flow (`docker compose up`, `./scripts/acceptance-test.sh`) per constraint.
- Full runtime behavior with PostgreSQL-backed API + UI was not end-to-end exercised in this audit; that remains partially unconfirmed.

## 3. Top Findings

### Finding 1
- Severity: Medium
- Conclusion: Full-stack E2E gate in the canonical test runner is misconfigured and can skip full-stack tests even when API is healthy.
- Brief rationale: The health probe checks `/api/health` against default `http://localhost:5173` (web port), not API port `3000`.
- Evidence: `run_tests.sh:48` sets `API_URL="${BASE_URL:-http://localhost:5173}"`; `run_tests.sh:49` probes `${API_URL}/api/health`.
- Impact: Full-stack E2E execution can be silently skipped, weakening confidence in integrated backend+frontend behavior.
- Minimum actionable fix: Change default probe base to API host/port (e.g., `http://localhost:3000`) or split `WEB_BASE_URL` and `API_BASE_URL` explicitly.

### Finding 2
- Severity: Medium
- Conclusion: E2E tests are present but mostly smoke-level and heavily gated; core failure/security journeys are not deeply covered at browser/integration level.
- Brief rationale: Tests primarily validate navigation/visibility and skip unless `FULL_STACK=true`; they do not cover critical failure outcomes (e.g., 401/403 UI handling, refund supervisor denial, expired-signature flow).
- Evidence: `apps/web/e2e/enrollment.spec.ts:6`, `apps/web/e2e/enrollment.spec.ts:13`, `apps/web/e2e/enrollment.spec.ts:22`, `apps/web/e2e/enrollment.spec.ts:29`, `apps/web/e2e/enrollment.spec.ts:38` use `test.skip(!fullStackAvailable, ...)`; tests assert page text/controls only (e.g., `apps/web/e2e/enrollment.spec.ts:9`, `apps/web/e2e/enrollment.spec.ts:17`).
- Impact: Reduced confidence in real user-critical paths under integrated runtime conditions.
- Minimum actionable fix: Add a minimal full-stack E2E set for one complete happy path and at least one auth/authorization failure path.

### Finding 3
- Severity: Low
- Conclusion: Local run instructions are mixed-platform and may be confusing for Windows-only execution without shell adaptation.
- Brief rationale: README uses Unix-style `export`/`open` in the local path while project is being audited in a Windows PowerShell environment.
- Evidence: `README.md:47`-`README.md:55` (`export ...`), `README.md:65` (`open http://localhost:5173`).
- Impact: Onboarding friction; does not block deliverable quality itself.
- Minimum actionable fix: Add a Windows PowerShell block (`$env:VAR=...`, `start http://localhost:5173`) alongside Unix examples.

## 4. Security Summary

### authentication
- Pass
- Evidence: Password policy enforces 12+ with complexity in `libs/shared/src/schemas/auth.schema.ts:20`-`libs/shared/src/schemas/auth.schema.ts:27`; account lockout after repeated failures in `apps/api/src/core/application/use-cases/auth.service.ts:201`-`apps/api/src/core/application/use-cases/auth.service.ts:214`; CAPTCHA escalation in `apps/api/src/core/application/use-cases/auth.service.ts:89`-`apps/api/src/core/application/use-cases/auth.service.ts:106`.

### route authorization
- Pass
- Evidence: Global guard chain configured in `apps/api/src/app.module.ts:35`-`apps/api/src/app.module.ts:50`; role checks in `apps/api/src/api/guards/roles.guard.ts:12`-`apps/api/src/api/guards/roles.guard.ts:35`; JWT guard in `apps/api/src/api/guards/jwt-auth.guard.ts:12`-`apps/api/src/api/guards/jwt-auth.guard.ts:29`.

### object-level authorization
- Pass
- Evidence: Ownership checks for enrollments/orders/notifications and report access are enforced in controllers/services (e.g., `apps/api/src/api/controllers/enrollment.controller.ts:62`-`apps/api/src/api/controllers/enrollment.controller.ts:71`, `apps/api/src/api/controllers/order.controller.ts:40`-`apps/api/src/api/controllers/order.controller.ts:49`, `apps/api/src/core/application/use-cases/notification.service.ts:96`-`apps/api/src/core/application/use-cases/notification.service.ts:101`, `apps/api/src/api/controllers/health-check.controller.ts:75`-`apps/api/src/api/controllers/health-check.controller.ts:85`).

### tenant / user isolation
- Cannot Confirm
- Evidence / boundary: System appears single-tenant by design; no explicit multi-tenant partitioning model was found in reviewed paths. User-level isolation is implemented for patient-scoped resources, but tenant-level isolation is not applicable/explicitly modeled.

## 5. Test Sufficiency Summary

### Test Overview
- Unit tests exist: Yes (API and web).
- API / integration tests exist: Yes (guard-chain integration and multiple service-level suites).
- Obvious test entry points: `npm run test:api`, `npm run test:web`, `npm run test:e2e`, `run_tests.sh`.

### Core Coverage
- happy path: partial
  - Evidence: API service happy paths covered broadly (e.g., `apps/api/test/enrollment.service.spec.ts`, `apps/api/test/payment.service.spec.ts`, `apps/api/test/health-check.service.spec.ts`), but browser E2E full happy path is limited.
- key failure paths: partial
  - Evidence: Guard and role failures covered in API tests (`apps/api/test/api-integration.spec.ts:107`, `apps/api/test/api-integration.spec.ts:175`), but end-to-end failure UX paths are sparse.
- security-critical coverage: partial
  - Evidence: auth/rate/roles/signature boundary tests exist (`apps/api/test/auth.service.spec.ts`, `apps/api/test/rate-limit.guard.spec.ts`, `apps/api/test/authorization-boundaries.spec.ts`), but integrated full-stack security flows are not robustly exercised.

### Major Gaps
- Missing robust full-stack E2E for enrollment→order→payment→notification completion with DB state assertions.
- Missing full-stack E2E for refund supervisor-approval denial/approval boundary.
- Missing full-stack E2E for report-signature SLA expiry and post-sign lock behavior in UI/API combination.

### Final Test Verdict
- Partial Pass

## 6. Engineering Quality Summary
- Overall architecture is credible and modular for scope: clear NestJS module decomposition, dedicated guards/services, and React module/page separation.
- Core business areas from the prompt are implemented with real logic rather than single-file demo patterns (pricing engine with deterministic reasoning, immutable discount audit persistence, offline draft/queue support, versioned health checks with reviewer signature, risk and notification schedulers).
- Professional baseline quality is present: validation via Zod pipes, structured logging, typed DTOs/schemas, and non-trivial automated test suites.
- Main delivery confidence limiter is not core architecture, but integrated runtime test depth and a miswired full-stack E2E gate in the runner.

## 7. Next Actions
- 1) Fix `run_tests.sh` API health probe base URL so full-stack E2E is not skipped incorrectly.
- 2) Add one mandatory full-stack E2E happy path (enrollment to paid order) with assertion on discount breakdown and final statuses.
- 3) Add one mandatory full-stack E2E security boundary path (403/401 role or ownership denial) surfaced through UI and API.
- 4) Add one full-stack E2E for report sign-off SLA expiry/lock semantics.
- 5) Add explicit Windows PowerShell startup instructions in `README.md` to reduce runnability friction.
