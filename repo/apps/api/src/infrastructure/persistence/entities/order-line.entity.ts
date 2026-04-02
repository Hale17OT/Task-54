import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OrderEntity } from './order.entity';
import { CatalogServiceEntity } from './catalog-service.entity';

@Entity('order_lines')
export class OrderLineEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => OrderEntity, (order) => order.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: OrderEntity;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId!: string;

  @ManyToOne(() => CatalogServiceEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'service_id' })
  service!: CatalogServiceEntity;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({ name: 'unit_price', type: 'numeric', precision: 10, scale: 2 })
  unitPrice!: number;

  @Column({ name: 'discount_amount', type: 'numeric', precision: 10, scale: 2, default: 0 })
  discountAmount!: number;

  @Column({ name: 'line_total', type: 'numeric', precision: 10, scale: 2 })
  lineTotal!: number;

  @Column({ name: 'discount_reason', type: 'text', nullable: true })
  discountReason!: string | null;
}
