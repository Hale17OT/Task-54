# CHECC API Spec

## Conventions

- Base URL: `/api`
- Auth: `Authorization: Bearer <accessToken>` unless endpoint is public
- Optional device header: `X-Device-Fingerprint: <sha256-like fingerprint>`
- Content type: JSON unless noted otherwise

### Success Envelopes

Single resource:

```json
{ "data": { } }
```

Single resource with message:

```json
{ "data": { }, "message": "..." }
```

List:

```json
{
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20
  }
}
```

### Error Envelope

```json
{
  "statusCode": 403,
  "errorCode": "AUTHZ_001",
  "message": "Forbidden",
  "details": {},
  "timestamp": "2026-04-03T00:00:00.000Z"
}
```

### Roles

- `patient`
- `staff`
- `admin`
- `reviewer`

## Public Endpoints

### `GET /health`

- Auth: public
- Response:

```json
{
  "status": "ok",
  "timestamp": "2026-04-03T00:00:00.000Z",
  "uptime": 123.45
}
```

### `POST /auth/register`

- Auth: public
- Rate limit: 5 requests / 60 seconds
- Body:

```json
{
  "username": "patient1",
  "email": "patient1@example.com",
  "password": "StrongPassword123!",
  "fullName": "Alice Patient"
}
```

- Notes:
  - password must be 12+ chars with upper, lower, number, and special char
  - new users are always created as `patient`
- Response: `{ data: UserDto, message: "Registration successful" }`

### `POST /auth/login`

- Auth: public
- Rate limit: 10 requests / 60 seconds
- Body:

```json
{
  "username": "patient1",
  "password": "StrongPassword123!",
  "deviceFingerprint": "optional",
  "captchaId": "optional-uuid",
  "captchaAnswer": "optional-answer"
}
```

- Notes:
  - CAPTCHA becomes required after suspicious failed-login activity from the same IP
  - account lockout occurs after 5 failed attempts in 15 minutes
- Response:

```json
{
  "data": {
    "accessToken": "jwt",
    "refreshToken": "jwt",
    "user": {
      "id": "uuid",
      "username": "patient1",
      "email": "patient1@example.com",
      "role": "patient",
      "fullName": "Alice Patient",
      "canApproveRefunds": false,
      "isActive": true,
      "createdAt": "2026-04-03T00:00:00.000Z"
    }
  }
}
```

### `GET /risk/captcha`

- Auth: public
- Response:

```json
{
  "data": {
    "id": "uuid",
    "imageBase64": "...",
    "expiresAt": "2026-04-03T00:05:00.000Z"
  }
}
```

### `POST /risk/captcha/verify`

- Auth: public
- Body:

```json
{
  "id": "captcha-uuid",
  "answer": "42"
}
```

- Response:

```json
{ "data": { "valid": true } }
```

### `GET /media/:filename`

- Auth: public
- Response: streamed file content
- Notes:
  - serves images, audio, or video from local media storage
  - filename is sanitized before lookup

## Authenticated Endpoints

### `GET /auth/me`

