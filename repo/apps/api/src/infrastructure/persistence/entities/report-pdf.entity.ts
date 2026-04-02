import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { HealthCheckEntity } from './health-check.entity';

@Entity('report_pdfs')
export class ReportPdfEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'health_check_id', type: 'uuid' })
  healthCheckId!: string;

  @ManyToOne(() => HealthCheckEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'health_check_id' })
  healthCheck!: HealthCheckEntity;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber!: number;

  @Column({ name: 'file_path', type: 'varchar', length: 500 })
  filePath!: string;

  @Column({ name: 'file_size_bytes', type: 'bigint' })
  fileSizeBytes!: number;

  @Column({ name: 'sha256_checksum', type: 'varchar', length: 64 })
  sha256Checksum!: string;

  @Column({ name: 'generated_at', type: 'timestamptz' })
  generatedAt!: Date;
}
