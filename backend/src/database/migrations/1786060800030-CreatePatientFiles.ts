import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePatientFiles1786060800030 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "patient_file_category_enum" AS ENUM ('CLINICAL_PHOTO','XRAY','DOCUMENT','FORM','OTHER')`,
    );
    await queryRunner.query(`
      CREATE TABLE "patient_files" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "branch_id" uuid NOT NULL,
        "patient_id" uuid NOT NULL,
        "source_visit_id" uuid NOT NULL,
        "original_file_name" varchar(255) NOT NULL,
        "object_key" varchar(500) NOT NULL,
        "content_type" varchar(50) NOT NULL,
        "size_bytes" integer NOT NULL,
        "category" "patient_file_category_enum" NOT NULL,
        "note" varchar(500),
        "file_date" date NOT NULL,
        "created_by_user_id" uuid NOT NULL,
        "updated_by_user_id" uuid NOT NULL,
        "archived_by_user_id" uuid,
        "archived_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_patient_files_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_patient_files_object_key" UNIQUE ("object_key"),
        CONSTRAINT "chk_patient_files_name_not_blank" CHECK (length(btrim("original_file_name")) > 0),
        CONSTRAINT "chk_patient_files_content_type" CHECK ("content_type" IN ('image/jpeg','image/png','image/webp','application/pdf')),
        CONSTRAINT "chk_patient_files_size" CHECK ("size_bytes" BETWEEN 1 AND 10485760),
        CONSTRAINT "chk_patient_files_note_length" CHECK ("note" IS NULL OR length("note") BETWEEN 1 AND 500),
        CONSTRAINT "chk_patient_files_archive_pair" CHECK (("archived_at" IS NULL) = ("archived_by_user_id" IS NULL)),
        CONSTRAINT "fk_patient_files_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_patient_files_branch" FOREIGN KEY ("branch_id", "tenant_id") REFERENCES "branches"("id", "tenant_id") ON DELETE RESTRICT,
        CONSTRAINT "fk_patient_files_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_patient_files_source_visit" FOREIGN KEY ("source_visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_patient_files_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_patient_files_updated_by" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_patient_files_archived_by" FOREIGN KEY ("archived_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_patient_files_patient_date" ON "patient_files" ("tenant_id", "branch_id", "patient_id", "archived_at", "file_date" DESC, "id" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_patient_files_patient_category_date" ON "patient_files" ("tenant_id", "branch_id", "patient_id", "category", "archived_at", "file_date" DESC, "id" DESC)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "patient_files"');
    await queryRunner.query('DROP TYPE "patient_file_category_enum"');
  }
}
