import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientOverviewAndOperatories1786060800024 implements MigrationInterface {
  name = 'AddPatientOverviewAndOperatories1786060800024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tenant_display_counters" (
        "tenant_id" uuid NOT NULL,
        "next_patient_number" bigint NOT NULL DEFAULT 1,
        "next_treatment_plan_number" bigint NOT NULL DEFAULT 1,
        CONSTRAINT "pk_tenant_display_counters" PRIMARY KEY ("tenant_id"),
        CONSTRAINT "fk_tenant_display_counters_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_tenant_display_counters_positive" CHECK ("next_patient_number" > 0 AND "next_treatment_plan_number" > 0)
      )
    `);

    await queryRunner.query(
      'ALTER TABLE "patients" ADD COLUMN "display_number" bigint, ADD COLUMN "email" varchar(254)',
    );
    await queryRunner.query(
      'ALTER TABLE "treatment_plans" ADD COLUMN "display_number" bigint',
    );
    await queryRunner.query(`
      WITH numbered AS (
        SELECT id, row_number() OVER (PARTITION BY tenant_id ORDER BY created_at, id) AS display_number
        FROM patients
      )
      UPDATE patients
      SET display_number = numbered.display_number
      FROM numbered
      WHERE patients.id = numbered.id
    `);
    await queryRunner.query(`
      WITH numbered AS (
        SELECT id, row_number() OVER (PARTITION BY tenant_id ORDER BY created_at, id) AS display_number
        FROM treatment_plans
      )
      UPDATE treatment_plans
      SET display_number = numbered.display_number
      FROM numbered
      WHERE treatment_plans.id = numbered.id
    `);
    await queryRunner.query(`
      INSERT INTO tenant_display_counters (tenant_id, next_patient_number, next_treatment_plan_number)
      SELECT tenant.id,
        COALESCE((SELECT MAX(patient.display_number) + 1 FROM patients patient WHERE patient.tenant_id = tenant.id), 1),
        COALESCE((SELECT MAX(plan.display_number) + 1 FROM treatment_plans plan WHERE plan.tenant_id = tenant.id), 1)
      FROM tenants tenant
    `);
    await queryRunner.query(
      'ALTER TABLE "patients" ALTER COLUMN "display_number" SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "treatment_plans" ALTER COLUMN "display_number" SET NOT NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_patients_tenant_display_number" ON "patients" ("tenant_id", "display_number")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_treatment_plans_tenant_display_number" ON "treatment_plans" ("tenant_id", "display_number")',
    );
    await queryRunner.query(`
      CREATE FUNCTION allocate_patient_display_number() RETURNS trigger AS $$
      BEGIN
        IF NEW.display_number IS NULL THEN
          INSERT INTO tenant_display_counters (tenant_id)
          VALUES (NEW.tenant_id)
          ON CONFLICT (tenant_id) DO NOTHING;
          UPDATE tenant_display_counters
          SET next_patient_number = next_patient_number + 1
          WHERE tenant_id = NEW.tenant_id
          RETURNING next_patient_number - 1 INTO NEW.display_number;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE FUNCTION allocate_treatment_plan_display_number() RETURNS trigger AS $$
      BEGIN
        IF NEW.display_number IS NULL THEN
          INSERT INTO tenant_display_counters (tenant_id)
          VALUES (NEW.tenant_id)
          ON CONFLICT (tenant_id) DO NOTHING;
          UPDATE tenant_display_counters
          SET next_treatment_plan_number = next_treatment_plan_number + 1
          WHERE tenant_id = NEW.tenant_id
          RETURNING next_treatment_plan_number - 1 INTO NEW.display_number;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(
      'CREATE TRIGGER "trg_patients_display_number" BEFORE INSERT ON "patients" FOR EACH ROW EXECUTE FUNCTION allocate_patient_display_number()',
    );
    await queryRunner.query(
      'CREATE TRIGGER "trg_treatment_plans_display_number" BEFORE INSERT ON "treatment_plans" FOR EACH ROW EXECUTE FUNCTION allocate_treatment_plan_display_number()',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_treatment_plans_overview" ON "treatment_plans" ("tenant_id", "branch_id", "patient_id", "status", "updated_at" DESC)',
    );

    await queryRunner.query(
      `CREATE TYPE "patient_alert_category_enum" AS ENUM ('ALLERGY', 'MEDICAL_CONDITION', 'MEDICATION', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "patient_alert_severity_enum" AS ENUM ('INFO', 'WARNING', 'CRITICAL')`,
    );
    await queryRunner.query(`
      CREATE TABLE "patient_alerts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "patient_id" uuid NOT NULL,
        "category" "patient_alert_category_enum" NOT NULL,
        "severity" "patient_alert_severity_enum" NOT NULL,
        "message" varchar(500) NOT NULL,
        "created_by_user_id" uuid NOT NULL,
        "resolved_by_user_id" uuid,
        "resolved_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_patient_alerts" PRIMARY KEY ("id"),
        CONSTRAINT "chk_patient_alert_message_not_blank" CHECK (length(btrim("message")) > 0),
        CONSTRAINT "chk_patient_alert_resolution_pair" CHECK (("resolved_by_user_id" IS NULL) = ("resolved_at" IS NULL)),
        CONSTRAINT "fk_patient_alerts_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_patient_alerts_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_patient_alerts_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_patient_alerts_resolved_by" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_patient_alerts_active" ON "patient_alerts" ("tenant_id", "patient_id", "severity", "created_at") WHERE "resolved_at" IS NULL',
    );

    await queryRunner.query(`
      CREATE TABLE "operatories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "branch_id" uuid NOT NULL,
        "code" varchar(100) NOT NULL,
        "name" varchar(150) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_operatories" PRIMARY KEY ("id"),
        CONSTRAINT "uq_operatories_identity_scope" UNIQUE ("id", "tenant_id", "branch_id"),
        CONSTRAINT "chk_operatories_code_not_blank" CHECK (length(btrim("code")) > 0),
        CONSTRAINT "chk_operatories_name_not_blank" CHECK (length(btrim("name")) > 0),
        CONSTRAINT "fk_operatories_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_operatories_branch" FOREIGN KEY ("branch_id", "tenant_id") REFERENCES "branches"("id", "tenant_id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_operatories_branch_code_ci" ON "operatories" ("tenant_id", "branch_id", lower("code"))',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_operatories_branch_name_ci" ON "operatories" ("tenant_id", "branch_id", lower("name"))',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_operatories_branch_active_name" ON "operatories" ("tenant_id", "branch_id", "is_active", "name", "id")',
    );

    await queryRunner.query(
      'ALTER TABLE "appointments" ADD COLUMN "operatory_id" uuid',
    );
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD CONSTRAINT "fk_appointments_operatory_in_same_branch"
      FOREIGN KEY ("operatory_id", "tenant_id", "branch_id")
      REFERENCES "operatories"("id", "tenant_id", "branch_id") ON DELETE RESTRICT
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_appointments_operatory_start_at_id" ON "appointments" ("tenant_id", "branch_id", "operatory_id", "start_at", "id")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_appointments_patient_status_start_at" ON "appointments" ("tenant_id", "branch_id", "patient_id", "status", "start_at", "id")',
    );
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD CONSTRAINT "ex_appointments_operatory_time_overlap"
      EXCLUDE USING gist (
        "operatory_id" WITH =,
        tstzrange("start_at", "end_at", '[)') WITH &&
      )
      WHERE (
        "operatory_id" IS NOT NULL
        AND "status" IN ('BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "appointments" DROP CONSTRAINT "ex_appointments_operatory_time_overlap"',
    );
    await queryRunner.query(
      'DROP INDEX "idx_appointments_patient_status_start_at"',
    );
    await queryRunner.query(
      'DROP INDEX "idx_appointments_operatory_start_at_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "appointments" DROP CONSTRAINT "fk_appointments_operatory_in_same_branch"',
    );
    await queryRunner.query(
      'ALTER TABLE "appointments" DROP COLUMN "operatory_id"',
    );
    await queryRunner.query('DROP TABLE "operatories"');
    await queryRunner.query('DROP TABLE "patient_alerts"');
    await queryRunner.query('DROP TYPE "patient_alert_severity_enum"');
    await queryRunner.query('DROP TYPE "patient_alert_category_enum"');
    await queryRunner.query('DROP INDEX "idx_treatment_plans_overview"');
    await queryRunner.query(
      'DROP TRIGGER "trg_treatment_plans_display_number" ON "treatment_plans"',
    );
    await queryRunner.query(
      'DROP TRIGGER "trg_patients_display_number" ON "patients"',
    );
    await queryRunner.query(
      'DROP FUNCTION allocate_treatment_plan_display_number()',
    );
    await queryRunner.query('DROP FUNCTION allocate_patient_display_number()');
    await queryRunner.query(
      'DROP INDEX "uq_treatment_plans_tenant_display_number"',
    );
    await queryRunner.query('DROP INDEX "uq_patients_tenant_display_number"');
    await queryRunner.query(
      'ALTER TABLE "treatment_plans" DROP COLUMN "display_number"',
    );
    await queryRunner.query(
      'ALTER TABLE "patients" DROP COLUMN "email", DROP COLUMN "display_number"',
    );
    await queryRunner.query('DROP TABLE "tenant_display_counters"');
  }
}
