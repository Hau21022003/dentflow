// test/setup/app.setup.ts
import { ClassSerializerInterceptor, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { useContainer } from 'class-validator';
// import cookieParser from 'cookie-parser';
import { AppModule } from 'src/app.module';
import { GlobalExceptionFilter } from 'src/common/filters/http-exception.filter';
import { LoggingInterceptor } from 'src/common/interceptors/logging.interceptor';
import { AppLogger } from 'src/common/logging/app-logger.service';
import { CustomValidationPipe } from 'src/common/pipes/custom-validation.pipe';
import { AppConfigService } from 'src/config/app-config.service';

let app: INestApplication;

export async function initApp() {
  if (app) return app;

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();

  // app.use(cookieParser());

  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  app.useGlobalPipes(
    new CustomValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new LoggingInterceptor(app.get(AppLogger), app.get(AppConfigService)),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.init();
  return app;
}

export async function closeApp() {
  await app?.close();
}
