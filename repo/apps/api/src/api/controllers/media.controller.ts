import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../decorators/public.decorator';
import * as fs from 'fs';
import * as path from 'path';

@Controller('media')
export class MediaController {
  private readonly storagePath: string;

  constructor() {
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

    // Determine content type from extension
    const ext = path.extname(safeName).toLowerCase();
    const mimeTypes: Record<string, string> = {
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

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const stream = fs.createReadStream(resolvedPath);
    stream.pipe(res);
  }
}
