import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaptchaChallengeEntity } from '../persistence/entities/captcha-challenge.entity';
import { CAPTCHA_LIMITS } from '@checc/shared/constants/limits';
import { WinstonLogger } from '../logging/winston.logger';

@Injectable()
export class CaptchaService {
  private readonly logger = new WinstonLogger();

  constructor(
    @InjectRepository(CaptchaChallengeEntity)
    private readonly captchaRepo: Repository<CaptchaChallengeEntity>,
  ) {}

  async generate(): Promise<{ id: string; imageBase64: string; expiresAt: string }> {
    const a = Math.floor(Math.random() * 50) + 1;
    const b = Math.floor(Math.random() * 50) + 1;
    const answer = String(a + b);
    const questionText = `${a} + ${b} = ?`;

    // Generate a simple text-based image representation as base64
    const imageText = this.generateTextImage(questionText);
    const imageBase64 = Buffer.from(imageText).toString('base64');

    const expiresAt = new Date(Date.now() + CAPTCHA_LIMITS.EXPIRY_MINUTES * 60 * 1000);

    const challenge = this.captchaRepo.create({
      challengeText: answer,
      imageData: Buffer.from(imageBase64),
      expiresAt,
      isUsed: false,
    });

    const saved = await this.captchaRepo.save(challenge);

    this.logger.log(`Captcha generated: ${saved.id}`, 'CaptchaService');

    return {
      id: saved.id,
      imageBase64,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async verify(id: string, answer: string): Promise<boolean> {
    const challenge = await this.captchaRepo.findOne({ where: { id } });

    if (!challenge) return false;
    if (challenge.isUsed) return false;
    if (challenge.expiresAt < new Date()) return false;

    // Mark as used regardless of answer
    challenge.isUsed = true;
    await this.captchaRepo.save(challenge);

    return challenge.challengeText === answer.trim();
  }

  private generateTextImage(text: string): string {
    // Simple ASCII art style captcha representation
    const border = '+' + '-'.repeat(text.length + 4) + '+';
    const line = `|  ${text}  |`;
    return `${border}\n${line}\n${border}`;
  }
}
