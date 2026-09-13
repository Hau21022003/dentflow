import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStaffInvitationEmailTemplateKey1786060800016 implements MigrationInterface {
  name = 'AddStaffInvitationEmailTemplateKey1786060800016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "email_template_revisions"
      DROP CONSTRAINT "chk_email_template_revisions_key"
    `);
    await queryRunner.query(`
      ALTER TABLE "email_template_revisions"
      ADD CONSTRAINT "chk_email_template_revisions_key"
      CHECK ("template_key" IN ('tenant-owner-invitation', 'staff-invitation'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "email_template_revisions"
      WHERE "template_key" = 'staff-invitation'
    `);
    await queryRunner.query(`
      ALTER TABLE "email_template_revisions"
      DROP CONSTRAINT "chk_email_template_revisions_key"
    `);
    await queryRunner.query(`
      ALTER TABLE "email_template_revisions"
      ADD CONSTRAINT "chk_email_template_revisions_key"
      CHECK ("template_key" IN ('tenant-owner-invitation'))
    `);
  }
}
