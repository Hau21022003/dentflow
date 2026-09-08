import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppLogger } from '../../common/logging/app-logger.service';
import { IdempotencyService } from './idempotency.service';

/**
 * Dọn retention là câu lệnh xóa database idempotent và an toàn. Nó chủ đích
 * chạy trong API process, không cần queue hay worker riêng.
 */
@Injectable()
export class IdempotencyRecordPurgeService {
  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Chạy hằng ngày lúc 03:15 UTC. Purge thất bại được log và để lần chạy tiếp
   * theo xử lý vì record idempotency quá hạn không có side effect nghiệp vụ.
   */
  @Cron('0 15 3 * * *', {
    name: 'idempotency-record-purge',
    timeZone: 'UTC',
    waitForCompletion: true,
  })
  async purgeExpiredRecords(): Promise<void> {
    try {
      const deletedCount = await this.idempotency.purgeExpiredCompleted();
      this.logger.info(
        'idempotency_records_purged',
        { deletedCount },
        IdempotencyRecordPurgeService.name,
      );
    } catch (error) {
      this.logger.error(
        'idempotency_record_purge_failed',
        error,
        {},
        IdempotencyRecordPurgeService.name,
      );
    }
  }
}
