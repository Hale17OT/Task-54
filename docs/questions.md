(1) Network Topology & Offline Scope

Question: Is the system a standalone desktop application or a distributed local client-server model for offline access?

My Understanding: The system operates as a "Local Cloud" where one central machine acts as a server for other local devices on a LAN without requiring an internet gateway.

Solution: Bind the NestJS backend to a static local IP and use an Electron wrapper for the primary server node to manage the DB lifecycle, allowing other devices to access the React UI via the local server address.

(2) Enrollment vs. Order Lifecycle

Question: Are "Enrollment Applications" and "Orders" the same entity or separate records?

My Understanding: They are distinct but linked; an enrollment is a profile/membership contract, while an order is the specific financial event.

Solution: Implement a 1:N relationship where the Enrollment record is created in a PENDING_PAYMENT state and only transitions to ACTIVE once the associated Order is marked as PAID.

(3) Promotion Engine "Best Offer" Logic

Question: What is the tie-breaker logic when two mutually exclusive promotion rules provide the same financial value?

My Understanding: The system should prioritize the best financial outcome for the patient unless an administrative priority is specifically set.

Solution: Assign each rule a priority_level and an exclusion_group. The engine will filter rules by group and select the one with the highest priority, defaulting to the maximum discount amount if priorities are equal.

(4) Unpaid Order "Inactivity" Definitions

Question: Does "30 minutes of inactivity" refer to user session idle time or the time elapsed since the order was created?

My Understanding: Inactivity refers specifically to the time elapsed since an order was created without a status transition to 'Paid'.

Solution: Implement a NestJS TaskScheduling cron job that runs every 5 minutes to sweep the Orders table and move any PENDING order older than 30 minutes to a CANCELED status.

(5) Health-Check Versioning & Immutability

Question: Can a health-check record be edited after a reviewer has already applied an e-signature?

My Understanding: Clinical data integrity requires that a signed record remains a "frozen" legal document to maintain an audit trail.

Solution: Utilize a HealthCheck header and a HealthCheckVersions table. Once a version is marked as signed: true, it is locked; any subsequent edits generate a new version ID requiring a fresh signature.

(6) Supervisor Confirmation for Refunds

Question: Is "Supervisor" a distinct system role or a specific permission level within the "Clinic Staff" role?

My Understanding: Creating a fourth role for a single action is inefficient; it should be handled as a permission-based override.

Solution: Add a can_approve_refunds boolean flag to user profiles. If a standard staff member initiates a refund, the UI will prompt for a Supervisor Credential re-entry to sign the refund_authorization_log.

(7) Sensitive Word Warning Workflow

Question: Is the sensitive-word detection a "hard block" preventing a save or a "soft warning" for the user?

My Understanding: It should be a soft warning to allow for valid clinical or cultural nuances that an automated dictionary might misinterpret.

Solution: Run a regex scan against a SensitiveWords table upon "Save Draft." The API returns a 200 OK with a warnings array, requiring the user to acknowledge a "Warning Acknowledgment" checkbox before the "Publish" button is enabled.

(8) Device Fingerprinting

Question: How can we consistently identify hardware for risk detection without access to third-party cloud fingerprinting services?

My Understanding: We need to identify hardware consistently using only browser-available data to detect brute-force attempts.

Solution: Generate a hash using Canvas Fingerprinting, AudioContext, and stable hardware attributes (CPU cores, RAM). This "Device ID" is sent in a custom header and checked against the RiskEvent log.

(9) Quota Management & Race Conditions

Question: When is a seat quota officially consumed—at the start of the application or upon final payment?

My Understanding: To prevent users from completing long applications only to find the seat is gone, we need a reservation system.

Solution: Implement "Soft Reservations" that mark a seat as RESERVED for 60 minutes when an application starts. If no payment is recorded within that window, the seat is released back into the pool.

(10) Notification Frequency Throttling

Question: Does the "three reminders per 24 hours" limit apply to total system notifications or per-item?

My Understanding: This is a per-item constraint to prevent alert fatigue regarding a specific overdue balance or report.

Solution: Use the NotificationLog to track the entity_id. The NotificationService will perform a COUNT query for that specific ID within a rolling 24-hour window before allowing a new dispatch.

(11) PDF Storage & Integrity

Question: Are PDFs stored on the client workstation or the server's filesystem, and how is integrity verified?

My Understanding: For multi-user access, they must be stored on the server's disk but verified before being served to the client.

Solution: Store PDFs in a non-public folder on the server and save a SHA-256 hash in the database. Re-calculate the hash on every request; if it doesn't match the DB, log an "Integrity Error" in the Risk Control module.

(12) E-Signature 24-Hour Expiry Logic

Question: Does the 24-hour signature expiry window start at report creation or report submission for review?

My Understanding: The clock should start when the staff member officially submits the report for reviewer sign-off.

Solution: Add a submitted_for_review_at timestamp to the report. A background task will flag any PENDING_REVIEW report as a "Compliance Breach" if the current time exceeds the submission timestamp by 24 hours.

(13) Application-Level Encryption

Question: Should data-at-rest encryption rely on database-level TDE or application-level logic?

My Understanding: Application-level encryption is more resilient for portable offline databases if the raw database files are accessed.

Solution: Use the NestJS crypto module to encrypt sensitive fields like medical notes using AES-256-GCM, with the encryption key provided via a server-side environment variable.