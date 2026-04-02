import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ArticleEntity } from './article.entity';

@Entity('media_assets')
export class MediaAssetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'article_id', type: 'uuid' })
  articleId!: string;

  @ManyToOne(() => ArticleEntity, (article) => article.mediaAssets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'article_id' })
  article!: ArticleEntity;

  @Column({ name: 'file_path', type: 'varchar', length: 500 })
  filePath!: string;

  @Column({ name: 'media_type', type: 'varchar', length: 20 })
  mediaType!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ name: 'file_size_bytes', type: 'integer' })
  fileSizeBytes!: number;

  @Column({ name: 'alt_text', type: 'varchar', length: 300, nullable: true })
  altText!: string | null;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
