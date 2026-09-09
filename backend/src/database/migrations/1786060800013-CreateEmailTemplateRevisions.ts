import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailTemplateRevisions1786060800013 implements MigrationInterface {
  name = 'CreateEmailTemplateRevisions1786060800013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "email_template_revision_status_enum"
      AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED')
    `);
    await queryRunner.query(`
      CREATE TABLE "email_template_revisions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "template_key" character varying(100) NOT NULL,
        "locale" character varying(10) NOT NULL,
        "version" integer NOT NULL,
        "status" "email_template_revision_status_enum" NOT NULL,
        "subject" character varying(500) NOT NULL,
        "text" text NOT NULL,
        "html" text NOT NULL,
        "created_by_user_id" uuid,
        "published_by_user_id" uuid,
        "published_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_email_template_revisions_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_email_template_revisions_key_locale_version"
          UNIQUE ("template_key", "locale", "version"),
        CONSTRAINT "chk_email_template_revisions_key"
          CHECK ("template_key" IN ('tenant-owner-invitation')),
        CONSTRAINT "chk_email_template_revisions_locale"
          CHECK ("locale" IN ('vi', 'en')),
        CONSTRAINT "chk_email_template_revisions_version_positive"
          CHECK ("version" > 0),
        CONSTRAINT "chk_email_template_revisions_publish_state"
          CHECK (
            ("status" = 'DRAFT'
              AND "published_at" IS NULL
              AND "published_by_user_id" IS NULL)
            OR
            ("status" IN ('PUBLISHED', 'ARCHIVED')
              AND "published_at" IS NOT NULL)
          ),
        CONSTRAINT "fk_email_template_revisions_created_by_user_id"
          FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_email_template_revisions_published_by_user_id"
          FOREIGN KEY ("published_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_email_template_revisions_current_draft"
      ON "email_template_revisions" ("template_key", "locale")
      WHERE "status" = 'DRAFT'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_email_template_revisions_current_published"
      ON "email_template_revisions" ("template_key", "locale")
      WHERE "status" = 'PUBLISHED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "uq_email_template_revisions_current_published"',
    );
    await queryRunner.query(
      'DROP INDEX "uq_email_template_revisions_current_draft"',
    );
    await queryRunner.query('DROP TABLE "email_template_revisions"');
    await queryRunner.query('DROP TYPE "email_template_revision_status_enum"');
  }
}
