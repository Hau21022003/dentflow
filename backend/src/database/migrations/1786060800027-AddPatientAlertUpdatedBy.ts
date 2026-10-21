import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientAlertUpdatedBy1786060800027 implements MigrationInterface {
  name = 'AddPatientAlertUpdatedBy1786060800027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "patient_alerts" ADD COLUMN "updated_by_user_id" uuid',
    );
    await queryRunner.query(`
      UPDATE "patient_alerts"
      SET "updated_by_user_id" = COALESCE("resolved_by_user_id", "created_by_user_id")
    `);
    await queryRunner.query(
      'ALTER TABLE "patient_alerts" ALTER COLUMN "updated_by_user_id" SET NOT NULL',
    );
    await queryRunner.query(`
      ALTER TABLE "patient_alerts"
      ADD CONSTRAINT "fk_patient_alerts_updated_by"
      FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "patient_alerts" DROP CONSTRAINT "fk_patient_alerts_updated_by"',
    );
    await queryRunner.query(
      'ALTER TABLE "patient_alerts" DROP COLUMN "updated_by_user_id"',
    );
  }
}
