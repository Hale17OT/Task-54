# Static Delivery Acceptance + Architecture Audit

Date: 2026-04-07  
Mode: Static analysis only (no runtime execution)

## 1) Verdict

Overall verdict: **Partial Pass (Not production-ready due to unresolved High issues)**.

- Core business architecture is present and broadly aligned with the prompt (enrollment/order, pricing rules, health-check workflow, content workflow, risk modules).
- However, there are **High severity gaps** in notification scheduling robustness, device-fingerprint control completeness, and secure default posture.
- Several items can only be validated dynamically and are marked **Cannot Confirm Statistically / Manual Verification Required**.

## 2) Scope and Boundary

- Reviewed monorepo structure and static code in `apps/api`, `apps/web`, and `libs/shared`.
- Reviewed API modules/controllers/services/guards/entities/migration and representative tests.
- Reviewed web routing/auth/offline utilities/domain pages and representative tests.
- Did **not** run API/web/tests/docker or verify external integrations at runtime.

## 3) Requirement Mapping Summary

| Requirement | Static Status | Notes |
|---|---|---|
| Offline enrollment/order flow | Partial | Draft/offline queue exists in web; end-to-end resilience requires runtime validation.
| Pricing/promo best-offer + exclusion | Pass | Deterministic rule filtering/sorting/exclusion resolution with audit trail.
| Health-check versioning + reviewer sign-off | Pass | Version chain, reviewer re-auth, SLA checks, signatures, PDF checksum path.
| Notifications + frequency limits | Partial | Frequency logic exists, but scheduler key usage is inconsistent and high-risk.
| Content draft-review-publish + sensitive words | Partial | Workflow and scanning exist; role exposure mismatch and media validation gaps.
| Risk controls set (password, lockout, IP, rate limit, CAPTCHA, device fingerprinting, anomalies) | Partial | Most controls present; device-fingerprint enforcement appears incomplete.
| Encryption at rest, local PDFs with checksum, offline constraints | Partial | Encryption transformers and checksum exist; some operational controls cannot be confirmed statically.

## 4) Section-by-Section Review

### A. Offline Enrollment / Order

Status: **Partial**

- Web supports local draft persistence with per-user keys via IndexedDB (`apps/web/src/utils/offline-storage.ts:15`, `apps/web/src/utils/offline-storage.ts:50`).
- Web queues failed enrollment actions for replay (`apps/web/src/utils/sync-queue.ts:24`, `apps/web/src/utils/sync-queue.ts:51`).
- Enrollment form explicitly supports offline save + queued sync fallback (`apps/web/src/hooks/useEnrollmentForm.ts:66`, `apps/web/src/hooks/useEnrollmentForm.ts:106`).
- Backend submit flow creates seats, order, and applies pricing atomically (`apps/api/src/core/application/use-cases/enrollment.service.ts:165`, `apps/api/src/core/application/use-cases/enrollment.service.ts:294`).
- Auto-cancel and seat release are scheduled (`apps/api/src/infrastructure/scheduling/order-timeout.service.ts:26`, `apps/api/src/infrastructure/scheduling/order-timeout.service.ts:84`).
- **Cannot Confirm Statistically**: queue replay reliability under prolonged offline windows, conflict resolution behavior, and exact UX recovery sequencing.

### B. Pricing / Promo Best-Offer + Exclusion

Status: **Pass**

- Pricing engine applies rule applicability filters, date windows, quantity/subtotal checks (`apps/api/src/core/application/use-cases/pricing-engine.ts:85`).
- Exclusion-group best-offer selection + tie-break logic is explicit (`apps/api/src/core/application/use-cases/pricing-engine.ts:152`).
- Applied rules are capped at line subtotal (`apps/api/src/core/application/use-cases/pricing-engine.ts:209`).
- Discount reasoning trace is persisted and order totals updated (`apps/api/src/core/application/use-cases/pricing.service.ts:166`, `apps/api/src/core/application/use-cases/pricing.service.ts:194`).
- Audit table exists and stores immutable-style discount records (`apps/api/src/infrastructure/persistence/migrations/1711929600000-InitialSchema.ts:161`).

### C. Health-Check Versioning + Reviewer Sign-Off

Status: **Pass**

- Health-check versions are persisted with unique `(health_check_id, version_number)` (`apps/api/src/infrastructure/persistence/entities/health-check-version.entity.ts:16`).
- Submit-for-review transition enforces DRAFT -> AWAITING_REVIEW (`apps/api/src/core/application/use-cases/health-check.service.ts:251`, `apps/api/src/core/application/use-cases/health-check.service.ts:258`).
- Signature flow re-authenticates reviewer credentials and binds to current JWT user (`apps/api/src/core/application/use-cases/signature.service.ts:44`, `apps/api/src/core/application/use-cases/signature.service.ts:57`).
- Reviewer-only enforcement and SLA expiry checks are present (`apps/api/src/core/application/use-cases/signature.service.ts:65`, `apps/api/src/core/application/use-cases/signature.service.ts:117`).
- PDF generation is local filesystem-based with checksum storage and download-time checksum validation (`apps/api/src/infrastructure/pdf/pdf-export.service.ts:36`, `apps/api/src/infrastructure/pdf/pdf-export.service.ts:180`, `apps/api/src/infrastructure/pdf/pdf-export.service.ts:222`).

