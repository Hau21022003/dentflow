import { Module } from '@nestjs/common';
import { EmailModule } from './email/email.module';
import { StorageModule } from './storage/storage.module';

/**
 * Composition root for reusable external-service adapters.
 * Domain modules should import the smallest infrastructure module they use.
 */
@Module({
  imports: [EmailModule, StorageModule],
  exports: [EmailModule, StorageModule],
})
export class InfrastructureModule {}
