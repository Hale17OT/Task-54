import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../src/api/pipes/zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  it('should pass valid data through', () => {
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform({ name: 'John', age: 30 });
    expect(result).toEqual({ name: 'John', age: 30 });
  });

  it('should throw BadRequestException for invalid data', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform({ name: '', age: -1 })).toThrow(BadRequestException);
  });

  it('should return detailed field errors', () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({ name: '', age: -1 });
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as Record<string, unknown>;
      expect(response.details).toBeDefined();
    }
  });

  it('should pass through when no schema provided', () => {
    const pipe = new ZodValidationPipe();
    const data = { anything: 'goes' };
    expect(pipe.transform(data)).toEqual(data);
  });
});
