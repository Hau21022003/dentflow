import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateServiceGroups1786060800018 implements MigrationInterface {
  name = 'CreateServiceGroups1786060800018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "service_groups" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_service_groups_id" PRIMARY KEY ("id"),
        CONSTRAINT "chk_service_groups_name_not_blank"
          CHECK (length(btrim("name")) > 0),
        CONSTRAINT "fk_service_groups_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_service_groups_id_tenant_id" ON "service_groups" ("id", "tenant_id")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_service_groups_tenant_id_lower_name" ON "service_groups" ("tenant_id", lower("name"))',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_service_groups_tenant_id_is_active_name_id" ON "service_groups" ("tenant_id", "is_active", "name", "id")',
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM "services"
          WHERE length(
            regexp_replace(btrim("group_name"), '[[:space:]]+', ' ', 'g')
          ) = 0
        ) THEN
          RAISE EXCEPTION
            'Cannot migrate services with a blank group_name; remediate the catalog before applying CreateServiceGroups1786060800018.';
        END IF;
      END;
      $$;
    `);
    await queryRunner.query(`
      INSERT INTO "service_groups" ("tenant_id", "name")
      SELECT DISTINCT ON ("tenant_id", lower("normalized_name"))
        "tenant_id",
        "normalized_name"
      FROM (
        SELECT
          "tenant_id",
          regexp_replace(btrim("group_name"), '[[:space:]]+', ' ', 'g') AS "normalized_name",
          "created_at",
          "id"
        FROM "services"
      ) AS "normalized_services"
      ORDER BY "tenant_id", lower("normalized_name"), "created_at", "id"
    `);
    await queryRunner.query(
      'ALTER TABLE "services" ADD "service_group_id" uuid',
    );
    await queryRunner.query(`
      UPDATE "services" AS "service"
      SET "service_group_id" = "service_group"."id"
      FROM "service_groups" AS "service_group"
      WHERE "service_group"."tenant_id" = "service"."tenant_id"
        AND lower("service_group"."name") = lower(
          regexp_replace(btrim("service"."group_name"), '[[:space:]]+', ' ', 'g')
        )
    `);
    await queryRunner.query(
      'ALTER TABLE "services" ALTER COLUMN "service_group_id" SET NOT NULL',
    );
    await queryRunner.query(`
      ALTER TABLE "services"
      ADD CONSTRAINT "fk_services_service_group_in_same_tenant"
      FOREIGN KEY ("service_group_id", "tenant_id")
      REFERENCES "service_groups"("id", "tenant_id") ON DELETE RESTRICT
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_services_tenant_id_service_group_id" ON "services" ("tenant_id", "service_group_id")',
    );
    await queryRunner.query('ALTER TABLE "services" DROP COLUMN "group_name"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "services" ADD "group_name" character varying(100)',
    );
    await queryRunner.query(`
      UPDATE "services" AS "service"
      SET "group_name" = "service_group"."name"
      FROM "service_groups" AS "service_group"
      WHERE "service_group"."id" = "service"."service_group_id"
        AND "service_group"."tenant_id" = "service"."tenant_id"
    `);
    await queryRunner.query(
      'ALTER TABLE "services" ALTER COLUMN "group_name" SET NOT NULL',
    );
    await queryRunner.query(
      'DROP INDEX "idx_services_tenant_id_service_group_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "services" DROP CONSTRAINT "fk_services_service_group_in_same_tenant"',
    );
    await queryRunner.query(
      'ALTER TABLE "services" DROP COLUMN "service_group_id"',
    );
    await queryRunner.query('DROP TABLE "service_groups"');
  }
}
