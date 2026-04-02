import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('captcha_challenges')
export class CaptchaChallengeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'challenge_text', type: 'varchar', length: 100 })
  challengeText!: string;

  @Column({ name: 'image_data', type: 'bytea' })
  imageData!: Buffer;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'is_used', type: 'boolean', default: false })
  isUsed!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
