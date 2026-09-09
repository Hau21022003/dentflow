import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Compatibility for databases that ran the original draft of migration 0013.
 * New installations do not create this column, so both statements are no-ops.
 */
export class DropTenantOwnerInvitationEmailTemplateRevision1786060800014 implements MigrationInterface {
  name = 'DropTenantOwnerInvitationEmailTemplateRevision1786060800014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenant_owner_invitations"
        DROP CONSTRAINT IF EXISTS "fk_tenant_owner_invitations_email_template_revision_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "tenant_owner_invitations"
        DROP COLUMN IF EXISTS "email_template_revision_id"
    `);
  }

  public down(_queryRunner: QueryRunner): Promise<void> {
    return Promise.resolve();
  }
}
