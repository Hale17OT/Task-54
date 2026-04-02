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
import { MediaAssetEntity } from './media-asset.entity';
import { encryptedTransformer } from '../../security/encrypted-transformer';

@Entity('articles')
export class ArticleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  @Column({ type: 'varchar', length: 400, unique: true })
  slug!: string;

  @Column({ type: 'text', transformer: encryptedTransformer })
  body!: string;

  @Column({ name: 'content_type', type: 'varchar', length: 20 })
  contentType!: string;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status!: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author!: UserEntity;

  @Column({ name: 'reviewer_id', type: 'uuid', nullable: true })
  reviewerId!: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer!: UserEntity | null;

  @Column({ name: 'review_notes', type: 'varchar', length: 1000, nullable: true })
  reviewNotes!: string | null;

  @Column({ name: 'sensitive_word_hits', type: 'jsonb', nullable: true })
  sensitiveWordHits!: Record<string, unknown>[] | null;

  @Column({ name: 'current_version', type: 'int', default: 1 })
  currentVersion!: number;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => MediaAssetEntity, (asset) => asset.article, { cascade: true })
  mediaAssets!: MediaAssetEntity[];
}
