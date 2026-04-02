import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { ReportTemplateEntity } from './report-template.entity';
import { HealthCheckVersionEntity } from './health-check-version.entity';

@Entity('health_checks')
export class HealthCheckEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: UserEntity;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId!: string;

  @ManyToOne(() => ReportTemplateEntity)
  @JoinColumn({ name: 'template_id' })
  template!: ReportTemplateEntity;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status!: string;

  @Column({ name: 'current_version', type: 'int', default: 1 })
  currentVersion!: number;

  @Column({ name: 'compliance_breach', type: 'boolean', default: false })
  complianceBreach!: boolean;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'created_by' })
  creator!: UserEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => HealthCheckVersionEntity, (version) => version.healthCheck, {
    cascade: true,
  })
  versions!: HealthCheckVersionEntity[];
}
