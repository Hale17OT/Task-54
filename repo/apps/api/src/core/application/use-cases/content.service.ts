import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sanitizeHtml = require('sanitize-html');
import { ArticleEntity } from '../../../infrastructure/persistence/entities/article.entity';
import { ArticleVersionEntity } from '../../../infrastructure/persistence/entities/article-version.entity';
import { MediaAssetEntity } from '../../../infrastructure/persistence/entities/media-asset.entity';
import { SensitiveWordService } from './sensitive-word.service';
import { ContentStatus } from '@checc/shared/types/content.types';
import { ErrorCodes } from '@checc/shared/constants/error-codes';
import { WinstonLogger } from '../../../infrastructure/logging/winston.logger';
import type { CreateArticleInput, UpdateArticleInput, ReviewArticleInput } from '@checc/shared/schemas/content.schema';

@Injectable()
export class ContentService {
  private readonly logger = new WinstonLogger();

  constructor(
    @InjectRepository(ArticleEntity)
    private readonly articleRepo: Repository<ArticleEntity>,
    @InjectRepository(ArticleVersionEntity)
    private readonly versionRepo: Repository<ArticleVersionEntity>,
    @InjectRepository(MediaAssetEntity)
    private readonly mediaAssetRepo: Repository<MediaAssetEntity>,
    private readonly sensitiveWordService: SensitiveWordService,
    private readonly dataSource: DataSource,
  ) {}

