import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIdempotencyRecords1786060800010 implements MigrationInterface {
  name = 'CreateIdempotencyRecords1786060800010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "idempotency_record_status_enum" AS ENUM ('PROCESSING', 'COMPLETED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "idempotency_records" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "actor_user_id" uuid NOT NULL,
        "idempotency_key_hash" character varying(64) NOT NULL,
        "request_fingerprint_hash" character varying(64) NOT NULL,
        "status" "idempotency_record_status_enum" NOT NULL,
        "processing_token" uuid,
        "processing_lease_expires_at" TIMESTAMP WITH TIME ZONE,
        "http_status" smallint,
        "response_has_body" boolean NOT NULL DEFAULT false,
        "response_body" jsonb,
        "response_headers" jsonb,
        "original_request_id" uuid NOT NULL,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "expires_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_idempotency_records_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_idempotency_records_actor_key_hash"
          UNIQUE ("actor_user_id", "idempotency_key_hash"),
        CONSTRAINT "fk_idempotency_records_actor_user_id"
          FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_idempotency_records_completed_status"
          CHECK (
            ("status" = 'PROCESSING'
              AND "processing_token" IS NOT NULL
              AND "processing_lease_expires_at" IS NOT NULL
              AND "http_status" IS NULL
              AND "completed_at" IS NULL
              AND "expires_at" IS NULL)
            OR
            ("status" = 'COMPLETED'
              AND "processing_token" IS NULL
              AND "processing_lease_expires_at" IS NULL
              AND "http_status" IS NOT NULL
              AND "response_headers" IS NOT NULL
              AND "completed_at" IS NOT NULL
              AND "expires_at" IS NOT NULL)
          )
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_idempotency_records_completed_expiry" ON "idempotency_records" ("status", "expires_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "idempotency_records"');
    await queryRunner.query('DROP TYPE "idempotency_record_status_enum"');
  }
}
