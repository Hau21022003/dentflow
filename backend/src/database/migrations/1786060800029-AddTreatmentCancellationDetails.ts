import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTreatmentCancellationDetails1786060800029 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "treatment_item_events" ADD "reason_code" varchar(80)',
    );
    await queryRunner.query(
      'ALTER TABLE "treatment_item_events" ADD "note" varchar(500)',
    );
    await queryRunner.query(`
      ALTER TABLE "treatment_item_events"
      ADD CONSTRAINT "chk_treatment_item_events_reason_code"
      CHECK (
        "reason_code" IS NULL
        OR (
          "event_type" = 'CANCELLED'
          AND "reason_code" ~ '^[A-Z][A-Z0-9_]{0,79}$'
        )
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "treatment_item_events"
      ADD CONSTRAINT "chk_treatment_item_events_cancellation_note"
      CHECK (
        "note" IS NULL
        OR (
          "event_type" = 'CANCELLED'
          AND length(btrim("note")) BETWEEN 1 AND 500
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "treatment_item_events" DROP CONSTRAINT "chk_treatment_item_events_cancellation_note"',
    );
    await queryRunner.query(
      'ALTER TABLE "treatment_item_events" DROP CONSTRAINT "chk_treatment_item_events_reason_code"',
    );
    await queryRunner.query(
      'ALTER TABLE "treatment_item_events" DROP COLUMN "note"',
    );
    await queryRunner.query(
      'ALTER TABLE "treatment_item_events" DROP COLUMN "reason_code"',
    );
  }
}
