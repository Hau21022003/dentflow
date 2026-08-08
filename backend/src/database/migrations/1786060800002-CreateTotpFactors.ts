import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTotpFactors1786060800002 implements MigrationInterface {
  name = 'CreateTotpFactors1786060800002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "totp_factors" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "secret_encrypted" text NOT NULL,
        "verified_at" TIMESTAMP WITH TIME ZONE,
        "last_used_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_totp_factors_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_totp_factors_user_id" UNIQUE ("user_id"),
        CONSTRAINT "fk_totp_factors_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "totp_factors"');
  }
}
