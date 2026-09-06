import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

import { ClassSerializerInterceptor, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AppLogger } from './common/logging/app-logger.service';
import { CustomValidationPipe } from './common/pipes/custom-validation.pipe';
import { AppConfigService } from './config/app-config.service';
import { IdempotencyInterceptor } from './modules/idempotency/idempotency.interceptor';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from './modules/auth/auth.constants';

function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('My API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth(ACCESS_TOKEN_COOKIE, undefined, ACCESS_TOKEN_COOKIE)
    .addCookieAuth(REFRESH_TOKEN_COOKIE, undefined, REFRESH_TOKEN_COOKIE)
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      docExpansion: 'none',
      persistAuthorization: true,
      withCredentials: true,
    },
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  app.useGlobalPipes(
    new CustomValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  setupSwagger(app);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allowed?: boolean) => void,
    ) => {
      const frontendOrigin =
        app.get(AppConfigService).corsConfig.frontendOrigin;
      callback(null, !origin || origin === frontendOrigin);
    },
    methods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  });

  app.useGlobalInterceptors(
    new LoggingInterceptor(app.get(AppLogger), app.get(AppConfigService)),
    app.get(IdempotencyInterceptor),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
