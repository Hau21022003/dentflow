import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptions1786060800009 implements MigrationInterface {
  name = 'CreateSubscriptions1786060800009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "subscription_status_enum" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'SUSPENDED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "plan_id" uuid NOT NULL,
        "provider_customer_id" character varying(255),
        "provider_subscription_id" character varying(255),
        "status" "subscription_status_enum" NOT NULL,
        "current_period_start" TIMESTAMP WITH TIME ZONE,
        "current_period_end" TIMESTAMP WITH TIME ZONE,
        "canceled_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_subscriptions_id" PRIMARY KEY ("id"),
        CONSTRAINT "fk_subscriptions_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_subscriptions_plan_id"
          FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_subscription_plans_provider_plan_id" ON "subscription_plans" ("provider_plan_id") WHERE "provider_plan_id" IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_subscriptions_provider_subscription_id" ON "subscriptions" ("provider_subscription_id") WHERE "provider_subscription_id" IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_subscriptions_plan_id" ON "subscriptions" ("plan_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_subscriptions_tenant_id_status" ON "subscriptions" ("tenant_id", "status")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "subscriptions"');
    await queryRunner.query('DROP TYPE "subscription_status_enum"');
    await queryRunner.query(
      'DROP INDEX "uq_subscription_plans_provider_plan_id"',
    );
  }
}
