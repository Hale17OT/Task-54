import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import * as crypto from 'crypto';
import { encryptedTransformer } from '../../security/encrypted-transformer';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  username!: string;

  /**
   * Encrypted email for confidentiality (non-deterministic, random IV).
   * NOT used for lookups — use emailHash instead.
   */
  @Column({ type: 'varchar', length: 500, transformer: encryptedTransformer })
  email!: string;

  /**
   * Deterministic SHA-256 hash of normalized (lowercased, trimmed) email.
   * Used for unique constraint enforcement and email-based lookups.
   */
  @Column({ name: 'email_hash', type: 'varchar', length: 64, unique: true })
  emailHash!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: string;

  @Column({ name: 'can_approve_refunds', type: 'boolean', default: false })
  canApproveRefunds!: boolean;

  @Column({ name: 'full_name', type: 'varchar', length: 200 })
  fullName!: string;

  @Column({ name: 'phone_encrypted', type: 'bytea', nullable: true })
  phoneEncrypted!: Buffer | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @BeforeInsert()
  @BeforeUpdate()
  computeEmailHash() {
    if (this.email) {
      this.emailHash = UserEntity.hashEmail(this.email);
    }
  }

  static hashEmail(email: string): string {
    return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
  }
}
