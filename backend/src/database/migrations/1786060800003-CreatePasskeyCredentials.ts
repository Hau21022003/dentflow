import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePasskeyCredentials1786060800003 implements MigrationInterface {
  name = 'CreatePasskeyCredentials1786060800003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "passkey_credentials" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "credential_id" character varying(1024) NOT NULL,
        "public_key" bytea NOT NULL,
        "sign_count" bigint NOT NULL DEFAULT 0,
        "transports" text[] NOT NULL DEFAULT '{}'::text[],
        "aaguid" character varying(36),
        "device_type" character varying(32),
        "backed_up" boolean NOT NULL DEFAULT false,
        "label" character varying(100),
        "last_used_at" TIMESTAMP WITH TIME ZONE,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_passkey_credentials_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_passkey_credentials_credential_id" UNIQUE ("credential_id"),
        CONSTRAINT "fk_passkey_credentials_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_passkey_credentials_user_id" ON "passkey_credentials" ("user_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "passkey_credentials"');
  }
}
