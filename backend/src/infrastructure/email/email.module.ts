import { Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { EMAIL_SENDER } from './email.tokens';
import { createEmailSender } from './email-sender.factory';

@Module({
  providers: [
    {
      provide: EMAIL_SENDER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        createEmailSender(config.emailConfig, config.runtimeConfig.nodeEnv),
    },
  ],
  exports: [EMAIL_SENDER],
})
export class EmailModule {}
