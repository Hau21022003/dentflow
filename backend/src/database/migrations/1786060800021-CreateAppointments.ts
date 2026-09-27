import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppointments1786060800021 implements MigrationInterface {
  name = 'CreateAppointments1786060800021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "appointment_status_enum" AS ENUM (
        'BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS',
        'COMPLETED', 'CANCELLED', 'NO_SHOW'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "appointment_source_enum" AS ENUM (
        'PHONE', 'WALK_IN', 'ONLINE', 'OTHER'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "appointments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "branch_id" uuid NOT NULL,
        "patient_id" uuid NOT NULL,
        "status" "appointment_status_enum" NOT NULL DEFAULT 'BOOKED',
        "source" "appointment_source_enum" NOT NULL,
        "start_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "end_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "assigned_dentist_user_id" uuid,
        "service_id" uuid,
        "service_code" character varying(100),
        "service_name" character varying(150),
        "service_amount" integer,
        "service_currency" character(3),
        "service_duration_minutes" smallint,
        "visit_reason" character varying(1000),
        "operational_note" character varying(2000),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_appointments_id" PRIMARY KEY ("id"),
        CONSTRAINT "chk_appointments_time_range"
          CHECK ("start_at" < "end_at"),
        CONSTRAINT "chk_appointments_reason_without_service"
          CHECK ("service_id" IS NOT NULL OR length(btrim(coalesce("visit_reason", ''))) > 0),
        CONSTRAINT "chk_appointments_service_snapshot"
          CHECK (
            ("service_id" IS NULL AND "service_code" IS NULL AND "service_name" IS NULL AND "service_amount" IS NULL AND "service_currency" IS NULL AND "service_duration_minutes" IS NULL)
            OR
            ("service_id" IS NOT NULL AND "service_code" IS NOT NULL AND "service_name" IS NOT NULL AND "service_amount" IS NOT NULL AND "service_currency" IS NOT NULL AND "service_duration_minutes" IS NOT NULL)
          ),
        CONSTRAINT "chk_appointments_service_snapshot_amount"
          CHECK ("service_amount" IS NULL OR "service_amount" >= 0),
        CONSTRAINT "chk_appointments_service_snapshot_currency"
          CHECK ("service_currency" IS NULL OR "service_currency" ~ '^[A-Z]{3}$'),
        CONSTRAINT "chk_appointments_service_snapshot_duration"
          CHECK ("service_duration_minutes" IS NULL OR "service_duration_minutes" > 0),
        CONSTRAINT "fk_appointments_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_appointments_branch_in_same_tenant"
          FOREIGN KEY ("branch_id", "tenant_id")
          REFERENCES "branches"("id", "tenant_id") ON DELETE RESTRICT,
        CONSTRAINT "fk_appointments_patient_id"
          FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_appointments_service_id"
          FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_appointments_assigned_dentist_user_id"
          FOREIGN KEY ("assigned_dentist_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_appointments_branch_start_at_id" ON "appointments" ("tenant_id", "branch_id", "start_at", "id")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_appointments_branch_status_start_at_id" ON "appointments" ("tenant_id", "branch_id", "status", "start_at", "id")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_appointments_assigned_dentist_start_at_id" ON "appointments" ("tenant_id", "branch_id", "assigned_dentist_user_id", "start_at", "id")',
    );
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "btree_gist"');
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD CONSTRAINT "ex_appointments_assigned_dentist_time_overlap"
      EXCLUDE USING gist (
        "assigned_dentist_user_id" WITH =,
        tstzrange("start_at", "end_at", '[)') WITH &&
      )
      WHERE (
        "assigned_dentist_user_id" IS NOT NULL
        AND "status" IN ('BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "appointment_status_transitions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "appointment_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "branch_id" uuid NOT NULL,
        "from_status" "appointment_status_enum",
        "to_status" "appointment_status_enum" NOT NULL,
        "reason_code" character varying(80),
        "changed_by_user_id" uuid NOT NULL,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_appointment_status_transitions_id" PRIMARY KEY ("id"),
        CONSTRAINT "fk_appointment_status_transitions_appointment_id"
          FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_appointment_status_transitions_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_appointment_status_transitions_branch_in_same_tenant"
          FOREIGN KEY ("branch_id", "tenant_id")
          REFERENCES "branches"("id", "tenant_id") ON DELETE RESTRICT,
        CONSTRAINT "fk_appointment_status_transitions_changed_by_user_id"
          FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_appointment_status_transitions_appointment_occurred_at_id" ON "appointment_status_transitions" ("appointment_id", "occurred_at", "id")',
    );
    await queryRunner.query(`
      CREATE FUNCTION "prevent_appointment_status_transition_mutation"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'appointment_status_transitions are append-only';
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_appointment_status_transitions_append_only"
      BEFORE UPDATE OR DELETE ON "appointment_status_transitions"
      FOR EACH ROW EXECUTE FUNCTION "prevent_appointment_status_transition_mutation"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER "trg_appointment_status_transitions_append_only" ON "appointment_status_transitions"',
    );
    await queryRunner.query(
      'DROP FUNCTION "prevent_appointment_status_transition_mutation"',
    );
    await queryRunner.query('DROP TABLE "appointment_status_transitions"');
    await queryRunner.query('DROP TABLE "appointments"');
    await queryRunner.query('DROP TYPE "appointment_source_enum"');
    await queryRunner.query('DROP TYPE "appointment_status_enum"');
  }
}
