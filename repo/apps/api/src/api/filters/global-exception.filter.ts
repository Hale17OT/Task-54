import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { WinstonLogger } from '../../infrastructure/logging/winston.logger';
import { ErrorCodes } from '@checc/shared/constants/error-codes';
import type { ApiErrorResponse } from '@checc/shared/types/common.types';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: WinstonLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode: string = ErrorCodes.INTERNAL_ERROR;
    let message = 'An unexpected error occurred';
    let details: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;
        errorCode = (resp.errorCode as string) || this.mapStatusToErrorCode(status);
        details = resp.details as Record<string, string[]> | undefined;
      } else {
        message = exception.message;
        errorCode = this.mapStatusToErrorCode(status);
      }
    } else if (exception instanceof Error) {
      message = 'An unexpected error occurred';
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        'GlobalExceptionFilter',
      );
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
        'GlobalExceptionFilter',
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} ${status} - ${message}`,
        'GlobalExceptionFilter',
      );
    }

    const errorResponse: ApiErrorResponse = {
      statusCode: status,
      errorCode,
      message,
      details,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorResponse);
  }

  private mapStatusToErrorCode(status: number): string {
    switch (status) {
      case 400: return ErrorCodes.VALIDATION_ERROR;
      case 401: return ErrorCodes.INVALID_CREDENTIALS;
      case 403: return ErrorCodes.FORBIDDEN;
      case 404: return ErrorCodes.NOT_FOUND;
      default: return ErrorCodes.INTERNAL_ERROR;
    }
  }
}
