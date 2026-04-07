import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { MediaAssetEntity } from '../../infrastructure/persistence/entities/media-asset.entity';
import * as fs from 'fs';
import * as path from 'path';

/** Extension-based MIME fallback for files not tracked in the database. */
const EXTENSION_MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

@Controller('media')
export class MediaController {
  private readonly storagePath: string;

  constructor(
    @InjectRepository(MediaAssetEntity)
    private readonly mediaAssetRepo: Repository<MediaAssetEntity>,
  ) {
    this.storagePath = process.env.MEDIA_STORAGE_PATH || 'data/media';
  }

  @Public()
  @Get(':filename')
  async serveMedia(@Param('filename') filename: string, @Res() res: Response) {
    // Sanitize filename to prevent directory traversal
    const safeName = path.basename(filename);
    const filePath = path.join(this.storagePath, safeName);
    const resolvedPath = path.resolve(filePath);
    const resolvedStorage = path.resolve(this.storagePath);

    if (!resolvedPath.startsWith(resolvedStorage)) {
      throw new NotFoundException('File not found');
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new NotFoundException('File not found');
    }

    // Prefer the authoritative MIME type stored at upload time, fall back to extension guess
    let contentType: string | undefined;
    const asset = await this.mediaAssetRepo.findOne({
      where: { filePath: resolvedPath },
    });
    if (!asset) {
      // Also try matching by the original multer-generated path (relative)
      const relativeAsset = await this.mediaAssetRepo.findOne({
        where: { filePath },
      });
      contentType = relativeAsset?.mimeType;
    } else {
      contentType = asset.mimeType;
    }

    if (!contentType) {
      const ext = path.extname(safeName).toLowerCase();
      contentType = EXTENSION_MIME_MAP[ext] || 'application/octet-stream';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const stream = fs.createReadStream(resolvedPath);
    stream.pipe(res);
  }
}
