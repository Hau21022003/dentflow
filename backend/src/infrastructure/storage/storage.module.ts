import { Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { createObjectStorage } from './s3-object-storage.factory';
import { OBJECT_STORAGE } from './object-storage.tokens';

@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        createObjectStorage(config.s3Config),
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
