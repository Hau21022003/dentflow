import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggingModule } from './common/logging/logging.module';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import appConfig from './config/app.config';
import { validateEnvironment } from './config/env.validation';
import { AppI18nModule } from './i18n/app-i18n.module';
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
    AppConfigModule,
    AppI18nModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
