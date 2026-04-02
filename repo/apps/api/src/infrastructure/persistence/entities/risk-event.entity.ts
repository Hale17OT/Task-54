import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('risk_events')
export class RiskEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity | null;

  @Column({ name: 'event_type', type: 'varchar', length: 50 })
  eventType!: string;

  @Column({ type: 'varchar', length: 20 })
  severity!: string;

  @Column({ type: 'jsonb', default: {} })
  details!: Record<string, unknown>;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'device_fingerprint', type: 'varchar', length: 64, nullable: true })
  deviceFingerprint!: string | null;

  @Column({ name: 'detected_at', type: 'timestamptz', default: () => 'NOW()' })
  detectedAt!: Date;
}
