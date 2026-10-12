import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOperatoryType1786060800025 implements MigrationInterface {
  name = 'AddOperatoryType1786060800025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "operatory_type_enum" AS ENUM ('ROOM', 'CHAIR')`,
    );
    await queryRunner.query(
      `ALTER TABLE "operatories" ADD COLUMN "type" "operatory_type_enum" NOT NULL DEFAULT 'CHAIR'`,
    );
    await queryRunner.query(
      `UPDATE "operatories" SET "type" = 'ROOM' WHERE "name" ~* '(^|[^[:alpha:]])room([^[:alpha:]]|$)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "operatories" ALTER COLUMN "type" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "operatories" DROP COLUMN "type"');
    await queryRunner.query('DROP TYPE "operatory_type_enum"');
  }
}
