import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTreatmentProgressNotes1786060800028 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "treatment_item_event_type_enum" RENAME TO "treatment_item_event_type_enum_old"',
    );
    await queryRunner.query(
      `CREATE TYPE "treatment_item_event_type_enum" AS ENUM ('IN_PROGRESS','COMPLETED','CANCELLED','PROGRESS_NOTE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "treatment_item_events" ALTER COLUMN "event_type" TYPE "treatment_item_event_type_enum" USING "event_type"::text::"treatment_item_event_type_enum"`,
    );
    await queryRunner.query('DROP TYPE "treatment_item_event_type_enum_old"');
    await queryRunner.query(
      'ALTER TABLE "treatment_item_events" ADD "content" text',
    );
    await queryRunner.query(`
      ALTER TABLE "treatment_item_events"
      ADD CONSTRAINT "chk_treatment_item_events_progress_content"
      CHECK (
        ("event_type" = 'PROGRESS_NOTE' AND "content" IS NOT NULL AND length(btrim("content")) BETWEEN 1 AND 2000)
        OR ("event_type" <> 'PROGRESS_NOTE' AND "content" IS NULL)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "treatment_item_event_images" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "object_key" varchar(500) NOT NULL,
        "content_type" varchar(50) NOT NULL,
        "size_bytes" integer NOT NULL,
        "sort_order" smallint NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_treatment_item_event_images_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_treatment_item_event_images_event_sort" UNIQUE ("event_id", "sort_order"),
        CONSTRAINT "uq_treatment_item_event_images_object_key" UNIQUE ("object_key"),
        CONSTRAINT "fk_treatment_item_event_images_event" FOREIGN KEY ("event_id") REFERENCES "treatment_item_events"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_treatment_item_event_images_content_type" CHECK ("content_type" IN ('image/jpeg','image/png','image/webp')),
        CONSTRAINT "chk_treatment_item_event_images_size" CHECK ("size_bytes" BETWEEN 1 AND 5242880),
        CONSTRAINT "chk_treatment_item_event_images_sort" CHECK ("sort_order" BETWEEN 0 AND 4)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_treatment_item_event_images_event" ON "treatment_item_event_images" ("event_id", "sort_order")',
    );
    await queryRunner.query(
      `CREATE FUNCTION "prevent_treatment_item_event_image_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'treatment_item_event_images are append-only'; END; $$`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "trg_treatment_item_event_images_append_only" BEFORE UPDATE OR DELETE ON "treatment_item_event_images" FOR EACH ROW EXECUTE FUNCTION "prevent_treatment_item_event_image_mutation"()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER "trg_treatment_item_event_images_append_only" ON "treatment_item_event_images"',
    );
    await queryRunner.query('DROP TABLE "treatment_item_event_images"');
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS "prevent_treatment_item_event_image_mutation"',
    );
    await queryRunner.query(
      'DROP TRIGGER "trg_treatment_item_events_append_only" ON "treatment_item_events"',
    );
    await queryRunner.query(
      `DELETE FROM "treatment_item_events" WHERE "event_type" = 'PROGRESS_NOTE'`,
    );
    await queryRunner.query(
      'ALTER TABLE "treatment_item_events" DROP CONSTRAINT "chk_treatment_item_events_progress_content"',
    );
    await queryRunner.query(
      'ALTER TABLE "treatment_item_events" DROP COLUMN "content"',
    );
    await queryRunner.query(
      'ALTER TYPE "treatment_item_event_type_enum" RENAME TO "treatment_item_event_type_enum_old"',
    );
    await queryRunner.query(
      `CREATE TYPE "treatment_item_event_type_enum" AS ENUM ('IN_PROGRESS','COMPLETED','CANCELLED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "treatment_item_events" ALTER COLUMN "event_type" TYPE "treatment_item_event_type_enum" USING "event_type"::text::"treatment_item_event_type_enum"`,
    );
    await queryRunner.query('DROP TYPE "treatment_item_event_type_enum_old"');
    await queryRunner.query(
      `CREATE TRIGGER "trg_treatment_item_events_append_only" BEFORE UPDATE OR DELETE ON "treatment_item_events" FOR EACH ROW EXECUTE FUNCTION "prevent_treatment_item_event_mutation"()`,
    );
  }
}
