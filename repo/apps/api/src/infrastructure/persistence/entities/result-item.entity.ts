import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { HealthCheckVersionEntity } from './health-check-version.entity';
import { encryptedTransformer } from '../../security/encrypted-transformer';

@Entity('health_check_result_items')
export class ResultItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'version_id', type: 'uuid' })
  versionId!: string;

  @ManyToOne(() => HealthCheckVersionEntity, (version) => version.resultItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'version_id' })
  version!: HealthCheckVersionEntity;

  @Column({ name: 'test_name', type: 'varchar', length: 200 })
  testName!: string;

  @Column({ name: 'test_code', type: 'varchar', length: 50 })
  testCode!: string;

  @Column({ type: 'varchar', length: 100, transformer: encryptedTransformer })
  value!: string;

  @Column({ type: 'varchar', length: 50, default: '' })
  unit!: string;

  @Column({ name: 'reference_low', type: 'decimal', precision: 12, scale: 4, nullable: true })
  referenceLow!: number | null;

  @Column({ name: 'reference_high', type: 'decimal', precision: 12, scale: 4, nullable: true })
  referenceHigh!: number | null;

  @Column({ name: 'is_abnormal', type: 'boolean', default: false })
  isAbnormal!: boolean;

  @Column({ type: 'varchar', length: 5, nullable: true })
  flag!: string | null;

  @Column({ name: 'prior_value', type: 'varchar', length: 100, nullable: true, transformer: encryptedTransformer })
  priorValue!: string | null;

  @Column({ name: 'prior_date', type: 'timestamptz', nullable: true })
  priorDate!: Date | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;
}
