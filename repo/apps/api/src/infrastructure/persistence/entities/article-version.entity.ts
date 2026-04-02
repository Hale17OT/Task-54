import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ArticleEntity } from './article.entity';

@Entity('article_versions')
@Unique(['articleId', 'versionNumber'])
export class ArticleVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'article_id', type: 'uuid' })
  articleId!: string;

  @ManyToOne(() => ArticleEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'article_id' })
  article!: ArticleEntity;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber!: number;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'content_type', type: 'varchar', length: 20 })
  contentType!: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
