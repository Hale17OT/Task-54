import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentController } from '../controllers/content.controller';
import { MediaController } from '../controllers/media.controller';
import { ContentService } from '../../core/application/use-cases/content.service';
import { SensitiveWordService } from '../../core/application/use-cases/sensitive-word.service';
import { ArticleEntity } from '../../infrastructure/persistence/entities/article.entity';
import { ArticleVersionEntity } from '../../infrastructure/persistence/entities/article-version.entity';
import { MediaAssetEntity } from '../../infrastructure/persistence/entities/media-asset.entity';
import { SensitiveWordEntity } from '../../infrastructure/persistence/entities/sensitive-word.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ArticleEntity,
      ArticleVersionEntity,
      MediaAssetEntity,
      SensitiveWordEntity,
    ]),
  ],
  controllers: [ContentController, MediaController],
  providers: [ContentService, SensitiveWordService],
  exports: [ContentService, SensitiveWordService],
})
export class ContentModule {}