- Auth: any authenticated user
- Response:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "username": "patient1",
      "email": "patient1@example.com",
      "role": "patient",
      "fullName": "Alice Patient",
      "canApproveRefunds": false,
      "isActive": true,
      "createdAt": "2026-04-03T00:00:00.000Z"
    }
  }
}
```

## Catalog

### `GET /catalog`

- Auth: any authenticated user
- Response: `{ data: CatalogServiceDto[] }`

`CatalogServiceDto` fields:

- `id`
- `code`
- `name`
- `description`
- `basePrice`
- `category`
- `isActive`
- `maxSeats`
- `availableSeats`

### `GET /catalog/:id`

- Auth: any authenticated user
- Response: `{ data: CatalogServiceDto }`

## Enrollments

### `POST /enrollments`

- Auth: `patient`
- Body:

```json
{
  "notes": "optional",
  "serviceLines": [
    { "serviceId": "uuid", "quantity": 1 }
  ]
}
```

- Response: `{ data: EnrollmentDto, message: "Enrollment created" }`

### `GET /enrollments?page=1&limit=20`

- Auth: any authenticated user
- Behavior:
  - `staff` and `admin` get all enrollments
  - others get only their own
- Response: paginated `EnrollmentDto[]`

### `GET /enrollments/:id`

- Auth: any authenticated user
- Behavior:
  - `staff` and `admin` can view any enrollment
  - others can view only their own
- Response: `{ data: EnrollmentDto }`

### `PUT /enrollments/:id`

- Auth: authenticated, but business rule effectively restricts updates to the owning patient
- Body:

```json
{
  "notes": "optional",
  "serviceLines": [
    { "serviceId": "uuid", "quantity": 2 }
  ]
}
```

- Notes:
  - only `DRAFT` enrollments can be updated
- Response: `{ data: EnrollmentDto, message: "Enrollment updated" }`

### `POST /enrollments/:id/submit`

- Auth: authenticated, but business rule effectively restricts submission to the owning patient
- Rate limit: 10 requests / 60 seconds
- Notes:
  - only `DRAFT` enrollments can be submitted
  - submission creates held seats and an order
- Response: `{ data: EnrollmentDto, message: "Enrollment submitted" }`

### `POST /enrollments/:id/cancel`

- Auth: any authenticated user
- Behavior:
  - `staff` and `admin` can cancel any non-active enrollment
  - patients can cancel only their own
- Response: `{ data: EnrollmentDto, message: "Enrollment canceled" }`

## Orders

### `GET /orders?page=1&limit=20`

- Auth: any authenticated user
- Behavior:
  - `staff` and `admin` get all orders
  - others get only their own
- Response: paginated `OrderDto[]`

### `GET /orders/by-enrollment/:enrollmentId`

- Auth: any authenticated user
- Behavior:
  - same ownership rules as `GET /orders/:id`
- Response: `{ data: OrderDto | null }`

### `GET /orders/:id`

- Auth: any authenticated user
- Behavior:
  - `staff` and `admin` can view any order
  - others can view only their own
- Response: `{ data: OrderDto }`

### `POST /orders/:id/cancel`

- Auth: any authenticated user
- Behavior:
  - `staff` and `admin` can cancel any cancelable order
  - patients can cancel only their own
- Notes:
  - paid orders cannot be canceled
  - canceling reverts the enrollment to `DRAFT`
- Response: `{ data: OrderDto, message: "Order canceled" }`

## Pricing

### `GET /pricing/rules?page=1&limit=20&activeOnly=true`

- Auth: `admin`
- Response: paginated `PricingRuleDto[]`

### `POST /pricing/rules`

- Auth: `admin`
- Body:

```json
{
  "name": "10% Off Over $200",
  "description": "optional",
  "ruleType": "percentage_off",
  "priorityLevel": 10,
  "value": 10,
  "minQuantity": 1,
  "minOrderSubtotal": 200,
  "applicableServiceIds": ["uuid"],
  "applicableCategories": ["lab"],
  "exclusionGroup": "volume_discount",
  "validFrom": "2026-04-01T00:00:00.000Z",
  "validUntil": "2026-12-31T23:59:59.000Z"
}
```

- Response: `{ data: PricingRuleDto, message: "Pricing rule created" }`

### `PUT /pricing/rules/:id`

- Auth: `admin`
- Body: partial pricing rule payload
- Response: `{ data: PricingRuleDto, message: "Pricing rule updated" }`

### `DELETE /pricing/rules/:id`

- Auth: `admin`
- Behavior: soft-deactivates the rule by setting `isActive=false`
- Response:

```json
{ "message": "Pricing rule deactivated" }
```

### `POST /pricing/compute`

- Auth: `staff` or `admin`
- Body:

```json
{
  "lines": [
    {
      "serviceId": "uuid",
      "category": "lab",
      "unitPrice": 120,
      "quantity": 2
    }
  ]
}
```

- Response: computed per-line discount breakdown with full reasoning

### `GET /pricing/audit/:orderId`

- Auth: `staff` or `admin`
- Response: `{ data: DiscountAuditDto[] }`

## Payments

### `GET /payments?page=1&limit=20`

- Auth: `staff` or `admin`
- Response: paginated `PaymentDto[]`

### `POST /payments`

- Auth: `staff` or `admin`
- Body:

```json
{
  "orderId": "uuid",
  "paymentMethod": "cash",
  "amount": 250,
  "referenceNumber": "optional"
}
```

- Notes:
  - amount must exactly equal the order final total
  - successful payment marks the order `PAID`
  - successful payment activates the related enrollment
- Response: `{ data: PaymentDto, message: "Payment recorded" }`

### `GET /payments/order/:orderId`

- Auth: `staff` or `admin`
- Response: `{ data: PaymentDto[] }`

### `GET /payments/:id`

- Auth: `staff` or `admin`
- Response: `{ data: PaymentDto }`

### `POST /payments/refund`

- Auth: `staff` or `admin`
- Rate limit: 5 requests / 60 seconds
- Body:

```json
{
  "paymentId": "uuid",
  "amount": 50,
  "reasonCode": "BILLING_ERROR",
  "reasonDetail": "optional",
  "supervisorUsername": "optional",
  "supervisorPassword": "optional"
}
```

- Notes:
  - reason code is mandatory
  - if requester lacks `canApproveRefunds`, supervisor credentials are required
  - supervisor must have `canApproveRefunds=true`
- Response: `{ data: RefundDto, message: "Refund processed" }`

## Health Checks

### `GET /templates`

- Auth: any authenticated user
- Response: `{ data: ReportTemplateDto[] }`

### `GET /health-checks?page=1&limit=20`

- Auth: any authenticated user
- Behavior:
  - `staff`, `admin`, and `reviewer` get all health checks
  - patients get only their own
- Response: paginated health checks

### `POST /health-checks`

- Auth: `staff` or `admin`
- Body:

```json
{
  "patientId": "uuid",
  "templateId": "uuid",
  "orderId": "optional-uuid",
  "resultItems": [
    {
      "testName": "Glucose",
      "testCode": "GLU",
      "value": "95",
      "unit": "mg/dL",
      "referenceLow": 70,
      "referenceHigh": 100
    }
  ]
}
```

- Response: `{ data: HealthCheckDto, message: "Health check created" }`

### `GET /health-checks/:id`

- Auth: any authenticated user
- Behavior:
  - `staff`, `admin`, and `reviewer` can view any report
  - patients can view only their own
- Response:

```json
{
  "data": {
    "id": "uuid",
    "patientId": "uuid",
    "templateId": "uuid",
    "orderId": "uuid-or-null",
    "status": "DRAFT",
    "currentVersion": 1,
    "complianceBreach": false,
    "createdBy": "uuid",
    "createdAt": "...",
    "updatedAt": "...",
    "version": {
      "id": "uuid",
      "healthCheckId": "uuid",
      "versionNumber": 1,
      "status": "DRAFT",
      "changeSummary": null,
      "createdBy": "uuid",
      "createdAt": "...",
      "resultItems": []
    }
  }
}
```

### `PUT /health-checks/:id`

- Auth: `staff` or `admin`
- Body:

```json
{
  "resultItems": [
    {
      "testName": "Glucose",
      "testCode": "GLU",
      "value": "101",
      "unit": "mg/dL",
      "referenceLow": 70,
      "referenceHigh": 100
    }
  ],
  "changeSummary": "optional"
}
```

- Notes:
  - creates a new version rather than editing the old one in place
- Response: `{ data: HealthCheckDto, message: "Health check updated" }`

### `POST /health-checks/:id/submit-review`

- Auth: `staff` or `admin`
- Notes:
  - only current `DRAFT` versions can be submitted
- Response: `{ data: HealthCheckDto, message: "Health check submitted for review" }`

### `POST /health-checks/:id/sign`

- Auth: `reviewer`
- Rate limit: 5 requests / 60 seconds
- Body:

```json
{
  "username": "reviewer1",
  "password": "Reviewer12345!",
  "versionNumber": 1
}
```

- Notes:
  - reviewer credentials must match the currently authenticated reviewer
  - version must be `AWAITING_REVIEW`
  - signature must occur within 24 hours of version creation
  - signing triggers PDF generation
- Response: signature metadata including `signatureHash`

### `GET /health-checks/:id/versions`

- Auth: same access rules as `GET /health-checks/:id`
- Response: `{ data: HealthCheckVersionDto[] }`

### `GET /health-checks/:id/pdf/:versionNumber`

- Auth: same access rules as `GET /health-checks/:id`
- Response: streamed PDF download
- Notes:
  - checksum is validated before streaming

## Notifications

### `GET /notifications?page=1&limit=20&unreadOnly=true`

- Auth: any authenticated user
- Response: paginated `NotificationDto[]`

### `PATCH /notifications/:id/read`

- Auth: any authenticated user
- Behavior: only the notification owner can mark it read
- Response:

```json
{ "message": "Notification marked as read" }
```

### `PATCH /notifications/read-all`

- Auth: any authenticated user
- Response:

```json
{ "message": "All notifications marked as read" }
```

### `GET /notifications/unread-count`

- Auth: any authenticated user
- Response:

```json
{ "data": { "count": 3 } }
```

### `GET /notifications/throttle-status`

- Auth: any authenticated user
- Response:

```json
{ "data": { "maxPerItem": 3, "windowHours": 24 } }
```

## Content

### `GET /content/published?page=1&limit=20`

- Auth: any authenticated user
- Response: paginated published `ArticleDto[]`

### `GET /content/:slug`

- Auth: any authenticated user
- Notes:
  - only published content is returned
- Response: `{ data: ArticleDto }`

### `GET /content?page=1&limit=20&status=DRAFT`

- Auth: `admin`
- Response: paginated `ArticleDto[]`

### `POST /content`

- Auth: `admin` or `staff`
- Body:

```json
{
  "title": "Healthy Eating Tips",
  "body": "<p>HTML allowed</p>",
  "contentType": "article"
}
```

- Notes:
  - HTML is sanitized on save
  - sensitive-word hits are recorded if found
- Response: `{ data: ArticleDto, message: "Article created" }`

### `PUT /content/:id`

- Auth: `admin` or `staff`
- Business rule: only the author can update, and only while the article is `DRAFT`
- Response: `{ data: ArticleDto, message: "Article updated" }`

### `POST /content/:id/submit-review`

- Auth: `admin` or `staff`
- Business rule: only the author can submit, and only while `DRAFT`
- Response: `{ data: ArticleDto, message: "Article submitted for review" }`

### `POST /content/:id/review`

- Auth: `admin`
- Body:

```json
{
  "approved": true,
  "reviewNotes": "optional"
}
```

- Notes:
  - article must be `IN_REVIEW`
  - approval publishes immediately
  - rejection stores review notes and sets status `REJECTED`
- Response: `{ data: ArticleDto, message: "Article reviewed" }`

### `POST /content/:id/archive`

- Auth: `admin`
- Response: `{ data: ArticleDto, message: "Article archived" }`

### `GET /content/:id/versions`

- Auth: `admin` or `staff`
- Response: `{ data: ArticleVersion[] }`

### `POST /content/:id/media`

- Auth: `admin` or `staff`
- Content type: `multipart/form-data`
- Field name: `file`
- Business rule: only the article author can upload media
- Response: `{ data: MediaAsset, message: "Media uploaded" }`

## Risk

### `GET /risk/ip-rules?page=1&limit=20`

- Auth: `admin`
- Response: paginated `IpRuleDto[]`

### `POST /risk/ip-rules`

- Auth: `admin`
- Body:

```json
{
  "ipAddress": "192.168.1.10",
  "cidrMask": 32,
  "ruleType": "deny",
  "reason": "optional",
  "expiresAt": "optional-iso-datetime"
}
```

- Response: `{ data: IpRuleDto, message: "IP rule created" }`

### `DELETE /risk/ip-rules/:id`

- Auth: `admin`
- Response:

```json
{ "message": "IP rule deleted" }
```

### `GET /risk/events?page=1&limit=20`

- Auth: `admin`
- Response: paginated `RiskEventDto[]`

### `GET /risk/incidents?page=1&limit=20&status=OPEN`

- Auth: `admin`
- Response: paginated `IncidentTicketDto[]`

### `PATCH /risk/incidents/:id`

- Auth: `admin`
- Body:

```json
{
  "status": "INVESTIGATING",
  "assignedTo": "optional-user-uuid",
  "resolutionNotes": "optional"
}
```

- Response: `{ data: IncidentTicketDto, message: "Incident updated" }`

## DTO Summary

### `EnrollmentDto`

- `id`
- `patientId`
- `status`: `DRAFT | SUBMITTED | ACTIVE | REJECTED | CANCELED`
- `enrollmentDate`
- `notes`
- `serviceLines[]`
- `createdAt`
- `updatedAt`
- `submittedAt`

### `OrderDto`

- `id`
- `orderNumber`
- `enrollmentId`
- `patientId`
- `status`: `PENDING_PAYMENT | PAID | REFUNDED | CANCELED`
- `subtotal`
- `discountTotal`
- `finalTotal`
- `lines[]`
- `createdAt`
- `updatedAt`
- `autoCancelAt`

### `PaymentDto`

- `id`
- `orderId`
- `paymentMethod`: `cash | check | manual_card`
- `amount`
- `referenceNumber`
- `status`: `PENDING | PAID | REFUNDED | CANCELED`
- `recordedBy`
- `paidAt`
- `createdAt`

### `HealthCheckVersionDto`

- `id`
- `healthCheckId`
- `versionNumber`
- `status`: `DRAFT | AWAITING_REVIEW | SIGNED | AMENDED`
- `changeSummary`
- `createdBy`
- `createdAt`
- `resultItems[]`

### `ArticleDto`

- `id`
- `title`
- `slug`
- `body`
- `contentType`: `article | gallery | audio | video`
- `status`: `DRAFT | IN_REVIEW | PUBLISHED | REJECTED | ARCHIVED`
- `authorId`
- `reviewerId`
- `reviewNotes`
- `sensitiveWordHits`
- `publishedAt`
- `createdAt`
- `updatedAt`
- `mediaAssets[]`

## Common Error Codes

- auth:
  - `AUTH_001` invalid credentials
  - `AUTH_002` account locked
  - `AUTH_008` CAPTCHA required
  - `AUTH_009` CAPTCHA invalid
- authorization:
  - `AUTHZ_002` insufficient role
  - `AUTHZ_003` resource not owned
  - `AUTHZ_004` supervisor required
- enrollment:
  - `ENROLL_001` enrollment not found
  - `ENROLL_002` invalid enrollment state
  - `ENROLL_004` seat unavailable
- order:
  - `ORDER_001` order not found
  - `ORDER_002` order already paid / not payable
- payment:
  - `PAY_001` payment not found
  - `PAY_003` refund supervisor required
  - `PAY_004` invalid refund supervisor
- health check:
  - `HC_001` report not found
  - `HC_002` report version locked
  - `HC_003` signature SLA expired
  - `HC_004` report already signed
  - `HC_007` PDF checksum mismatch
- content:
  - `CMS_001` article not found
  - `CMS_002` article slug conflict
- risk:
  - `RISK_001` IP denied
  - `RISK_002` rate limited
