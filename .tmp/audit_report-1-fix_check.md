# Final Re-Check of 7 Reported Issues

Date: 2026-04-07  
Method: Static code review only (no runtime execution)

## Verdict

All 7 previously reported issues are now addressed in code.  
No original finding remains open under its original definition.

## Status by Issue

| # | Issue | Re-check Status |
|---|---|---|
| 1 | Notification throttle key/type inconsistency | **Fixed** |
| 2 | Device fingerprint control incomplete | **Fixed** |
| 3 | Security defaults weak/misconfig-prone | **Fixed** |
| 4 | Content creation RBAC mismatch | **Fixed** |
| 5 | Media upload policy limits missing | **Fixed** |
| 6 | Health-check response typing mismatch | **Fixed** |
| 7 | Hard-constraints tests used source-string assertions | **Fixed** |

## Evidence

### 1) Notification throttle key/type inconsistency — Fixed
- Scheduler now uses canonical IDs and explicit notification type in throttle checks, not synthetic `overdue-*`/`pickup-*` keys:
  - `apps/api/src/infrastructure/scheduling/notification-scheduler.service.ts:90`
  - `apps/api/src/infrastructure/scheduling/notification-scheduler.service.ts:125`
- Throttle function supports notification-type scoping:
  - `apps/api/src/core/application/use-cases/notification.service.ts:127`
  - `apps/api/src/core/application/use-cases/notification.service.ts:138`
- Delivery log reference column accepts string IDs:
  - `apps/api/src/infrastructure/persistence/entities/notification-delivery-log.entity.ts:18`

### 2) Device fingerprint control incomplete — Fixed
- Backend entity exists and is actively used in auth service/module:
  - `apps/api/src/infrastructure/persistence/entities/device-fingerprint.entity.ts:10`
  - `apps/api/src/api/modules/auth.module.ts:17`
  - `apps/api/src/core/application/use-cases/auth.service.ts:152`
- Login includes untrusted-device step-up logic using fingerprint trust state:
  - `apps/api/src/core/application/use-cases/auth.service.ts:150`
  - `apps/api/src/core/application/use-cases/auth.service.ts:157`
- Trust lifecycle endpoints are now exposed:
  - `apps/api/src/api/controllers/auth.controller.ts:43`
  - `apps/api/src/api/controllers/auth.controller.ts:57`
  - `apps/api/src/api/controllers/auth.controller.ts:66`
- Frontend still sends fingerprint at login:
  - `apps/web/src/stores/auth.store.ts:33`

### 3) Security defaults weak/misconfig-prone — Fixed
- JWT strategy blocks missing secret outside dev/test:
  - `apps/api/src/infrastructure/security/jwt.strategy.ts:16`
  - `apps/api/src/infrastructure/security/jwt.strategy.ts:19`
- Compose now requires sensitive env vars and rate limit defaults to enabled:
  - `docker-compose.yml:37`
  - `docker-compose.yml:40`
  - `docker-compose.yml:46`

### 4) Content RBAC mismatch — Fixed
- UI create route allows `staffAndAdmin`:
  - `apps/web/src/router.tsx:63`
- API create route allows `ADMIN, STAFF`:
  - `apps/api/src/api/controllers/content.controller.ts:38`

### 5) Media upload policy limits missing — Fixed
- Upload interceptor now enforces file size and MIME allowlist:
  - `apps/api/src/api/controllers/content.controller.ts:118`
  - `apps/api/src/api/controllers/content.controller.ts:121`
  - `apps/api/src/api/controllers/content.controller.ts:125`

### 6) Health-check typing mismatch — Fixed
- Web client expects `currentVersionData`:
  - `apps/web/src/api/health-check.api.ts:18`
- Backend DTO returns `currentVersionData`:
  - `apps/api/src/core/application/use-cases/health-check.service.ts:394`

### 7) Source-string assertions in hard-constraint tests — Fixed
- Previously flagged lines no longer use source-file string scans; they now use metadata/constants assertions:
  - `apps/api/test/hard-constraints.spec.ts:57`
  - `apps/api/test/hard-constraints.spec.ts:76`
  - `apps/api/test/hard-constraints.spec.ts:88`

## Note

This confirms static code alignment only. Runtime behavior (including full integration paths) still requires executing test suites.
