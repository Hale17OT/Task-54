import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from 'typeorm';
import { HealthCheckEntity } from './health-check.entity';
import { ResultItemEntity } from './result-item.entity';
import { encryptedTransformer, encryptedJsonTransformer } from '../../security/encrypted-transformer';

@Entity('health_check_versions')
@Unique(['healthCheckId', 'versionNumber'])
export class HealthCheckVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'health_check_id', type: 'uuid' })
  healthCheckId!: string;

  @ManyToOne(() => HealthCheckEntity, (hc) => hc.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'health_check_id' })
  healthCheck!: HealthCheckEntity;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber!: number;

  @Column({ name: 'content_snapshot', type: 'jsonb', default: '{}', transformer: encryptedJsonTransformer })
  contentSnapshot!: Record<string, unknown>;

  @Column({ name: 'change_summary', type: 'text', nullable: true, transformer: encryptedTransformer })
  changeSummary!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status!: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => ResultItemEntity, (item) => item.version, {
    cascade: true,
  })
  resultItems!: ResultItemEntity[];
}
