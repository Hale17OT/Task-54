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
import { EnrollmentServiceLineEntity } from './enrollment-service-line.entity';
import { encryptedTransformer } from '../../security/encrypted-transformer';

@Entity('enrollments')
export class EnrollmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: UserEntity;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status!: string;

  @Column({ name: 'enrollment_date', type: 'date', nullable: true })
  enrollmentDate!: Date | null;

  @Column({ type: 'text', default: '', transformer: encryptedTransformer })
  notes!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @OneToMany(() => EnrollmentServiceLineEntity, (line) => line.enrollment, {
    cascade: true,
  })
  serviceLines!: EnrollmentServiceLineEntity[];
}
