import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAvatarObjectKey1786060800019 implements MigrationInterface {
  name = 'AddUserAvatarObjectKey1786060800019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD "avatar_object_key" character varying(500)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "avatar_object_key"',
    );
  }
}
