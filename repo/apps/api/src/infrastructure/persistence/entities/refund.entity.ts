import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PaymentEntity } from './payment.entity';
import { UserEntity } from './user.entity';

@Entity('refunds')
export class RefundEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId!: string;

  @ManyToOne(() => PaymentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment!: PaymentEntity;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount!: number;

  @Column({ name: 'reason_code', type: 'varchar', length: 50 })
  reasonCode!: string;

  @Column({ name: 'reason_detail', type: 'varchar', length: 1000, nullable: true })
  reasonDetail!: string | null;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requested_by' })
  requester!: UserEntity;

  @Column({ name: 'approved_by', type: 'uuid' })
  approvedBy!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approved_by' })
  approver!: UserEntity;

  @Column({ name: 'approved_at', type: 'timestamptz' })
  approvedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
