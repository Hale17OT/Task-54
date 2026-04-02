import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RiskEventEntity } from './risk-event.entity';
import { UserEntity } from './user.entity';

@Entity('incident_tickets')
export class IncidentTicketEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'risk_event_id', type: 'uuid' })
  riskEventId!: string;

  @ManyToOne(() => RiskEventEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_event_id' })
  riskEvent!: RiskEventEntity;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status!: string;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo!: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignee!: UserEntity | null;

  @Column({ name: 'hit_logs', type: 'jsonb', default: {} })
  hitLogs!: Record<string, unknown>;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ name: 'resolution_notes', type: 'varchar', length: 2000, nullable: true })
  resolutionNotes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
