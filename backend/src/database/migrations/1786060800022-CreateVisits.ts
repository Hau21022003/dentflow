import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVisits1786060800022 implements MigrationInterface {
  name = 'CreateVisits1786060800022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "visit_status_enum" AS ENUM ('OPEN', 'COMPLETED')
    `);
    await queryRunner.query(`
      CREATE TABLE "visits" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "branch_id" uuid NOT NULL,
        "appointment_id" uuid NOT NULL,
        "opened_by_user_id" uuid NOT NULL,
        "status" "visit_status_enum" NOT NULL DEFAULT 'OPEN',
        "symptoms" text,
        "relevant_history" text,
        "examination" text,
        "diagnosis" text,
        "clinical_note" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_visits_id" PRIMARY KEY ("id"),
        CONSTRAINT "fk_visits_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_visits_branch_in_same_tenant"
          FOREIGN KEY ("branch_id", "tenant_id")
          REFERENCES "branches"("id", "tenant_id") ON DELETE RESTRICT,
        CONSTRAINT "fk_visits_appointment_id"
          FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_visits_opened_by_user_id"
          FOREIGN KEY ("opened_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_visits_symptoms_length"
          CHECK ("symptoms" IS NULL OR char_length("symptoms") <= 10000),
        CONSTRAINT "chk_visits_relevant_history_length"
          CHECK ("relevant_history" IS NULL OR char_length("relevant_history") <= 10000),
        CONSTRAINT "chk_visits_examination_length"
          CHECK ("examination" IS NULL OR char_length("examination") <= 10000),
        CONSTRAINT "chk_visits_diagnosis_length"
          CHECK ("diagnosis" IS NULL OR char_length("diagnosis") <= 10000),
        CONSTRAINT "chk_visits_clinical_note_length"
          CHECK ("clinical_note" IS NULL OR char_length("clinical_note") <= 10000)
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_visits_appointment_id" ON "visits" ("appointment_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_visits_tenant_branch_appointment_id" ON "visits" ("tenant_id", "branch_id", "appointment_id")',
    );
    await queryRunner.query(`
      CREATE TABLE "treatment_notes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "branch_id" uuid NOT NULL,
        "visit_id" uuid NOT NULL,
        "author_user_id" uuid NOT NULL,
        "content" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_treatment_notes_id" PRIMARY KEY ("id"),
        CONSTRAINT "fk_treatment_notes_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_treatment_notes_branch_in_same_tenant"
          FOREIGN KEY ("branch_id", "tenant_id")
          REFERENCES "branches"("id", "tenant_id") ON DELETE RESTRICT,
        CONSTRAINT "fk_treatment_notes_visit_id"
          FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_treatment_notes_author_user_id"
          FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_treatment_notes_content"
          CHECK (char_length(btrim("content")) BETWEEN 1 AND 10000)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_treatment_notes_visit_created_at_id" ON "treatment_notes" ("visit_id", "created_at", "id")',
    );
    await queryRunner.query(`
      CREATE FUNCTION "prevent_treatment_note_mutation"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'treatment_notes are append-only';
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_treatment_notes_append_only"
      BEFORE UPDATE OR DELETE ON "treatment_notes"
      FOR EACH ROW EXECUTE FUNCTION "prevent_treatment_note_mutation"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER "trg_treatment_notes_append_only" ON "treatment_notes"',
    );
    await queryRunner.query('DROP FUNCTION "prevent_treatment_note_mutation"');
    await queryRunner.query('DROP TABLE "treatment_notes"');
    await queryRunner.query('DROP TABLE "visits"');
    await queryRunner.query('DROP TYPE "visit_status_enum"');
  }
}
