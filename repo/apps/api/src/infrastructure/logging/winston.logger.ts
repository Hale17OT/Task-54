import { LoggerService } from '@nestjs/common';
import * as winston from 'winston';

const PII_PATTERNS = [
  /password["\s:=]+["']?[^"'\s,}]+/gi,
  /token["\s:=]+["']?[^"'\s,}]+/gi,
  /authorization["\s:=]+["']?[^"'\s,}]+/gi,
  /ssn["\s:=]+["']?\d{3}-?\d{2}-?\d{4}/gi,
  /\b\d{3}-\d{2}-\d{4}\b/g,
];

function scrubPII(message: string): string {
  let scrubbed = message;
  for (const pattern of PII_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, '[REDACTED]');
  }
  return scrubbed;
}

export class WinstonLogger implements LoggerService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
        winston.format.printf((info) => {
          const ctx = info.context ? `[${info.context}]` : '';
          const msg = scrubPII(typeof info.message === 'string' ? info.message : JSON.stringify(info.message));
          const stackTrace = info.stack ? `\n${scrubPII(String(info.stack))}` : '';
          return `${info.timestamp} ${String(info.level).toUpperCase()} ${ctx} ${msg}${stackTrace}`;
        }),
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 10 * 1024 * 1024,
          maxFiles: 10,
        }),
      ],
    });
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { context, stack: trace });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }
}
