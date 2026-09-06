import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export enum IdempotencyRecordStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
}

export type ReplayableResponseHeaders = Record<string, string | string[]>;
// Cố ý không dùng kiểu đệ quy: TypeORM sẽ mở rộng kiểu property khi tạo partial
// update type, khiến kiểu JSON đệ quy bị tràn độ sâu. JSON container vẫn được
// biểu diễn bằng `object` tại ranh giới persistence.
export type IdempotencyResponseBody = object | string | number | boolean | null;

@Entity({ name: 'idempotency_records' })
@Unique('uq_idempotency_records_actor_key_hash', [
  'actorUserId',
  'idempotencyKeyHash',
])
@Index('idx_idempotency_records_completed_expiry', ['status', 'expiresAt'])
@Check(
  'chk_idempotency_records_completed_status',
  `("status" = 'PROCESSING' AND "processing_token" IS NOT NULL AND "processing_lease_expires_at" IS NOT NULL AND "http_status" IS NULL AND "completed_at" IS NULL AND "expires_at" IS NULL) OR ("status" = 'COMPLETED' AND "processing_token" IS NULL AND "processing_lease_expires_at" IS NULL AND "http_status" IS NOT NULL AND "response_headers" IS NOT NULL AND "completed_at" IS NOT NULL AND "expires_at" IS NOT NULL)`,
)
/**
 * Trạng thái replay kỹ thuật cho một cặp actor/key. Entity chỉ lưu HMAC và
 * response snapshot đã hoàn tất, không lưu key hay request body gốc của client.
 */
export class IdempotencyRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_user_id', type: 'uuid' })
  actorUserId: string;

  @Column({ name: 'idempotency_key_hash', type: 'varchar', length: 64 })
  idempotencyKeyHash: string;

  @Column({ name: 'request_fingerprint_hash', type: 'varchar', length: 64 })
  requestFingerprintHash: string;

  @Column({
    type: 'enum',
    enum: IdempotencyRecordStatus,
    enumName: 'idempotency_record_status_enum',
  })
  status: IdempotencyRecordStatus;

  @Column({ name: 'processing_token', type: 'uuid', nullable: true })
  processingToken: string | null;

  @Column({
    name: 'processing_lease_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  processingLeaseExpiresAt: Date | null;

  @Column({ name: 'http_status', type: 'smallint', nullable: true })
  httpStatus: number | null;

  @Column({ name: 'response_has_body', type: 'boolean', default: false })
  responseHasBody: boolean;

  @Column({ name: 'response_body', type: 'jsonb', nullable: true })
  responseBody: IdempotencyResponseBody;

  @Column({ name: 'response_headers', type: 'jsonb', nullable: true })
  responseHeaders: ReplayableResponseHeaders | null;

  @Column({ name: 'original_request_id', type: 'uuid' })
  originalRequestId: string;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