  /** Strip dangerous HTML (scripts, event handlers) while preserving safe formatting. */
  private sanitizeBody(html: string): string {
    return sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3']),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ['src', 'alt', 'width', 'height'],
      },
      disallowedTagsMode: 'discard',
    });
  }

  async create(input: CreateArticleInput, authorId: string) {
    const slug = this.generateSlug(input.title);

    // Check slug uniqueness
    const existingSlug = await this.articleRepo.findOne({ where: { slug } });
    if (existingSlug) {
      throw new BadRequestException({
        message: 'An article with a similar title already exists',
        errorCode: ErrorCodes.ARTICLE_SLUG_TAKEN,
      });
    }

    // Scan for sensitive words
    const hits = await this.sensitiveWordService.scan(input.body);

    const sanitizedBody = this.sanitizeBody(input.body);

    const article = this.articleRepo.create({
      title: input.title,
      slug,
      body: sanitizedBody,
      contentType: input.contentType,
      status: ContentStatus.DRAFT,
      authorId,
      currentVersion: 1,
      sensitiveWordHits: hits.length > 0 ? (hits as unknown as Record<string, unknown>[]) : null,
    });

    const saved = await this.articleRepo.save(article);

    // Create initial version snapshot
    const version = this.versionRepo.create({
      articleId: saved.id,
      versionNumber: 1,
      title: saved.title,
      body: sanitizedBody,
      contentType: saved.contentType,
      createdBy: authorId,
    });
    await this.versionRepo.save(version);

    this.logger.log(`Article created: ${saved.id} by ${authorId}`, 'ContentService');
    return saved;
  }

  async update(id: string, input: UpdateArticleInput, userId: string) {
    const article = await this.articleRepo.findOne({ where: { id } });

    if (!article) {
      throw new NotFoundException({
        message: 'Article not found',
        errorCode: ErrorCodes.ARTICLE_NOT_FOUND,
      });
    }

    if (article.authorId !== userId) {
      throw new ForbiddenException({
        message: 'Only the author can update this article',
        errorCode: ErrorCodes.RESOURCE_NOT_OWNED,
      });
    }

    if (article.status !== ContentStatus.DRAFT) {
      throw new BadRequestException({
        message: 'Only DRAFT articles can be updated',
        errorCode: ErrorCodes.ARTICLE_NOT_IN_REVIEW,
      });
    }

    if (input.title) {
      article.title = input.title;
      const newSlug = this.generateSlug(input.title);
      const existingSlug = await this.articleRepo.findOne({ where: { slug: newSlug } });
      if (existingSlug && existingSlug.id !== id) {
        throw new BadRequestException({
          message: 'An article with a similar title already exists',
          errorCode: ErrorCodes.ARTICLE_SLUG_TAKEN,
        });
      }
      article.slug = newSlug;
    }

    if (input.body) {
      article.body = this.sanitizeBody(input.body);
      const hits = await this.sensitiveWordService.scan(input.body);
      article.sensitiveWordHits = hits.length > 0 ? (hits as unknown as Record<string, unknown>[]) : null;
    }

    // Bump version
    article.currentVersion = (article.currentVersion || 0) + 1;
    const saved = await this.articleRepo.save(article);

    // Create version snapshot
    const version = this.versionRepo.create({
      articleId: saved.id,
      versionNumber: saved.currentVersion,
      title: saved.title,
      body: saved.body,
      contentType: saved.contentType,
      createdBy: userId,
    });
    await this.versionRepo.save(version);

    this.logger.log(`Article updated: ${saved.id} v${saved.currentVersion}`, 'ContentService');
    return saved;
  }

  async submitForReview(id: string, userId: string) {
    const article = await this.articleRepo.findOne({ where: { id } });

    if (!article) {
      throw new NotFoundException({
        message: 'Article not found',
        errorCode: ErrorCodes.ARTICLE_NOT_FOUND,
      });
    }

    if (article.authorId !== userId) {
      throw new ForbiddenException({
        message: 'Only the author can submit for review',
        errorCode: ErrorCodes.RESOURCE_NOT_OWNED,
      });
    }

    if (article.status !== ContentStatus.DRAFT) {
      throw new BadRequestException({
        message: 'Only DRAFT articles can be submitted for review',
        errorCode: ErrorCodes.ARTICLE_NOT_IN_REVIEW,
      });
    }

    article.status = ContentStatus.IN_REVIEW;
    const saved = await this.articleRepo.save(article);
    this.logger.log(`Article submitted for review: ${saved.id}`, 'ContentService');
    return saved;
  }

  async review(id: string, reviewData: ReviewArticleInput, adminId: string) {
    return this.dataSource.transaction(async (manager) => {
      const article = await manager.findOne(ArticleEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!article) {
        throw new NotFoundException({
          message: 'Article not found',
          errorCode: ErrorCodes.ARTICLE_NOT_FOUND,
        });
      }

      if (article.status !== ContentStatus.IN_REVIEW) {
        throw new BadRequestException({
          message: 'Article is not in review',
          errorCode: ErrorCodes.ARTICLE_NOT_IN_REVIEW,
        });
      }

      article.reviewerId = adminId;

      if (reviewData.approved) {
        article.status = ContentStatus.PUBLISHED;
        article.publishedAt = new Date();
      } else {
        article.status = ContentStatus.REJECTED;
        article.reviewNotes = reviewData.reviewNotes || null;
      }

      const saved = await manager.save(ArticleEntity, article);
      this.logger.log(
        `Article reviewed: ${saved.id} - ${reviewData.approved ? 'APPROVED' : 'REJECTED'}`,
        'ContentService',
      );
      return saved;
    });
  }

  async archive(id: string) {
    const article = await this.articleRepo.findOne({ where: { id } });

    if (!article) {
      throw new NotFoundException({
        message: 'Article not found',
        errorCode: ErrorCodes.ARTICLE_NOT_FOUND,
      });
    }

    article.status = ContentStatus.ARCHIVED;
    return this.articleRepo.save(article);
  }

  async listPublished(page: number, limit: number) {
    const [data, total] = await this.articleRepo.findAndCount({
      where: { status: ContentStatus.PUBLISHED },
      relations: ['mediaAssets'],
      order: { publishedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async list(page: number, limit: number, status?: string) {
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    const [data, total] = await this.articleRepo.findAndCount({
      where,
      relations: ['mediaAssets'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async getBySlug(slug: string) {
    const article = await this.articleRepo.findOne({
      where: { slug, status: ContentStatus.PUBLISHED },
      relations: ['mediaAssets'],
    });

    if (!article) {
      throw new NotFoundException({
        message: 'Article not found',
        errorCode: ErrorCodes.ARTICLE_NOT_FOUND,
      });
    }

    return article;
  }

  async getVersionHistory(articleId: string) {
    const versions = await this.versionRepo.find({
      where: { articleId },
      order: { versionNumber: 'DESC' },
    });
    return versions;
  }

  async uploadMedia(articleId: string, file: { path: string; originalname: string; mimetype: string; size: number }, userId: string) {
    const article = await this.articleRepo.findOne({ where: { id: articleId } });
    if (!article) {
      throw new NotFoundException({ message: 'Article not found', errorCode: ErrorCodes.ARTICLE_NOT_FOUND });
    }
    if (article.authorId !== userId) {
      throw new ForbiddenException({ message: 'Only the author can upload media', errorCode: ErrorCodes.RESOURCE_NOT_OWNED });
    }

    const mediaType = file.mimetype.startsWith('image/') ? 'image'
      : file.mimetype.startsWith('audio/') ? 'audio'
      : file.mimetype.startsWith('video/') ? 'video'
      : 'image';

    const count = await this.mediaAssetRepo.count({ where: { articleId } });

    const asset = this.mediaAssetRepo.create({
      articleId,
      filePath: file.path,
      mediaType,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      sortOrder: count,
    });
    return this.mediaAssetRepo.save(asset);
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
