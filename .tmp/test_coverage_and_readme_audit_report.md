# Test Coverage Audit

## Backend Endpoint Inventory

Global API prefix is enabled in `apps/api/src/main.ts:24` via `app.setGlobalPrefix('api')`.

Total resolved backend endpoints: **63**

1. `GET /api/health`
2. `POST /api/auth/register`
3. `POST /api/auth/login`
4. `GET /api/auth/me`
5. `GET /api/auth/devices`
6. `POST /api/auth/devices/:fingerprint/trust`
7. `DELETE /api/auth/devices/:fingerprint/trust`
8. `GET /api/catalog`
9. `GET /api/catalog/:id`
10. `POST /api/content`
11. `PUT /api/content/:id`
12. `POST /api/content/:id/submit-review`
13. `POST /api/content/:id/review`
14. `POST /api/content/:id/archive`
15. `GET /api/content/published`
16. `GET /api/content`
17. `GET /api/content/:id/versions`
18. `POST /api/content/:id/media`
19. `GET /api/content/:slug`
20. `POST /api/enrollments`
21. `GET /api/enrollments`
22. `GET /api/enrollments/:id`
23. `PUT /api/enrollments/:id`
24. `POST /api/enrollments/:id/submit`
25. `POST /api/enrollments/:id/cancel`
26. `POST /api/health-checks`
27. `GET /api/health-checks`
28. `GET /api/health-checks/:id`
29. `PUT /api/health-checks/:id`
30. `POST /api/health-checks/:id/submit-review`
31. `POST /api/health-checks/:id/sign`
32. `GET /api/health-checks/:id/versions`
33. `GET /api/health-checks/:id/pdf/:versionNumber`
34. `GET /api/media/:filename`
35. `GET /api/notifications`
36. `PATCH /api/notifications/:id/read`
37. `PATCH /api/notifications/read-all`
38. `GET /api/notifications/unread-count`
39. `GET /api/notifications/throttle-status`
40. `GET /api/orders`
41. `GET /api/orders/by-enrollment/:enrollmentId`
42. `GET /api/orders/:id`
43. `POST /api/orders/:id/cancel`
44. `POST /api/payments`
45. `GET /api/payments/order/:orderId`
46. `GET /api/payments/:id`
47. `POST /api/payments/refund`
48. `GET /api/payments`
49. `POST /api/pricing/rules`
50. `PUT /api/pricing/rules/:id`
51. `DELETE /api/pricing/rules/:id`
52. `GET /api/pricing/rules`
53. `POST /api/pricing/compute`
54. `GET /api/pricing/audit/:orderId`
55. `GET /api/risk/ip-rules`
56. `POST /api/risk/ip-rules`
57. `DELETE /api/risk/ip-rules/:id`
58. `GET /api/risk/events`
59. `GET /api/risk/incidents`
60. `PATCH /api/risk/incidents/:id`
61. `GET /api/risk/captcha`
62. `POST /api/risk/captcha/verify`
63. `GET /api/templates`

Endpoint source evidence: `apps/api/src/api/controllers/*.ts` (controller decorators + method decorators).

## API Test Mapping Table

Canonical endpoint coverage is in `apps/api/test/e2e/endpoints.e2e.spec.ts`.

