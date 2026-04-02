import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('login_attempts')
export class LoginAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ name: 'ip_address', type: 'varchar', length: 45 })
  ipAddress!: string;

  @Column({ name: 'device_fingerprint', type: 'varchar', length: 64, nullable: true })
  deviceFingerprint!: string | null;

  @Column({ type: 'boolean' })
  success!: boolean;

  @Column({ name: 'attempted_at', type: 'timestamptz', default: () => 'NOW()' })
  attemptedAt!: Date;
}
