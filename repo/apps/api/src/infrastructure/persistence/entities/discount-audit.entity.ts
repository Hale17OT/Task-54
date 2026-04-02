import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OrderEntity } from './order.entity';
import { OrderLineEntity } from './order-line.entity';
import { PricingRuleEntity } from './pricing-rule.entity';
import type { DiscountReasoning } from '@checc/shared/types/pricing.types';

/**
 * IMMUTABLE audit trail for discount computations.
 * No update methods should be exposed — insert only.
 */
@Entity('discount_audit_trail')
export class DiscountAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => OrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: OrderEntity;

  @Column({ name: 'order_line_id', type: 'uuid', nullable: true })
  orderLineId!: string | null;

  @ManyToOne(() => OrderLineEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'order_line_id' })
  orderLine!: OrderLineEntity | null;

  @Column({ name: 'pricing_rule_id', type: 'uuid', nullable: true })
  pricingRuleId!: string | null;

  @ManyToOne(() => PricingRuleEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'pricing_rule_id' })
  pricingRule!: PricingRuleEntity | null;

  @Column({ name: 'original_price', type: 'numeric', precision: 10, scale: 2 })
  originalPrice!: number;

  @Column({ name: 'discount_amount', type: 'numeric', precision: 10, scale: 2 })
  discountAmount!: number;

  @Column({ name: 'final_price', type: 'numeric', precision: 10, scale: 2 })
  finalPrice!: number;

  @Column({ type: 'jsonb' })
  reasoning!: DiscountReasoning;

  @Column({ name: 'computed_at', type: 'timestamptz', default: () => 'NOW()' })
  computedAt!: Date;
}
