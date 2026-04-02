import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SensitiveWordEntity } from '../../../infrastructure/persistence/entities/sensitive-word.entity';
import type { SensitiveWordHit } from '@checc/shared/types/content.types';

@Injectable()
export class SensitiveWordService {
  constructor(
    @InjectRepository(SensitiveWordEntity)
    private readonly sensitiveWordRepo: Repository<SensitiveWordEntity>,
  ) {}

  async scan(text: string): Promise<SensitiveWordHit[]> {
    const words = await this.sensitiveWordRepo.find();
    if (words.length === 0) return [];

    const hits: SensitiveWordHit[] = [];

    for (const entry of words) {
      const pattern = new RegExp(this.escapeRegex(entry.word), 'gi');
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(text)) !== null) {
        const position = match.index;
        const contextStart = Math.max(0, position - 20);
        const contextEnd = Math.min(text.length, position + match[0].length + 20);
        const context = text.substring(contextStart, contextEnd);

        hits.push({
          word: entry.word,
          position,
          context,
          severity: entry.severity as 'HIGH' | 'MEDIUM' | 'LOW',
        });
      }
    }

    return hits;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
