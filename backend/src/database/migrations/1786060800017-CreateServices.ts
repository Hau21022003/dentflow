import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateServices1786060800017 implements MigrationInterface {
  name = 'CreateServices1786060800017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "services" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "code" character varying(100) NOT NULL,
        "name" character varying(150) NOT NULL,
        "group_name" character varying(100) NOT NULL,
        "amount" integer NOT NULL,
        "currency" character(3) NOT NULL,
        "duration_minutes" smallint NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_services_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_services_tenant_id_code" UNIQUE ("tenant_id", "code"),
        CONSTRAINT "chk_services_code_format"
          CHECK ("code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
        CONSTRAINT "chk_services_amount_non_negative"
          CHECK ("amount" >= 0),
        CONSTRAINT "chk_services_currency_format"
          CHECK ("currency" ~ '^[A-Z]{3}$'),
        CONSTRAINT "chk_services_duration_minutes_positive"
          CHECK ("duration_minutes" > 0),
        CONSTRAINT "fk_services_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_services_tenant_id_is_active_name_id" ON "services" ("tenant_id", "is_active", "name", "id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "services"');
  }
}
