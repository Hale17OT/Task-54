import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CatalogServiceEntity } from './catalog-service.entity';
import { EnrollmentEntity } from './enrollment.entity';

@Entity('seat_reservations')
export class SeatReservationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId!: string;

  @ManyToOne(() => CatalogServiceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service!: CatalogServiceEntity;

  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId!: string;

  @ManyToOne(() => EnrollmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment!: EnrollmentEntity;

  @Column({ name: 'reserved_at', type: 'timestamptz', default: () => 'NOW()' })
  reservedAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'varchar', length: 20, default: 'HELD' })
  status!: string;
}
