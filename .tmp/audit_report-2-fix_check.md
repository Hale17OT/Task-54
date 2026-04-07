# Issue Fix Verification (Static-Only, Latest Re-check)

Reviewed only the 5 previously reported issues using static inspection (no run/tests/docker).

## Overall
- Fixed: **5 / 5**
- Partially fixed: **0 / 5**
- Not fixed: **0 / 5**

## 1) Acceptance script cannot satisfy login contract (High)
- Status: **Fixed**
- What changed:
  - Script login payload includes required `deviceFingerprint` (`scripts/acceptance-test.sh:31-37`, `libs/shared/src/schemas/auth.schema.ts:5-10`, `apps/api/src/core/application/use-cases/auth.service.ts:84-89`).
  - Script has CAPTCHA handling/retry path for `AUTH_008` (`scripts/acceptance-test.sh:39-60`).
  - CAPTCHA challenge request uses `GET /api/risk/captcha`, matching API controller (`scripts/acceptance-test.sh:42`, `apps/api/src/api/controllers/risk.controller.ts:99-103`).
  - README includes acceptance command and expected checks (`README.md:79-84`).
- Verification conclusion: previously reported login-contract mismatch is addressed statically.

## 2) Media upload/serve path may break content rendering (High, suspected)
- Status: **Fixed**
- What changed:
  - Upload flow persists authoritative `mimeType` metadata (`apps/api/src/core/application/use-cases/content.service.ts:307-312`).
  - Media serving prefers stored MIME and falls back to extension map only when metadata is unavailable (`apps/api/src/api/controllers/media.controller.ts:59-77`).
  - Frontend filename extraction handles both Unix and Windows path separators (`apps/web/src/lib/media-url.ts:8-10`).
- Verification conclusion: MIME/path portability risk is addressed statically.

## 3) Full-stack E2E coverage is mostly conditional/skipped by default (Medium)
- Status: **Fixed**
- What changed:
  - CI has mandatory `full-stack-e2e` job after unit tests (`.github/workflows/ci.yml:26-30`).
  - Job sets `FULL_STACK='true'`, runs acceptance + E2E, and uploads artifacts (`.github/workflows/ci.yml:33`, `.github/workflows/ci.yml:42-56`).
- Verification conclusion: CI now enforces full-stack non-skipped coverage path.

## 4) Hard-constraint tests validate constants more than runtime behavior (Medium)
- Status: **Fixed**
- What changed:
  - Service-level behavioral tests are present for lockout/CAPTCHA/throttle/refund flows (`apps/api/test/hard-constraints.spec.ts:265-274`, `apps/api/test/hard-constraints.spec.ts:279-707`).
  - A companion DB-backed suite now exists and covers requested persistence-level flows (lockout transitions, notification throttle, auto-cancel, refund path, encryption at rest) (`apps/api/test/db-integration.spec.ts:1-19`, `apps/api/test/db-integration.spec.ts:169-259`, `apps/api/test/db-integration.spec.ts:264-361`, `apps/api/test/db-integration.spec.ts:366-511`, `apps/api/test/db-integration.spec.ts:516-564`).
  - Test runner environment provides DB configuration and runs API tests in docker test flow (`docker-compose.test.yml:71-77`, `package.json:24`, `apps/api/jest.config.ts:6`).
- Verification conclusion: requested DB-state integration-depth coverage is now present statically.

## 5) Object-level authorization test coverage is uneven across real endpoints (Medium)
- Status: **Fixed**
- What changed:
  - HTTP endpoint-security tests cover ownership checks and negative cross-user cases for `/enrollments/:id`, `/orders/:id`, and `/health-checks/:id` (`apps/api/test/endpoint-security.spec.ts:182-250`, `apps/api/test/endpoint-security.spec.ts:252-319`, `apps/api/test/endpoint-security.spec.ts:321-416`).
  - Includes explicit 401/403 assertions on unauthorized and cross-user access paths (`apps/api/test/endpoint-security.spec.ts:246-249`, `apps/api/test/endpoint-security.spec.ts:299-318`, `apps/api/test/endpoint-security.spec.ts:373-399`).
- Verification conclusion: previously reported endpoint-level ownership coverage gap is addressed.

## Final Note
- This verification is static-only; runtime behavior remains **Manual Verification Required**.
