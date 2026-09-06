import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestContextModule } from '../../common/request-context/request-context.module';
import { IdempotencyRecord } from './entities/idempotency-record.entity';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyRecordRepository } from './idempotency-record.repository';
import { IdempotencyRecordPurgeService } from './idempotency-record-purge.service';
import { IdempotencyService } from './idempotency.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IdempotencyRecord]),
    RequestContextModule,
  ],
  providers: [
    IdempotencyInterceptor,
    IdempotencyRecordRepository,
    IdempotencyRecordPurgeService,
    IdempotencyService,
  ],
  exports: [
    IdempotencyInterceptor,
    IdempotencyRecordRepository,
    IdempotencyService,
  ],
})
export class IdempotencyModule {}
