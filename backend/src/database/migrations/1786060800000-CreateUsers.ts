import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1786060800000 implements MigrationInterface {
  name = 'CreateUsers1786060800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query(
      `CREATE TYPE "user_status_enum" AS ENUM ('ACTIVE', 'DISABLED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying(254) NOT NULL,
        "email_normalized" character varying(254) NOT NULL,
        "full_name" character varying(150) NOT NULL,
        "status" "user_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "password_hash" character varying(255) NOT NULL,
        "password_changed_at" TIMESTAMP WITH TIME ZONE,
        "failed_login_attempts" smallint NOT NULL DEFAULT 0,
        "locked_until" TIMESTAMP WITH TIME ZONE,
        "last_login_at" TIMESTAMP WITH TIME ZONE,
        "email_verified_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "pk_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_users_email_normalized" UNIQUE ("email_normalized")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "users"');
    await queryRunner.query('DROP TYPE "user_status_enum"');
  }
}
