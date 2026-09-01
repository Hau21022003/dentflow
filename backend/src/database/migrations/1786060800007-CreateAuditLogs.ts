import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogs1786060800007 implements MigrationInterface {
  name = 'CreateAuditLogs1786060800007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "audit_domain_enum" AS ENUM ('PLATFORM', 'TENANT_ADMIN', 'CLINICAL', 'FINANCIAL', 'SECURITY')`,
    );
    await queryRunner.query(
      `CREATE TYPE "audit_actor_type_enum" AS ENUM ('USER', 'SYSTEM', 'WEBHOOK')`,
    );
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid,
        "branch_id" uuid,
        "actor_type" "audit_actor_type_enum" NOT NULL,
        "actor_user_id" uuid,
        "actor_session_id" uuid,
        "domain" "audit_domain_enum" NOT NULL,
        "action" character varying(100) NOT NULL,
        "resource_type" character varying(80) NOT NULL,
        "resource_id" uuid NOT NULL,
        "reason" character varying(500),
        "before" jsonb,
        "after" jsonb,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "request_id" uuid NOT NULL,
        "source_ip_hmac" character varying(64),
        "user_agent" character varying(512),
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_audit_logs_id" PRIMARY KEY ("id"),
        CONSTRAINT "chk_audit_logs_tenant_scope"
          CHECK ("tenant_id" IS NOT NULL OR "domain" IN ('PLATFORM', 'SECURITY')),
        CONSTRAINT "chk_audit_logs_branch_scope"
          CHECK ("branch_id" IS NULL OR "tenant_id" IS NOT NULL),
        CONSTRAINT "chk_audit_logs_user_actor"
          CHECK ("actor_type" <> 'USER' OR "actor_user_id" IS NOT NULL),
        CONSTRAINT "fk_audit_logs_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_audit_logs_branch_in_same_tenant"
          FOREIGN KEY ("branch_id", "tenant_id")
          REFERENCES "branches"("id", "tenant_id") ON DELETE RESTRICT,
        CONSTRAINT "fk_audit_logs_actor_user_id"
          FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_audit_logs_tenant_occurred_at" ON "audit_logs" ("tenant_id", "occurred_at" DESC, "id" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_audit_logs_branch_occurred_at" ON "audit_logs" ("branch_id", "occurred_at" DESC, "id" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_audit_logs_actor_occurred_at" ON "audit_logs" ("actor_user_id", "occurred_at" DESC, "id" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_audit_logs_resource_occurred_at" ON "audit_logs" ("resource_type", "resource_id", "occurred_at" DESC, "id" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_audit_logs_domain_occurred_at" ON "audit_logs" ("domain", "occurred_at" DESC, "id" DESC)',
    );
    await queryRunner.query(`
      CREATE FUNCTION "prevent_audit_log_mutation"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs are append-only';
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_audit_logs_append_only"
      BEFORE UPDATE OR DELETE ON "audit_logs"
      FOR EACH ROW EXECUTE FUNCTION "prevent_audit_log_mutation"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER "trg_audit_logs_append_only" ON "audit_logs"',
    );
    await queryRunner.query('DROP FUNCTION "prevent_audit_log_mutation"');
    await queryRunner.query('DROP TABLE "audit_logs"');
    await queryRunner.query('DROP TYPE "audit_actor_type_enum"');
    await queryRunner.query('DROP TYPE "audit_domain_enum"');
  }
}
