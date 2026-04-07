import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('device_fingerprints')
export class DeviceFingerprintEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ type: 'varchar', length: 64 })
  fingerprint!: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ name: 'first_seen_at', type: 'timestamptz', default: () => 'NOW()' })
  firstSeenAt!: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz', default: () => 'NOW()' })
  lastSeenAt!: Date;

  @Column({ name: 'is_trusted', type: 'boolean', default: false })
  isTrusted!: boolean;
}
