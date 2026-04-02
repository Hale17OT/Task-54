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
import { EnrollmentEntity } from './enrollment.entity';
import { OrderLineEntity } from './order-line.entity';

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_number', type: 'varchar', length: 30, unique: true })
  orderNumber!: string;

  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId!: string;

  @ManyToOne(() => EnrollmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment!: EnrollmentEntity;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: UserEntity;

  @Column({ type: 'varchar', length: 20, default: 'PENDING_PAYMENT' })
  status!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ name: 'discount_total', type: 'numeric', precision: 10, scale: 2, default: 0 })
  discountTotal!: number;

  @Column({ name: 'final_total', type: 'numeric', precision: 10, scale: 2, default: 0 })
  finalTotal!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'auto_cancel_at', type: 'timestamptz', nullable: true })
  autoCancelAt!: Date | null;

  @OneToMany(() => OrderLineEntity, (line) => line.order, { cascade: true })
  lines!: OrderLineEntity[];
}
