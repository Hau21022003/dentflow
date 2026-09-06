import { BullModule } from '@nestjs/bullmq';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core/constants';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggingModule } from './common/logging/logging.module';
import { RequestContextMiddleware } from './common/request-context/request-context.middleware';
import { RequestContextModule } from './common/request-context/request-context.module';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import appConfig from './config/app.config';
import { validateEnvironment } from './config/env.validation';
import { AppI18nModule } from './i18n/app-i18n.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { ModulesModule } from './modules/modules.module';

const runtimeEnvOnly = process.env.RUNTIME_ENV_ONLY === 'true';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: runtimeEnvOnly,
      ...(!runtimeEnvOnly && {
        envFilePath: process.env.NODE_ENV
          ? `.env.${process.env.NODE_ENV}`
          : '.env',
      }),
      load: [appConfig],
      validate: validateEnvironment,
    }),
    ScheduleModule.forRoot(),
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const databaseConfig = config.databaseConfig;

        return {
          type: 'postgres',
          host: databaseConfig.host,
          port: databaseConfig.port,
          username: databaseConfig.username,
          password: databaseConfig.password,
          database: databaseConfig.database,
          synchronize: databaseConfig.synchronize,
          logging: databaseConfig.logging,
          autoLoadEntities: true,
          migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
          timezone: 'Z',
          // Chỉ thêm multipleStatements khi đang ở môi trường testing để tránh rủi ro SQL injection ở môi trường khác
          ...(config.runtimeConfig.isTesting && {
            extra: {
              multipleStatements: true,
            },
          }),
        };
      },
    }),
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        connection: {
          host: config.redisConfig.host,
          port: config.redisConfig.port,
        },
      }),
    }),
    ModulesModule,
    LoggingModule,
    RequestContextModule,
    AppConfigModule,
    AppI18nModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
