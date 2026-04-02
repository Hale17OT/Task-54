import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('pricing_rules')
export class PricingRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ name: 'rule_type', type: 'varchar', length: 30 })
  ruleType!: string;

  @Column({ name: 'priority_level', type: 'int', default: 0 })
  priorityLevel!: number;

  @Column({ type: 'numeric', precision: 10, scale: 4 })
  value!: number;

  @Column({ name: 'min_quantity', type: 'int', default: 1 })
  minQuantity!: number;

  @Column({ name: 'min_order_subtotal', type: 'numeric', precision: 10, scale: 2, nullable: true })
  minOrderSubtotal!: number | null;

  @Column({ name: 'applicable_service_ids', type: 'uuid', array: true, nullable: true })
  applicableServiceIds!: string[] | null;

  @Column({ name: 'applicable_categories', type: 'varchar', array: true, nullable: true })
  applicableCategories!: string[] | null;

  @Column({ name: 'exclusion_group', type: 'varchar', length: 100, nullable: true })
  exclusionGroup!: string | null;

  @Column({ name: 'valid_from', type: 'timestamptz' })
  validFrom!: Date;

  @Column({ name: 'valid_until', type: 'timestamptz' })
  validUntil!: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator!: UserEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
