import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePatients1786060800020 implements MigrationInterface {
  name = 'CreatePatients1786060800020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "patient_gender_enum" AS ENUM ('MALE', 'FEMALE', 'OTHER')
    `);
    await queryRunner.query(`
      CREATE TABLE "patients" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "full_name" character varying(150) NOT NULL,
        "phone" character varying(30) NOT NULL,
        "phone_normalized" character varying(20) NOT NULL,
        "date_of_birth" date,
        "gender" "patient_gender_enum" NOT NULL,
        "address" character varying(500),
        "emergency_contact_name" character varying(150),
        "emergency_contact_phone" character varying(30),
        "emergency_contact_relationship" character varying(100),
        "referral_source" character varying(150),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_patients_id" PRIMARY KEY ("id"),
        CONSTRAINT "chk_patients_full_name_not_blank"
          CHECK (length(btrim("full_name")) > 0),
        CONSTRAINT "chk_patients_phone_not_blank"
          CHECK (length(btrim("phone")) > 0),
        CONSTRAINT "fk_patients_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_patients_tenant_id_phone_normalized" ON "patients" ("tenant_id", "phone_normalized")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_patients_tenant_id_full_name_id" ON "patients" ("tenant_id", "full_name", "id")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_patients_tenant_id_created_at_id" ON "patients" ("tenant_id", "created_at", "id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "patients"');
    await queryRunner.query('DROP TYPE "patient_gender_enum"');
  }
}