| Endpoint range | Covered | Test type | Test files | Evidence |
|---|---|---|---|---|
| #1 (`GET /api/health`) | yes | true no-mock HTTP | `apps/api/test/e2e/endpoints.e2e.spec.ts` | `describe('GET /api/health (#1)')` + `request(app).get('/api/health')` at `:52-67` |
| #2-7 (Auth) | yes | true no-mock HTTP | `apps/api/test/e2e/endpoints.e2e.spec.ts` | `describe('AUTH endpoints (#2-7)')` with direct `/api/auth/...` requests at `:72-189` |
| #8-9 (Catalog) | yes | true no-mock HTTP | `apps/api/test/e2e/endpoints.e2e.spec.ts` | `describe('CATALOG endpoints (#8-9)')` at `:194-230` |
| #10-19 (Content) | yes | true no-mock HTTP | `apps/api/test/e2e/endpoints.e2e.spec.ts` | `describe('CONTENT endpoints (#10-19)')` at `:235-383` |
| #20-25 (Enrollments) | yes | true no-mock HTTP | `apps/api/test/e2e/endpoints.e2e.spec.ts` | `describe('ENROLLMENT endpoints (#20-25)')` at `:388-496` |
| #26-33 (Health checks) | yes | true no-mock HTTP | `apps/api/test/e2e/endpoints.e2e.spec.ts` | `describe('HEALTH-CHECK endpoints (#26-33)')` at `:501-620` |
| #34 (Media) | yes | true no-mock HTTP | `apps/api/test/e2e/endpoints.e2e.spec.ts` | `describe('MEDIA endpoint (#34)')` at `:625-647` |
| #35-39 (Notifications) | yes | true no-mock HTTP | `apps/api/test/e2e/endpoints.e2e.spec.ts` | `describe('NOTIFICATION endpoints (#35-39)')` at `:652-698` |
| #40-43 (Orders) | yes | true no-mock HTTP | `apps/api/test/e2e/endpoints.e2e.spec.ts` | `describe('ORDER endpoints (#40-43)')` at `:703-765` |
| #44-48 (Payments) | yes | true no-mock HTTP | `apps/api/test/e2e/endpoints.e2e.spec.ts` | `describe('PAYMENT endpoints (#44-48)')` at `:770-884` |
| #49-54 (Pricing) | yes | true no-mock HTTP | `apps/api/test/e2e/endpoints.e2e.spec.ts` | `describe('PRICING endpoints (#49-54)')` at `:889-969` |
| #55-62 (Risk) | yes | true no-mock HTTP | `apps/api/test/e2e/endpoints.e2e.spec.ts` | `describe('RISK endpoints (#55-62)')` at `:974-1063` |
| #63 (Templates) | yes | true no-mock HTTP | `apps/api/test/e2e/endpoints.e2e.spec.ts` | `describe('TEMPLATE endpoint (#63)')` at `:1068-1100` |

Additional HTTP test layer (not canonical for no-mock classification):
- `apps/api/test/endpoint-security.spec.ts` tests production `/api/...` routes with mocked service dependencies (`useValue`) for guard wiring.

## API Test Classification

1. **True No-Mock HTTP**
   - `apps/api/test/e2e/endpoints.e2e.spec.ts`
   - Evidence: real `AppModule` bootstrap in `apps/api/test/e2e/test-app.ts:50-61`, no provider overrides, real HTTP requests via supertest helper `apps/api/test/e2e/helpers.ts:15-18`.

2. **HTTP with Mocking**
   - `apps/api/test/endpoint-security.spec.ts`
   - Evidence: multiple mocked providers via `useValue` (e.g., `HealthCheckService` at `:85`, `AuthService` at `:149-160`, `OrderService` at `:290`).

3. **Non-HTTP (unit/integration without HTTP)**
   - Remaining API test suites under `apps/api/test/*.spec.ts` (service tests, guard/pipe tests, DB integration, hard constraints).

## Mock Detection

- No `jest.mock`/`vi.mock`/`sinon.stub` usage detected in `apps/api/test` (static grep).
- DI-based mocking is extensive in unit/integration tests and in endpoint-security tests:
  - `apps/api/test/endpoint-security.spec.ts:85`, `:149-160`, `:221`, `:290`, `:363-365`
  - `apps/api/test/auth.service.spec.ts:65-70`
  - `apps/api/test/authorization-boundaries.spec.ts:77-84`, `:161-167`, `:234-238`, `:287-291`
  - `apps/api/test/payment.service.spec.ts:164-168`
  - `apps/api/test/enrollment.service.spec.ts:147-154`
  - `apps/api/test/content.service.spec.ts:85-89`
  - `apps/api/test/hard-constraints.spec.ts:342-347`, `:449-454`, `:491-496`, `:626-632`, `:650-656`, `:684-690`

## Coverage Summary

