// test/setup/app.setup.ts
import { ClassSerializerInterceptor, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { useContainer } from 'class-validator';
import cookieParser from 'cookie-parser';
import { AppModule } from 'src/app.module';
import { GlobalExceptionFilter } from 'src/common/filters/http-exception.filter';
import { LoggingInterceptor } from 'src/common/interceptors/logging.interceptor';
import { AppLogger } from 'src/common/logging/app-logger.service';
import { CustomValidationPipe } from 'src/common/pipes/custom-validation.pipe';
import { AppConfigService } from 'src/config/app-config.service';
import { IdempotencyInterceptor } from 'src/modules/idempotency/idempotency.interceptor';

let app: INestApplication;

export async function initApp() {
  if (app) return app;

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();

  app.use(cookieParser());

  const appConfig = app.get(AppConfigService);
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allowed?: boolean) => void,
    ) => {
      callback(null, !origin || origin === appConfig.corsConfig.frontendOrigin);
    },
    methods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  });

  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  app.useGlobalPipes(
    new CustomValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.useGlobalInterceptors(
    new LoggingInterceptor(app.get(AppLogger), appConfig),
    app.get(IdempotencyInterceptor),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.init();
  return app;
}

export async function closeApp() {
  await app?.close();
}
