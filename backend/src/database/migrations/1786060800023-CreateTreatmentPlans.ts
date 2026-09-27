import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTreatmentPlans1786060800023 implements MigrationInterface {
  name = 'CreateTreatmentPlans1786060800023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "treatment_plan_status_enum" AS ENUM ('DRAFT','PROPOSED','ACCEPTED','PARTIALLY_COMPLETED','COMPLETED','CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "treatment_item_status_enum" AS ENUM ('PENDING','IN_PROGRESS','COMPLETED','CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "treatment_item_event_type_enum" AS ENUM ('IN_PROGRESS','COMPLETED','CANCELLED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "treatment_plans" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(), "tenant_id" uuid NOT NULL,
        "branch_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "origin_visit_id" uuid NOT NULL,
        "created_by_user_id" uuid NOT NULL, "status" "treatment_plan_status_enum" NOT NULL DEFAULT 'DRAFT',
        "accepted_by_user_id" uuid, "accepted_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_treatment_plans_id" PRIMARY KEY ("id"),
        CONSTRAINT "fk_treatment_plans_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_treatment_plans_branch" FOREIGN KEY ("branch_id", "tenant_id") REFERENCES "branches"("id", "tenant_id") ON DELETE RESTRICT,
        CONSTRAINT "fk_treatment_plans_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_treatment_plans_origin_visit" FOREIGN KEY ("origin_visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_treatment_plans_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_treatment_plans_accepted_by" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_treatment_plans_acceptance_pair" CHECK (("accepted_by_user_id" IS NULL) = ("accepted_at" IS NULL))
      )`);
    await queryRunner.query(
      'CREATE INDEX "idx_treatment_plans_tenant_branch_patient" ON "treatment_plans" ("tenant_id", "branch_id", "patient_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_treatment_plans_origin_visit" ON "treatment_plans" ("origin_visit_id")',
    );
    await queryRunner.query(`
      CREATE TABLE "treatment_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(), "treatment_plan_id" uuid NOT NULL,
        "service_id" uuid NOT NULL, "service_code" varchar(100) NOT NULL, "service_name" varchar(150) NOT NULL,
        "list_unit_amount" integer NOT NULL, "currency" char(3) NOT NULL, "quantity" integer NOT NULL,
        "discount_amount" integer NOT NULL DEFAULT 0, "final_unit_amount" integer NOT NULL,
        "tooth_position" varchar(100), "indication" text, "planned_dentist_user_id" uuid NOT NULL,
        "status" "treatment_item_status_enum" NOT NULL DEFAULT 'PENDING',
        "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_treatment_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_treatment_items_id_plan" UNIQUE ("id", "treatment_plan_id"),
        CONSTRAINT "fk_treatment_items_plan" FOREIGN KEY ("treatment_plan_id") REFERENCES "treatment_plans"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_treatment_items_service" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_treatment_items_planned_dentist" FOREIGN KEY ("planned_dentist_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_treatment_items_quantity" CHECK ("quantity" > 0),
        CONSTRAINT "chk_treatment_items_amounts" CHECK ("list_unit_amount" >= 0 AND "discount_amount" >= 0 AND "discount_amount" <= "list_unit_amount" AND "final_unit_amount" = "list_unit_amount" - "discount_amount"),
        CONSTRAINT "chk_treatment_items_currency" CHECK ("currency" ~ '^[A-Z]{3}$'),
        CONSTRAINT "chk_treatment_items_tooth_position" CHECK ("tooth_position" IS NULL OR length(btrim("tooth_position")) > 0),
        CONSTRAINT "chk_treatment_items_indication" CHECK ("indication" IS NULL OR length(btrim("indication")) > 0)
      )`);
    await queryRunner.query(
      'CREATE INDEX "idx_treatment_items_plan" ON "treatment_items" ("treatment_plan_id", "id")',
    );
    await queryRunner.query(`
      CREATE TABLE "treatment_item_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(), "treatment_item_id" uuid NOT NULL,
        "treatment_plan_id" uuid NOT NULL, "visit_id" uuid NOT NULL, "performed_by_user_id" uuid NOT NULL,
        "event_type" "treatment_item_event_type_enum" NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_treatment_item_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "fk_treatment_item_events_item_plan" FOREIGN KEY ("treatment_item_id", "treatment_plan_id") REFERENCES "treatment_items"("id", "treatment_plan_id") ON DELETE RESTRICT,
        CONSTRAINT "fk_treatment_item_events_plan" FOREIGN KEY ("treatment_plan_id") REFERENCES "treatment_plans"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_treatment_item_events_visit" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_treatment_item_events_user" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )`);
    await queryRunner.query(
      'CREATE INDEX "idx_treatment_item_events_item_created_id" ON "treatment_item_events" ("treatment_item_id", "created_at", "id")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_treatment_item_events_visit_created_id" ON "treatment_item_events" ("visit_id", "created_at", "id")',
    );
    await queryRunner.query(
      `CREATE FUNCTION "prevent_treatment_item_event_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'treatment_item_events are append-only'; END; $$`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "trg_treatment_item_events_append_only" BEFORE UPDATE OR DELETE ON "treatment_item_events" FOR EACH ROW EXECUTE FUNCTION "prevent_treatment_item_event_mutation"()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER "trg_treatment_item_events_append_only" ON "treatment_item_events"',
    );
    await queryRunner.query(
      'DROP FUNCTION "prevent_treatment_item_event_mutation"',
    );
    await queryRunner.query('DROP TABLE "treatment_item_events"');
    await queryRunner.query('DROP TABLE "treatment_items"');
    await queryRunner.query('DROP TABLE "treatment_plans"');
    await queryRunner.query('DROP TYPE "treatment_item_event_type_enum"');
    await queryRunner.query('DROP TYPE "treatment_item_status_enum"');
    await queryRunner.query('DROP TYPE "treatment_plan_status_enum"');
  }
}
