import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UsePipes,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ContentService } from '../../core/application/use-cases/content.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { ZodValidate } from '../pipes/zod-validation.pipe';
import {
  createArticleSchema,
  updateArticleSchema,
  reviewArticleSchema,
} from '@checc/shared/schemas/content.schema';
import type {
  CreateArticleInput,
  UpdateArticleInput,
  ReviewArticleInput,
} from '@checc/shared/schemas/content.schema';
import type { UserDto } from '@checc/shared/types/auth.types';
import { UserRole } from '@checc/shared/constants/roles';
import { MEDIA_LIMITS } from '@checc/shared/constants/limits';

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @UsePipes(ZodValidate(createArticleSchema))
  async create(@Body() body: CreateArticleInput, @CurrentUser() user: UserDto) {
    const result = await this.contentService.create(body, user.id);
    return { data: result, message: 'Article created' };
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @UsePipes(ZodValidate(updateArticleSchema))
  async update(
    @Param('id') id: string,
    @Body() body: UpdateArticleInput,
    @CurrentUser() user: UserDto,
  ) {
    const result = await this.contentService.update(id, body, user.id);
    return { data: result, message: 'Article updated' };
  }

  @Post(':id/submit-review')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  async submitForReview(@Param('id') id: string, @CurrentUser() user: UserDto) {
    const result = await this.contentService.submitForReview(id, user.id);
    return { data: result, message: 'Article submitted for review' };
  }

  @Post(':id/review')
  @Roles(UserRole.ADMIN)
  @UsePipes(ZodValidate(reviewArticleSchema))
  async review(
    @Param('id') id: string,
    @Body() body: ReviewArticleInput,
    @CurrentUser() user: UserDto,
  ) {
    const result = await this.contentService.review(id, body, user.id);
    return { data: result, message: 'Article reviewed' };
  }

  @Post(':id/archive')
  @Roles(UserRole.ADMIN)
  async archive(@Param('id') id: string) {
    const result = await this.contentService.archive(id);
    return { data: result, message: 'Article archived' };
  }

  @Get('published')
  async listPublished(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const result = await this.contentService.listPublished(p, l);
    return { data: result.data, meta: { total: result.total, page: p, limit: l } };
  }

  @Get()
  @Roles(UserRole.ADMIN)
  async list(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const result = await this.contentService.list(p, l, status);
    return { data: result.data, meta: { total: result.total, page: p, limit: l } };
  }

  @Get(':id/versions')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  async getVersionHistory(@Param('id') id: string) {
    const versions = await this.contentService.getVersionHistory(id);
    return { data: versions };
  }

  @Post(':id/media')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @UseInterceptors(FileInterceptor('file', {
    dest: process.env.MEDIA_STORAGE_PATH || 'data/media',
    limits: {
      fileSize: MEDIA_LIMITS.MAX_FILE_SIZE_BYTES,
    },
    fileFilter: (_req: unknown, file: { mimetype: string }, cb: (err: Error | null, accept: boolean) => void) => {
      if ((MEDIA_LIMITS.ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(`File type ${file.mimetype} is not allowed. Accepted types: ${MEDIA_LIMITS.ALLOWED_MIME_TYPES.join(', ')}`), false);
      }
    },
  }))
  async uploadMedia(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserDto,
  ) {
    const result = await this.contentService.uploadMedia(id, file, user.id);
    return { data: result, message: 'Media uploaded' };
  }

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    const result = await this.contentService.getBySlug(slug);
    return { data: result };
  }
}
