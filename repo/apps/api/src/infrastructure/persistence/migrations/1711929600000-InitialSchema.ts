import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1711929600000 implements MigrationInterface {
  name = 'InitialSchema1711929600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // ==================== USERS & AUTH ====================
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "username" VARCHAR(100) UNIQUE NOT NULL,
        "email" VARCHAR(500) NOT NULL,
        "email_hash" VARCHAR(64) UNIQUE NOT NULL,
        "password_hash" VARCHAR(255) NOT NULL,
        "role" VARCHAR(20) NOT NULL CHECK ("role" IN ('patient','staff','admin','reviewer')),
        "can_approve_refunds" BOOLEAN NOT NULL DEFAULT FALSE,
        "full_name" VARCHAR(200) NOT NULL,
        "phone_encrypted" BYTEA,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "locked_until" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "login_attempts" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID REFERENCES "users"("id") ON DELETE CASCADE,
        "ip_address" VARCHAR(45) NOT NULL,
        "device_fingerprint" VARCHAR(64),
        "success" BOOLEAN NOT NULL,
        "attempted_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_login_attempts_user_recent" ON "login_attempts"("user_id", "attempted_at" DESC)`);

    await queryRunner.query(`
      CREATE TABLE "device_fingerprints" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "fingerprint" VARCHAR(64) NOT NULL,
        "user_agent" TEXT,
        "first_seen_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "is_trusted" BOOLEAN NOT NULL DEFAULT FALSE,
        UNIQUE("user_id", "fingerprint")
      )
    `);

    // ==================== CATALOG & ENROLLMENT ====================
    await queryRunner.query(`
      CREATE TABLE "catalog_services" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" VARCHAR(50) UNIQUE NOT NULL,
        "name" VARCHAR(200) NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "base_price" NUMERIC(10,2) NOT NULL,
        "category" VARCHAR(100) NOT NULL DEFAULT 'general',
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "max_seats" INT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "enrollments" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "patient_id" UUID NOT NULL REFERENCES "users"("id"),
        "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','SUBMITTED','ACTIVE','REJECTED','CANCELED')),
        "enrollment_date" DATE,
        "notes" TEXT NOT NULL DEFAULT '',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "submitted_at" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_enrollments_patient" ON "enrollments"("patient_id", "status")`);

    await queryRunner.query(`
      CREATE TABLE "enrollment_service_lines" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "enrollment_id" UUID NOT NULL REFERENCES "enrollments"("id") ON DELETE CASCADE,
        "service_id" UUID NOT NULL REFERENCES "catalog_services"("id"),
        "quantity" INT NOT NULL DEFAULT 1,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "seat_reservations" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "service_id" UUID NOT NULL REFERENCES "catalog_services"("id"),
        "enrollment_id" UUID NOT NULL REFERENCES "enrollments"("id") ON DELETE CASCADE,
        "reserved_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "expires_at" TIMESTAMPTZ NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'HELD' CHECK ("status" IN ('HELD','CONFIRMED','RELEASED'))
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_seat_reservations_service" ON "seat_reservations"("service_id", "status")`);

    // ==================== ORDERS ====================
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_number" VARCHAR(30) UNIQUE NOT NULL,
        "enrollment_id" UUID NOT NULL REFERENCES "enrollments"("id"),
        "patient_id" UUID NOT NULL REFERENCES "users"("id"),
        "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK ("status" IN ('PENDING_PAYMENT','PAID','REFUNDED','CANCELED')),
        "subtotal" NUMERIC(10,2) NOT NULL,
        "discount_total" NUMERIC(10,2) NOT NULL DEFAULT 0,
        "final_total" NUMERIC(10,2) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "auto_cancel_at" TIMESTAMPTZ NOT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_orders_patient" ON "orders"("patient_id", "status")`);
    await queryRunner.query(`CREATE INDEX "idx_orders_auto_cancel" ON "orders"("status", "auto_cancel_at") WHERE "status" = 'PENDING_PAYMENT'`);

    await queryRunner.query(`
      CREATE TABLE "order_lines" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" UUID NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "service_id" UUID NOT NULL REFERENCES "catalog_services"("id"),
        "quantity" INT NOT NULL DEFAULT 1,
        "unit_price" NUMERIC(10,2) NOT NULL,
        "discount_amount" NUMERIC(10,2) NOT NULL DEFAULT 0,
        "line_total" NUMERIC(10,2) NOT NULL,
        "discount_reason" TEXT
      )
    `);

    // ==================== PRICING & PROMOTIONS ====================
    await queryRunner.query(`
      CREATE TABLE "pricing_rules" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(200) NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "rule_type" VARCHAR(30) NOT NULL CHECK ("rule_type" IN ('percentage_off','fixed_off','fixed_price','buy_x_get_y')),
        "priority_level" INT NOT NULL,
        "value" NUMERIC(10,4) NOT NULL,
        "min_quantity" INT NOT NULL DEFAULT 1,
        "min_order_subtotal" NUMERIC(10,2),
        "applicable_service_ids" UUID[],
        "applicable_categories" VARCHAR(100)[],
        "exclusion_group" VARCHAR(100),
        "valid_from" TIMESTAMPTZ NOT NULL,
        "valid_until" TIMESTAMPTZ NOT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_by" UUID REFERENCES "users"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_pricing_rules_active" ON "pricing_rules"("is_active", "priority_level") WHERE "is_active" = TRUE`);

    await queryRunner.query(`
      CREATE TABLE "discount_audit_trail" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" UUID NOT NULL REFERENCES "orders"("id"),
        "order_line_id" UUID REFERENCES "order_lines"("id"),
        "pricing_rule_id" UUID REFERENCES "pricing_rules"("id"),
        "original_price" NUMERIC(10,2) NOT NULL,
        "discount_amount" NUMERIC(10,2) NOT NULL,
        "final_price" NUMERIC(10,2) NOT NULL,
        "reasoning" JSONB NOT NULL,
        "computed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ==================== PAYMENTS ====================
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" UUID NOT NULL REFERENCES "orders"("id"),
        "payment_method" VARCHAR(30) NOT NULL CHECK ("payment_method" IN ('cash','check','manual_card')),
        "amount" NUMERIC(10,2) NOT NULL,
        "reference_number" VARCHAR(100),
        "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','PAID','REFUNDED','CANCELED')),
        "recorded_by" UUID NOT NULL REFERENCES "users"("id"),
        "paid_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "refunds" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "payment_id" UUID NOT NULL REFERENCES "payments"("id"),
        "amount" NUMERIC(10,2) NOT NULL,
        "reason_code" VARCHAR(50) NOT NULL,
        "reason_detail" TEXT,
        "requested_by" UUID NOT NULL REFERENCES "users"("id"),
        "approved_by" UUID NOT NULL REFERENCES "users"("id"),
        "approved_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ==================== HEALTH CHECKS ====================
    await queryRunner.query(`
      CREATE TABLE "report_templates" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(200) NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "sections" JSONB NOT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "health_checks" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "patient_id" UUID NOT NULL REFERENCES "users"("id"),
        "template_id" UUID REFERENCES "report_templates"("id"),
        "order_id" UUID REFERENCES "orders"("id"),
        "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','AWAITING_REVIEW','SIGNED','AMENDED')),
        "current_version" INT NOT NULL DEFAULT 1,
        "compliance_breach" BOOLEAN NOT NULL DEFAULT FALSE,
        "created_by" UUID NOT NULL REFERENCES "users"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_health_checks_patient" ON "health_checks"("patient_id")`);

    await queryRunner.query(`
      CREATE TABLE "health_check_versions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "health_check_id" UUID NOT NULL REFERENCES "health_checks"("id") ON DELETE CASCADE,
        "version_number" INT NOT NULL,
        "content_snapshot" JSONB NOT NULL DEFAULT '{}',
        "change_summary" TEXT,
        "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','AWAITING_REVIEW','SIGNED')),
        "created_by" UUID NOT NULL REFERENCES "users"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE("health_check_id", "version_number")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "health_check_result_items" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "version_id" UUID NOT NULL REFERENCES "health_check_versions"("id") ON DELETE CASCADE,
        "test_name" VARCHAR(200) NOT NULL,
        "test_code" VARCHAR(50) NOT NULL,
        "value" VARCHAR(100) NOT NULL,
        "unit" VARCHAR(50) NOT NULL DEFAULT '',
        "reference_low" NUMERIC(10,4),
        "reference_high" NUMERIC(10,4),
        "is_abnormal" BOOLEAN NOT NULL DEFAULT FALSE,
        "flag" VARCHAR(10) CHECK ("flag" IN ('H','L','HH','LL','C')),
        "prior_value" VARCHAR(100),
        "prior_date" DATE,
        "sort_order" INT NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "report_signatures" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "health_check_id" UUID NOT NULL REFERENCES "health_checks"("id"),
        "version_number" INT NOT NULL,
        "signer_id" UUID NOT NULL REFERENCES "users"("id"),
        "signature_hash" VARCHAR(128) NOT NULL,
        "signed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "ip_address" VARCHAR(45)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "report_pdfs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "health_check_id" UUID NOT NULL REFERENCES "health_checks"("id"),
        "version_number" INT NOT NULL,
        "file_path" VARCHAR(500) NOT NULL,
        "file_size_bytes" BIGINT NOT NULL,
        "sha256_checksum" VARCHAR(64) NOT NULL,
        "generated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ==================== NOTIFICATIONS ====================
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id"),
        "type" VARCHAR(50) NOT NULL,
        "title" VARCHAR(300) NOT NULL,
        "body" TEXT NOT NULL DEFAULT '',
        "reference_type" VARCHAR(50),
        "reference_id" UUID,
        "is_read" BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_notifications_user" ON "notifications"("user_id", "is_read", "created_at" DESC)`);

    await queryRunner.query(`
      CREATE TABLE "notification_delivery_log" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "notification_type" VARCHAR(50) NOT NULL,
        "reference_id" VARCHAR(100) NOT NULL,
        "user_id" UUID NOT NULL REFERENCES "users"("id"),
        "delivered_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_delivery_log_freq" ON "notification_delivery_log"("user_id", "reference_id", "delivered_at" DESC)`);

    // ==================== CONTENT ====================
    await queryRunner.query(`
      CREATE TABLE "articles" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" VARCHAR(300) NOT NULL,
        "slug" VARCHAR(300) UNIQUE NOT NULL,
        "body" TEXT NOT NULL,
        "content_type" VARCHAR(20) NOT NULL CHECK ("content_type" IN ('article','gallery','audio','video')),
        "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','IN_REVIEW','PUBLISHED','REJECTED','ARCHIVED')),
        "author_id" UUID NOT NULL REFERENCES "users"("id"),
        "reviewer_id" UUID REFERENCES "users"("id"),
        "review_notes" TEXT,
        "sensitive_word_hits" JSONB,
        "published_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "current_version" INT NOT NULL DEFAULT 1`);

    await queryRunner.query(`
      CREATE TABLE "article_versions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "article_id" UUID NOT NULL REFERENCES "articles"("id") ON DELETE CASCADE,
        "version_number" INT NOT NULL,
        "title" VARCHAR(300) NOT NULL,
        "body" TEXT NOT NULL,
        "content_type" VARCHAR(20) NOT NULL,
        "created_by" UUID NOT NULL REFERENCES "users"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("article_id", "version_number")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_article_versions_article" ON "article_versions"("article_id", "version_number" DESC)`);

    await queryRunner.query(`
      CREATE TABLE "media_assets" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "article_id" UUID REFERENCES "articles"("id") ON DELETE CASCADE,
        "file_path" VARCHAR(500) NOT NULL,
        "media_type" VARCHAR(20) NOT NULL CHECK ("media_type" IN ('image','audio','video')),
        "mime_type" VARCHAR(100) NOT NULL,
        "file_size_bytes" BIGINT NOT NULL,
        "alt_text" VARCHAR(300),
        "sort_order" INT NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "sensitive_words" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "word" VARCHAR(200) UNIQUE NOT NULL,
        "severity" VARCHAR(10) NOT NULL CHECK ("severity" IN ('HIGH','MEDIUM','LOW')),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ==================== RISK CONTROL ====================
    await queryRunner.query(`
      CREATE TABLE "ip_rules" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "ip_address" VARCHAR(45) NOT NULL,
        "cidr_mask" INT NOT NULL DEFAULT 32,
        "rule_type" VARCHAR(10) NOT NULL CHECK ("rule_type" IN ('allow','deny')),
        "reason" TEXT,
        "created_by" UUID REFERENCES "users"("id"),
        "expires_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_ip_rules_lookup" ON "ip_rules"("ip_address", "rule_type")`);

    await queryRunner.query(`
      CREATE TABLE "rate_limit_buckets" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id"),
        "action" VARCHAR(100) NOT NULL,
        "window_start" TIMESTAMPTZ NOT NULL,
        "request_count" INT NOT NULL DEFAULT 1,
        UNIQUE("user_id", "action", "window_start")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "risk_events" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID REFERENCES "users"("id"),
        "event_type" VARCHAR(50) NOT NULL,
        "severity" VARCHAR(10) NOT NULL CHECK ("severity" IN ('low','medium','high','critical')),
        "details" JSONB NOT NULL DEFAULT '{}',
        "ip_address" VARCHAR(45),
        "device_fingerprint" VARCHAR(64),
        "detected_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "incident_tickets" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "risk_event_id" UUID REFERENCES "risk_events"("id"),
        "title" VARCHAR(300) NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN','INVESTIGATING','RESOLVED','DISMISSED')),
        "assigned_to" UUID REFERENCES "users"("id"),
        "hit_logs" JSONB NOT NULL DEFAULT '{}',
        "resolved_at" TIMESTAMPTZ,
        "resolution_notes" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "captcha_challenges" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "challenge_text" VARCHAR(10) NOT NULL,
        "image_data" BYTEA NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "is_used" BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ==================== AUDIT LOG ====================
    await queryRunner.query(`
      CREATE TABLE "audit_log" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID REFERENCES "users"("id"),
        "action" VARCHAR(100) NOT NULL,
        "entity_type" VARCHAR(50) NOT NULL,
        "entity_id" UUID,
        "old_value" JSONB,
        "new_value" JSONB,
        "ip_address" VARCHAR(45),
        "device_fingerprint" VARCHAR(64),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_audit_log_entity" ON "audit_log"("entity_type", "entity_id")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_log_user" ON "audit_log"("user_id", "created_at" DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'audit_log', 'captcha_challenges', 'incident_tickets', 'risk_events',
      'rate_limit_buckets', 'ip_rules', 'sensitive_words', 'media_assets',
      'article_versions', 'articles', 'notification_delivery_log', 'notifications', 'report_pdfs',
      'report_signatures', 'health_check_result_items', 'health_check_versions',
      'health_checks', 'report_templates', 'refunds', 'payments',
      'discount_audit_trail', 'pricing_rules', 'order_lines', 'orders',
      'seat_reservations', 'enrollment_service_lines', 'enrollments',
      'catalog_services', 'device_fingerprints', 'login_attempts', 'users',
    ];

    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
  }
}