### D. Notifications + Frequency Limits

Status: **Partial (High-risk defect present)**

- Global limits are defined as 3 reminders in rolling 24h (`libs/shared/src/constants/limits.ts:21`).
- Delivery throttle checks use `notification_delivery_log` count by `userId + referenceId + time window` (`apps/api/src/core/application/use-cases/notification.service.ts:127`).
- Scheduler sends due/overdue/pickup/compliance notifications (`apps/api/src/infrastructure/scheduling/notification-scheduler.service.ts:30`).
- **High issue**: scheduler passes synthetic non-UUID keys in `canDeliver` for overdue/pickup (`overdue-${order.id}`, `pickup-${reservation.id}`), but reference field is UUID-backed (`apps/api/src/infrastructure/scheduling/notification-scheduler.service.ts:91`, `apps/api/src/infrastructure/scheduling/notification-scheduler.service.ts:125`, `apps/api/src/infrastructure/persistence/entities/notification-delivery-log.entity.ts:18`, `apps/api/src/infrastructure/persistence/migrations/1711929600000-InitialSchema.ts:308`).
- **High issue impact**: potential SQL/type failures in throttle lookup and/or unreliable scheduler behavior; no local try/catch around per-item sends (`apps/api/src/infrastructure/scheduling/notification-scheduler.service.ts:81`, `apps/api/src/infrastructure/scheduling/notification-scheduler.service.ts:120`).

### E. Content Draft-Review-Publish + Sensitive Words

Status: **Partial**

- Draft creation, review submission, and admin review publish/reject flow exists (`apps/api/src/core/application/use-cases/content.service.ts:47`, `apps/api/src/core/application/use-cases/content.service.ts:154`, `apps/api/src/core/application/use-cases/content.service.ts:184`).
- Sensitive-word scanning is performed and hits stored (`apps/api/src/core/application/use-cases/content.service.ts:60`, `apps/api/src/core/application/use-cases/sensitive-word.service.ts:14`).
- Body HTML is sanitized before persistence (`apps/api/src/core/application/use-cases/content.service.ts:35`).
- **Role inconsistency**: API allows STAFF+ADMIN create/update, while web route restricts content create page to ADMIN only (`apps/api/src/api/controllers/content.controller.ts:36`, `apps/web/src/router.tsx:63`).
- **Validation gap**: media upload interceptor sets destination only; no explicit static MIME/size policy in interceptor options (`apps/api/src/api/controllers/content.controller.ts:114`).

### F. Risk Controls + Security Posture

Status: **Partial**

- Password policy is enforced in shared auth schema (min length + complexity) (`libs/shared/src/schemas/auth.schema.ts:20`).
- Account lockout logic after repeated failures is present (`apps/api/src/core/application/use-cases/auth.service.ts:201`).
- CAPTCHA escalation and verification exist (`apps/api/src/core/application/use-cases/auth.service.ts:89`, `apps/api/src/infrastructure/security/captcha.service.ts:47`).
- IP allow/deny and global guard chain are present (`apps/api/src/app.module.ts:38`, `apps/api/src/api/guards/ip-allow-deny.guard.ts:40`).
- Rate limit control exists but is environment-disablable (`apps/api/src/api/guards/rate-limit.guard.ts:25`).
- Trust-proxy behavior is explicit and opt-in (`apps/api/src/infrastructure/security/ip-extractor.ts:8`).
- At-rest encryption is implemented via AES-GCM utility + TypeORM transformers on sensitive fields (`apps/api/src/infrastructure/security/encryption.util.ts:3`, `apps/api/src/infrastructure/persistence/entities/user.entity.ts:25`, `apps/api/src/infrastructure/persistence/entities/health-check-version.entity.ts:31`).
- **High gap**: device fingerprinting appears only partially implemented (fingerprint generated client-side and login attempts store fingerprint, migration creates `device_fingerprints` table, but no API entity/service enforcement path found for trusted-device policy) (`apps/web/src/stores/auth.store.ts:33`, `apps/api/src/core/application/use-cases/auth.service.ts:129`, `apps/api/src/infrastructure/persistence/migrations/1711929600000-InitialSchema.ts:42`).
- **High secure-default concern**: non-prod JWT fallback secret and compose default `RATE_LIMIT_DISABLED=true` increase accidental insecure deployment risk (`apps/api/src/infrastructure/security/jwt.strategy.ts:18`, `docker-compose.yml:46`).

## 5) Severity-Rated Issue List

### Blocker

- None identified from static evidence.

### High

1. **Notification throttle key type inconsistency can break scheduled notification flow**  
   Evidence: `apps/api/src/infrastructure/scheduling/notification-scheduler.service.ts:91`, `apps/api/src/infrastructure/scheduling/notification-scheduler.service.ts:125`, `apps/api/src/infrastructure/persistence/entities/notification-delivery-log.entity.ts:18`.

