import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { HealthCheckEntity } from './health-check.entity';
import { UserEntity } from './user.entity';

@Entity('report_signatures')
export class ReportSignatureEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'health_check_id', type: 'uuid' })
  healthCheckId!: string;

  @ManyToOne(() => HealthCheckEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'health_check_id' })
  healthCheck!: HealthCheckEntity;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber!: number;

  @Column({ name: 'signer_id', type: 'uuid' })
  signerId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'signer_id' })
  signer!: UserEntity;

  @Column({ name: 'signature_hash', type: 'varchar', length: 256 })
  signatureHash!: string;

  @Column({ name: 'signed_at', type: 'timestamptz' })
  signedAt!: Date;

  @Column({ name: 'ip_address', type: 'varchar', length: 45 })
  ipAddress!: string;
}
