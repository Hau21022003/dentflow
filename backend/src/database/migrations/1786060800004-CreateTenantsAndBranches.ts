import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantsAndBranches1786060800004 implements MigrationInterface {
  name = 'CreateTenantsAndBranches1786060800004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "tenant_status_enum" AS ENUM ('PROVISIONING', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "branch_status_enum" AS ENUM ('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(`
      CREATE TABLE "tenants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "legal_name" character varying(200) NOT NULL,
        "display_name" character varying(150) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "billing_email" character varying(254) NOT NULL,
        "contact_email" character varying(254),
        "contact_phone" character varying(30),
        "logo_url" character varying(2048),
        "default_locale" character varying(10) NOT NULL DEFAULT 'vi',
        "default_timezone" character varying(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
        "status" "tenant_status_enum" NOT NULL DEFAULT 'PROVISIONING',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_tenants_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_tenants_slug" UNIQUE ("slug"),
        CONSTRAINT "chk_tenants_slug_format"
          CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "branches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "name" character varying(150) NOT NULL,
        "address" character varying(500) NOT NULL,
        "phone" character varying(30) NOT NULL,
        "timezone" character varying(64),
        "status" "branch_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_branches_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_branches_id_tenant_id" UNIQUE ("id", "tenant_id"),
        CONSTRAINT "fk_branches_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_branches_tenant_id_status" ON "branches" ("tenant_id", "status")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "branches"');
    await queryRunner.query('DROP TABLE "tenants"');
    await queryRunner.query('DROP TYPE "branch_status_enum"');
    await queryRunner.query('DROP TYPE "tenant_status_enum"');
  }
}