2. **Device fingerprint control is incomplete versus requirement intent**  
   Evidence: `apps/web/src/stores/auth.store.ts:33`, `apps/api/src/core/application/use-cases/auth.service.ts:129`, `apps/api/src/infrastructure/persistence/migrations/1711929600000-InitialSchema.ts:42`; no matching `device_fingerprints` entity/service usage found in `apps/api/src`.

3. **Security defaults are easy to misconfigure into weak posture**  
   Evidence: `apps/api/src/infrastructure/security/jwt.strategy.ts:18`, `docker-compose.yml:46`.

### Medium

4. **Content creation RBAC mismatch between UI and API**  
   Evidence: `apps/web/src/router.tsx:63`, `apps/api/src/api/controllers/content.controller.ts:36`.

5. **Media upload policy limits not explicit in upload interceptor**  
   Evidence: `apps/api/src/api/controllers/content.controller.ts:114`.

6. **Web/API health-check detail typing inconsistency** (`currentVersionData` vs `version`)  
   Evidence: `apps/web/src/api/health-check.api.ts:18`, `apps/api/src/core/application/use-cases/health-check.service.ts:394`.

7. **Prompt-critical tests include source-string assertions, reducing assurance quality**  
   Evidence: `apps/api/test/hard-constraints.spec.ts:55`, `apps/api/test/hard-constraints.spec.ts:76`, `apps/api/test/hard-constraints.spec.ts:88`.

## 6) Security Review Summary

- Strong controls present: layered guards, lockout, CAPTCHA, role checks, ownership checks, IP allow/deny, anomaly incident creation, encrypted fields at rest.
- Key shortcomings are primarily in operational hardening and control completeness:
  - device fingerprint trusted-device enforcement path not evident,
  - insecure defaults possible in local/compose configs,
  - notification scheduler robustness issues.
- **Manual Verification Required**:
  - key management lifecycle for `FIELD_ENCRYPTION_KEY` and JWT secrets,
  - production environment policy preventing insecure defaults,
  - operational monitoring/alerting around scheduler failures.

## 7) Tests and Logging Review

- Test suites are broad across API unit/integration and web unit/e2e files, including guard-chain tests (`apps/api/test/api-integration.spec.ts:75`) and ownership boundary tests (`apps/api/test/authorization-boundaries.spec.ts:43`).
- Some acceptance-critical tests rely on source-text inspection rather than behavior assertions (`apps/api/test/hard-constraints.spec.ts:55`), which weakens regression resistance.
- Web full-stack e2e execution is conditional on `FULL_STACK=true`, so many runtime assertions may be skipped depending on environment (`apps/web/e2e/helpers.ts:8`).
- Logging includes structured output and basic PII scrubbing (`apps/api/src/infrastructure/logging/winston.logger.ts:4`) plus centralized exception logging (`apps/api/src/api/filters/global-exception.filter.ts:49`).
- **Cannot Confirm Statistically**: whether logs fully satisfy privacy/retention standards under production traffic.

## 8) Mandatory Static Test Coverage Assessment

| Core Requirement / Risk | Static Tests Found | Coverage Judgment | Gap |
|---|---|---|---|
| Pricing exclusion best-offer | `apps/api/test/hard-constraints.spec.ts:33` | Partial | Includes logic test, but mixed with structural tests.
| Enrollment state transitions | `apps/api/test/hard-constraints.spec.ts:143` | Partial | Some checks are source-string based.
| Auth role/guard boundaries | `apps/api/test/api-integration.spec.ts:75` | Good | Runtime stack still not executed in this audit.
| Ownership boundaries | `apps/api/test/authorization-boundaries.spec.ts:43` | Good | Mostly mocked service-level tests.
| Notification frequency constraints | `apps/api/test/hard-constraints.spec.ts:67` | Weak | Constant assertion only; no scheduler behavior verification.
| Signature SLA and immutability | `apps/api/test/hard-constraints.spec.ts:86`, `apps/api/test/hard-constraints.spec.ts:97` | Weak/Partial | String checks, not end-to-end state transitions.
| Encryption utility | `apps/api/test/hard-constraints.spec.ts:181` | Partial | Utility tested; field-level persistence behavior not proven here.
| Device fingerprint enforcement | None meaningful found | Insufficient | Requirement appears under-implemented.

Final static test-coverage judgment: **Partial and uneven**. Critical paths exist, but assurance is reduced by structural string checks and missing behavioral coverage for certain prompt-critical controls.

## 9) Final Notes

- This report is intentionally static-only and does not assert runtime correctness.
- Priority remediation order:
  1) fix notification scheduler key/type handling and add behavioral tests,
  2) implement/verify end-to-end device-fingerprint policy enforcement,
  3) harden insecure defaults for deployment safety.
- Manual verification should follow for offline sync conflict handling, scheduler reliability, and production security configuration.
