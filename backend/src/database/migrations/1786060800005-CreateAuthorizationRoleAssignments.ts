import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthorizationRoleAssignments1786060800005 implements MigrationInterface {
  name = 'CreateAuthorizationRoleAssignments1786060800005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "platform_role_code_enum" AS ENUM ('PLATFORM_ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "tenant_role_code_enum" AS ENUM ('TENANT_ADMIN', 'BRANCH_ADMIN', 'RECEPTIONIST', 'DENTIST')`,
    );
    await queryRunner.query(`
      CREATE TABLE "platform_role_assignments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "role_code" "platform_role_code_enum" NOT NULL,
        "assigned_by_user_id" uuid,
        "assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "assignment_reason" character varying(500),
        "revoked_by_user_id" uuid,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "revocation_reason" character varying(500),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_platform_role_assignments_id" PRIMARY KEY ("id"),
        CONSTRAINT "fk_platform_role_assignments_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_platform_role_assignments_assigned_by_user_id"
          FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_platform_role_assignments_revoked_by_user_id"
          FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "role_assignments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "branch_id" uuid,
        "role_code" "tenant_role_code_enum" NOT NULL,
        "assigned_by_user_id" uuid,
        "assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "assignment_reason" character varying(500),
        "revoked_by_user_id" uuid,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "revocation_reason" character varying(500),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_role_assignments_id" PRIMARY KEY ("id"),
        CONSTRAINT "chk_role_assignments_scope" CHECK (
          ("role_code" = 'TENANT_ADMIN' AND "branch_id" IS NULL)
          OR
          ("role_code" IN ('BRANCH_ADMIN', 'RECEPTIONIST', 'DENTIST') AND "branch_id" IS NOT NULL)
        ),
        CONSTRAINT "fk_role_assignments_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_role_assignments_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_role_assignments_branch_in_same_tenant"
          FOREIGN KEY ("branch_id", "tenant_id")
          REFERENCES "branches"("id", "tenant_id") ON DELETE RESTRICT,
        CONSTRAINT "fk_role_assignments_assigned_by_user_id"
          FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_role_assignments_revoked_by_user_id"
          FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_active_platform_role_assignment"
      ON "platform_role_assignments" ("user_id", "role_code")
      WHERE "revoked_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_active_platform_role_assignments_by_user"
      ON "platform_role_assignments" ("user_id")
      WHERE "revoked_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_active_tenant_wide_role_assignment"
      ON "role_assignments" ("user_id", "tenant_id", "role_code")
      WHERE "revoked_at" IS NULL AND "branch_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_active_branch_role_assignment"
      ON "role_assignments" ("user_id", "tenant_id", "role_code", "branch_id")
      WHERE "revoked_at" IS NULL AND "branch_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_active_role_assignments_for_authorization"
      ON "role_assignments" ("user_id", "tenant_id", "branch_id", "role_code")
      WHERE "revoked_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "role_assignments"');
    await queryRunner.query('DROP TABLE "platform_role_assignments"');
    await queryRunner.query('DROP TYPE "tenant_role_code_enum"');
    await queryRunner.query('DROP TYPE "platform_role_code_enum"');
  }
}
