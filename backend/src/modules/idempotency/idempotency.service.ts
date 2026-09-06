import { Injectable } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import { AppConfigService } from '../../config/app-config.service';
import type { AuthorizationContext } from '../authorization/authorization-context';
import { canonicalJson } from './canonical-json';
import type {
  IdempotencyResponseBody,
  ReplayableResponseHeaders,
} from './entities/idempotency-record.entity';
import {
  type ClaimResult,
  IdempotencyRecordRepository,
} from './idempotency-record.repository';

export interface RequestFingerprintInput {
  operation: string;
  method: string;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  body: unknown;
  authorizationContext: AuthorizationContext;
}

export interface ProcessingClaim {
  recordId: string;
  processingToken: string;
}

export interface CompleteOutcomeInput {
  claim: ProcessingClaim;
  httpStatus: number;
  responseHasBody: boolean;
  responseBody: IdempotencyResponseBody;
  responseHeaders: ReplayableResponseHeaders;
}

@Injectable()
export class IdempotencyService {
  constructor(
    private readonly config: AppConfigService,
    private readonly records: IdempotencyRecordRepository,
  ) {}

  /**
   * Chuyển key do client gửi thành dạng duy nhất được lưu persistence.
   * Không được lưu raw idempotency key trong PostgreSQL hoặc log.
   */
  hashKey(key: string): string {
    return this.hash('idempotency-key', key);
  }

  /**
   * Gắn key với đúng command intent, bao gồm scope do server resolve.
   * Tenant và branch ID được lấy từ authorization context đã xác thực, không
   * bao giờ từ field do client gửi.
   */
  fingerprint(input: RequestFingerprintInput): string {
    const context = input.authorizationContext;

    return this.hash(
      'idempotency-request-fingerprint',
      canonicalJson({
        operation: input.operation,
        method: input.method.toUpperCase(),
        params: input.params,
        query: input.query,
        body: input.body,
        resolvedContext: {
          scope: context.scope,
          tenantId: context.tenant?.id ?? null,
          branchId: context.branch?.id ?? null,
        },
      }),
    );
  }

  /**
   * Bắt đầu lease PROCESSING ngắn hạn. Token trả về chứng minh request này sở
   * hữu record khi hoàn tất hoặc giải phóng nó ở bước sau.
   */
  async claim({
    actorUserId,
    idempotencyKeyHash,
    requestFingerprintHash,
    originalRequestId,
  }: {
    actorUserId: string;
    idempotencyKeyHash: string;
    requestFingerprintHash: string;
    originalRequestId: string;
  }): Promise<ClaimResult> {
    const processingToken = randomUUID();
    const processingLeaseExpiresAt = new Date(
      Date.now() + this.config.idempotencyConfig.processingLeaseMs,
    );

    return this.records.claim({
      actorUserId,
      idempotencyKeyHash,
      requestFingerprintHash,
      processingToken,
      processingLeaseExpiresAt,
      originalRequestId,
    });
  }

  /**
   * Lưu HTTP outcome có thể replay và chuyển lease đang sở hữu sang COMPLETED.
   * Thời gian retention chỉ bắt đầu sau khi command hoàn tất.
   */
  async complete(input: CompleteOutcomeInput): Promise<boolean> {
    const completedAt = new Date();
    const expiresAt = new Date(
      completedAt.getTime() +
        this.config.idempotencyConfig.completedRetentionMs,
    );

    return this.records.complete({
      ...input.claim,
      httpStatus: input.httpStatus,
      responseHasBody: input.responseHasBody,
      responseBody: input.responseBody,
      responseHeaders: input.responseHeaders,
      completedAt,
      expiresAt,
    });
  }

  /** Chỉ giải phóng lease PROCESSING của caller khi handler bị lỗi. */
  release(claim: ProcessingClaim): Promise<void> {
    return this.records.release(claim.recordId, claim.processingToken);
  }

  /** Chỉ xóa record COMPLETED đã hết thời gian retention được cấu hình. */
  purgeExpiredCompleted(): Promise<number> {
    return this.records.purgeExpiredCompleted(new Date());
  }

  private hash(namespace: string, value: string): string {
    return createHmac('sha256', this.config.idempotencyConfig.hmacSecret)
      .update(namespace)
      .update('\0')
      .update(value)
      .digest('hex');
  }
}
