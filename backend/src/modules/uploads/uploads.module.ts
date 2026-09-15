import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [StorageModule, AuthorizationModule],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
