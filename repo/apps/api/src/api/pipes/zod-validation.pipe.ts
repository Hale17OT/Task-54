import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';
import { ErrorCodes } from '@checc/shared/constants/error-codes';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema?: ZodSchema) {}

  transform(value: unknown, metadata?: { type?: string; metatype?: unknown; data?: string }) {
    if (!this.schema) return value;
    // @UsePipes attaches the pipe to every parameter on a handler. Only
    // validate the request body — other parameter sources (custom decorators
    // like @CurrentUser, @Param, @Query) carry unrelated values that won't
    // match the body schema.
    if (metadata && metadata.type !== 'body') return value;

    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const details: Record<string, string[]> = {};
        for (const issue of error.issues) {
          const path = issue.path.join('.') || 'value';
          if (!details[path]) details[path] = [];
          details[path].push(issue.message);
        }

        throw new BadRequestException({
          message: 'Validation failed',
          errorCode: ErrorCodes.VALIDATION_ERROR,
          details,
        });
      }
      throw error;
    }
  }
}

export function ZodValidate(schema: ZodSchema) {
  return new ZodValidationPipe(schema);
}
