import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  IdempotencyRecord,
  IdempotencyRecordStatus,
  type IdempotencyResponseBody,
  type ReplayableResponseHeaders,
} from './entities/idempotency-record.entity';

export interface ClaimInput {
  actorUserId: string;
  idempotencyKeyHash: string;
  requestFingerprintHash: string;
  processingToken: string;
  processingLeaseExpiresAt: Date;
  originalRequestId: string;
}

export type ClaimResult =
  | { kind: 'claimed'; recordId: string; processingToken: string }
  | { kind: 'replay'; record: IdempotencyRecord }
  | { kind: 'mismatch' }
  | { kind: 'in_progress'; retryAfterSeconds: number };

export interface CompleteInput {
  recordId: string;
  processingToken: string;
  httpStatus: number;
  responseHasBody: boolean;
  responseBody: IdempotencyResponseBody;
  responseHeaders: ReplayableResponseHeaders;
  completedAt: Date;
  expiresAt: Date;
}

@Injectable()
export class IdempotencyRecordRepository {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Claim key một cách atomic hoặc phân loại record hiện có thành replay,
   * request mismatch, hoặc lease đang hoạt động. Transaction này không bao giờ
   * bao quanh mutation của controller hay business service.
   */
  async claim(input: ClaimInput): Promise<ClaimResult> {
    return this.dataSource.transaction((manager) =>
      this.claimInTransaction(manager, input),
    );
  }

  /**
   * Chỉ lưu outcome khi request này vẫn sở hữu đúng PROCESSING token, ngăn lease
   * owner cũ ghi đè request mới hơn.
   */
  async complete(input: CompleteInput): Promise<boolean> {
    const result = await this.dataSource
      .createQueryBuilder()
      .update(IdempotencyRecord)
      .set({
        status: IdempotencyRecordStatus.COMPLETED,
        processingToken: null,
        processingLeaseExpiresAt: null,
        httpStatus: input.httpStatus,
        responseHasBody: input.responseHasBody,
        responseBody: input.responseBody,
        responseHeaders: input.responseHeaders,
        completedAt: input.completedAt,
        expiresAt: input.expiresAt,
      })
      .where('id = :recordId', { recordId: input.recordId })
      .andWhere('status = :status', {
        status: IdempotencyRecordStatus.PROCESSING,
      })
      .andWhere('processing_token = :processingToken', {
        processingToken: input.processingToken,
      })
      .execute();

    return (result.affected ?? 0) === 1;
  }

  /**
   * Chỉ xóa lease của request lỗi khi token được gửi vẫn sở hữu nó; lease đã bị
   * reclaim không bao giờ bị xóa bởi owner trước đó.
   */
  async release(recordId: string, processingToken: string): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(IdempotencyRecord)
      .where('id = :recordId', { recordId })
      .andWhere('status = :status', {
        status: IdempotencyRecordStatus.PROCESSING,
      })
      .andWhere('processing_token = :processingToken', { processingToken })
      .execute();
  }

  /**
   * Xóa retention do scheduler hằng ngày dùng. An toàn khi chạy nhiều lần hoặc
   * đồng thời giữa các API instance.
   */
  async purgeExpiredCompleted(now: Date): Promise<number> {
    const result = await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(IdempotencyRecord)
      .where('status = :status', { status: IdempotencyRecordStatus.COMPLETED })
      .andWhere('expires_at <= :now', { now })
      .execute();

    return result.affected ?? 0;
  }

  private async claimInTransaction(
    manager: EntityManager,
    input: ClaimInput,
  ): Promise<ClaimResult> {
    // Unique constraint là cơ chế concurrency giữa các instance. Khi conflict,
    // lock rồi phân loại record actor/key duy nhất đang tồn tại ở dưới.
    const inserted = await manager
      .createQueryBuilder()
      .insert()
      .into(IdempotencyRecord)
      .values(this.toProcessingValues(input))
      .orIgnore()
      .returning(['id'])
      .execute();

    const insertedId = this.idFromIdentifier(inserted.identifiers[0]);
    if (insertedId !== null) {
      return {
        kind: 'claimed',
        recordId: insertedId,
        processingToken: input.processingToken,
      };
    }

    const record = await manager
      .getRepository(IdempotencyRecord)
      .createQueryBuilder('record')
      .setLock('pessimistic_write')
      .where('record.actor_user_id = :actorUserId', {
        actorUserId: input.actorUserId,
      })
      .andWhere('record.idempotency_key_hash = :idempotencyKeyHash', {
        idempotencyKeyHash: input.idempotencyKeyHash,
      })
      .getOneOrFail();

    const now = new Date();
    if (
      record.status === IdempotencyRecordStatus.COMPLETED &&
      record.expiresAt !== null &&
      record.expiresAt <= now
    ) {
      // Retention hết hạn khiến cùng key trở thành một intent mới.
      await manager.remove(record);
      const replacement = await manager.save(
        manager.create(IdempotencyRecord, this.toProcessingValues(input)),
      );

      return {
        kind: 'claimed',
        recordId: replacement.id,
        processingToken: input.processingToken,
      };
    }

    if (record.requestFingerprintHash !== input.requestFingerprintHash) {
      return { kind: 'mismatch' };
    }

    if (record.status === IdempotencyRecordStatus.COMPLETED) {
      return { kind: 'replay', record };
    }

    if (
      record.processingLeaseExpiresAt !== null &&
      record.processingLeaseExpiresAt > now
    ) {
      return {
        kind: 'in_progress',
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(
            (record.processingLeaseExpiresAt.getTime() - now.getTime()) / 1000,
          ),
        ),
      };
    }

    await manager
      .getRepository(IdempotencyRecord)
      .update(record.id, this.toProcessingValues(input));

    return {
      kind: 'claimed',
      recordId: record.id,
      processingToken: input.processingToken,
    };
  }

  private toProcessingValues(input: ClaimInput): Partial<IdempotencyRecord> {
    return {
      actorUserId: input.actorUserId,
      idempotencyKeyHash: input.idempotencyKeyHash,
      requestFingerprintHash: input.requestFingerprintHash,
      status: IdempotencyRecordStatus.PROCESSING,
      processingToken: input.processingToken,
      processingLeaseExpiresAt: input.processingLeaseExpiresAt,
      httpStatus: null,
      responseHasBody: false,
      responseBody: null,
      responseHeaders: null,
      originalRequestId: input.originalRequestId,
      completedAt: null,
      expiresAt: null,
    };
  }

  private idFromIdentifier(identifier: unknown): string | null {
    if (
      typeof identifier === 'object' &&
      identifier !== null &&
      'id' in identifier &&
      typeof identifier.id === 'string'
    ) {
      return identifier.id;
    }

    return null;
  }
}