- Total endpoints: **63**
- Endpoints with HTTP tests: **63**
- Endpoints with true no-mock HTTP tests: **63**
- HTTP coverage: **100.00%**
- True API coverage: **100.00%**

## Unit Test Summary

- API test files discovered: **26** (`apps/api/test/**/*.spec.ts`)
- Unit/service coverage includes controllers/services/repositories-related logic for:
  - auth, enrollment, order timeout, payment, pricing/pricing-engine, risk, content, notifications, health-check/signature
  - guards/pipes/utilities: roles guard, rate-limit guard, zod validation pipe, ip extractor, encryption/captcha
  - DB integration scenarios: `apps/api/test/db-integration.spec.ts`

Important modules with weak or missing direct dedicated tests:
- `IpAllowDenyGuard` has no direct spec file (only indirect via app guards/e2e).
- `JwtAuthGuard` has no dedicated direct unit spec (covered indirectly).
- `GlobalExceptionFilter` has no dedicated direct unit spec.

## Tests Check

- Success path coverage: strong and broad in `apps/api/test/e2e/endpoints.e2e.spec.ts` across all endpoint groups.
- Failure/authorization/validation coverage: present in e2e and endpoint-security suites (401/403/404/400 paths).
- Edge cases: present but uneven; some assertions accept broad status ranges (`[200,400]`, `[200,404]`, `[200,400,404,500]`) reducing strictness.
- Assertion quality: mostly meaningful response assertions; a minority are route-reachability assertions rather than strict contract assertions.
- Integration boundaries: strong; e2e uses real AppModule + real DB path when available (`apps/api/test/e2e/test-app.ts:50-67`).
- `run_tests.sh` check:
  - Docker-based test flow exists and is first-class in README/test compose: **OK**.
  - Script still contains local dependency/runtime branch (`npm install`, local Playwright install/build): **FLAG** (`run_tests.sh:22-27`, `:85-89`).

## Test Coverage Score (0-100)

**93 / 100**

## Score Rationale

- Full endpoint inventory has explicit HTTP tests with true no-mock execution path (major positive).
- Real DB-backed e2e endpoint suite plus additional DB integration tests materially increases confidence.
- Score not maximum due to permissive assertions in some endpoint tests and missing dedicated direct specs for a few cross-cutting components.

## Key Gaps

1. Several endpoint tests allow wide status-code sets, weakening contract precision.
2. Some routes are validated mainly for reachability, not deep response schema semantics.
3. No dedicated direct unit specs for `IpAllowDenyGuard`, `JwtAuthGuard`, `GlobalExceptionFilter`.
4. Unified test runner still includes local-install behavior (strict Docker-only policy mismatch).

## Confidence & Assumptions

- Confidence: **High**.
- Assumptions:
  - Static classification treats tests as coverage evidence regardless of conditional runtime skip (`DATABASE_HOST` checks).
  - Endpoint definitions are derived from decorators + global prefix, not generated runtime routes.

---

# README Audit

## High Priority Issues

- None found.

## Medium Priority Issues

- `run_tests.sh` still supports non-Docker local install/run paths, while README now positions Docker-only workflow; documentation and script behavior are not fully aligned (`run_tests.sh:22-27`, `:85-89`).

## Low Priority Issues

- README includes both direct compose commands and an "npm shortcut" section but shows compose commands again; wording can be tightened for clarity (`README.md:65-70`).

## Hard Gate Failures

- None.

Hard gate check evidence:
- Project type declared at top: **PASS** (`README.md:1`)
- README exists at `repo/README.md`: **PASS**
- Backend/fullstack startup includes literal `docker-compose up`: **PASS** (`README.md:16`)
- Access method includes URLs/ports: **PASS** (`README.md:21-25`)
- Verification method provided (`curl` + web access): **PASS** (`README.md:46-52`)
- Environment rules (no npm/pip/apt/manual DB setup in README): **PASS**
- Auth credentials with all roles documented: **PASS** (`README.md:85-91`)

## README Verdict

**PASS**

Project-type inference note: explicit declaration present (`fullstack`), so no fallback inference required.
