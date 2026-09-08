import { Module } from '@nestjs/common';
import { EmailModule } from './email/email.module';

/**
 * Composition root for reusable external-service adapters.
 * Domain modules should import the smallest infrastructure module they use.
 */
@Module({
  imports: [EmailModule],
  exports: [EmailModule],
})
export class InfrastructureModule {}
