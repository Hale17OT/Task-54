import { DataSource } from 'typeorm';
import { AppDataSource } from './data-source';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { encrypt } from '../security/encryption.util';

function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

function encryptEmail(email: string): string {
  return encrypt(email);
}

/**
 * Idempotent seed function. Skips if users already exist.
 * Can be called with any DataSource (app runtime or standalone CLI).
 */
export async function runSeed(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    // Check if already seeded
    const existing = await queryRunner.query(`SELECT COUNT(*) FROM "users"`);
    if (parseInt(existing[0].count) > 0) {
      // eslint-disable-next-line no-console
      console.log('Database already seeded, skipping.');
      return;
    }

    // eslint-disable-next-line no-console
    console.log('Seeding database...');

    const passwordHash = await bcrypt.hash('Admin12345678!', 10);
    const staffHash = await bcrypt.hash('Staff12345678!', 10);
    const patientHash = await bcrypt.hash('Patient12345!', 10);
    const reviewerHash = await bcrypt.hash('Reviewer12345!', 10);

    // Users (email_hash is deterministic SHA-256 for unique lookup)
    // Emails are encrypted before insertion to maintain encryption-at-rest guarantee
    await queryRunner.query(`
      INSERT INTO "users" ("id", "username", "email", "email_hash", "password_hash", "role", "can_approve_refunds", "full_name")
      VALUES
        ('00000000-0000-0000-0000-000000000001', 'admin', $5, $10, $1, 'admin', FALSE, 'System Administrator'),
        ('00000000-0000-0000-0000-000000000002', 'staff1', $6, $11, $2, 'staff', FALSE, 'Jane Staff'),
        ('00000000-0000-0000-0000-000000000003', 'supervisor', $7, $12, $2, 'staff', TRUE, 'Bob Supervisor'),
        ('00000000-0000-0000-0000-000000000004', 'patient1', $8, $13, $3, 'patient', FALSE, 'Alice Patient'),
        ('00000000-0000-0000-0000-000000000005', 'reviewer1', $9, $14, $4, 'reviewer', FALSE, 'Dr. Carol Reviewer')
    `, [
      passwordHash, staffHash, patientHash, reviewerHash,
      encryptEmail('admin@checc.local'),
      encryptEmail('staff1@checc.local'),
      encryptEmail('supervisor@checc.local'),
      encryptEmail('patient1@checc.local'),
      encryptEmail('reviewer1@checc.local'),
      hashEmail('admin@checc.local'),
      hashEmail('staff1@checc.local'),
      hashEmail('supervisor@checc.local'),
      hashEmail('patient1@checc.local'),
      hashEmail('reviewer1@checc.local'),
    ]);

    // Catalog Services
    await queryRunner.query(`
      INSERT INTO "catalog_services" ("id", "code", "name", "description", "base_price", "category", "max_seats")
      VALUES
        ('00000000-0000-0000-0001-000000000001', 'ANNUAL_LAB', 'Annual Lab Panel', 'Comprehensive annual blood work panel', 250.00, 'lab', NULL),
        ('00000000-0000-0000-0001-000000000002', 'NUTRITION', 'Nutrition Session', 'One-on-one nutrition counseling session', 75.00, 'wellness', 20),
        ('00000000-0000-0000-0001-000000000003', 'BLOOD_DRAW', 'Blood Draw', 'Standard venous blood draw', 35.00, 'lab', NULL),
        ('00000000-0000-0000-0001-000000000004', 'VISION_SCR', 'Vision Screening', 'Standard vision screening exam', 60.00, 'screening', 30),
        ('00000000-0000-0000-0001-000000000005', 'HEARING_SCR', 'Hearing Screening', 'Audiometry hearing screening', 55.00, 'screening', 30),
        ('00000000-0000-0000-0001-000000000006', 'BP_CHECK', 'Blood Pressure Check', 'Blood pressure measurement and recording', 15.00, 'screening', NULL),
        ('00000000-0000-0000-0001-000000000007', 'BMI_ASSESS', 'BMI Assessment', 'Body mass index calculation and counseling', 20.00, 'wellness', NULL),
        ('00000000-0000-0000-0001-000000000008', 'CHOLESTEROL', 'Cholesterol Panel', 'Lipid panel including HDL, LDL, triglycerides', 120.00, 'lab', NULL)
    `);

    // Report Templates
    await queryRunner.query(`
      INSERT INTO "report_templates" ("id", "name", "description", "sections")
      VALUES
        ('00000000-0000-0000-0002-000000000001', 'Basic Health Check', 'Standard health check template', $1),
        ('00000000-0000-0000-0002-000000000002', 'Comprehensive Panel', 'Full lab panel template', $2)
    `, [
      JSON.stringify([
        { name: 'Vitals', testItems: [
          { testName: 'Blood Pressure Systolic', testCode: 'BP_SYS', unit: 'mmHg', referenceLow: 90, referenceHigh: 120 },
          { testName: 'Blood Pressure Diastolic', testCode: 'BP_DIA', unit: 'mmHg', referenceLow: 60, referenceHigh: 80 },
          { testName: 'Heart Rate', testCode: 'HR', unit: 'bpm', referenceLow: 60, referenceHigh: 100 },
          { testName: 'Temperature', testCode: 'TEMP', unit: '°F', referenceLow: 97.0, referenceHigh: 99.0 },
        ]},
        { name: 'Body Measurements', testItems: [
          { testName: 'Weight', testCode: 'WEIGHT', unit: 'lbs', referenceLow: null, referenceHigh: null },
          { testName: 'Height', testCode: 'HEIGHT', unit: 'in', referenceLow: null, referenceHigh: null },
          { testName: 'BMI', testCode: 'BMI', unit: 'kg/m²', referenceLow: 18.5, referenceHigh: 24.9 },
        ]},
      ]),
      JSON.stringify([
        { name: 'Blood Chemistry', testItems: [
          { testName: 'Glucose', testCode: 'GLU', unit: 'mg/dL', referenceLow: 70, referenceHigh: 100 },
          { testName: 'Total Cholesterol', testCode: 'CHOL', unit: 'mg/dL', referenceLow: 0, referenceHigh: 200 },
          { testName: 'HDL Cholesterol', testCode: 'HDL', unit: 'mg/dL', referenceLow: 40, referenceHigh: 60 },
          { testName: 'LDL Cholesterol', testCode: 'LDL', unit: 'mg/dL', referenceLow: 0, referenceHigh: 100 },
          { testName: 'Triglycerides', testCode: 'TRIG', unit: 'mg/dL', referenceLow: 0, referenceHigh: 150 },
        ]},
        { name: 'Hematology', testItems: [
          { testName: 'Hemoglobin', testCode: 'HGB', unit: 'g/dL', referenceLow: 12.0, referenceHigh: 17.5 },
          { testName: 'White Blood Cells', testCode: 'WBC', unit: 'K/uL', referenceLow: 4.5, referenceHigh: 11.0 },
          { testName: 'Platelets', testCode: 'PLT', unit: 'K/uL', referenceLow: 150, referenceHigh: 400 },
        ]},
      ]),
    ]);

    // Pricing Rules
    const now = new Date();
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    await queryRunner.query(`
      INSERT INTO "pricing_rules" ("id", "name", "description", "rule_type", "priority_level", "value", "min_quantity", "min_order_subtotal", "applicable_categories", "exclusion_group", "valid_from", "valid_until", "created_by")
      VALUES
        ('00000000-0000-0000-0003-000000000001', '10% Off Over $200', 'Get 10% off when your order total exceeds $200', 'percentage_off', 10, 10.0000, 1, 200.00, NULL, 'volume_discount', $1, $2, '00000000-0000-0000-0000-000000000001'),
        ('00000000-0000-0000-0003-000000000002', 'BOGO Screenings', 'Buy one get one free on select screenings', 'buy_x_get_y', 5, 1.0000, 2, NULL, '{screening}', 'screening_promo', $1, $2, '00000000-0000-0000-0000-000000000001'),
        ('00000000-0000-0000-0003-000000000003', '50% Off Second Item', 'Get 50% off the second item', 'percentage_off', 8, 50.0000, 2, NULL, NULL, 'volume_discount', $1, $2, '00000000-0000-0000-0000-000000000001')
    `, [now.toISOString(), yearEnd.toISOString()]);

    // eslint-disable-next-line no-console
    console.log('Seed complete.');
  } finally {
    await queryRunner.release();
  }
}

// Standalone CLI entry point (npm run db:seed)
if (require.main === module) {
  AppDataSource.initialize()
    .then((ds) => runSeed(ds))
    .then(() => AppDataSource.destroy())
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
