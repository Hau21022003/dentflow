import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantCatalogCreatedAtIndex1786060800012 implements MigrationInterface {
  name = 'AddTenantCatalogCreatedAtIndex1786060800012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_tenants_created_at_id" ON "tenants" ("created_at" DESC, "id" DESC)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_tenants_created_at_id"');
  }
}
