import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthSessions1786060800001 implements MigrationInterface {
  name = 'CreateAuthSessions1786060800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "auth_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "refresh_token_id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "refresh_token_hash" character varying(255) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "last_used_at" TIMESTAMP WITH TIME ZONE,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_auth_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_auth_sessions_refresh_token_id" UNIQUE ("refresh_token_id"),
        CONSTRAINT "fk_auth_sessions_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_auth_sessions_user_id" ON "auth_sessions" ("user_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "auth_sessions"');
  }
}
