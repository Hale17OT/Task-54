import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { WinstonLogger } from './infrastructure/logging/winston.logger';
import { GlobalExceptionFilter } from './api/filters/global-exception.filter';
import { ZodValidationPipe } from './api/pipes/zod-validation.pipe';
import { runSeed } from './infrastructure/persistence/seed';

async function bootstrap() {
  const logger = new WinstonLogger();
  const app = await NestFactory.create(AppModule, { logger });

  // Run seed if RUN_SEED=true (idempotent — skips if data already exists)
  if (process.env.RUN_SEED === 'true') {
    try {
      const dataSource = app.get(DataSource);
      await runSeed(dataSource);
    } catch (err) {
      logger.warn(`Seed execution failed: ${err}`, 'Bootstrap');
    }
  }

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.useGlobalPipes(new ZodValidationPipe());
  const defaultOrigins = ['http://localhost:5173', 'http://localhost:3000'];
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : defaultOrigins;
  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`CHECC API running on port ${port}`, 'Bootstrap');
}

bootstrap();
