import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CaptchaService } from '../src/infrastructure/security/captcha.service';
import { CaptchaChallengeEntity } from '../src/infrastructure/persistence/entities/captcha-challenge.entity';

describe('CaptchaService', () => {
  let service: CaptchaService;
  let captchaRepo: Record<string, jest.Mock>;

  let storedChallenge: any = null;

  beforeEach(async () => {
    storedChallenge = null;

    captchaRepo = {
      create: jest.fn().mockImplementation((data) => {
        storedChallenge = {
          ...data,
          id: 'captcha-uuid-1',
          createdAt: new Date(),
        };
        return storedChallenge;
      }),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaptchaService,
        { provide: getRepositoryToken(CaptchaChallengeEntity), useValue: captchaRepo },
      ],
    }).compile();

    service = module.get<CaptchaService>(CaptchaService);
  });

  describe('generate', () => {
    it('should produce challenge with id and image', async () => {
      const result = await service.generate();

      expect(result.id).toBeDefined();
      expect(result.imageBase64).toBeDefined();
      expect(result.imageBase64.length).toBeGreaterThan(0);
      expect(result.expiresAt).toBeDefined();
      expect(captchaRepo.create).toHaveBeenCalled();
      expect(captchaRepo.save).toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    it('should return true for correct answer', async () => {
      captchaRepo.findOne.mockResolvedValue({
        id: 'captcha-uuid-1',
        challengeText: '25',
        isUsed: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min from now
      });

      const result = await service.verify('captcha-uuid-1', '25');

      expect(result).toBe(true);
      expect(captchaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isUsed: true }),
      );
    });

    it('should return false for wrong answer', async () => {
      captchaRepo.findOne.mockResolvedValue({
        id: 'captcha-uuid-1',
        challengeText: '25',
        isUsed: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      const result = await service.verify('captcha-uuid-1', '99');

      expect(result).toBe(false);
    });

    it('should return false for expired challenge', async () => {
      captchaRepo.findOne.mockResolvedValue({
        id: 'captcha-uuid-1',
        challengeText: '25',
        isUsed: false,
        expiresAt: new Date(Date.now() - 60 * 1000), // Expired 1 min ago
      });

      const result = await service.verify('captcha-uuid-1', '25');

      expect(result).toBe(false);
    });

    it('should return false for already used challenge', async () => {
      captchaRepo.findOne.mockResolvedValue({
        id: 'captcha-uuid-1',
        challengeText: '25',
        isUsed: true,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      const result = await service.verify('captcha-uuid-1', '25');

      expect(result).toBe(false);
    });

    it('should return false for non-existent challenge', async () => {
      captchaRepo.findOne.mockResolvedValue(null);

      const result = await service.verify('nonexistent', '25');

      expect(result).toBe(false);
    });
  });
});
