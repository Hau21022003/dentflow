import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantStaffManagement1786060800015 implements MigrationInterface {
  name = 'CreateTenantStaffManagement1786060800015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "tenant_user_membership_status_enum" AS ENUM ('ACTIVE', 'DISABLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "staff_invitation_status_enum" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "staff_invitation_delivery_status_enum" AS ENUM ('PENDING', 'SENT', 'FAILED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "tenant_user_memberships" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "status" "tenant_user_membership_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "disabled_at" TIMESTAMP WITH TIME ZONE,
        "disabled_by_user_id" uuid,
        "disabled_reason" character varying(500),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_tenant_user_memberships_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_tenant_user_memberships_tenant_user" UNIQUE ("tenant_id", "user_id"),
        CONSTRAINT "uq_tenant_user_memberships_user_tenant" UNIQUE ("user_id", "tenant_id"),
        CONSTRAINT "fk_tenant_user_memberships_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_tenant_user_memberships_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_tenant_user_memberships_disabled_by_user_id"
          FOREIGN KEY ("disabled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_tenant_user_memberships_disabled_state" CHECK (
          ("status" = 'ACTIVE' AND "disabled_at" IS NULL AND "disabled_by_user_id" IS NULL AND "disabled_reason" IS NULL)
          OR
          ("status" = 'DISABLED' AND "disabled_at" IS NOT NULL AND "disabled_by_user_id" IS NOT NULL AND "disabled_reason" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(`
      INSERT INTO "tenant_user_memberships" ("tenant_id", "user_id", "status")
      SELECT DISTINCT "tenant_id", "user_id", 'ACTIVE'::"tenant_user_membership_status_enum"
      FROM "role_assignments"
      ON CONFLICT ("tenant_id", "user_id") DO NOTHING
    `);
    await queryRunner.query(`
      ALTER TABLE "role_assignments"
      ADD CONSTRAINT "fk_role_assignments_active_membership"
      FOREIGN KEY ("user_id", "tenant_id")
      REFERENCES "tenant_user_memberships"("user_id", "tenant_id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE TABLE "staff_invitations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "email" character varying(254) NOT NULL,
        "email_normalized" character varying(254) NOT NULL,
        "full_name" character varying(150) NOT NULL,
        "token_hash" character(64) NOT NULL,
        "status" "staff_invitation_status_enum" NOT NULL DEFAULT 'PENDING',
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "accepted_at" TIMESTAMP WITH TIME ZONE,
        "accepted_by_user_id" uuid,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "delivery_status" "staff_invitation_delivery_status_enum" NOT NULL DEFAULT 'PENDING',
        "last_sent_at" TIMESTAMP WITH TIME ZONE,
        "last_delivery_error_code" character varying(100),
        "created_by_user_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_staff_invitations_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_staff_invitations_id_tenant" UNIQUE ("id", "tenant_id"),
        CONSTRAINT "fk_staff_invitations_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_staff_invitations_accepted_by_user_id"
          FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_staff_invitations_created_by_user_id"
          FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_staff_invitations_pending_tenant_email"
      ON "staff_invitations" ("tenant_id", "email_normalized")
      WHERE "status" = 'PENDING'
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_staff_invitations_tenant_status" ON "staff_invitations" ("tenant_id", "status")`,
    );
    await queryRunner.query(`
      CREATE TABLE "staff_invitation_assignments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "staff_invitation_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "branch_id" uuid,
        "role_code" "tenant_role_code_enum" NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_staff_invitation_assignments_id" PRIMARY KEY ("id"),
        CONSTRAINT "chk_staff_invitation_assignments_scope" CHECK (
          ("role_code" = 'TENANT_ADMIN' AND "branch_id" IS NULL)
          OR
          ("role_code" IN ('BRANCH_ADMIN', 'RECEPTIONIST', 'DENTIST') AND "branch_id" IS NOT NULL)
        ),
        CONSTRAINT "fk_staff_invitation_assignments_invitation"
          FOREIGN KEY ("staff_invitation_id", "tenant_id")
          REFERENCES "staff_invitations"("id", "tenant_id") ON DELETE RESTRICT,
        CONSTRAINT "fk_staff_invitation_assignments_branch_same_tenant"
          FOREIGN KEY ("branch_id", "tenant_id")
          REFERENCES "branches"("id", "tenant_id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_staff_invitation_tenant_wide_assignment"
      ON "staff_invitation_assignments" ("staff_invitation_id", "role_code")
      WHERE "branch_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_staff_invitation_branch_assignment"
      ON "staff_invitation_assignments" ("staff_invitation_id", "role_code", "branch_id")
      WHERE "branch_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "staff_invitation_assignments"');
    await queryRunner.query('DROP TABLE "staff_invitations"');
    await queryRunner.query(
      'ALTER TABLE "role_assignments" DROP CONSTRAINT "fk_role_assignments_active_membership"',
    );
    await queryRunner.query('DROP TABLE "tenant_user_memberships"');
    await queryRunner.query(
      'DROP TYPE "staff_invitation_delivery_status_enum"',
    );
    await queryRunner.query('DROP TYPE "staff_invitation_status_enum"');
    await queryRunner.query('DROP TYPE "tenant_user_membership_status_enum"');
  }
}
