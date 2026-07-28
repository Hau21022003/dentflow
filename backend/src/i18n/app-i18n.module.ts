import { Global, Module } from '@nestjs/common';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
} from 'nestjs-i18n';
import path from 'path';
import { AppConfigService } from 'src/config/app-config.service';
import { AppI18nService } from './app-i18n.service';

@Global()
@Module({
  imports: [
    I18nModule.forRootAsync({
      inject: [AppConfigService],
      resolvers: [
        new HeaderResolver(['x-localization']),
        AcceptLanguageResolver,
      ],
      useFactory: (config: AppConfigService) => ({
        fallbackLanguage: config.i18nConfig.fallbackLanguage,
        fallbacks: {
          'vi-VN': 'vi',
          'en-US': 'en',
        },
        loaderOptions: {
          path: path.join(__dirname),
          watch: config.runtimeConfig.isDevelopment,
        },
      }),
    }),
  ],
  providers: [AppI18nService],
  exports: [AppI18nService],
})
export class AppI18nModule {}
