import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SensitiveWordService } from '../src/core/application/use-cases/sensitive-word.service';
import { SensitiveWordEntity } from '../src/infrastructure/persistence/entities/sensitive-word.entity';

describe('SensitiveWordService', () => {
  let service: SensitiveWordService;
  let sensitiveWordRepo: Record<string, jest.Mock>;

  const mockWords = [
    { id: '1', word: 'badword', severity: 'HIGH', createdAt: new Date() },
    { id: '2', word: 'offensive', severity: 'MEDIUM', createdAt: new Date() },
  ];

  beforeEach(async () => {
    sensitiveWordRepo = {
      find: jest.fn().mockResolvedValue(mockWords),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SensitiveWordService,
        { provide: getRepositoryToken(SensitiveWordEntity), useValue: sensitiveWordRepo },
      ],
    }).compile();

    service = module.get<SensitiveWordService>(SensitiveWordService);
  });

  describe('scan', () => {
    it('should return hit with position and context for matching word', async () => {
      const text = 'This text contains badword in the middle';

      const hits = await service.scan(text);

      expect(hits.length).toBe(1);
      expect(hits[0].word).toBe('badword');
      expect(hits[0].position).toBe(19);
      expect(hits[0].severity).toBe('HIGH');
      expect(hits[0].context).toContain('badword');
    });

    it('should return empty array when no matches', async () => {
      const text = 'This is a perfectly clean text with nothing wrong';

      const hits = await service.scan(text);

      expect(hits).toEqual([]);
    });

    it('should return multiple hits for multiple words', async () => {
      const text = 'This has badword and also offensive content here';

      const hits = await service.scan(text);

      expect(hits.length).toBe(2);
      const words = hits.map((h) => h.word);
      expect(words).toContain('badword');
      expect(words).toContain('offensive');
    });
  });
});
