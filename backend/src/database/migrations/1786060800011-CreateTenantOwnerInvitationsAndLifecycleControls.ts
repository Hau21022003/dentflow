import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantOwnerInvitationsAndLifecycleControls1786060800011 implements MigrationInterface {
  name = 'CreateTenantOwnerInvitationsAndLifecycleControls1786060800011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
        ADD COLUMN IF NOT EXISTS "owner_user_id" uuid,
        ADD COLUMN IF NOT EXISTS "admin_suspended_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "admin_suspended_by_user_id" uuid
    `);
    await queryRunner.query(
      `DO $$ BEGIN
        CREATE TYPE "tenant_owner_invitation_status_enum" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
        CREATE TYPE "tenant_owner_invitation_delivery_status_enum" AS ENUM ('PENDING', 'SENT', 'FAILED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_owner_invitations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "owner_email" character varying(254) NOT NULL,
        "owner_email_normalized" character varying(254) NOT NULL,
        "owner_full_name" character varying(150) NOT NULL,
        "token_hash" character(64) NOT NULL,
        "status" "tenant_owner_invitation_status_enum" NOT NULL DEFAULT 'PENDING',
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "accepted_at" TIMESTAMP WITH TIME ZONE,
        "accepted_by_user_id" uuid,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "delivery_status" "tenant_owner_invitation_delivery_status_enum" NOT NULL DEFAULT 'PENDING',
        "last_sent_at" TIMESTAMP WITH TIME ZONE,
        "last_delivery_error_code" character varying(100),
        "created_by_user_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_tenant_owner_invitations_id" PRIMARY KEY ("id"),
        CONSTRAINT "fk_tenant_owner_invitations_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_tenant_owner_invitations_accepted_by_user_id"
          FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_tenant_owner_invitations_created_by_user_id"
          FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    // A previous local prototype used shorter column names. Keep this
    // migration safe for those databases while fresh installations create the
    // canonical schema above.
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_owner_invitations' AND column_name = 'email')
          AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_owner_invitations' AND column_name = 'owner_email') THEN
          ALTER TABLE "tenant_owner_invitations" RENAME COLUMN "email" TO "owner_email";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_owner_invitations' AND column_name = 'email_normalized')
          AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_owner_invitations' AND column_name = 'owner_email_normalized') THEN
          ALTER TABLE "tenant_owner_invitations" RENAME COLUMN "email_normalized" TO "owner_email_normalized";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_owner_invitations' AND column_name = 'full_name')
          AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_owner_invitations' AND column_name = 'owner_full_name') THEN
          ALTER TABLE "tenant_owner_invitations" RENAME COLUMN "full_name" TO "owner_full_name";
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_owner_invitations' AND column_name = 'invited_by_user_id')
          AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_owner_invitations' AND column_name = 'created_by_user_id') THEN
          ALTER TABLE "tenant_owner_invitations" RENAME COLUMN "invited_by_user_id" TO "created_by_user_id";
        END IF;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE "tenant_owner_invitations"
        ADD COLUMN IF NOT EXISTS "status" "tenant_owner_invitation_status_enum" NOT NULL DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "last_delivery_error_code" character varying(100)
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tenant_owner_invitations'
            AND column_name = 'delivery_status'
            AND udt_name = 'owner_invitation_delivery_status_enum'
        ) THEN
          ALTER TABLE "tenant_owner_invitations"
            ALTER COLUMN "delivery_status" DROP DEFAULT,
            ALTER COLUMN "delivery_status" TYPE "tenant_owner_invitation_delivery_status_enum"
              USING (
                CASE
                  WHEN "delivery_status"::text IN ('SIMULATED', 'QUEUED') THEN 'PENDING'
                  WHEN "delivery_status"::text = 'FAILED' THEN 'FAILED'
                  ELSE 'PENDING'
                END
              )::"tenant_owner_invitation_delivery_status_enum",
            ALTER COLUMN "delivery_status" SET DEFAULT 'PENDING';
        END IF;
      END $$
    `);
    await queryRunner.query(
      'ALTER TABLE "tenant_owner_invitations" DROP CONSTRAINT IF EXISTS "uq_tenant_owner_invitations_tenant_id"',
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_tenant_owner_invitations_pending_tenant"
      ON "tenant_owner_invitations" ("tenant_id")
      WHERE "status" = 'PENDING'
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_tenant_owner_invitations_tenant_status" ON "tenant_owner_invitations" ("tenant_id", "status")',
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_subscriptions_tenant_open"
      ON "subscriptions" ("tenant_id")
      WHERE "canceled_at" IS NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "tenants" ADD CONSTRAINT "fk_tenants_owner_user_id"
          FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "tenants" ADD CONSTRAINT "fk_tenants_admin_suspended_by_user_id"
          FOREIGN KEY ("admin_suspended_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "uq_subscriptions_tenant_open"');
    await queryRunner.query('DROP TABLE "tenant_owner_invitations"');
    await queryRunner.query(
      'DROP TYPE "tenant_owner_invitation_delivery_status_enum"',
    );
    await queryRunner.query('DROP TYPE "tenant_owner_invitation_status_enum"');
    await queryRunner.query(`
      ALTER TABLE "tenants"
        DROP CONSTRAINT "fk_tenants_admin_suspended_by_user_id",
        DROP CONSTRAINT "fk_tenants_owner_user_id",
        DROP COLUMN "admin_suspended_by_user_id",
        DROP COLUMN "admin_suspended_at",
        DROP COLUMN "owner_user_id"
    `);
  }
}
