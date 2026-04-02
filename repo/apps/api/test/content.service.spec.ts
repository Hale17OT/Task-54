import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ContentService } from '../src/core/application/use-cases/content.service';
import { SensitiveWordService } from '../src/core/application/use-cases/sensitive-word.service';
import { ArticleEntity } from '../src/infrastructure/persistence/entities/article.entity';
import { ArticleVersionEntity } from '../src/infrastructure/persistence/entities/article-version.entity';
import { MediaAssetEntity } from '../src/infrastructure/persistence/entities/media-asset.entity';
import { ContentStatus, ContentType } from '@checc/shared/types/content.types';

describe('ContentService', () => {
  let service: ContentService;
  let articleRepo: Record<string, jest.Mock>;
  let sensitiveWordService: Record<string, jest.Mock>;

  const authorId = 'author-uuid-1';
  const adminId = 'admin-uuid-1';
  const otherUserId = 'other-uuid-1';
  const articleId = 'article-uuid-1';

  const mockArticle = {
    id: articleId,
    title: 'Test Article',
    slug: 'test-article',
    body: 'This is a test article body',
    contentType: ContentType.ARTICLE,
    status: ContentStatus.DRAFT,
    authorId,
    reviewerId: null,
    reviewNotes: null,
    sensitiveWordHits: null,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    articleRepo = {
      create: jest.fn().mockImplementation((data) => ({
        ...data,
        id: articleId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    sensitiveWordService = {
      scan: jest.fn().mockResolvedValue([]),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb: Function) => {
        const manager = {
          findOne: jest.fn().mockImplementation((entity: any, opts: any) => {
            const name = entity.name || entity;
            if (name === 'ArticleEntity') return articleRepo.findOne(opts);
            return jest.fn()(opts);
          }),
          save: jest.fn().mockImplementation((entity: any, data: any) => {
            const name = entity.name || entity;
            if (name === 'ArticleEntity') return articleRepo.save(data);
            return jest.fn()(data);
          }),
          create: jest.fn().mockImplementation((entity: any, data: any) => {
            const name = entity.name || entity;
            if (name === 'ArticleEntity') return articleRepo.create(data);
            return jest.fn()(data);
          }),
        };
        return cb(manager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentService,
        { provide: getRepositoryToken(ArticleEntity), useValue: articleRepo },
        { provide: getRepositoryToken(ArticleVersionEntity), useValue: { create: jest.fn().mockImplementation((d) => d), save: jest.fn().mockImplementation((d) => Promise.resolve(d)), find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(MediaAssetEntity), useValue: { create: jest.fn(), save: jest.fn(), count: jest.fn().mockResolvedValue(0) } },
        { provide: SensitiveWordService, useValue: sensitiveWordService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ContentService>(ContentService);
  });

  describe('create', () => {
    it('should create article with auto-generated slug', async () => {
      articleRepo.findOne.mockResolvedValue(null); // No slug conflict

      const input = {
        title: 'My New Article',
        body: 'Article content here',
        contentType: ContentType.ARTICLE,
      };

      const result = await service.create(input, authorId);

      expect(result).toBeDefined();
      expect(articleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My New Article',
          slug: 'my-new-article',
          status: ContentStatus.DRAFT,
          authorId,
        }),
      );
      expect(articleRepo.save).toHaveBeenCalled();
    });
  });

  describe('submitForReview', () => {
    it('should transition to IN_REVIEW', async () => {
      articleRepo.findOne.mockResolvedValue({ ...mockArticle });

      const result = await service.submitForReview(articleId, authorId);

      expect(articleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.IN_REVIEW }),
      );
    });
  });

  describe('review', () => {
    it('should approve article and set to PUBLISHED', async () => {
      articleRepo.findOne.mockResolvedValue({
        ...mockArticle,
        status: ContentStatus.IN_REVIEW,
      });

      const result = await service.review(
        articleId,
        { approved: true },
        adminId,
      );

      expect(articleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ContentStatus.PUBLISHED,
          reviewerId: adminId,
        }),
      );
    });

    it('should reject article with notes', async () => {
      articleRepo.findOne.mockResolvedValue({
        ...mockArticle,
        status: ContentStatus.IN_REVIEW,
      });

      const result = await service.review(
        articleId,
        { approved: false, reviewNotes: 'Needs revision' },
        adminId,
      );

      expect(articleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ContentStatus.REJECTED,
          reviewNotes: 'Needs revision',
          reviewerId: adminId,
        }),
      );
    });
  });

  describe('archive', () => {
    it('should archive article', async () => {
      articleRepo.findOne.mockResolvedValue({ ...mockArticle });

      await service.archive(articleId);

      expect(articleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ContentStatus.ARCHIVED }),
      );
    });

    it('should throw if article not found', async () => {
      articleRepo.findOne.mockResolvedValue(null);

      await expect(service.archive('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('author-only update', () => {
    it('should reject update from non-author', async () => {
      articleRepo.findOne.mockResolvedValue({ ...mockArticle });

      await expect(
        service.update(articleId, { title: 'Changed' }, otherUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('sensitive word detection', () => {
    it('should store sensitive word hits on create', async () => {
      articleRepo.findOne.mockResolvedValue(null); // No slug conflict

      sensitiveWordService.scan.mockResolvedValue([
        { word: 'badword', position: 10, context: 'contains badword here', severity: 'HIGH' },
      ]);

      const input = {
        title: 'Article',
        body: 'This contains badword here',
        contentType: ContentType.ARTICLE,
      };

      await service.create(input, authorId);

      expect(articleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sensitiveWordHits: [
            expect.objectContaining({ word: 'badword', severity: 'HIGH' }),
          ],
        }),
      );
    });
  });
});
