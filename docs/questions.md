# Technical Clarification: Community Health Enrollment & Clinic Commerce System

**Project Overview:** A localized, full-stack healthcare commerce and enrollment platform.
**Tech Stack:** React (Frontend), NestJS (Backend), PostgreSQL (Database).

---

## 1. Network Topology & Offline Scope
* **What sounded ambiguous:** The requirement for "fully offline" vs. "local network" access. It wasn't clear if this was a standalone desktop app or a distributed local client-server model.
* **How it was understood:** The system operates as a "Local Cloud." One machine acts as the central node (server), and others connect via local Wi-Fi/LAN without requiring an internet gateway.
* **How it was solved:** The NestJS backend will bind to a static local IP. We will utilize a desktop wrapper (like Electron) for the primary server node to manage the DB lifecycle, while other devices access the React UI via the browser at the local server address.

---

## 2. Enrollment vs. Order Lifecycle
* **What sounded ambiguous:** The relationship between an "Enrollment Application" and an "Order" (with add-on services). It was unclear if they were the same entity.
* **How it was understood:** They are distinct but linked. An Enrollment is a profile/membership contract, while an Order is a specific financial event.
* **How it was solved:** We will implement a 1:N relationship. An `Enrollment` record is created in a `DRAFT` or `PENDING_PAYMENT` state. It only transitions to `ACTIVE` once the associated `Order` (containing the base enrollment fee + add-ons) is marked as `PAID`.

---

## 3. Promotion Engine "Best Offer" Logic
* **What sounded ambiguous:** "Prevents stacking when rules are mutually exclusive." It didn't define the tie-breaker logic if two exclusive rules provided the same or similar value.
* **How it was understood:** The system should prioritize the best financial outcome for the patient unless an administrative "Priority" is set.
* **How it was solved:** Each rule will have a `priority_level` (Integer) and an `exclusion_group` (String). The engine will filter valid rules, group them by exclusion, and pick the one with the highest priority. If priorities are equal, it defaults to the rule providing the maximum discount amount.

---

## 4. Unpaid Order "Inactivity" Definitions
* **What sounded ambiguous:** "Unpaid orders auto-cancel after 30 minutes of inactivity." Inactivity could be interpreted as user session idle time or a lack of database updates.
* **How it was understood:** Since staff might be handling physical cash, "inactivity" refers to the time elapsed since the order was created without a status change to 'Paid'.
* **How it was solved:** A NestJS `TaskScheduling` cron job will run every 5 minutes to sweep the `Orders` table. Any order with `status: PENDING` and a `createdAt` timestamp older than 30 minutes will be moved to `CANCELED`.

---

## 5. Health-Check Versioning & Immutability
* **What sounded ambiguous:** It was unclear if a record could be edited after a Reviewer had already applied an e-signature.
* **How it was understood:** Clinical data integrity requires that a signed record remains a "frozen" legal document.
* **How it was solved:** We will use a `HealthCheck` header table and a `HealthCheckVersions` detail table. Once a version is `signed: true`, it is locked. Any subsequent "Edit" creates a new version with a new `version_id`, requiring a fresh signature.

---

## 6. Supervisor Confirmation for Refunds
* **What sounded ambiguous:** Whether "Supervisor" is a unique system role or a permission level within the "Clinic Staff" role.
* **How it was understood:** Adding a fourth role for one specific action is overkill; it should be a permission-based override.
* **How it was solved:** A `can_approve_refunds` boolean flag will be added to user profiles. If a standard Staff member initiates a refund, the frontend will prompt for a "Supervisor Credential" re-entry to sign the `refund_authorization_log`.

---

## 7. Sensitive Word Warning Workflow
* **What sounded ambiguous:** Whether the "sensitive-word warning" was a hard block (preventing save) or a soft warning.
* **How it was understood:** It should be a soft warning to allow for valid clinical or cultural nuances that an automated dictionary might misinterpret.
* **How it was solved:** Upon "Save Draft," the backend runs a regex scan against a `SensitiveWords` table. The API returns a `200 OK` with a `warnings: []` array. The UI then requires the Admin to check an "I acknowledge these warnings" box before the "Publish" button is enabled.

---

## 8. Device Fingerprinting (No External APIs)
* **What sounded ambiguous:** "Device fingerprinting based on stable local attributes" without access to third-party cloud fingerprinting services.
* **How it was understood:** We need to identify hardware consistently using only browser-available data to detect brute force attempts.
* **How it was solved:** We will generate a hash using `Canvas Fingerprinting`, `AudioContext` fingerprinting, and stable hardware attributes (CPU cores, RAM hints). This "Device ID" is sent in a custom header and checked against the `RiskEvent` log.

---

## 9. Quota Management & Race Conditions
* **What sounded ambiguous:** When exactly a "Seat Quota" is consumed—at the start of the application or upon payment.
* **How it was understood:** If it's only upon payment, a user might fill out a long application only to find the seat gone at the checkout.
* **How it was solved:** We will implement "Soft Reservations." When an application is started, a seat is marked as `RESERVED` for 60 minutes. If no payment is recorded, the seat is released. The UI will show a "Time Remaining" countdown for the reservation.

---

## 10. Notification Frequency Throttling
* **What sounded ambiguous:** "No more than three reminders per item per 24 hours." It was unclear if this was total notifications or per-category.
* **How it was understood:** This is a per-item constraint to prevent alert fatigue regarding a specific overdue balance or report.
* **How it was solved:** The `NotificationLog` will track `entity_id` (the specific order/report). The `NotificationService` will perform a `COUNT` query for that `entity_id` within the last 24-hour rolling window before allowing a new dispatch.

---

## 11. PDF Storage & Integrity
* **What sounded ambiguous:** "PDFs are stored locally with checksum validation." Unclear if this meant on the client's local disk or the server's local filesystem.
* **How it was understood:** For multi-user access, they must be on the server's disk but verified before being served.
* **How it was solved:** PDFs will be stored in a non-public folder on the server. The DB will store a SHA-256 hash. Upon request, the server re-calculates the hash of the file. If it matches the DB, the file is streamed; otherwise, an "Integrity Error" is logged in the Risk Control module.

---

## 12. E-Signature 24-Hour Expiry Logic
* **What sounded ambiguous:** Whether the 24-hour window for Reviewer sign-off starts from the moment the report was created or when it was submitted for review.
* **How it was understood:** The clock should start from the moment the Staff member "Submits" the report for Reviewer sign-off.
* **How it was solved:** A `submitted_for_review_at` timestamp will be added to the report. A background task will flag any report where `status: PENDING_REVIEW` and `now() > submitted_at + 24h` as a "Compliance Breach."

---

## 13. Application-Level Encryption
* **What sounded ambiguous:** "All sensitive fields encrypted at rest." Unclear if this relied on DB-level Transparent Data Encryption (TDE) or application-level logic.
* **How it was understood:** Given the offline/portable nature of the system, application-level encryption is more resilient if the raw `.db` file is stolen.
* **How it was solved:** We will use the `crypto` module in NestJS to encrypt fields like `medical_identifiers` and `notes` using `AES-256-GCM`. The encryption key will be provided via an environment variable on the server node, ensuring the data is unreadable even if the PostgreSQL files are accessed directly.