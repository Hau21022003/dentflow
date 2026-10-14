import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientAppointmentHistoryIndex1786060800026 implements MigrationInterface {
  name = 'AddPatientAppointmentHistoryIndex1786060800026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX "idx_appointments_patient_start_at_id" ON "appointments" ("tenant_id", "branch_id", "patient_id", "start_at", "id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "public"."idx_appointments_patient_start_at_id"',
    );
  }
}
