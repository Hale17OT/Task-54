import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('notification_delivery_log')
export class NotificationDeliveryLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'notification_type', type: 'varchar', length: 50 })
  notificationType!: string;

  @Column({ name: 'reference_id', type: 'varchar', length: 100, nullable: true })
  referenceId!: string | null;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ name: 'delivered_at', type: 'timestamptz', default: () => 'NOW()' })
  deliveredAt!: Date;
}
