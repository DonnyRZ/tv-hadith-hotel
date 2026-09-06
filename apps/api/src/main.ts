import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { RequestHandler } from 'express';

import { STAFF_SESSION_MIDDLEWARE } from './auth/auth.constants';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './http/api-exception.filter';
import { requestContextMiddleware } from './http/request-context.middleware';
import { RealtimeIoAdapter } from './realtime/realtime.io-adapter';
import { RealtimeState } from './realtime/realtime.state';

export async function createApplication(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const staffSessionMiddleware = app.get<RequestHandler>(STAFF_SESSION_MIDDLEWARE);
  const realtimeAdapter = new RealtimeIoAdapter(
    app,
    config,
    app.get(RealtimeState),
    staffSessionMiddleware,
  );
  await realtimeAdapter.initialize();
  app.useWebSocketAdapter(realtimeAdapter);
  app.getHttpServer().once('close', () => void realtimeAdapter.close());

  app.setGlobalPrefix('api/v1');
  app.use(requestContextMiddleware);
  app.use(staffSessionMiddleware);
  app.enableCors({
    origin: (config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter(config));

  return app;
}

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  const config = app.get(ConfigService);
  const configuredPort = config.get<string>('PORT') ?? config.get<string>('API_PORT') ?? '3000';
  const port = Number(configuredPort);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer; received "${configuredPort}"`);
  }

  await app.listen(port, '0.0.0.0');
}

if (require.main === module) {
  void bootstrap();
}
